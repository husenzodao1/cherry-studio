-- Духтари хубам · 0004 engagement & CMS extras
-- Learning progress, bookmarks, achievements, Daily Inspiration, help texts (the "!" popovers),
-- managed UI strings, CMS pages, banners, notifications, search index.

-- ---------------------------------------------------------------- learning
create table public.lesson_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  status text not null default 'started' check (status in ('started', 'completed')),
  progress_percent smallint not null default 0 check (progress_percent between 0 and 100),
  position jsonb check (position is null or jsonb_typeof(position) = 'object'),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index lesson_progress_user_idx on public.lesson_progress (user_id, updated_at desc);

create table public.bookmarks (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9_.-]+$'),
  icon_asset_id uuid references public.media_assets (id) on delete restrict,
  -- {"type":"lessons_completed","count":10} | {"type":"course_completed","course_id":"…"}
  -- {"type":"school_completed","school_id":"…"} | {"type":"quiz_passed","quiz_id":"…"} | {"type":"quizzes_passed","count":3}
  rule jsonb not null check (jsonb_typeof(rule) = 'object' and rule ? 'type'),
  position int not null default 0,
  status public.content_status not null default 'draft',
  publish_at timestamptz,
  first_published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.achievement_translations (
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  locale public.locale_code not null,
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 500),
  ready boolean not null default false,
  primary key (achievement_id, locale)
);
create table public.user_achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

