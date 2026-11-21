-- Духтари хубам · 0031 Mahliyo AI: the staff choose who answers and teach her from books.
-- • Keys of AI providers (OpenAI, Anthropic, DeepSeek, Google, xAI, Mistral), one per provider, kept only
--   encrypted by the server (AES-256-GCM with a secret only the server has); a key is never read back by
--   anyone but the server. The model that answers is the one whose key was saved last (or chosen).
-- • Books: the staff's panel reads a book's text in the browser and sends it in pieces; the pieces are
--   kept with a full-text index, so the server finds the passages a question is about in milliseconds.
-- What only the server may read (the active key, the books' passages) asks for its proof: a secret whose
-- SHA-256 is below (the secret itself is in the server's environment, MAHLIYO_SERVER_SECRET).
-- Add-only: new tables in the private schema and new functions; a book taken away is only marked so.

create table private.mahliyo_ai_keys (
  provider text primary key check (provider in ('anthropic', 'openai', 'deepseek', 'google', 'xai', 'mistral')),
  key_cipher text check (char_length(key_cipher) <= 4000),
  -- what the staff see of the key: its last four characters
  key_hint text check (char_length(key_hint) <= 12),
  updated_at timestamptz not null default now()
);

create table private.mahliyo_ai_active (
  id smallint primary key default 1 check (id = 1),
  provider text references private.mahliyo_ai_keys (provider),
  model text check (char_length(model) between 1 and 120),
  updated_at timestamptz not null default now()
);

create table private.mahliyo_books (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 300),
  file_name text check (char_length(file_name) <= 300),
  pages integer,
  chunks integer not null default 0,
  status text not null default 'loading' check (status in ('loading', 'ready')),
  created_at timestamptz not null default now(),
  removed_at timestamptz
);

create table private.mahliyo_book_chunks (
  book_id uuid not null references private.mahliyo_books (id),
  n integer not null,
  page integer,
  text text not null check (char_length(text) <= 4000),
  -- searched as learners type: Tajik letters also typed as Russian ones (ӣ/и, ӯ/у, қ/к, ҳ/х, ҷ/ч, ғ/г)
  tsv tsvector generated always as (to_tsvector('simple', translate(lower(text), 'ӣӯқҳҷғё', 'иукхчге'))) stored,
  primary key (book_id, n)
);
create index mahliyo_book_chunks_tsv on private.mahliyo_book_chunks using gin (tsv);

-- the server's proof (see above)
create or replace function private.server_ok(p_proof text) returns boolean
language sql immutable set search_path = '' as $$
  select p_proof is not null and encode(extensions.digest(p_proof, 'sha256'), 'hex') = '3333ec44bb51fc8fc5f644312ec8ec3eb4f88be1e3113c4e01afd2d981f2f1b1'
$$;

-- ── models ──────────────────────────────────────────────────────────────────────────────────────────

-- what the staff see: which providers have a key (its hint, when saved) and which model answers
create or replace function public.admin_ai_settings() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  return jsonb_build_object(
    'keys', coalesce((select jsonb_agg(jsonb_build_object('provider', k.provider, 'hint', k.key_hint, 'at', k.updated_at) order by k.provider)
                      from private.mahliyo_ai_keys k where k.key_cipher is not null), '[]'::jsonb),
    'active', (select jsonb_build_object('provider', a.provider, 'model', a.model, 'at', a.updated_at)
                 from private.mahliyo_ai_active a where a.id = 1 and a.provider is not null));
end $$;

-- a provider's key (already encrypted by the server) saved in a model's box: that model answers from now on
create or replace function public.admin_ai_set_key(p_provider text, p_cipher text, p_hint text, p_model text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  insert into private.mahliyo_ai_keys (provider, key_cipher, key_hint, updated_at) values (p_provider, p_cipher, p_hint, now())
    on conflict (provider) do update set key_cipher = excluded.key_cipher, key_hint = excluded.key_hint, updated_at = now();
  insert into private.mahliyo_ai_active (id, provider, model, updated_at) values (1, p_provider, p_model, now())
    on conflict (id) do update set provider = excluded.provider, model = excluded.model, updated_at = now();
end $$;

-- another model of a provider whose key is saved; or none (null): the app's own default answers
create or replace function public.admin_ai_activate(p_provider text, p_model text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  if p_provider is not null and not exists (select 1 from private.mahliyo_ai_keys where provider = p_provider and key_cipher is not null) then
    perform private.fail('no_key');
  end if;
  insert into private.mahliyo_ai_active (id, provider, model, updated_at) values (1, p_provider, case when p_provider is null then null else p_model end, now())
    on conflict (id) do update set provider = excluded.provider, model = excluded.model, updated_at = now();
end $$;

-- a provider's key forgotten (if its model was answering, the default answers again)
create or replace function public.admin_ai_forget_key(p_provider text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  update private.mahliyo_ai_active set provider = null, model = null, updated_at = now() where id = 1 and provider = p_provider;
  update private.mahliyo_ai_keys set key_cipher = null, key_hint = null, updated_at = now() where provider = p_provider;
end $$;

-- for the server only: the model that answers and its encrypted key
create or replace function public.api_ai_active(p_proof text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.server_ok(p_proof) then perform private.fail('forbidden'); end if;
  return (select jsonb_build_object('provider', a.provider, 'model', a.model, 'cipher', k.key_cipher)
            from private.mahliyo_ai_active a join private.mahliyo_ai_keys k on k.provider = a.provider
           where a.id = 1 and k.key_cipher is not null);
end $$;

-- ── books ───────────────────────────────────────────────────────────────────────────────────────────

create or replace function public.admin_books() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'title', b.title, 'file', b.file_name, 'pages', b.pages,
      'chunks', b.chunks, 'status', b.status, 'at', b.created_at) order by b.created_at desc)
    from private.mahliyo_books b where b.removed_at is null), '[]'::jsonb);
end $$;

create or replace function public.admin_book_start(p_title text, p_file text, p_pages integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  insert into private.mahliyo_books (title, file_name, pages) values (left(trim(p_title), 300), left(p_file, 300), p_pages) returning id into v_id;
  return v_id;
end $$;

-- a batch of a book's passages: [{ "n": 0, "page": 1, "text": "…" }, …]
create or replace function public.admin_book_chunks(p_book uuid, p_chunks jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  if jsonb_typeof(p_chunks) <> 'array' or jsonb_array_length(p_chunks) > 400 then perform private.fail('bad_chunks'); end if;
  insert into private.mahliyo_book_chunks (book_id, n, page, text)
    select p_book, (c ->> 'n')::integer, nullif(c ->> 'page', '')::integer, left(c ->> 'text', 4000)
      from jsonb_array_elements(p_chunks) c
     where coalesce(trim(c ->> 'text'), '') <> ''
    on conflict (book_id, n) do update set page = excluded.page, text = excluded.text;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function public.admin_book_done(p_book uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  update private.mahliyo_books set status = 'ready', chunks = (select count(*) from private.mahliyo_book_chunks where book_id = p_book) where id = p_book;
end $$;

create or replace function public.admin_book_remove(p_book uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  update private.mahliyo_books set removed_at = now() where id = p_book;
end $$;

-- for the server only: the passages nearest a question (p_query: "word:* | word:*", built by the server)
create or replace function public.api_books_search(p_proof text, p_query text, p_limit integer default 4) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_q tsquery;
begin
  if not private.server_ok(p_proof) then perform private.fail('forbidden'); end if;
  begin
    v_q := to_tsquery('simple', p_query);
  exception when others then
    return '[]'::jsonb;
  end;
  return coalesce((
    select jsonb_agg(jsonb_build_object('book', r.title, 'page', r.page, 'text', r.text) order by r.rank desc)
      from (select b.title, c.page, c.text, ts_rank_cd(c.tsv, v_q) as rank
              from private.mahliyo_book_chunks c join private.mahliyo_books b on b.id = c.book_id
             where c.tsv @@ v_q and b.removed_at is null and b.status = 'ready'
             order by rank desc limit least(greatest(p_limit, 1), 8)) r), '[]'::jsonb);
end $$;

-- whether any book is there (the app says it is searching them when an answer takes a while)
create or replace function public.api_books_count() returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from private.mahliyo_books where removed_at is null and status = 'ready'
$$;

-- nobody reads the tables directly: only through the functions above
revoke all on private.mahliyo_ai_keys, private.mahliyo_ai_active, private.mahliyo_books, private.mahliyo_book_chunks from public, anon, authenticated;
