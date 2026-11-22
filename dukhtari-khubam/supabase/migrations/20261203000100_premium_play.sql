-- Premium: Google Play subscriptions kept as entitlements, the app's settings edited in the panel,
-- Premium per school and course from the panel, and deleting one's own account (Google Play requires it).

-- one Google Play purchase (its token) is one entitlement row, kept up to date with Google's answer
alter table public.entitlements add column if not exists play_token text;
alter table public.entitlements add column if not exists play_product text;
alter table public.entitlements add column if not exists play_order text;
alter table public.entitlements add column if not exists auto_renew boolean;
alter table public.entitlements add column if not exists updated_at timestamptz not null default now();
create unique index if not exists entitlements_play_token_idx on public.entitlements (play_token) where play_token is not null;

-- written only by the server (it proves itself with its secret, see private.server_ok): what Google said
-- about a purchase. A token keeps the account it was first bought on.
create or replace function public.api_play_entitlement(
  p_proof text, p_user uuid, p_token text, p_product text, p_order text, p_starts timestamptz, p_ends timestamptz, p_auto_renew boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if not private.server_ok(p_proof) then perform private.fail('forbidden'); end if;
  if p_token is null or char_length(p_token) > 2000 or p_ends is null then perform private.fail('validation_failed'); end if;
  insert into public.entitlements (user_id, tier, source, starts_at, ends_at, note, play_token, play_product, play_order, auto_renew)
  values (p_user, 'premium', 'payment', least(coalesce(p_starts, now()), p_ends - interval '1 second'), p_ends, 'Google Play',
          p_token, left(p_product, 120), left(p_order, 120), p_auto_renew)
  on conflict (play_token) where play_token is not null do update
    set ends_at = greatest(excluded.ends_at, public.entitlements.starts_at + interval '1 second'),
        play_order = coalesce(excluded.play_order, public.entitlements.play_order),
        auto_renew = excluded.auto_renew, updated_at = now()
  returning user_id into v_user;
  return jsonb_build_object('user', v_user, 'premium', private.has_premium(v_user));
end $$;

-- whose purchase a token is (Google's notifications name only the token)
create or replace function public.api_play_owner(p_proof text, p_token text) returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.server_ok(p_proof) then perform private.fail('forbidden'); end if;
  return (select user_id from public.entitlements where play_token = p_token);
end $$;

-- the signed-in learner's Premium: whether, until when, and how it was given
create or replace function public.api_my_premium() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'premium', private.has_premium(auth.uid()),
    'ends_at', (select max(e.ends_at) from public.entitlements e where e.user_id = auth.uid() and e.tier = 'premium' and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now())),
    'forever', exists (select 1 from public.entitlements e where e.user_id = auth.uid() and e.tier = 'premium' and e.starts_at <= now() and e.ends_at is null),
    'source', (select e.source from public.entitlements e where e.user_id = auth.uid() and e.tier = 'premium' and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now()) order by e.ends_at desc nulls first limit 1),
    'auto_renew', (select e.auto_renew from public.entitlements e where e.user_id = auth.uid() and e.play_token is not null order by e.ends_at desc limit 1)
  );
$$;
revoke all on function public.api_my_premium() from public, anon;
grant execute on function public.api_my_premium() to authenticated;

-- the app's own settings, changed in the panel (read by everyone through the API: nothing secret here)
create table if not exists public.app_settings (
  key text primary key check (key ~ '^[a-z_]{2,60}$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
alter table public.app_settings enable row level security;
insert into public.app_settings (key, value) values
  -- "Google Pay дастрас нест? Ба мушовир нависед" on the Premium screen of the Google Play build
  ('premium_consultant', 'false'::jsonb)
on conflict (key) do nothing;

create or replace function public.api_app_settings() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from public.app_settings;
$$;
grant execute on function public.api_app_settings() to anon, authenticated;

create or replace function public.admin_set_setting(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_role('content_admin') then perform private.fail('forbidden'); end if;
  insert into public.app_settings (key, value, updated_at, updated_by) values (p_key, p_value, now(), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
end $$;

-- Premium per school and course, from the panel's "Premium" tab
create or replace function public.admin_set_tier(p_kind text, p_id uuid, p_tier public.access_tier) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_role('content_admin') then perform private.fail('forbidden'); end if;
  if p_kind = 'school' then update public.schools set access_tier = p_tier where id = p_id;
  elsif p_kind = 'course' then update public.courses set access_tier = p_tier where id = p_id;
  else perform private.fail('validation_failed'); end if;
  if not found then perform private.fail('not_found'); end if;
end $$;

-- the panel's overview: schools and their courses with their tiers, and who has Premium now
create or replace function public.admin_premium_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.has_role('content_admin') then perform private.fail('forbidden'); end if;
  return jsonb_build_object(
    'schools', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'slug', s.slug, 'tier', s.access_tier,
        'title', coalesce((select st.title from public.school_translations st where st.school_id = s.id order by (st.locale::text = 'tg') desc limit 1), s.slug),
        'courses', coalesce((
          select jsonb_agg(jsonb_build_object('id', c.id, 'tier', c.access_tier,
            'title', coalesce((select ct.title from public.course_translations ct where ct.course_id = c.id order by (ct.locale::text = 'tg') desc limit 1), c.slug)
          ) order by c.position)
          from public.courses c where c.school_id = s.id and c.status::text <> 'archived'), '[]'::jsonb)
      ) order by s.position)
      from public.schools s where s.status::text <> 'archived'), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(x order by x ->> 'ends_at' desc nulls first) from (
        select jsonb_build_object('id', e.id, 'email', u.email, 'source', e.source, 'ends_at', e.ends_at, 'auto_renew', e.auto_renew,
          'note', e.note, 'starts_at', e.starts_at) as x
        from public.entitlements e join auth.users u on u.id = e.user_id
        where e.tier = 'premium' and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now())
        order by e.created_at desc limit 500) m), '[]'::jsonb),
    'settings', public.api_app_settings()
  );
end $$;

-- Premium by e-mail for a number of months (bought through a consultant): 0 months is "for ever"
create or replace function public.admin_grant_by_email(p_email text, p_months int, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid; v_id uuid; v_from timestamptz;
begin
  if not private.has_role('content_admin') then perform private.fail('forbidden'); end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_user is null then perform private.fail('not_found'); end if;
  if p_months < 0 or p_months > 60 then perform private.fail('validation_failed'); end if;
  -- months follow on from the Premium she already has
  select greatest(now(), coalesce(max(ends_at), now())) into v_from from public.entitlements
    where user_id = v_user and tier = 'premium' and (ends_at is null or ends_at > now());
  insert into public.entitlements (user_id, tier, source, starts_at, ends_at, note, created_by)
  values (v_user, 'premium', 'manual', now(), case when p_months = 0 then null else v_from + make_interval(months => p_months) end,
          left(coalesce(p_note, 'Мушовир'), 500), auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'user', v_user);
end $$;

-- deleting one's own account and everything kept about it (a staff account is removed by an admin)
create or replace function public.api_delete_me() returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then perform private.fail('auth_required'); end if;
  if exists (select 1 from public.user_roles where user_id = v_uid) then perform private.fail('forbidden'); end if;
  delete from public.mahliyo_questions where code_hash in (select code_hash from public.google_learners where user_id = v_uid);
  delete from public.device_profiles where code_hash in (select code_hash from public.google_learners where user_id = v_uid);
  delete from auth.users where id = v_uid;
end $$;
revoke all on function public.api_delete_me() from public, anon;
grant execute on function public.api_delete_me() to authenticated;