-- ---------------------------------------------------------------- Daily Inspiration
create table public.daily_inspirations (
  id uuid primary key default gen_random_uuid(),
  image_asset_id uuid references public.media_assets (id) on delete restrict,
  placement text not null default 'home' check (placement in ('home', 'lesson', 'notification')),
  status public.content_status not null default 'draft',
  publish_at timestamptz,
  first_published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.daily_inspiration_translations (
  inspiration_id uuid not null references public.daily_inspirations (id) on delete cascade,
  locale public.locale_code not null,
  body text not null check (char_length(body) between 1 and 1000),
  author_name text check (char_length(author_name) <= 200),
  source_title text check (char_length(source_title) <= 300),
  source_url text check (source_url is null or source_url ~ '^https://'),
  ready boolean not null default false,
  primary key (inspiration_id, locale),
  -- a quote is never attributed to a person without a source (spec §5.11)
  constraint attribution_needs_source check (author_name is null or source_title is not null)
);

-- ---------------------------------------------------------------- help texts and UI strings
create table public.help_texts (
  key text primary key check (key ~ '^[a-z0-9_.-]+$'),
  enabled boolean not null default true,
  icon text not null default 'info' check (icon in ('info', 'alert', 'question')),
  updated_at timestamptz not null default now()
);
create table public.help_text_translations (
  key text not null references public.help_texts (key) on delete cascade,
  locale public.locale_code not null,
  title text check (char_length(title) <= 120),
  body text not null check (char_length(body) between 1 and 600),
  ready boolean not null default false,
  primary key (key, locale)
);
create table public.ui_strings (
  key text not null check (key ~ '^[a-z0-9_.-]+$'),
  locale public.locale_code not null,
  value text not null check (char_length(value) between 1 and 300),
  updated_at timestamptz not null default now(),
  primary key (key, locale)
);

-- ---------------------------------------------------------------- CMS pages & banners
create table public.cms_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status public.content_status not null default 'draft',
  publish_at timestamptz,
  first_published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.cms_page_translations (
  page_id uuid not null references public.cms_pages (id) on delete cascade,
  locale public.locale_code not null,
  title text not null check (char_length(title) between 1 and 200),
  body jsonb not null default '[]'::jsonb check (jsonb_typeof(body) = 'array'),
  ready boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (page_id, locale)
);

create table public.banners (
  id uuid primary key default gen_random_uuid(),
  placement text not null check (placement in ('home_top', 'home_card', 'school')),
  image_asset_id uuid references public.media_assets (id) on delete restrict,
  link_url text check (link_url is null or link_url ~ '^https://'),
  deep_link text check (deep_link is null or deep_link ~ '^/[A-Za-z0-9/_?=&.-]*$'),
  position int not null default 0,
  ends_at timestamptz,
  status public.content_status not null default 'draft',
  publish_at timestamptz,
  first_published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.banner_translations (
  banner_id uuid not null references public.banners (id) on delete cascade,
  locale public.locale_code not null,
  title text not null check (char_length(title) between 1 and 120),
  subtitle text check (char_length(subtitle) <= 300),
  cta_label text check (char_length(cta_label) <= 40),
  ready boolean not null default false,
  primary key (banner_id, locale)
);

-- ---------------------------------------------------------------- notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  -- {"type":"all"} | {"type":"school","school_id":"…"} | {"type":"course","course_id":"…"}
  audience jsonb not null default '{"type":"all"}'::jsonb check (audience ->> 'type' in ('all', 'school', 'course')),
  deep_link text check (deep_link is null or deep_link ~ '^/[A-Za-z0-9/_?=&.-]*$'),
  send_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sent', 'cancelled')),
  sent_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.notification_translations (
  notification_id uuid not null references public.notifications (id) on delete cascade,
  locale public.locale_code not null,
  title text not null check (char_length(title) between 1 and 80),
  body text check (char_length(body) <= 300),
  primary key (notification_id, locale)
);
create table public.notification_reads (
  user_id uuid not null references auth.users (id) on delete cascade,
  notification_id uuid not null references public.notifications (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, notification_id)
);
create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('android', 'web', 'ios')),
  token text not null unique check (char_length(token) between 10 and 4096),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- search index (published lessons only)
create table public.lesson_search_index (
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  locale public.locale_code not null,
  title text not null,
  body text not null default '',
  primary key (lesson_id, locale)
);
create index lesson_search_title_trgm on public.lesson_search_index using gin (title extensions.gin_trgm_ops);
create index lesson_search_body_trgm on public.lesson_search_index using gin (body extensions.gin_trgm_ops);
create index school_tr_title_trgm on public.school_translations using gin (title extensions.gin_trgm_ops);
create index course_tr_title_trgm on public.course_translations using gin (title extensions.gin_trgm_ops);
create index module_tr_title_trgm on public.module_translations using gin (title extensions.gin_trgm_ops);
create index topic_tr_title_trgm on public.topic_translations using gin (title extensions.gin_trgm_ops);

-- ---------------------------------------------------------------- triggers
do $$
declare t text;
begin
  foreach t in array array['lesson_progress', 'achievements', 'daily_inspirations', 'help_texts', 'ui_strings',
    'cms_pages', 'cms_page_translations', 'banners', 'notifications'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.set_updated_at()',
                   t || '_updated_at', t);
  end loop;
  foreach t in array array['achievements', 'daily_inspirations', 'cms_pages', 'banners', 'notifications'] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function private.content_row_guard()',
                   t || '_guard', t);
  end loop;
  foreach t in array array['achievements', 'achievement_translations', 'daily_inspirations',
    'daily_inspiration_translations', 'help_texts', 'help_text_translations', 'ui_strings', 'cms_pages',
    'cms_page_translations', 'banners', 'banner_translations', 'notifications', 'notification_translations'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_row()',
                   t || '_audit', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- achievements engine
create or replace function private.course_lesson_ids(p_course uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select l.id from public.lessons l
  join public.topics t on t.id = l.topic_id
  join public.modules m on m.id = t.module_id
  where m.course_id = p_course and private.lesson_live(l.id);
$$;

create or replace function private.evaluate_achievements(p_user uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  ach record;
  v_ok boolean;
  v_new int := 0;
begin
  if p_user is null then return 0; end if;
  for ach in
    select a.* from public.achievements a
    where private.is_live_status(a.status, a.publish_at)
      and not exists (select 1 from public.user_achievements ua where ua.user_id = p_user and ua.achievement_id = a.id)
  loop
    v_ok := case ach.rule ->> 'type'
      when 'lessons_completed' then
        (select count(*) from public.lesson_progress p where p.user_id = p_user and p.status = 'completed')
          >= greatest(coalesce((ach.rule ->> 'count')::int, 1), 1)
      when 'quizzes_passed' then
        (select count(distinct a.quiz_id) from public.quiz_attempts a where a.user_id = p_user and a.passed)
          >= greatest(coalesce((ach.rule ->> 'count')::int, 1), 1)
      when 'quiz_passed' then
        exists (select 1 from public.quiz_attempts a where a.user_id = p_user and a.passed
                and a.quiz_id = (ach.rule ->> 'quiz_id')::uuid)
      when 'course_completed' then
        exists (select 1 from private.course_lesson_ids((ach.rule ->> 'course_id')::uuid))
        and not exists (
          select 1 from private.course_lesson_ids((ach.rule ->> 'course_id')::uuid) lid
          where not exists (select 1 from public.lesson_progress p
                            where p.user_id = p_user and p.lesson_id = lid and p.status = 'completed'))
      when 'school_completed' then
        exists (select 1 from public.courses c where c.school_id = (ach.rule ->> 'school_id')::uuid and private.course_live(c.id))
        and not exists (
          select 1 from public.courses c, private.course_lesson_ids(c.id) lid
          where c.school_id = (ach.rule ->> 'school_id')::uuid and private.course_live(c.id)
            and not exists (select 1 from public.lesson_progress p
                            where p.user_id = p_user and p.lesson_id = lid and p.status = 'completed'))
      else false
    end;
    if coalesce(v_ok, false) then
      insert into public.user_achievements (user_id, achievement_id) values (p_user, ach.id) on conflict do nothing;
      v_new := v_new + 1;
    end if;
  end loop;
  return v_new;
end $$;

-- ---------------------------------------------------------------- RLS
alter table public.lesson_progress enable row level security;
alter table public.bookmarks enable row level security;
alter table public.achievements enable row level security;
alter table public.achievement_translations enable row level security;
alter table public.user_achievements enable row level security;
alter table public.daily_inspirations enable row level security;
alter table public.daily_inspiration_translations enable row level security;
alter table public.help_texts enable row level security;
alter table public.help_text_translations enable row level security;
alter table public.ui_strings enable row level security;
alter table public.cms_pages enable row level security;
alter table public.cms_page_translations enable row level security;
alter table public.banners enable row level security;
alter table public.banner_translations enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_translations enable row level security;
alter table public.notification_reads enable row level security;
alter table public.push_devices enable row level security;
alter table public.lesson_search_index enable row level security;

-- own learning data only; progress is written through api_track_progress (validates the lesson)
create policy progress_select on public.lesson_progress for select to authenticated
  using (user_id = (select auth.uid()) or private.can_view_analytics());
revoke insert, update, delete on public.lesson_progress from anon, authenticated;

create policy bookmarks_select on public.bookmarks for select to authenticated using (user_id = (select auth.uid()));
create policy bookmarks_insert on public.bookmarks for insert to authenticated
  with check (user_id = (select auth.uid()) and private.lesson_live(lesson_id));
create policy bookmarks_delete on public.bookmarks for delete to authenticated using (user_id = (select auth.uid()));

create policy achievements_select on public.achievements for select to anon, authenticated
  using (private.is_live_status(status, publish_at) or private.is_staff());
create policy achievements_write on public.achievements for all to authenticated
  using (private.can_publish()) with check (private.can_publish());
create policy achievement_tr_select on public.achievement_translations for select to anon, authenticated using (true);
create policy achievement_tr_write on public.achievement_translations for all to authenticated
  using (private.can_publish()) with check (private.can_publish());
create policy user_achievements_select on public.user_achievements for select to authenticated
  using (user_id = (select auth.uid()) or private.can_view_analytics());
revoke insert, update, delete on public.user_achievements from anon, authenticated;

create policy inspirations_select on public.daily_inspirations for select to authenticated using (private.is_staff());
create policy inspirations_write on public.daily_inspirations for all to authenticated
  using (private.can_edit_any()) with check (private.can_edit_any());
create policy inspiration_tr_select on public.daily_inspiration_translations for select to authenticated using (private.is_staff());
create policy inspiration_tr_write on public.daily_inspiration_translations for all to authenticated
  using (private.can_edit_any()) with check (private.can_edit_any());

create policy help_select on public.help_texts for select to anon, authenticated using (true);
create policy help_write on public.help_texts for all to authenticated
  using (private.can_edit_any()) with check (private.can_edit_any());
create policy help_tr_select on public.help_text_translations for select to anon, authenticated
  using (ready or private.is_staff());
create policy help_tr_write on public.help_text_translations for all to authenticated
  using (private.can_edit_any()) with check (private.can_edit_any());
create policy ui_strings_select on public.ui_strings for select to anon, authenticated using (true);
create policy ui_strings_write on public.ui_strings for all to authenticated
  using (private.can_edit_any()) with check (private.can_edit_any());

create policy pages_select on public.cms_pages for select to anon, authenticated
  using (private.is_live_status(status, publish_at) or private.is_staff());
create policy pages_write on public.cms_pages for all to authenticated
  using (private.can_edit_any()) with check (private.can_edit_any());
create policy page_tr_select on public.cms_page_translations for select to authenticated using (private.is_staff());
create policy page_tr_write on public.cms_page_translations for all to authenticated
  using (private.can_edit_any()) with check (private.can_edit_any());

create policy banners_select on public.banners for select to authenticated using (private.is_staff());
create policy banners_write on public.banners for all to authenticated
  using (private.can_edit_any()) with check (private.can_edit_any());
create policy banner_tr_select on public.banner_translations for select to authenticated using (private.is_staff());
create policy banner_tr_write on public.banner_translations for all to authenticated
  using (private.can_edit_any()) with check (private.can_edit_any());

create policy notifications_select on public.notifications for select to authenticated using (private.is_staff());
create policy notifications_write on public.notifications for all to authenticated
  using (private.can_publish()) with check (private.can_publish());
create policy notification_tr_select on public.notification_translations for select to authenticated using (private.is_staff());
create policy notification_tr_write on public.notification_translations for all to authenticated
  using (private.can_publish()) with check (private.can_publish());
create policy notification_reads_own on public.notification_reads for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy push_devices_own on public.push_devices for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy search_index_select on public.lesson_search_index for select to authenticated using (private.is_staff());
revoke insert, update, delete on public.lesson_search_index from anon, authenticated;
