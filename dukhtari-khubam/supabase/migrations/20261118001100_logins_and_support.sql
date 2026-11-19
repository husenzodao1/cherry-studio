-- Духтари хубам · 0011 learner logins and the support chat
-- A learner can sign in three ways: the 15-digit code; a login and password (when the code is lost);
-- or, when both are lost, by writing to the support chat, where staff can issue a temporary password.
-- The server never keeps the code itself: the phone stores it encrypted with a key derived from the
-- password (code_enc), and the server keeps only a bcrypt hash of the password.

create extension if not exists pgcrypto with schema extensions;

alter table public.device_profiles
  add column username text check (username ~ '^[a-z0-9_.]{3,32}$'),
  add column password_hash text,
  add column code_enc text check (char_length(code_enc) <= 500),
  -- a new code issued by staff with a temporary password; handed over once at the next login
  add column code_once text check (code_once ~ '^[1-9][0-9]{14}$'),
  add column must_change boolean not null default false,
  add column failed_logins int not null default 0,
  add column locked_until timestamptz;
create unique index device_profiles_username_key on public.device_profiles (username);

create or replace function public.api_profile_username_free(p_username text) returns boolean
language sql stable security definer set search_path = '' as $$
  select lower(trim(coalesce(p_username, ''))) ~ '^[a-z0-9_.]{3,32}$'
     and not exists (select 1 from public.device_profiles where username = lower(trim(p_username)));
$$;

-- Sets (or changes) the login of the profile whose code the caller knows.
create or replace function public.api_profile_set_login(p_code_hash text, p_username text, p_password text, p_code_enc text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user text := lower(trim(coalesce(p_username, '')));
begin
  if coalesce(p_code_hash, '') !~ '^[0-9a-f]{64}$' or v_user !~ '^[a-z0-9_.]{3,32}$'
     or char_length(coalesce(p_password, '')) not between 6 and 72 or coalesce(char_length(p_code_enc), 0) not between 1 and 500 then
    perform private.fail('validation_failed');
  end if;
  if not exists (select 1 from public.device_profiles where code_hash = p_code_hash) then perform private.fail('not_found'); end if;
  if exists (select 1 from public.device_profiles where username = v_user and code_hash <> p_code_hash) then
    perform private.fail('username_taken');
  end if;
  update public.device_profiles
     set username = v_user, password_hash = extensions.crypt(p_password, extensions.gen_salt('bf', 10)), code_enc = p_code_enc,
         code_once = null, must_change = false, failed_logins = 0, locked_until = null, updated_at = now()
   where code_hash = p_code_hash;
  return jsonb_build_object('username', v_user);
end $$;

-- Login and password → the profile. Wrong passwords are counted (8 in a row lock the login for
-- 15 minutes); the result is returned, not raised, so the counter is kept.
create or replace function public.api_profile_login(p_username text, p_password text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.device_profiles%rowtype;
  v_user text := lower(trim(coalesce(p_username, '')));
begin
  select * into p from public.device_profiles where username = v_user for update;
  if not found or p.password_hash is null then return jsonb_build_object('error', 'invalid_login'); end if;
  if p.locked_until is not null and p.locked_until > now() then return jsonb_build_object('error', 'locked'); end if;
  if extensions.crypt(coalesce(p_password, ''), p.password_hash) <> p.password_hash then
    update public.device_profiles
       set failed_logins = case when p.failed_logins + 1 >= 8 then 0 else p.failed_logins + 1 end,
           locked_until = case when p.failed_logins + 1 >= 8 then now() + interval '15 minutes' else p.locked_until end
     where code_hash = p.code_hash;
    return jsonb_build_object('error', 'invalid_login');
  end if;
  update public.device_profiles set failed_logins = 0, locked_until = null where code_hash = p.code_hash;
  return jsonb_build_object('name', p.name, 'data', p.data, 'username', p.username, 'code_enc', p.code_enc,
                            'code', p.code_once, 'must_change', p.must_change);
end $$;

-- Staff: a forgotten login. Issues a new code and a temporary password (shown once to staff, sent to the
-- learner in the support chat); the learner must choose a new password at the next login.
create or replace function public.admin_profile_reset(p_username text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user text := lower(trim(coalesce(p_username, '')));
  v_code text := '';
  v_pass text := '';
  v_abc text := 'abcdefghjkmnpqrstuvwxyz23456789';
  b bytea := extensions.gen_random_bytes(96);
  i int;
  v int;
begin
  if not private.is_super_admin() then perform private.fail('forbidden'); end if;
  if not exists (select 1 from public.device_profiles where username = v_user) then perform private.fail('not_found'); end if;
  for i in 0..63 loop
    exit when char_length(v_code) = 15;
    v := get_byte(b, i);
    continue when v >= 250 or (v_code = '' and v % 10 = 0);
    v_code := v_code || (v % 10)::text;
  end loop;
  for i in 64..95 loop
    exit when char_length(v_pass) = 10;
    v := get_byte(b, i);
    continue when v >= 248;
    v_pass := v_pass || substr(v_abc, v % 31 + 1, 1);
  end loop;
  if char_length(v_code) <> 15 or char_length(v_pass) <> 10 then perform private.fail('rate_limited'); end if;
  update public.device_profiles
     set code_hash = encode(extensions.digest(v_code, 'sha256'), 'hex'), code_once = v_code, code_enc = null,
         password_hash = extensions.crypt(v_pass, extensions.gen_salt('bf', 10)), must_change = true,
         failed_logins = 0, locked_until = null, updated_at = now()
   where username = v_user;
  return jsonb_build_object('username', v_user, 'password', v_pass);
end $$;

-- ---------------------------------------------------------------- support chat
-- A thread belongs to the phone that opened it (sha256 of a random token kept on that phone), so it
-- works without an account. Staff read and answer threads in the panel.
create table public.support_threads (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  name text check (char_length(name) <= 80),
  username text check (char_length(username) <= 40),
  status text not null default 'open' check (status in ('open', 'closed')),
  unread_staff int not null default 0,
  unread_learner int not null default 0,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads (id) on delete cascade,
  from_staff boolean not null,
  staff_id uuid references auth.users (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index support_messages_thread_idx on public.support_messages (thread_id, created_at);
create index support_threads_recent_idx on public.support_threads (status, last_message_at desc);
-- No policies: reachable only through the functions below.
alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;

create or replace function private.support_payload(p_thread uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', t.id, 'name', t.name, 'username', t.username, 'status', t.status,
    'unread_staff', t.unread_staff, 'unread_learner', t.unread_learner, 'last_message_at', t.last_message_at,
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'from_staff', m.from_staff, 'body', m.body, 'at', m.created_at) order by m.created_at)
      from (select * from public.support_messages where thread_id = t.id order by created_at desc limit 200) m), '[]'::jsonb))
  from public.support_threads t where t.id = p_thread;
$$;

create or replace function public.api_support_send(p_token_hash text, p_name text, p_username text, p_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_body text := trim(coalesce(p_body, ''));
  v_id uuid;
begin
  if coalesce(p_token_hash, '') !~ '^[0-9a-f]{64}$' or char_length(v_body) not between 1 and 2000 then
    perform private.fail('validation_failed');
  end if;
  insert into public.support_threads as t (token_hash, name, username)
  values (p_token_hash, nullif(left(trim(coalesce(p_name, '')), 80), ''), nullif(left(lower(trim(coalesce(p_username, ''))), 40), ''))
  on conflict (token_hash) do update
    set name = coalesce(excluded.name, t.name), username = coalesce(excluded.username, t.username)
  returning t.id into v_id;
  if (select count(*) from public.support_messages
       where thread_id = v_id and not from_staff and created_at > now() - interval '1 hour') >= 30 then
    perform private.fail('rate_limited');
  end if;
  insert into public.support_messages (thread_id, from_staff, body) values (v_id, false, v_body);
  update public.support_threads set status = 'open', unread_staff = unread_staff + 1, last_message_at = now() where id = v_id;
  return private.support_payload(v_id);
end $$;

-- The learner's own thread (opening it marks staff replies as read).
create or replace function public.api_support_thread(p_token_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  select id into v_id from public.support_threads where token_hash = p_token_hash;
  if v_id is null then return null; end if;
  update public.support_threads set unread_learner = 0 where id = v_id;
  return private.support_payload(v_id);
end $$;

create or replace function public.api_support_unread(p_token_hash text) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce((select unread_learner from public.support_threads where token_hash = p_token_hash), 0);
$$;

create or replace function public.admin_support_threads() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'name', t.name, 'username', t.username, 'status', t.status, 'unread_staff', t.unread_staff,
      'last_message_at', t.last_message_at,
      'last_body', (select m.body from public.support_messages m where m.thread_id = t.id order by m.created_at desc limit 1))
      order by (t.status = 'open') desc, t.last_message_at desc)
    from (select * from public.support_threads order by (status = 'open') desc, last_message_at desc limit 200) t), '[]'::jsonb);
