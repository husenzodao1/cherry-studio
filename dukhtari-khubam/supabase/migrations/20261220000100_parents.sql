-- The parents' view: a link she makes herself and can take back. Her parents see a short summary of her
-- learning that her own phone writes (her streak, active days, lessons, tests, flashcards learnt, her ММТ
-- estimate) — never her messages, her chats with Mahliyo, her contacts or her place (the place goes only
-- through an SOS she sends).

create table if not exists public.parent_links (
  profile text primary key references public.device_profiles (code_hash) on delete cascade,
  token text not null unique check (token ~ '^[0-9a-f]{32}$'),
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object' and pg_column_size(summary) <= 8192),
  summary_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.parent_links enable row level security;

-- her link (made the first time)
create or replace function public.api_parent_link(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.device_profiles := private.profile_by_code(p_code); v public.parent_links;
begin
  insert into public.parent_links (profile, token) values (me.code_hash, encode(extensions.gen_random_bytes(16), 'hex'))
  on conflict (profile) do nothing;
  select * into v from public.parent_links where profile = me.code_hash;
  return jsonb_build_object('token', v.token, 'summary_at', v.summary_at);
end $$;

-- taken back: the old link stops working at once
create or replace function public.api_parent_unlink(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.device_profiles := private.profile_by_code(p_code);
begin
  delete from public.parent_links where profile = me.code_hash;
end $$;

-- the summary her phone writes (only when she has a link)
create or replace function public.api_parent_summary(p_code text, p_summary jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare me public.device_profiles := private.profile_by_code(p_code);
begin
  if jsonb_typeof(p_summary) <> 'object' then perform private.fail('validation_failed'); end if;
  update public.parent_links set summary = p_summary, summary_at = now() where profile = me.code_hash;
  return found;
end $$;

-- what her parents see, by the link's token only
create or replace function public.api_parent_view(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name', split_part(trim(p.name), ' ', 1), 'summary', l.summary, 'summary_at', l.summary_at, 'active_at', p.updated_at)
  from public.parent_links l join public.device_profiles p on p.code_hash = l.profile
  where coalesce(p_token, '') ~ '^[0-9a-f]{32}$' and l.token = p_token;
$$;

revoke all on function public.api_parent_link(text), public.api_parent_unlink(text), public.api_parent_summary(text, jsonb), public.api_parent_view(text) from public;
grant execute on function public.api_parent_link(text), public.api_parent_unlink(text), public.api_parent_summary(text, jsonb), public.api_parent_view(text) to anon, authenticated;
