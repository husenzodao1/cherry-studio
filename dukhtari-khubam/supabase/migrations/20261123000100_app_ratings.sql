-- Духтари хубам · ratings of the app given in the app (Settings → "Rate the app"): 1–5 and a comment.
-- No personal data; written only through api_rate_app, read by staff in the panel/Supabase.
create table public.app_ratings (
  id bigint generated always as identity primary key,
  stars smallint not null check (stars between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  version text check (char_length(version) <= 40),
  platform text check (platform in ('android', 'web')),
  created_at timestamptz not null default now()
);
alter table public.app_ratings enable row level security;
revoke all on public.app_ratings from anon, authenticated;

create or replace function public.api_rate_app(p_stars int, p_comment text, p_version text, p_platform text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_stars is null or p_stars not between 1 and 5 or coalesce(p_platform, '') not in ('android', 'web') then
    perform private.fail('validation_failed');
  end if;
  insert into public.app_ratings (stars, comment, version, platform)
  values (p_stars, nullif(left(trim(coalesce(p_comment, '')), 1000), ''), left(p_version, 40), p_platform);
  return true;
end $$;
revoke execute on function public.api_rate_app(int, text, text, text) from public;
grant execute on function public.api_rate_app(int, text, text, text) to anon, authenticated, service_role;