end $$;

create or replace function public.admin_support_thread(p_thread uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  if not exists (select 1 from public.support_threads where id = p_thread) then perform private.fail('not_found'); end if;
  update public.support_threads set unread_staff = 0 where id = p_thread;
  return private.support_payload(p_thread);
end $$;

create or replace function public.admin_support_reply(p_thread uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_body text := trim(coalesce(p_body, ''));
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  if char_length(v_body) not between 1 and 2000 then perform private.fail('validation_failed'); end if;
  if not exists (select 1 from public.support_threads where id = p_thread) then perform private.fail('not_found'); end if;
  insert into public.support_messages (thread_id, from_staff, staff_id, body) values (p_thread, true, (select auth.uid()), v_body);
  update public.support_threads set unread_learner = unread_learner + 1, last_message_at = now() where id = p_thread;
  return private.support_payload(p_thread);
end $$;

create or replace function public.admin_support_status(p_thread uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  if p_status not in ('open', 'closed') then perform private.fail('validation_failed'); end if;
  update public.support_threads set status = p_status where id = p_thread;
  if not found then perform private.fail('not_found'); end if;
  return private.support_payload(p_thread);
end $$;

-- The home heading is now "7 оинаи духтар" (kept in step with the app's built-in text).
update public.ui_strings set value = '7 оинаи духтар', updated_at = now()
 where key = 'home.seven_schools' and locale = 'tg' and value = 'Ҳафт мактаби дониш';
