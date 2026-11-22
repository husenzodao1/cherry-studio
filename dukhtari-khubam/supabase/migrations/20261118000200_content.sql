-- Духтари хубам · 0002 content
-- Media library, school → course → module → topic → lesson hierarchy, translations,
-- content blocks (schema-versioned), revisions and liveness helpers.

-- ---------------------------------------------------------------- media library
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  kind public.media_kind not null,
  bucket text not null default 'media' check (bucket in ('media', 'media-protected')),
  path text not null check (char_length(path) between 1 and 500 and path !~ '\.\.'),
  mime_type text not null check (char_length(mime_type) <= 120),
  size_bytes bigint check (size_bytes >= 0),
  width int check (width > 0),
  height int check (height > 0),
  duration_seconds numeric(10, 2) check (duration_seconds >= 0),
  checksum text,
  focal_x numeric(4, 3) check (focal_x between 0 and 1),
  focal_y numeric(4, 3) check (focal_y between 0 and 1),
  crop jsonb check (crop is null or jsonb_typeof(crop) = 'object'),
  variants jsonb not null default '{}'::jsonb check (jsonb_typeof(variants) = 'object'),
  hls_path text,
  poster_asset_id uuid references public.media_assets (id) on delete set null,
  folder text not null default '' check (char_length(folder) <= 120),
  tags text[] not null default '{}',
  -- provenance (spec §9): every asset records source and licence; AI imagery is flagged
  origin public.asset_origin not null,
  author_name text check (char_length(author_name) <= 200),
  source_url text check (source_url is null or source_url ~ '^https://'),
  license text check (char_length(license) <= 200),
  license_url text check (license_url is null or license_url ~ '^https://'),
  provenance_notes text check (char_length(provenance_notes) <= 2000),
  is_ai_generated boolean not null default false,
  status text not null default 'active' check (status in ('active', 'archived')),
  version int not null default 1,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket, path)
);
create index media_assets_kind_idx on public.media_assets (kind, created_at desc);
create index media_assets_folder_idx on public.media_assets (folder);

create table public.media_asset_translations (
  asset_id uuid not null references public.media_assets (id) on delete cascade,
  locale public.locale_code not null,
  title text check (char_length(title) <= 200),
  alt_text text check (char_length(alt_text) <= 500),
  caption text check (char_length(caption) <= 1000),
  transcript text,
  subtitles_path text check (char_length(subtitles_path) <= 500),
  updated_at timestamptz not null default now(),
  primary key (asset_id, locale)
);

create table public.media_asset_versions (
  id bigint generated always as identity primary key,
  asset_id uuid not null references public.media_assets (id) on delete cascade,
  version int not null,
  bucket text not null,
  path text not null,
  mime_type text not null,
  size_bytes bigint,
  replaced_by uuid references auth.users (id) on delete set null,
  replaced_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- hierarchy
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  position int not null default 0,
  theme_color text check (theme_color ~ '^#[0-9A-Fa-f]{6}$'),
  icon_asset_id uuid references public.media_assets (id) on delete restrict,
  hero_asset_id uuid references public.media_assets (id) on delete restrict,
  access_tier public.access_tier not null default 'free',
  status public.content_status not null default 'draft',
  publish_at timestamptz,
  first_published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.school_translations (
  school_id uuid not null references public.schools (id) on delete cascade,
  locale public.locale_code not null,
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 600),
  ready boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (school_id, locale)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  position int not null default 0,
  level text check (level in ('beginner', 'intermediate', 'advanced')),
  estimated_minutes int check (estimated_minutes >= 0),
  access_tier public.access_tier not null default 'free',
  cover_asset_id uuid references public.media_assets (id) on delete restrict,
  model_asset_id uuid references public.media_assets (id) on delete restrict,
  status public.content_status not null default 'draft',
  publish_at timestamptz,
  first_published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, slug)
);
create index courses_school_idx on public.courses (school_id, position);

create table public.course_translations (
  course_id uuid not null references public.courses (id) on delete cascade,
  locale public.locale_code not null,
  title text not null check (char_length(title) between 1 and 160),
  description text check (char_length(description) <= 2000),
  goals text[] not null default '{}',
  ready boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (course_id, locale)
);

