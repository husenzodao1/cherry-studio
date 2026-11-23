-- The student's Workspace (Premium): her own study materials — lectures, textbooks, syllabi, her notes — read on
-- her phone, cut into passages and kept for her alone; Mahliyo answers her and solves her tasks from them first.
-- Only she reads or removes them (her account); the server searches them with her own session.

create table private.workspace_docs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  file_name text check (char_length(file_name) <= 300),
  subject text check (char_length(subject) <= 120),
  pages integer,
  chunks integer not null default 0,
  status text not null default 'loading' check (status in ('loading', 'ready')),
  created_at timestamptz not null default now()
);
create index workspace_docs_user on private.workspace_docs (user_id, created_at desc);

create table private.workspace_chunks (
  doc_id uuid not null references private.workspace_docs (id) on delete cascade,
  n integer not null,
  page integer,
  text text not null check (char_length(text) <= 4000),
  -- searched as she types: Tajik letters also typed as Russian ones (ӣ/и, ӯ/у, қ/к, ҳ/х, ҷ/ч, ғ/г)
  tsv tsvector generated always as (to_tsvector('simple', translate(lower(text), 'ӣӯқҳҷғё', 'иукхчге'))) stored,
  primary key (doc_id, n)
);
create index workspace_chunks_tsv on private.workspace_chunks using gin (tsv);

-- how much one learner may keep
create or replace function private.workspace_room() returns jsonb
language sql immutable set search_path = '' as $$ select '{"docs": 60, "chunks": 12000}'::jsonb $$;

-- whether she may use it: Premium (staff too), or anyone signed in while the plans are off
create or replace function private.workspace_ok(p_user uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_user is null then return false; end if;
  if coalesce((select value from public.app_settings where key = 'plans_live'), 'false'::jsonb) <> 'true'::jsonb then return true; end if;
  return private.plan_of(p_user) = 'premium';
end $$;

-- her materials, newest first
create or replace function public.api_ws_docs() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then perform private.fail('unauthorized'); end if;
  return jsonb_build_object(
    'allowed', private.workspace_ok(auth.uid()),
    'room', private.workspace_room(),
    'used', (select coalesce(sum(d.chunks), 0) from private.workspace_docs d where d.user_id = auth.uid()),
    'docs', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title, 'file', d.file_name, 'subject', d.subject,
        'pages', d.pages, 'chunks', d.chunks, 'status', d.status, 'at', d.created_at) order by d.created_at desc)
      from private.workspace_docs d where d.user_id = auth.uid()), '[]'::jsonb));
end $$;

create or replace function public.api_ws_start(p_title text, p_file text, p_subject text, p_pages integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then perform private.fail('unauthorized'); end if;
  if not private.workspace_ok(auth.uid()) then perform private.fail('plan_limit', '{"kind": "workspace"}'::jsonb); end if;
  if (select count(*) from private.workspace_docs where user_id = auth.uid()) >= (private.workspace_room() ->> 'docs')::integer then
    perform private.fail('workspace_full');
  end if;
  insert into private.workspace_docs (user_id, title, file_name, subject, pages)
    values (auth.uid(), left(trim(p_title), 300), left(p_file, 300), nullif(left(trim(coalesce(p_subject, '')), 120), ''), p_pages)
    returning id into v_id;
  return v_id;
end $$;

-- a batch of her passages: [{ "n": 0, "page": 1, "text": "…" }, …]
create or replace function public.api_ws_chunks(p_doc uuid, p_chunks jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if not exists (select 1 from private.workspace_docs where id = p_doc and user_id = auth.uid()) then perform private.fail('not_found'); end if;
  if jsonb_typeof(p_chunks) <> 'array' or jsonb_array_length(p_chunks) > 400 then perform private.fail('bad_chunks'); end if;
  if (select count(*) from private.workspace_chunks c join private.workspace_docs d on d.id = c.doc_id where d.user_id = auth.uid())
       + jsonb_array_length(p_chunks) > (private.workspace_room() ->> 'chunks')::integer then
    perform private.fail('workspace_full');
  end if;
  insert into private.workspace_chunks (doc_id, n, page, text)
    select p_doc, (c ->> 'n')::integer, nullif(c ->> 'page', '')::integer, left(c ->> 'text', 4000)
      from jsonb_array_elements(p_chunks) c
     where coalesce(trim(c ->> 'text'), '') <> ''
    on conflict (doc_id, n) do update set page = excluded.page, text = excluded.text;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function public.api_ws_done(p_doc uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update private.workspace_docs set status = 'ready', chunks = (select count(*) from private.workspace_chunks where doc_id = p_doc)
   where id = p_doc and user_id = auth.uid();
  if not found then perform private.fail('not_found'); end if;
end $$;

create or replace function public.api_ws_remove(p_doc uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from private.workspace_docs where id = p_doc and user_id = auth.uid();
  if not found then perform private.fail('not_found'); end if;
end $$;

-- the passages of her materials nearest a question (p_query: "word:* | word:*", built by the server)
create or replace function public.api_ws_search(p_query text, p_limit integer default 5) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_q tsquery;
begin
  if auth.uid() is null or not private.workspace_ok(auth.uid()) then return '[]'::jsonb; end if;
  begin
    v_q := to_tsquery('simple', p_query);
  exception when others then
    return '[]'::jsonb;
  end;
  return coalesce((
    select jsonb_agg(jsonb_build_object('book', r.title, 'page', r.page, 'text', r.text) order by r.rank desc)
      from (select d.title, c.page, c.text, ts_rank_cd(c.tsv, v_q) as rank
              from private.workspace_chunks c join private.workspace_docs d on d.id = c.doc_id
             where d.user_id = auth.uid() and d.status = 'ready' and c.tsv @@ v_q
             order by rank desc limit least(greatest(p_limit, 1), 8)) r), '[]'::jsonb);
end $$;

revoke all on function public.api_ws_docs(), public.api_ws_start(text, text, text, integer), public.api_ws_chunks(uuid, jsonb),
  public.api_ws_done(uuid), public.api_ws_remove(uuid), public.api_ws_search(text, integer) from public, anon;
grant execute on function public.api_ws_docs(), public.api_ws_start(text, text, text, integer), public.api_ws_chunks(uuid, jsonb),
  public.api_ws_done(uuid), public.api_ws_remove(uuid), public.api_ws_search(text, integer) to authenticated;
