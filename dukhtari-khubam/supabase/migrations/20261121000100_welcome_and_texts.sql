-- Духтари хубам · 0014 welcome questions and longer panel texts
-- 1. Panel texts may hold several lines (notification variants, answer options): up to 2000 characters.
-- 2. Staff see how learners answered the welcome questions (time a day, schools, where they heard of
--    the app), counted from the progress backups; no learner is identified.

alter table public.ui_strings drop constraint if exists ui_strings_value_check;
alter table public.ui_strings add constraint ui_strings_value_check check (char_length(value) between 1 and 2000);

create or replace function public.admin_welcome_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  return jsonb_build_object(
    'answered', (select count(*) from public.device_profiles where data ? 'about'),
    'profiles', (select count(*) from public.device_profiles),
    'time', coalesce((select jsonb_object_agg(v, n) from (
        select data -> 'about' ->> 'time' v, count(*) n from public.device_profiles
        where data -> 'about' ->> 'time' is not null group by 1) s), '{}'::jsonb),
    'source', coalesce((select jsonb_object_agg(v, n) from (
        select data -> 'about' ->> 'source' v, count(*) n from public.device_profiles
        where data -> 'about' ->> 'source' is not null group by 1) s), '{}'::jsonb),
    'schools', coalesce((select jsonb_object_agg(v, n) from (
        select x v, count(*) n from public.device_profiles,
          jsonb_array_elements_text(case when jsonb_typeof(data -> 'about' -> 'schools') = 'array' then data -> 'about' -> 'schools' else '[]'::jsonb end) x
        group by 1) s), '{}'::jsonb));
end $$;
revoke execute on function public.admin_welcome_stats() from anon;
grant execute on function public.admin_welcome_stats() to authenticated;