create table public.course_prerequisites (
  course_id uuid not null references public.courses (id) on delete cascade,
  required_course_id uuid not null references public.courses (id) on delete cascade,
  primary key (course_id, required_course_id),
  check (course_id <> required_course_id)
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete restrict,
  position int not null default 0,
  status public.content_status not null default 'draft',
  publish_at timestamptz,
  first_published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index modules_course_idx on public.modules (course_id, position);

create table public.module_translations (
  module_id uuid not null references public.modules (id) on delete cascade,
  locale public.locale_code not null,
  title text not null check (char_length(title) between 1 and 160),
  description text check (char_length(description) <= 2000),
  ready boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (module_id, locale)
);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete restrict,
  position int not null default 0,
  status public.content_status not null default 'draft',
  publish_at timestamptz,
  first_published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index topics_module_idx on public.topics (module_id, position);

create table public.topic_translations (
  topic_id uuid not null references public.topics (id) on delete cascade,
  locale public.locale_code not null,
  title text not null check (char_length(title) between 1 and 160),
  description text check (char_length(description) <= 2000),
  ready boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (topic_id, locale)
);

create table public.content_revisions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('lesson', 'quiz')),
  entity_id uuid not null,
  version int not null,
  kind text not null check (kind in ('manual', 'review', 'publish', 'restore')),
  snapshot jsonb not null,
  answer_key jsonb,
  note text check (char_length(note) <= 500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (entity_type, entity_id, version)
);
create index content_revisions_entity_idx on public.content_revisions (entity_type, entity_id, version desc);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id) on delete restrict,
  position int not null default 0,
  access_tier public.access_tier not null default 'free',
  estimated_minutes int check (estimated_minutes >= 0),
  status public.content_status not null default 'draft',
  publish_at timestamptz,
  first_published_at timestamptz,
  published_revision_id uuid references public.content_revisions (id) on delete set null,
  published_at timestamptz,
  version int not null default 1,
  draft_updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lessons_topic_idx on public.lessons (topic_id, position);

create table public.lesson_translations (
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  locale public.locale_code not null,
  title text not null check (char_length(title) between 1 and 200),
  summary text check (char_length(summary) <= 1000),
  ready boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (lesson_id, locale)
);

create table public.content_blocks (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  position int not null default 0,
  type public.block_type not null,
  schema_version smallint not null default 1 check (schema_version >= 1),
  props jsonb not null default '{}'::jsonb check (jsonb_typeof(props) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index content_blocks_lesson_idx on public.content_blocks (lesson_id, position);

create table public.content_block_translations (
  block_id uuid not null references public.content_blocks (id) on delete cascade,
  locale public.locale_code not null,
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (block_id, locale)
);

-- ---------------------------------------------------------------- triggers
do $$
declare t text;
begin
  foreach t in array array['media_assets', 'media_asset_translations', 'schools', 'school_translations',
    'courses', 'course_translations', 'modules', 'module_translations', 'topics', 'topic_translations',
    'lessons', 'lesson_translations', 'content_blocks', 'content_block_translations'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.set_updated_at()',
                   t || '_updated_at', t);
  end loop;
  foreach t in array array['media_assets', 'schools', 'courses', 'modules', 'topics', 'lessons'] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function private.content_row_guard()',
                   t || '_guard', t);
  end loop;
  foreach t in array array['media_assets', 'media_asset_translations', 'schools', 'school_translations',
    'courses', 'course_translations', 'course_prerequisites', 'modules', 'module_translations', 'topics',
    'topic_translations', 'lessons', 'lesson_translations'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_row()',
                   t || '_audit', t);
  end loop;
end $$;

-- Track unsaved-vs-published state of a lesson's working copy.
create or replace function private.touch_lesson() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_lesson uuid;
begin
  if tg_table_name = 'content_block_translations' then
    select b.lesson_id into v_lesson from public.content_blocks b
    where b.id = coalesce(new.block_id, old.block_id);
  else
    v_lesson := coalesce(new.lesson_id, old.lesson_id);
  end if;
  if v_lesson is not null then
    update public.lessons set draft_updated_at = now() where id = v_lesson;
  end if;
  return coalesce(new, old);
end $$;

create trigger content_blocks_touch after insert or update or delete on public.content_blocks
  for each row execute function private.touch_lesson();
create trigger content_block_translations_touch after insert or update or delete on public.content_block_translations
  for each row execute function private.touch_lesson();
create trigger lesson_translations_touch after insert or update or delete on public.lesson_translations
  for each row execute function private.touch_lesson();

-- ---------------------------------------------------------------- liveness helpers
create or replace function private.is_live_status(p_status public.content_status, p_publish_at timestamptz)
returns boolean language sql stable set search_path = '' as $$
  select p_status = 'published' or (p_status = 'scheduled' and p_publish_at is not null and p_publish_at <= now());
$$;

create or replace function private.school_live(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.schools s where s.id = p_id and private.is_live_status(s.status, s.publish_at));
$$;

create or replace function private.course_live(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.courses c
    where c.id = p_id and private.is_live_status(c.status, c.publish_at) and private.school_live(c.school_id)
  );
$$;

create or replace function private.module_live(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.modules m
    where m.id = p_id and private.is_live_status(m.status, m.publish_at) and private.course_live(m.course_id)
  );
$$;

create or replace function private.topic_live(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.topics t
    where t.id = p_id and private.is_live_status(t.status, t.publish_at) and private.module_live(t.module_id)
  );
$$;

create or replace function private.lesson_live(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.lessons l
    where l.id = p_id and l.published_revision_id is not null and l.status <> 'archived'
      and (l.publish_at is null or l.publish_at <= now()) and private.topic_live(l.topic_id)
  );
$$;

-- Effective tier: premium if the lesson or any ancestor is premium.
create or replace function private.lesson_tier(p_id uuid) returns public.access_tier
language sql stable security definer set search_path = '' as $$
  select case when l.access_tier = 'premium' or c.access_tier = 'premium' or s.access_tier = 'premium'
              then 'premium'::public.access_tier else 'free'::public.access_tier end
  from public.lessons l
  join public.topics t on t.id = l.topic_id
  join public.modules m on m.id = t.module_id
  join public.courses c on c.id = m.course_id
  join public.schools s on s.id = c.school_id
  where l.id = p_id;
$$;

-- ---------------------------------------------------------------- edit permission helpers
create or replace function private.can_edit_course(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select private.can_edit_owned(c.created_by) from public.courses c where c.id = p_id), false);
$$;
create or replace function private.can_edit_module(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select private.can_edit_owned(m.created_by) from public.modules m where m.id = p_id), false);
$$;
create or replace function private.can_edit_topic(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select private.can_edit_owned(t.created_by) from public.topics t where t.id = p_id), false);
$$;
create or replace function private.can_edit_lesson(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select private.can_edit_owned(l.created_by) from public.lessons l where l.id = p_id), false);
$$;
create or replace function private.can_edit_block(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select private.can_edit_lesson(b.lesson_id) from public.content_blocks b where b.id = p_id), false);
$$;

