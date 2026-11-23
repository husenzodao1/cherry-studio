-- Mahliyo in Telegram (Premium): her account linked to her Telegram by a one-time code made in the app (her
-- account's e-mail is confirmed already), so the bot answers her in a private chat and in the groups she turns
-- it on in. The server alone reads and writes these (its proof); the learner sees and ends only her own link.

create table private.telegram_links (
  tg_user bigint primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  tg_name text check (char_length(tg_name) <= 120),
  linked_at timestamptz not null default now()
);
create unique index telegram_links_user on private.telegram_links (user_id);

create table private.telegram_codes (
  code text primary key check (code ~ '^[A-Za-z0-9]{12}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '15 minutes'
);

-- a chat's recent turns (a private chat, or a group she turned the bot on in: its owner is who pays for it)
create table private.telegram_chats (
  chat_id bigint primary key,
  owner uuid references auth.users (id) on delete cascade,
  is_group boolean not null default false,
  turns jsonb not null default '[]'::jsonb check (jsonb_typeof(turns) = 'array'),
  updated_at timestamptz not null default now()
);

-- the learner: a code for the bot's link (t.me/<bot>?start=<code>), good for 15 minutes
create or replace function public.api_tg_code() returns text
language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  if auth.uid() is null then perform private.fail('unauthorized'); end if;
  if not private.workspace_ok(auth.uid()) then perform private.fail('plan_limit', '{"kind": "telegram"}'::jsonb); end if;
  delete from private.telegram_codes where user_id = auth.uid() or expires_at < now();
  v_code := substr(translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/=', 'xyz'), 1, 12);
  insert into private.telegram_codes (code, user_id) values (v_code, auth.uid());
  return v_code;
end $$;

-- the learner: whether her Telegram is linked (and as whom)
create or replace function public.api_tg_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then perform private.fail('unauthorized'); end if;
  return coalesce((select jsonb_build_object('linked', true, 'name', l.tg_name, 'at', l.linked_at) from private.telegram_links l where l.user_id = auth.uid()),
    jsonb_build_object('linked', false)) || jsonb_build_object('allowed', private.workspace_ok(auth.uid()));
end $$;

create or replace function public.api_tg_unlink() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then perform private.fail('unauthorized'); end if;
  delete from private.telegram_chats where owner = auth.uid();
  delete from private.telegram_links where user_id = auth.uid();
end $$;

-- the server: a code from "/start <code>" links this Telegram user to its account (once; the code is spent)
create or replace function public.api_tg_link(p_proof text, p_code text, p_tg_user bigint, p_tg_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if not private.server_ok(p_proof) then perform private.fail('forbidden'); end if;
  delete from private.telegram_codes where code = p_code and expires_at > now() returning user_id into v_user;
  if v_user is null then return jsonb_build_object('linked', false); end if;
  delete from private.telegram_links where user_id = v_user or tg_user = p_tg_user;
  insert into private.telegram_links (tg_user, user_id, tg_name) values (p_tg_user, v_user, left(p_tg_name, 120));
  return jsonb_build_object('linked', true, 'plan', private.plan_of(v_user));
end $$;

-- the server: who writes from Telegram (her account and plan), and whether the bot may answer in this chat
create or replace function public.api_tg_who(p_proof text, p_tg_user bigint, p_chat bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid; v_chat private.telegram_chats;
begin
  if not private.server_ok(p_proof) then perform private.fail('forbidden'); end if;
  select user_id into v_user from private.telegram_links where tg_user = p_tg_user;
  select * into v_chat from private.telegram_chats where chat_id = p_chat;
  return jsonb_build_object(
    'user', v_user,
    'allowed', v_user is not null and private.workspace_ok(v_user),
    'name', (select coalesce(nullif(p.display_name, ''), split_part(u.email, '@', 1)) from auth.users u left join public.profiles p on p.id = u.id where u.id = v_user),
    'chat_owner', v_chat.owner,
    'chat_allowed', v_chat.owner is not null and private.workspace_ok(v_chat.owner),
    'turns', coalesce(v_chat.turns, '[]'::jsonb));
end $$;

-- the server: a chat's turns kept (the last 16), its owner set when a linked learner turns it on
create or replace function public.api_tg_chat(p_proof text, p_chat bigint, p_owner uuid, p_group boolean, p_turns jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.server_ok(p_proof) then perform private.fail('forbidden'); end if;
  insert into private.telegram_chats (chat_id, owner, is_group, turns, updated_at)
    values (p_chat, p_owner, p_group, coalesce((select jsonb_agg(t) from (select t from jsonb_array_elements(p_turns) t offset greatest(jsonb_array_length(p_turns) - 16, 0)) x), '[]'::jsonb), now())
    on conflict (chat_id) do update set owner = coalesce(excluded.owner, private.telegram_chats.owner), is_group = excluded.is_group,
      turns = excluded.turns, updated_at = now();
end $$;

-- the server: a group turned off by its owner ("/off")
create or replace function public.api_tg_chat_off(p_proof text, p_chat bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.server_ok(p_proof) then perform private.fail('forbidden'); end if;
  delete from private.telegram_chats where chat_id = p_chat;
end $$;

revoke all on function public.api_tg_code(), public.api_tg_status(), public.api_tg_unlink() from public, anon;
grant execute on function public.api_tg_code(), public.api_tg_status(), public.api_tg_unlink() to authenticated;
revoke all on function public.api_tg_link(text, text, bigint, text), public.api_tg_who(text, bigint, bigint),
  public.api_tg_chat(text, bigint, uuid, boolean, jsonb), public.api_tg_chat_off(text, bigint) from public;
grant execute on function public.api_tg_link(text, text, bigint, text), public.api_tg_who(text, bigint, bigint),
  public.api_tg_chat(text, bigint, uuid, boolean, jsonb), public.api_tg_chat_off(text, bigint) to anon, authenticated;
