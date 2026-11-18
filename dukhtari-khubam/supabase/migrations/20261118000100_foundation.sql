-- Духтари хубам · 0001 foundation
-- Schemas, enums, role helpers (RBAC), profiles, entitlements, audit log.
-- Supabase provides: auth.users, auth.uid(), roles anon/authenticated/service_role.

create schema if not exists private;
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

grant usage on schema private to anon, authenticated, service_role;

-- ---------------------------------------------------------------- enums
create type public.app_role as enum (
  'super_admin', 'content_admin', 'author', 'editor', 'reviewer', 'media_manager', 'analytics_viewer'
);
create type public.content_status as enum (
  'draft', 'in_review', 'changes_requested', 'approved', 'scheduled', 'published', 'archived'
);
create type public.locale_code as enum ('tg', 'ru', 'ar');
create type public.access_tier as enum ('free', 'premium');
create type public.media_kind as enum ('image', 'video', 'audio', 'file', 'model3d');
create type public.asset_origin as enum (
  'photo', 'stock', 'model3d', 'render3d', 'illustration', 'icon', 'document', 'other'
);
create type public.block_type as enum (
  'heading', 'subheading', 'paragraph', 'lead', 'rich_text', 'ordered_list', 'bullet_list',
  'image', 'gallery', 'video', 'audio', 'quote', 'callout', 'table', 'source', 'file',
  'practical_task', 'quiz', 'related_lesson', 'divider', 'illustration', 'full_width_media',
  'side_by_side', 'model3d', 'caption', 'footnote'
);
create type public.question_type as enum (
  'single_choice', 'multiple_choice', 'true_false', 'matching', 'ordering', 'short_answer', 'long_answer'
);
create type public.attempt_status as enum ('in_progress', 'submitted', 'pending_review', 'graded');
create type public.reveal_policy as enum ('never', 'after_each', 'after_submit');

-- ---------------------------------------------------------------- generic triggers
create or replace function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- profiles & roles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  avatar_path text check (char_length(avatar_path) <= 300),
  locale public.locale_code not null default 'tg',
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  reduce_motion boolean not null default false,
  text_scale numeric(3, 2) not null default 1.00 check (text_scale between 0.80 and 1.60),
  notifications_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tier public.access_tier not null default 'premium',
  source text not null default 'manual' check (source in ('manual', 'promo', 'payment')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  note text check (char_length(note) <= 500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index entitlements_user_idx on public.entitlements (user_id);

-- ---------------------------------------------------------------- RBAC helpers
create or replace function private.has_role(p_role public.app_role) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and (ur.role = p_role or ur.role = 'super_admin')
  );
$$;

create or replace function private.has_any_role(p_roles public.app_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and (ur.role = any (p_roles) or ur.role = 'super_admin')
  );
$$;

create or replace function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()));
$$;

create or replace function private.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role = 'super_admin'
  );
$$;

create or replace function private.can_edit_any() returns boolean
language sql stable set search_path = '' as $$
  select private.has_any_role(array['content_admin', 'editor']::public.app_role[]);
$$;

-- Authors may edit only rows they created; editors and content admins may edit any row.
create or replace function private.can_edit_owned(p_owner uuid) returns boolean
language sql stable set search_path = '' as $$
  select private.can_edit_any()
      or (private.has_role('author') and p_owner is not null and p_owner = (select auth.uid()));
$$;

create or replace function private.can_create_content() returns boolean
language sql stable set search_path = '' as $$
  select private.has_any_role(array['content_admin', 'editor', 'author']::public.app_role[]);
$$;

create or replace function private.can_review() returns boolean
language sql stable set search_path = '' as $$
  select private.has_any_role(array['content_admin', 'reviewer']::public.app_role[]);
$$;

create or replace function private.can_publish() returns boolean
language sql stable set search_path = '' as $$
  select private.has_role('content_admin');
$$;

create or replace function private.can_manage_media() returns boolean
language sql stable set search_path = '' as $$
  select private.has_any_role(array['content_admin', 'media_manager', 'editor', 'author']::public.app_role[]);
$$;

create or replace function private.can_view_analytics() returns boolean
language sql stable set search_path = '' as $$
  select private.has_any_role(array['content_admin', 'analytics_viewer']::public.app_role[]);
$$;

-- Premium entitlement; staff always have access (needed for preview and review).
create or replace function private.has_premium(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_user is not null and (
    exists (
      select 1 from public.entitlements e
      where e.user_id = p_user and e.tier = 'premium'
        and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now())
    )
    or exists (select 1 from public.user_roles ur where ur.user_id = p_user)
  );
$$;

-- Raise a typed API error. The API maps the message to an HTTP status.
create or replace function private.fail(p_code text, p_detail jsonb default null) returns void
language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = 'P0001', message = p_code, detail = coalesce(p_detail::text, '');
end $$;

-- ---------------------------------------------------------------- new user → profile
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80), ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------- audit log
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  table_name text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (table_name, entity_id, created_at desc);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

create or replace function private.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
begin
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;
  v_row := coalesce(v_new, v_old);
  insert into public.audit_logs (actor_id, action, table_name, entity_id, old_data, new_data)
  values (
    auth.uid(), lower(tg_op), tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'key', v_row ->> 'block_id', v_row ->> 'question_id',
             v_row ->> 'option_id', v_row ->> 'section_id', v_row ->> 'lesson_id', v_row ->> 'topic_id',
             v_row ->> 'module_id', v_row ->> 'course_id', v_row ->> 'school_id', v_row ->> 'quiz_id',
             v_row ->> 'asset_id', v_row ->> 'page_id', v_row ->> 'banner_id',
             v_row ->> 'inspiration_id', v_row ->> 'achievement_id', v_row ->> 'notification_id',
             v_row ->> 'user_id'),
    v_old, v_new
  );
  return coalesce(new, old);
