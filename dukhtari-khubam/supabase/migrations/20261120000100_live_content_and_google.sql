-- Духтари хубам · 0013 live content updates and Google sign-in
--
-- 1. Live content. Every change staff make in the panel (content, texts, inspirations, pages, media)
--    moves one public stamp. The app and the site listen to that single row through Supabase Realtime
--    (and ask for it when they come back to the screen), so a change shows on every open phone and
--    browser within seconds, not after the next launch. Content scheduled for later goes live without
--    a write, so the stamp also carries the newest publish time that has passed.
-- 2. Google sign-in. A learner may tie her profile (the 15-digit code) to her Google account; signing
--    in with Google on a new phone gives the code back. Only the signed-in Google user can read her row.

create table public.content_stamp (
  id smallint primary key default 1 check (id = 1),
  changed_at timestamptz not null default now()
);
insert into public.content_stamp (id) values (1);
alter table public.content_stamp enable row level security;
create policy content_stamp_read on public.content_stamp for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.content_stamp from anon, authenticated;

create or replace function private.touch_content_stamp() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.content_stamp set changed_at = clock_timestamp() where id = 1;
  return null;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'achievement_translations', 'achievements', 'banner_translations', 'banners',
    'cms_page_translations', 'cms_pages', 'content_block_translations', 'content_blocks', 'content_revisions',
    'course_prerequisites', 'course_translations', 'courses',
    'daily_inspiration_translations', 'daily_inspirations', 'help_text_translations', 'help_texts',
    'lesson_translations', 'lessons', 'media_asset_translations', 'media_asset_versions', 'media_assets',
    'module_translations', 'modules', 'quiz_answer_keys', 'quiz_option_translations', 'quiz_options',
    'quiz_question_translations', 'quiz_questions', 'quiz_section_translations', 'quiz_sections',
    'quiz_translations', 'quizzes', 'school_translations', 'schools', 'topic_translations', 'topics', 'ui_strings'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists %I on public.%I', t || '_content_stamp', t);
      execute format('create trigger %I after insert or update or delete or truncate on public.%I '
        'for each statement execute function private.touch_content_stamp()', t || '_content_stamp', t);
    end if;
  end loop;
end $$;

-- The stamp the app compares with its stored one: the last change, or a scheduled publish time that
-- has just passed (whichever is newer).
create or replace function public.api_content_stamp() returns text
language sql stable security definer set search_path = '' as $$
  select to_char(greatest(
    (select changed_at from public.content_stamp where id = 1),
    (select max(publish_at) from public.courses where publish_at <= now()),
    (select max(publish_at) from public.lessons where publish_at <= now()),
    (select max(publish_at) from public.quizzes where publish_at <= now()),
    (select max(publish_at) from public.daily_inspirations where publish_at <= now())
  ) at time zone 'UTC', 'YYYYMMDD"T"HH24MISS.US');
$$;
grant execute on function public.api_content_stamp() to anon, authenticated;

-- Realtime: the one stamp row is broadcast on every change (Supabase projects only).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'content_stamp') then
    execute 'alter publication supabase_realtime add table public.content_stamp';
  end if;
end $$;

-- ---------------------------------------------------------------- Google sign-in
create table public.google_learners (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code_hash text not null references public.device_profiles (code_hash) on delete cascade,
  -- the code itself, readable only by this Google user through api_google_profile
  code text not null check (code ~ '^[1-9][0-9]{14}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- No policies: reachable only through the functions below.
alter table public.google_learners enable row level security;
revoke all on public.google_learners from anon, authenticated;

-- Ties the signed-in Google user to the profile whose code the phone holds (the profile must exist:
-- the phone backs up before it links).
create or replace function public.api_google_link(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_hash text;
begin
  if v_user is null then perform private.fail('auth_required'); end if;
  if coalesce(p_code, '') !~ '^[1-9][0-9]{14}$' then perform private.fail('validation_failed'); end if;
  v_hash := encode(extensions.digest(p_code, 'sha256'), 'hex');
  if not exists (select 1 from public.device_profiles where code_hash = v_hash) then perform private.fail('not_found'); end if;
  insert into public.google_learners as g (user_id, code_hash, code) values (v_user, v_hash, p_code)
  on conflict (user_id) do update set code_hash = excluded.code_hash, code = excluded.code, updated_at = now();
  return jsonb_build_object('linked', true);
end $$;

-- The profile tied to the signed-in Google user, or null when she has none yet.
create or replace function public.api_google_profile() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then perform private.fail('auth_required'); end if;
  return (
    select jsonb_build_object('code', g.code, 'name', p.name, 'data', p.data, 'updated_at', p.updated_at)
    from public.google_learners g join public.device_profiles p on p.code_hash = g.code_hash
    where g.user_id = v_user
  );
end $$;

revoke execute on function public.api_google_link(text) from anon;
revoke execute on function public.api_google_profile() from anon;
grant execute on function public.api_google_link(text) to authenticated;
grant execute on function public.api_google_profile() to authenticated;
