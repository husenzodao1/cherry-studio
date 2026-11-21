-- Духтари хубам · 0027 support chat: Mahliyo answers at once, the consultant joins, the learner rates;
-- a learner whose account is staff sees the questions waiting.
--
-- A conversation is everything since the thread was last closed. In each: Mahliyo greets the learner's
-- first message while no consultant is there (kind 'bot'); the first time a consultant opens it, the
-- learner sees "Мушовир … бо шумо пайваст шуд" (kind 'joined', the body is the consultant's name); once
-- staff close it, the learner is asked to rate the consultant (1–5 and a note), once per closing.

alter table public.support_messages
  add column kind text not null default 'text' check (kind in ('text', 'bot', 'joined'));
alter table public.support_threads
  add column closed_at timestamptz,
  add column rating smallint check (rating between 1 and 5),
  add column rating_note text check (char_length(rating_note) <= 500),
  add column rated_at timestamptz;

create or replace function private.support_payload(p_thread uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', t.id, 'name', t.name, 'username', t.username, 'status', t.status,
    'unread_staff', t.unread_staff, 'unread_learner', t.unread_learner, 'last_message_at', t.last_message_at,
    'rating', t.rating, 'rating_note', t.rating_note,
    'needs_rating', t.status = 'closed' and (t.rated_at is null or t.rated_at < t.closed_at)
      and exists (select 1 from public.support_messages m where m.thread_id = t.id and m.from_staff and m.kind = 'text'),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'from_staff', m.from_staff, 'kind', m.kind, 'body', m.body, 'at', m.created_at) order by m.created_at)
      from (select * from public.support_messages where thread_id = t.id order by created_at desc limit 200) m), '[]'::jsonb))
  from public.support_threads t where t.id = p_thread;
$$;

create or replace function public.api_support_send(p_token_hash text, p_name text, p_username text, p_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_body text := trim(coalesce(p_body, ''));
  v_id uuid;
  v_since timestamptz;
begin
  if coalesce(p_token_hash, '') !~ '^[0-9a-f]{64}$' or char_length(v_body) not between 1 and 2000 then
    perform private.fail('validation_failed');
  end if;
  insert into public.support_threads as t (token_hash, name, username)
  values (p_token_hash, nullif(left(trim(coalesce(p_name, '')), 80), ''), nullif(left(lower(trim(coalesce(p_username, ''))), 40), ''))
  on conflict (token_hash) do update
    set name = coalesce(excluded.name, t.name), username = coalesce(excluded.username, t.username)
  returning t.id, coalesce(t.closed_at, '-infinity'::timestamptz) into v_id, v_since;
  if (select count(*) from public.support_messages
       where thread_id = v_id and not from_staff and created_at > now() - interval '1 hour') >= 30 then
    perform private.fail('rate_limited');
  end if;
  insert into public.support_messages (thread_id, from_staff, body) values (v_id, false, v_body);
  -- Mahliyo answers at once while no consultant has spoken in this conversation (once per conversation)
  if not exists (select 1 from public.support_messages where thread_id = v_id and from_staff and created_at > v_since) then
    insert into public.support_messages (thread_id, from_staff, kind, body, created_at)
    values (v_id, true, 'bot', 'Салом! Лутфан интизор бошед: ҳоло ҳамаи мушовирони нуқтаи дастгирӣ банданд, ба шумо дар наздиктарин лаҳза ҷавоб хоҳем дод. Арзи сипос барои фаҳмиш 🙂', clock_timestamp());
  end if;
  update public.support_threads set status = 'open', unread_staff = unread_staff + 1, last_message_at = now() where id = v_id;
  return private.support_payload(v_id);
end $$;

-- The learner rates the consultant of the conversation just closed.
create or replace function public.api_support_rate(p_token_hash text, p_rating int, p_note text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if coalesce(p_rating, 0) not between 1 and 5 then perform private.fail('validation_failed'); end if;
  select id into v_id from public.support_threads where token_hash = p_token_hash;
  if v_id is null then perform private.fail('not_found'); end if;
  update public.support_threads
     set rating = p_rating, rating_note = nullif(left(trim(coalesce(p_note, '')), 500), ''), rated_at = now()
   where id = v_id;
  return private.support_payload(v_id);
end $$;

create or replace function public.admin_support_threads() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'name', t.name, 'username', t.username, 'status', t.status, 'unread_staff', t.unread_staff,
      'last_message_at', t.last_message_at, 'rating', t.rating, 'rating_note', t.rating_note,
      'last_body', (select m.body from public.support_messages m where m.thread_id = t.id and m.kind = 'text' order by m.created_at desc limit 1))
      order by (t.status = 'open') desc, t.last_message_at desc)
    from (select * from public.support_threads order by (status = 'open') desc, last_message_at desc limit 200) t), '[]'::jsonb);
end $$;

-- Opening a conversation: the first consultant to open it joins it (the learner sees her name).
create or replace function public.admin_support_thread(p_thread uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_t public.support_threads;
  v_since timestamptz;
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  select * into v_t from public.support_threads where id = p_thread;
  if v_t.id is null then perform private.fail('not_found'); end if;
  v_since := coalesce(v_t.closed_at, '-infinity'::timestamptz);
  if v_t.status = 'open'
     and exists (select 1 from public.support_messages where thread_id = p_thread and not from_staff and created_at > v_since)
     and not exists (select 1 from public.support_messages where thread_id = p_thread and kind = 'joined' and created_at > v_since) then
    insert into public.support_messages (thread_id, from_staff, staff_id, kind, body)
    values (p_thread, true, (select auth.uid()), 'joined',
      coalesce((select nullif(trim(p.display_name), '') from public.profiles p where p.id = (select auth.uid())), 'Мушовир'));
    update public.support_threads set unread_learner = unread_learner + 1 where id = p_thread;
  end if;
  update public.support_threads set unread_staff = 0 where id = p_thread;
  return private.support_payload(p_thread);
end $$;

create or replace function public.admin_support_status(p_thread uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  if p_status not in ('open', 'closed') then perform private.fail('validation_failed'); end if;
  update public.support_threads
     set status = p_status, closed_at = case when p_status = 'closed' then now() else closed_at end
   where id = p_thread;
  if not found then perform private.fail('not_found'); end if;
  return private.support_payload(p_thread);
end $$;

-- Whether the account tied to this learner's code is staff (a consultant), and how many conversations
-- wait for an answer; nothing else about the account is told.
create or replace function public.api_consultant(p_code_hash text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when exists (
      select 1 from public.google_learners g join public.user_roles ur on ur.user_id = g.user_id where g.code_hash = p_code_hash)
    then jsonb_build_object('consultant', true,
      'waiting', (select count(*) from public.support_threads where status = 'open' and unread_staff > 0))
    else jsonb_build_object('consultant', false) end;
$$;