-- ---------------------------------------------------------------- RLS
alter table public.media_assets enable row level security;
alter table public.media_asset_translations enable row level security;
alter table public.media_asset_versions enable row level security;
alter table public.schools enable row level security;
alter table public.school_translations enable row level security;
alter table public.courses enable row level security;
alter table public.course_translations enable row level security;
alter table public.course_prerequisites enable row level security;
alter table public.modules enable row level security;
alter table public.module_translations enable row level security;
alter table public.topics enable row level security;
alter table public.topic_translations enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_translations enable row level security;
alter table public.content_blocks enable row level security;
alter table public.content_block_translations enable row level security;
alter table public.content_revisions enable row level security;

-- media: readers receive asset data through API functions; the library itself is staff-only
create policy media_select on public.media_assets for select to authenticated using (private.is_staff());
create policy media_insert on public.media_assets for insert to authenticated with check (private.can_manage_media());
create policy media_update on public.media_assets for update to authenticated
  using (private.can_manage_media()) with check (private.can_manage_media());
create policy media_delete on public.media_assets for delete to authenticated
  using (private.has_any_role(array['content_admin', 'media_manager']::public.app_role[]));
create policy media_tr_select on public.media_asset_translations for select to authenticated using (private.is_staff());
create policy media_tr_write on public.media_asset_translations for all to authenticated
  using (private.can_manage_media()) with check (private.can_manage_media());
create policy media_versions_select on public.media_asset_versions for select to authenticated using (private.is_staff());

-- schools: content admins manage; everyone reads live rows
create policy schools_select on public.schools for select to anon, authenticated
  using (private.is_live_status(status, publish_at) or private.is_staff());
create policy schools_insert on public.schools for insert to authenticated with check (private.can_publish());
create policy schools_update on public.schools for update to authenticated
  using (private.can_publish()) with check (private.can_publish());
create policy schools_delete on public.schools for delete to authenticated
  using (private.can_publish() and first_published_at is null);
create policy school_tr_select on public.school_translations for select to anon, authenticated
  using (private.school_live(school_id) or private.is_staff());