end $$;

create trigger user_roles_audit after insert or update or delete on public.user_roles
  for each row execute function private.audit_row();
create trigger entitlements_audit after insert or update or delete on public.entitlements
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------- workflow-protected columns
-- Clients (anon/authenticated) may not set workflow or ownership columns directly;
-- those change only through security-definer workflow functions (run as table owner).
create or replace function private.content_row_guard() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb;
  v_patch jsonb := '{}'::jsonb;
  k text;
  -- media assets keep a free 'active/archived' status; only ownership and version are protected
  v_is_media boolean := tg_table_name = 'media_assets';
  protected text[] := case when tg_table_name = 'media_assets' then array['version', 'created_by']
                           else array['status', 'publish_at', 'first_published_at', 'published_revision_id',
                                      'published_at', 'version', 'created_by', 'sent_at'] end;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if v_new ? 'created_by' then v_patch := v_patch || jsonb_build_object('created_by', auth.uid()); end if;
    if v_new ? 'updated_by' then v_patch := v_patch || jsonb_build_object('updated_by', auth.uid()); end if;
    if v_new ? 'status' and not v_is_media then v_patch := v_patch || '{"status":"draft"}'::jsonb; end if;
    foreach k in array array['publish_at', 'first_published_at', 'published_revision_id', 'published_at', 'sent_at'] loop
      if v_new ? k then v_patch := v_patch || jsonb_build_object(k, null); end if;
    end loop;
    if v_new ? 'version' then v_patch := v_patch || '{"version":1}'::jsonb; end if;
    return jsonb_populate_record(new, v_patch);
  end if;
  v_old := to_jsonb(old);
  foreach k in array protected loop
    if v_new ? k and (v_new -> k) is distinct from (v_old -> k) then
      perform private.fail('protected_field', jsonb_build_object('field', k));
    end if;
  end loop;
  if v_new ? 'updated_by' then
    return jsonb_populate_record(new, jsonb_build_object('updated_by', auth.uid()));
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- RLS: foundation tables
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.entitlements enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.is_staff());
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or private.is_super_admin());

create policy entitlements_select on public.entitlements for select to authenticated
  using (user_id = (select auth.uid()) or private.has_role('content_admin'));

create policy audit_logs_select on public.audit_logs for select to authenticated
  using (private.has_role('content_admin'));

-- ---------------------------------------------------------------- role management API
create or replace function public.admin_grant_role(p_user uuid, p_role public.app_role) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_super_admin() then perform private.fail('forbidden'); end if;
  if not exists (select 1 from auth.users u where u.id = p_user) then perform private.fail('not_found'); end if;
  insert into public.user_roles (user_id, role, granted_by) values (p_user, p_role, auth.uid())
  on conflict (user_id, role) do nothing;
end $$;

create or replace function public.admin_revoke_role(p_user uuid, p_role public.app_role) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_super_admin() then perform private.fail('forbidden'); end if;
  if p_role = 'super_admin'
     and (select count(*) from public.user_roles where role = 'super_admin') <= 1
     and exists (select 1 from public.user_roles where user_id = p_user and role = 'super_admin') then
    perform private.fail('last_super_admin');
  end if;
  delete from public.user_roles where user_id = p_user and role = p_role;
end $$;

create or replace function public.admin_list_users(p_query text default null, p_limit int default 50, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_q text := nullif(trim(coalesce(p_query, '')), '');
begin
  if not private.has_role('content_admin') then perform private.fail('forbidden'); end if;
  return coalesce((
    select jsonb_agg(x order by x ->> 'created_at' desc)
    from (
      select jsonb_build_object(
        'id', u.id, 'email', u.email, 'display_name', p.display_name, 'created_at', u.created_at,
        'roles', coalesce((select jsonb_agg(r.role order by r.role) from public.user_roles r where r.user_id = u.id), '[]'::jsonb),
        'premium', private.has_premium(u.id)
      ) as x
      from auth.users u left join public.profiles p on p.id = u.id
      where v_q is null or u.email ilike '%' || v_q || '%' or p.display_name ilike '%' || v_q || '%'
      order by u.created_at desc
      limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0)
    ) s
  ), '[]'::jsonb);
end $$;

create or replace function public.admin_grant_entitlement(p_user uuid, p_ends_at timestamptz default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not private.has_role('content_admin') then perform private.fail('forbidden'); end if;
  insert into public.entitlements (user_id, tier, source, ends_at, note, created_by)
  values (p_user, 'premium', 'manual', p_ends_at, p_note, auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.admin_revoke_entitlement(p_entitlement uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_role('content_admin') then perform private.fail('forbidden'); end if;
  update public.entitlements set ends_at = greatest(starts_at + interval '1 second', now()) where id = p_entitlement;
end $$;

-- Bootstrap helper for the owner: run from the SQL editor as postgres (not exposed via API).
create or replace function private.grant_role_by_email(p_email text, p_role public.app_role) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(p_email);
  if v_user is null then raise exception 'user % not found', p_email; end if;
  insert into public.user_roles (user_id, role) values (v_user, p_role) on conflict do nothing;
end $$;