create policy school_tr_write on public.school_translations for all to authenticated
  using (private.can_publish()) with check (private.can_publish());

-- courses
create policy courses_select on public.courses for select to anon, authenticated
  using (private.course_live(id) or private.is_staff());
create policy courses_insert on public.courses for insert to authenticated with check (private.can_create_content());
create policy courses_update on public.courses for update to authenticated
  using (private.can_edit_owned(created_by)) with check (private.can_edit_owned(created_by));
create policy courses_delete on public.courses for delete to authenticated
  using (first_published_at is null and private.can_edit_owned(created_by));
create policy course_tr_select on public.course_translations for select to anon, authenticated
  using (private.course_live(course_id) or private.is_staff());
create policy course_tr_write on public.course_translations for all to authenticated
  using (private.can_edit_course(course_id)) with check (private.can_edit_course(course_id));
create policy course_pre_select on public.course_prerequisites for select to anon, authenticated
  using (private.course_live(course_id) or private.is_staff());
create policy course_pre_write on public.course_prerequisites for all to authenticated
  using (private.can_edit_course(course_id)) with check (private.can_edit_course(course_id));

-- modules
create policy modules_select on public.modules for select to anon, authenticated
  using (private.module_live(id) or private.is_staff());
create policy modules_insert on public.modules for insert to authenticated
  with check (private.can_create_content() and private.can_edit_course(course_id));
create policy modules_update on public.modules for update to authenticated
  using (private.can_edit_owned(created_by)) with check (private.can_edit_owned(created_by));
create policy modules_delete on public.modules for delete to authenticated
  using (first_published_at is null and private.can_edit_owned(created_by));
create policy module_tr_select on public.module_translations for select to anon, authenticated
  using (private.module_live(module_id) or private.is_staff());
create policy module_tr_write on public.module_translations for all to authenticated
  using (private.can_edit_module(module_id)) with check (private.can_edit_module(module_id));

-- topics
create policy topics_select on public.topics for select to anon, authenticated
  using (private.topic_live(id) or private.is_staff());
create policy topics_insert on public.topics for insert to authenticated
  with check (private.can_create_content() and private.can_edit_module(module_id));
create policy topics_update on public.topics for update to authenticated
  using (private.can_edit_owned(created_by)) with check (private.can_edit_owned(created_by));
create policy topics_delete on public.topics for delete to authenticated
  using (first_published_at is null and private.can_edit_owned(created_by));
create policy topic_tr_select on public.topic_translations for select to anon, authenticated
  using (private.topic_live(topic_id) or private.is_staff());
create policy topic_tr_write on public.topic_translations for all to authenticated
  using (private.can_edit_topic(topic_id)) with check (private.can_edit_topic(topic_id));

-- lessons: the working copy is staff-only; readers get the published snapshot via api_lesson()
create policy lessons_select on public.lessons for select to anon, authenticated
  using (private.lesson_live(id) or private.is_staff());
create policy lessons_insert on public.lessons for insert to authenticated
  with check (private.can_create_content() and exists (select 1 from public.topics t where t.id = topic_id));
create policy lessons_update on public.lessons for update to authenticated
  using (private.can_edit_owned(created_by)) with check (private.can_edit_owned(created_by));
create policy lessons_delete on public.lessons for delete to authenticated
  using (first_published_at is null and private.can_edit_owned(created_by));
create policy lesson_tr_select on public.lesson_translations for select to authenticated using (private.is_staff());
create policy lesson_tr_write on public.lesson_translations for all to authenticated
  using (private.can_edit_lesson(lesson_id)) with check (private.can_edit_lesson(lesson_id));
create policy blocks_select on public.content_blocks for select to authenticated using (private.is_staff());
create policy blocks_write on public.content_blocks for all to authenticated
  using (private.can_edit_lesson(lesson_id)) with check (private.can_edit_lesson(lesson_id));
create policy block_tr_select on public.content_block_translations for select to authenticated using (private.is_staff());
create policy block_tr_write on public.content_block_translations for all to authenticated
  using (private.can_edit_block(block_id)) with check (private.can_edit_block(block_id));

-- revisions are written only by workflow functions; answer keys are never selectable directly
create policy revisions_select on public.content_revisions for select to authenticated using (private.is_staff());
revoke select on public.content_revisions from anon, authenticated;
grant select (id, entity_type, entity_id, version, kind, snapshot, note, created_by, created_at)
  on public.content_revisions to authenticated;
revoke insert, update, delete on public.content_revisions from anon, authenticated;
