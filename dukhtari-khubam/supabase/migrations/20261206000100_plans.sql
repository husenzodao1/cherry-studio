-- Plans: free, Standard and Premium. Content (schools, courses, lessons, tests) is free, Standard or Premium;
-- a plan opens its own tier and those below it (staff open everything). What Mahliyo does for each plan is
-- counted (plan_usage) by the server. Subscriptions bought through Paddle, Premium gifts for a friend, and
-- Standard's free Premium week in its second month.
-- (The new tier is only compared as text here and in plpgsql bodies: a value added to an enum cannot be used
-- in the same transaction it was added in.)

alter type public.access_tier add value if not exists 'standard' before 'premium';

-- ---------------------------------------------------------------- the plans
create or replace function private.tier_rank(p_tier text) returns int
language sql immutable set search_path = '' as $$
  select case p_tier when 'premium' then 2 when 'standard' then 1 else 0 end
$$;

-- the learner's plan now: 'premium' (or staff), 'standard' or 'free'
create or replace function private.plan_of(p_user uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_rank int;
begin
  if p_user is null then return 'free'; end if;
  if exists (select 1 from public.user_roles ur where ur.user_id = p_user) then return 'premium'; end if;
  select max(private.tier_rank(e.tier::text)) into v_rank from public.entitlements e
    where e.user_id = p_user and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now());
  return case coalesce(v_rank, 0) when 2 then 'premium' when 1 then 'standard' else 'free' end;
end $$;

-- whether the learner may open content of this tier
create or replace function private.can_open(p_user uuid, p_tier public.access_tier) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  return private.tier_rank(coalesce(p_tier::text, 'free')) <= private.tier_rank(private.plan_of(p_user));
end $$;

-- a lesson's, course's and test's tier: the highest of its own and its course's and school's
create or replace function private.lesson_tier(p_id uuid) returns public.access_tier
language plpgsql stable security definer set search_path = '' as $$
declare v text;
begin
  select case greatest(private.tier_rank(l.access_tier::text), private.tier_rank(c.access_tier::text), private.tier_rank(s.access_tier::text))
           when 2 then 'premium' when 1 then 'standard' else 'free' end into v
  from public.lessons l
  join public.topics t on t.id = l.topic_id
  join public.modules m on m.id = t.module_id
  join public.courses c on c.id = m.course_id
  join public.schools s on s.id = c.school_id
  where l.id = p_id;
  return v::public.access_tier;
end $$;

create or replace function private.course_tier(p_course uuid) returns public.access_tier
language plpgsql stable security definer set search_path = '' as $$
declare v text;
begin
  select case greatest(private.tier_rank(c.access_tier::text), private.tier_rank(s.access_tier::text))
           when 2 then 'premium' when 1 then 'standard' else 'free' end into v
  from public.courses c join public.schools s on s.id = c.school_id where c.id = p_course;
  return v::public.access_tier;
end $$;

create or replace function private.quiz_tier(p_id uuid) returns public.access_tier
language plpgsql stable security definer set search_path = '' as $$
declare z public.quizzes%rowtype; v public.access_tier;
begin
  select * into z from public.quizzes where id = p_id;
  if not found then return null; end if;
  v := case
    when z.lesson_id is not null then private.lesson_tier(z.lesson_id)
    when z.topic_id is not null then (select private.course_tier(m.course_id) from public.topics t join public.modules m on m.id = t.module_id where t.id = z.topic_id)
    when z.module_id is not null then (select private.course_tier(m.course_id) from public.modules m where m.id = z.module_id)
    when z.course_id is not null then private.course_tier(z.course_id)
    when z.school_id is not null then (select s.access_tier from public.schools s where s.id = z.school_id)
    else null end;
  -- the test's own tier, when it is higher
  if private.tier_rank(z.access_tier::text) > private.tier_rank(coalesce(v::text, 'free')) then return z.access_tier; end if;
  return coalesce(v, z.access_tier);
end $$;

-- ---------------------------------------------------------------- what Mahliyo did, counted
-- `who`: the account (user id) or, for a learner without an account, her phone's token hash
create table if not exists public.plan_usage (
  who text not null check (char_length(who) between 8 and 80),
  period text not null check (period ~ '^(d|m)[0-9]{4}-[0-9]{2}(-[0-9]{2})?$'),
  kind text not null check (kind ~ '^[a-z_]{2,30}$'),
  used int not null default 0,
  primary key (who, period, kind)
);
alter table public.plan_usage enable row level security;

-- counts one use when under the limit (server only); a limit below 0 is "no limit"
create or replace function public.api_plan_use(p_proof text, p_who text, p_kind text, p_period text, p_limit int, p_count boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_used int;
begin
  if not private.server_ok(p_proof) then perform private.fail('forbidden'); end if;
  select used into v_used from public.plan_usage where who = p_who and period = p_period and kind = p_kind;
  v_used := coalesce(v_used, 0);
  if p_limit >= 0 and v_used >= p_limit then return jsonb_build_object('ok', false, 'used', v_used, 'limit', p_limit); end if;
  if p_count then
    insert into public.plan_usage (who, period, kind, used) values (p_who, p_period, p_kind, 1)
    on conflict (who, period, kind) do update set used = public.plan_usage.used + 1
    returning used into v_used;
  end if;
  return jsonb_build_object('ok', true, 'used', v_used, 'limit', p_limit);
end $$;
revoke all on function public.api_plan_use(text, text, text, text, int, boolean) from public;
grant execute on function public.api_plan_use(text, text, text, text, int, boolean) to anon, authenticated;

-- a learner's plan by her sign-in (server only: Mahliyo's answers)
create or replace function public.api_plan_of(p_proof text, p_user uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.server_ok(p_proof) then perform private.fail('forbidden'); end if;
  return private.plan_of(p_user);
end $$;
revoke all on function public.api_plan_of(text, uuid) from public;
grant execute on function public.api_plan_of(text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------- Paddle subscriptions
alter table public.entitlements add column if not exists paddle_subscription text;
create unique index if not exists entitlements_paddle_idx on public.entitlements (paddle_subscription) where paddle_subscription is not null;

-- written only by the server from Paddle's signed webhook: a subscription's plan and paid time
create or replace function public.api_paddle_entitlement(
  p_proof text, p_user uuid, p_subscription text, p_tier text, p_starts timestamptz, p_ends timestamptz, p_auto_renew boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not private.server_ok(p_proof) then perform private.fail('forbidden'); end if;
  if p_tier not in ('standard', 'premium') or p_subscription is null or p_ends is null then perform private.fail('validation_failed'); end if;
  insert into public.entitlements (user_id, tier, source, starts_at, ends_at, note, paddle_subscription, auto_renew)
  values (p_user, p_tier::public.access_tier, 'payment', least(coalesce(p_starts, now()), p_ends - interval '1 second'), p_ends, 'Paddle', left(p_subscription, 120), p_auto_renew)
  on conflict (paddle_subscription) where paddle_subscription is not null do update
    set tier = excluded.tier, ends_at = greatest(excluded.ends_at, public.entitlements.starts_at + interval '1 second'),
        auto_renew = excluded.auto_renew, updated_at = now();
  return jsonb_build_object('user', p_user, 'plan', private.plan_of(p_user));
end $$;
revoke all on function public.api_paddle_entitlement(text, uuid, text, text, timestamptz, timestamptz, boolean) from public;
grant execute on function public.api_paddle_entitlement(text, uuid, text, text, timestamptz, timestamptz, boolean) to anon, authenticated;

-- ---------------------------------------------------------------- gifts and perks
-- three days of Premium for a friend, given with a Premium purchase; one code, one friend
create table if not exists public.plan_gifts (
  code text primary key check (code ~ '^[A-Z0-9]{8}$'),
  from_user uuid not null references auth.users (id) on delete cascade,
  days int not null check (days between 1 and 31),
  created_at timestamptz not null default now(),
  redeemed_by uuid references auth.users (id) on delete set null,
  redeemed_at timestamptz
);
alter table public.plan_gifts enable row level security;
create index if not exists plan_gifts_from_idx on public.plan_gifts (from_user);

create table if not exists public.plan_perks (
  user_id uuid not null references auth.users (id) on delete cascade,
  perk text not null check (perk ~ '^[a-z_]{2,40}$'),
  at timestamptz not null default now(),
  primary key (user_id, perk)
);
alter table public.plan_perks enable row level security;

-- a gift for a friend, made by the server when a Premium subscription is bought (once per subscription)
create or replace function public.api_make_gift(p_proof text, p_user uuid, p_days int default 3) returns text
language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  if not private.server_ok(p_proof) then perform private.fail('forbidden'); end if;
  loop
    v_code := upper(substr(translate(encode(extensions.gen_random_bytes(12), 'base64'), '+/=0O1IL', ''), 1, 8));
    exit when char_length(v_code) = 8 and not exists (select 1 from public.plan_gifts where code = v_code);
  end loop;
  insert into public.plan_gifts (code, from_user, days) values (v_code, p_user, p_days);
  return v_code;
end $$;
revoke all on function public.api_make_gift(text, uuid, int) from public;
grant execute on function public.api_make_gift(text, uuid, int) to anon, authenticated;

-- a friend takes the gift: Premium for its days, from now (never one's own gift, each code once)
create or replace function public.api_redeem_gift(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g public.plan_gifts%rowtype; v_uid uuid := auth.uid();
begin
  if v_uid is null then perform private.fail('auth_required'); end if;
  select * into g from public.plan_gifts where code = upper(trim(p_code)) for update;
  if not found then perform private.fail('not_found'); end if;
  if g.redeemed_by is not null or g.from_user = v_uid then perform private.fail('conflict'); end if;
  update public.plan_gifts set redeemed_by = v_uid, redeemed_at = now() where code = g.code;
  insert into public.entitlements (user_id, tier, source, starts_at, ends_at, note)
  values (v_uid, 'premium', 'promo', now(), now() + make_interval(days => g.days), 'Тӯҳфаи дӯст');
  return jsonb_build_object('plan', private.plan_of(v_uid), 'days', g.days);
end $$;
revoke all on function public.api_redeem_gift(text) from public, anon;
grant execute on function public.api_redeem_gift(text) to authenticated;

-- Standard's second month: one free week of Premium, taken once
create or replace function public.api_claim_premium_week() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then perform private.fail('auth_required'); end if;
  if not exists (select 1 from public.entitlements e where e.user_id = v_uid and e.tier::text = 'standard'
                 and e.starts_at <= now() - interval '28 days' and (e.ends_at is null or e.ends_at > now())) then
    perform private.fail('not_allowed');
  end if;
  insert into public.plan_perks (user_id, perk) values (v_uid, 'premium_week') on conflict do nothing;
  if not found then perform private.fail('conflict'); end if;
  insert into public.entitlements (user_id, tier, source, starts_at, ends_at, note)
  values (v_uid, 'premium', 'promo', now(), now() + interval '7 days', 'Ҳафтаи Premium барои Standard');
  return jsonb_build_object('plan', private.plan_of(v_uid));
end $$;
revoke all on function public.api_claim_premium_week() from public, anon;
grant execute on function public.api_claim_premium_week() to authenticated;

-- ---------------------------------------------------------------- the learner's plan, for the app
create or replace function public.api_my_plan() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_plan text;
begin
  v_plan := private.plan_of(v_uid);
  return jsonb_build_object(
    'plan', v_plan,
    'staff', exists (select 1 from public.user_roles ur where ur.user_id = v_uid),
    'premium', v_plan = 'premium',
    'ends_at', (select max(e.ends_at) from public.entitlements e where e.user_id = v_uid and e.tier::text = v_plan and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now())),
    'forever', exists (select 1 from public.entitlements e where e.user_id = v_uid and e.tier::text = v_plan and e.starts_at <= now() and e.ends_at is null),
    'source', (select e.source from public.entitlements e where e.user_id = v_uid and e.tier::text = v_plan and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now()) order by e.ends_at desc nulls first limit 1),
    'auto_renew', (select e.auto_renew from public.entitlements e where e.user_id = v_uid and (e.play_token is not null or e.paddle_subscription is not null) order by e.ends_at desc limit 1),
    'standard_since', (select min(e.starts_at) from public.entitlements e where e.user_id = v_uid and e.tier::text = 'standard' and (e.ends_at is null or e.ends_at > now())),
    'week_taken', exists (select 1 from public.plan_perks p where p.user_id = v_uid and p.perk = 'premium_week'),
    'gifts', coalesce((select jsonb_agg(jsonb_build_object('code', g.code, 'days', g.days, 'redeemed', g.redeemed_by is not null) order by g.created_at desc)
                        from public.plan_gifts g where g.from_user = v_uid), '[]'::jsonb)
  );
end $$;
revoke all on function public.api_my_plan() from public;
grant execute on function public.api_my_plan() to anon, authenticated;

-- Premium as before (Premium or staff), with the plan beside it
create or replace function public.api_my_premium() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  return public.api_my_plan();
end $$;

-- ---------------------------------------------------------------- the panel
create or replace function public.admin_set_tier(p_kind text, p_id uuid, p_tier public.access_tier) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_role('content_admin') then perform private.fail('forbidden'); end if;
  if p_kind = 'school' then update public.schools set access_tier = p_tier where id = p_id;
  elsif p_kind = 'course' then update public.courses set access_tier = p_tier where id = p_id;
  elsif p_kind = 'lesson' then update public.lessons set access_tier = p_tier where id = p_id;
  elsif p_kind = 'quiz' then update public.quizzes set access_tier = p_tier where id = p_id;
  else perform private.fail('validation_failed'); end if;
  if not found then perform private.fail('not_found'); end if;
end $$;

-- a plan for an account by its e-mail, for some months (0: for ever) — bought through a consultant
create or replace function public.admin_grant_plan(p_email text, p_tier text, p_months int, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid; v_id uuid; v_from timestamptz;
begin
  if not private.has_role('content_admin') then perform private.fail('forbidden'); end if;
  if p_tier not in ('standard', 'premium') or p_months < 0 or p_months > 60 then perform private.fail('validation_failed'); end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_user is null then perform private.fail('not_found'); end if;
  -- months follow on from the same plan she already has
  select greatest(now(), coalesce(max(ends_at), now())) into v_from from public.entitlements
    where user_id = v_user and tier::text = p_tier and (ends_at is null or ends_at > now());
  insert into public.entitlements (user_id, tier, source, starts_at, ends_at, note, created_by)
  values (v_user, p_tier::public.access_tier, 'manual', now(), case when p_months = 0 then null else v_from + make_interval(months => p_months) end,
          left(coalesce(p_note, 'Мушовир'), 500), auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'user', v_user, 'plan', private.plan_of(v_user));
end $$;
revoke all on function public.admin_grant_plan(text, text, int, text) from public, anon;
grant execute on function public.admin_grant_plan(text, text, int, text) to authenticated;

-- a subscription taken back (the panel's ✕): ends now
create or replace function public.admin_end_entitlement(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_role('content_admin') then perform private.fail('forbidden'); end if;
  update public.entitlements set ends_at = greatest(starts_at + interval '1 second', now()), updated_at = now() where id = p_id;
  if not found then perform private.fail('not_found'); end if;
end $$;
revoke all on function public.admin_end_entitlement(uuid) from public, anon;
grant execute on function public.admin_end_entitlement(uuid) to authenticated;

create or replace function public.admin_premium_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.has_role('content_admin') then perform private.fail('forbidden'); end if;
  return jsonb_build_object(
    'schools', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'slug', s.slug, 'tier', s.access_tier, 'audience', s.audience,
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
        select jsonb_build_object('id', e.id, 'email', u.email, 'tier', e.tier, 'source', e.source, 'ends_at', e.ends_at, 'auto_renew', e.auto_renew,
          'note', e.note, 'starts_at', e.starts_at) as x
        from public.entitlements e join auth.users u on u.id = e.user_id
        where e.tier::text in ('standard', 'premium') and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now())
        order by e.created_at desc limit 500) m), '[]'::jsonb),
    'counts', jsonb_build_object(
      'standard', (select count(distinct e.user_id) from public.entitlements e where e.tier::text = 'standard' and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now())),
      'premium', (select count(distinct e.user_id) from public.entitlements e where e.tier::text = 'premium' and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now()))),
    'settings', public.api_app_settings()
  );
end $$;

-- the plans are on from now (the panel can switch them off: plans_live)
insert into public.app_settings (key, value) values ('plans_live', 'true'::jsonb) on conflict (key) do nothing;

-- ---------------------------------------------------------------- the readers, with the plans' check
-- public.api_course: the same, with the three plans' check
create or replace function public.api_course(p_course uuid, p_locale public.locale_code default 'tg') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  c public.courses%rowtype;
  v_tr jsonb;
  v_uid uuid := auth.uid();
  v_loc text := p_locale::text;
  v_locked boolean;
begin
  select * into c from public.courses where id = p_course;
  if not found or not private.course_live(p_course) then perform private.fail('not_found'); end if;
  v_tr := private.struct_tr('course', c.id, v_loc);
  if v_tr is null then perform private.fail('not_found'); end if;
  v_locked := not private.can_open(v_uid, private.course_tier(c.id));
  return jsonb_build_object(
    'id', c.id, 'slug', c.slug, 'title', v_tr ->> 'title', 'description', v_tr ->> 'description',
    'goals', coalesce(v_tr -> 'goals', '[]'::jsonb), 'locale', v_tr ->> 'locale',
    'level', c.level, 'estimated_minutes', c.estimated_minutes,
    'access_tier', private.course_tier(c.id), 'locked', v_locked,
    'cover', private.asset_json(c.cover_asset_id, v_loc), 'model', private.asset_json(c.model_asset_id, v_loc),
    'school', (select jsonb_build_object('id', s.id, 'slug', s.slug, 'title', private.struct_tr('school', s.id, v_loc) ->> 'title')
               from public.schools s where s.id = c.school_id),
    'prerequisites', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.required_course_id,
        'title', private.struct_tr('course', p.required_course_id, v_loc) ->> 'title',
        'completed', (private.course_progress(p.required_course_id, v_uid) ->> 'percent')::int = 100))
      from public.course_prerequisites p where p.course_id = c.id and private.course_live(p.required_course_id)), '[]'::jsonb),
    'progress', private.course_progress(c.id, v_uid),
    'resume_lesson_id', (
      select lp.lesson_id from public.lesson_progress lp
      where lp.user_id = v_uid and lp.status = 'started' and lp.lesson_id in (select private.course_lesson_ids(c.id))
      order by lp.updated_at desc limit 1),
    'quizzes', coalesce((select jsonb_agg(private.quiz_card(z.id, v_loc) order by z.position)
                         from public.quizzes z where z.course_id = c.id and private.quiz_live(z.id)), '[]'::jsonb),
    'modules', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'title', mtr ->> 'title', 'description', mtr ->> 'description',
        'quizzes', coalesce((select jsonb_agg(private.quiz_card(z.id, v_loc) order by z.position)
                             from public.quizzes z where z.module_id = m.id and private.quiz_live(z.id)), '[]'::jsonb),
        'topics', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', t.id, 'title', ttr ->> 'title', 'description', ttr ->> 'description',
            'quizzes', coalesce((select jsonb_agg(private.quiz_card(z.id, v_loc) order by z.position)
                                 from public.quizzes z where z.topic_id = t.id and private.quiz_live(z.id)), '[]'::jsonb),
            'lessons', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', l.id, 'title', private.lesson_title(l.id, v_loc), 'estimated_minutes', l.estimated_minutes,
                'access_tier', private.lesson_tier(l.id),
                'locked', not private.can_open(v_uid, private.lesson_tier(l.id)),
                'progress', (select p.status from public.lesson_progress p where p.user_id = v_uid and p.lesson_id = l.id))
                order by l.position, l.id)
              from public.lessons l where l.topic_id = t.id and private.lesson_live(l.id)), '[]'::jsonb))
            order by t.position, t.id)
          from public.topics t
          cross join lateral (select private.struct_tr('topic', t.id, v_loc) as ttr) tt
          where t.module_id = m.id and private.topic_live(t.id) and tt.ttr is not null), '[]'::jsonb))
        order by m.position, m.id)
      from public.modules m
      cross join lateral (select private.struct_tr('module', m.id, v_loc) as mtr) mm
      where m.course_id = c.id and private.module_live(m.id) and mm.mtr is not null), '[]'::jsonb));
end $$;

-- public.api_lesson: the same, with the three plans' check
create or replace function public.api_lesson(p_lesson uuid, p_locale public.locale_code default 'tg') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_snap jsonb;
  v_locked boolean;
begin
  if not private.lesson_live(p_lesson) then perform private.fail('not_found'); end if;
  select r.snapshot into v_snap
  from public.lessons l join public.content_revisions r on r.id = l.published_revision_id where l.id = p_lesson;
  v_locked := not private.can_open(auth.uid(), private.lesson_tier(p_lesson));
  -- the tests made for this lesson (admin: the lesson's "Тестҳо" tab) come with it
  return private.render_lesson(p_lesson, v_snap, p_locale::text, v_locked) || jsonb_build_object(
    'quizzes', coalesce((select jsonb_agg(private.quiz_card(z.id, p_locale::text) order by z.position, z.id)
                         from public.quizzes z where z.lesson_id = p_lesson and private.quiz_live(z.id)), '[]'::jsonb));
end $$;

-- public.api_offline_quiz: the same, with the three plans' check
CREATE OR REPLACE FUNCTION public.api_offline_quiz(p_quiz uuid, p_locale locale_code DEFAULT 'tg'::locale_code)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  z public.quizzes%rowtype;
  r public.content_revisions%rowtype;
  v_display jsonb;
  v_payload jsonb;
  v_loc text;
begin
  select * into z from public.quizzes where id = p_quiz;
  if not found or not private.quiz_live(p_quiz) or (not private.can_open(auth.uid(), private.quiz_tier(p_quiz))) then return null; end if;
  select * into r from public.content_revisions where id = z.published_revision_id;
  v_display := jsonb_build_object(
    'questions', coalesce((select jsonb_agg(q -> 'id' order by (q ->> 'position')::int)
                           from jsonb_array_elements(r.snapshot -> 'questions') q), '[]'::jsonb),
    'options', coalesce((select jsonb_object_agg(q ->> 'id', coalesce((
                           select jsonb_agg(o -> 'id' order by (o ->> 'position')::int) from jsonb_array_elements(q -> 'options') o), '[]'::jsonb))
                         from jsonb_array_elements(r.snapshot -> 'questions') q), '{}'::jsonb));
  v_payload := private.quiz_player_payload(r.snapshot, p_locale::text, v_display);
  v_loc := v_payload ->> 'locale';
  return v_payload || jsonb_build_object(
    'access_tier', private.quiz_tier(p_quiz),
    'settings', jsonb_build_object(
      'shuffle_questions', coalesce((r.snapshot -> 'quiz' ->> 'shuffle_questions')::boolean, false),
      'shuffle_options', coalesce((r.snapshot -> 'quiz' ->> 'shuffle_options')::boolean, false),
      'allow_retry', coalesce((r.snapshot -> 'quiz' ->> 'allow_retry')::boolean, true),
      'max_attempts', r.snapshot -> 'quiz' -> 'max_attempts',
      'completion_text', private.pick_text(r.snapshot -> 'translations', v_loc, 'completion_text')),
    'grading', coalesce((
      select jsonb_object_agg(q ->> 'id', jsonb_build_object(
        'partial_credit', coalesce((q ->> 'partial_credit')::boolean, false),
        'penalty', coalesce((q ->> 'penalty')::numeric, 0),
        'case_sensitive', coalesce((q ->> 'case_sensitive')::boolean, false),
        'ignore_punctuation', coalesce((q ->> 'ignore_punctuation')::boolean, true),
        'key', coalesce(r.answer_key -> (q ->> 'id'), '{}'::jsonb),
        'explanation_correct', private.pick_text(q -> 'translations', v_loc, 'explanation_correct'),
        'explanation_incorrect', private.pick_text(q -> 'translations', v_loc, 'explanation_incorrect'),
        'related_lesson_id', q -> 'related_lesson_id'))
      from jsonb_array_elements(r.snapshot -> 'questions') q), '{}'::jsonb));
end $function$;

-- public.api_school: the same, with the three plans' check
create or replace function public.api_school(p_key text, p_locale public.locale_code default 'tg') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.schools%rowtype;
  v_tr jsonb;
  v_uid uuid := auth.uid();
begin
  select * into s from public.schools x
  where (private.is_uuid(p_key) and x.id = p_key::uuid) or x.slug = p_key limit 1;
  if not found or not private.school_live(s.id) then perform private.fail('not_found'); end if;
  v_tr := private.struct_tr('school', s.id, p_locale::text);
  if v_tr is null then perform private.fail('not_found'); end if;
  return jsonb_build_object(
    'id', s.id, 'slug', s.slug, 'theme_color', s.theme_color, 'access_tier', s.access_tier,
    'title', v_tr ->> 'title', 'description', v_tr ->> 'description', 'locale', v_tr ->> 'locale',
    'icon', private.asset_json(s.icon_asset_id, p_locale::text),
    'hero', private.asset_json(s.hero_asset_id, p_locale::text),
    'courses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'slug', c.slug, 'title', ctr ->> 'title', 'description', ctr ->> 'description',
        'level', c.level, 'estimated_minutes', c.estimated_minutes, 'access_tier', private.course_tier(c.id),
        'locked', not private.can_open(v_uid, private.course_tier(c.id)),
        'cover', private.asset_json(c.cover_asset_id, p_locale::text),
        'module_count', (select count(*) from public.modules m where m.course_id = c.id and private.module_live(m.id)),
        'progress', private.course_progress(c.id, v_uid)) order by c.position, c.id)
      from public.courses c
      cross join lateral (select private.struct_tr('course', c.id, p_locale::text) as ctr) t
      where c.school_id = s.id and private.course_live(c.id) and private.course_has_lessons(c.id) and t.ctr is not null), '[]'::jsonb),
    'quizzes', coalesce((select jsonb_agg(private.quiz_card(z.id, p_locale::text) order by z.position)
                         from public.quizzes z where z.school_id = s.id and private.quiz_live(z.id)), '[]'::jsonb),
    'progress', (select jsonb_build_object(
        'completed', coalesce(sum((private.course_progress(c.id, v_uid) ->> 'completed')::int), 0),
        'total', coalesce(sum((private.course_progress(c.id, v_uid) ->> 'total')::int), 0))
      from public.courses c where c.school_id = s.id and private.course_live(c.id) and private.course_has_lessons(c.id)));
end $$;

-- public.api_search: the same, with the three plans' check
create or replace function public.api_search(p_q text, p_locale public.locale_code default 'tg', p_limit integer default 20, p_audience text default 'girls')
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare
  v_q text := trim(coalesce(p_q, ''));
  v_like text;
  v_premium boolean := private.has_premium(auth.uid());
  v_aud text := coalesce(nullif(p_audience, ''), 'girls');
begin
  if char_length(v_q) < 2 then return '[]'::jsonb; end if;
  v_q := left(v_q, 100);
  v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return coalesce((select jsonb_agg(r order by r.score desc) from (
    select * from (
      select 'school' as type, t.school_id as id, t.title, t.description as snippet,
             extensions.similarity(t.title, v_q) + case when t.title ilike v_like then 1 else 0 end as score
      from public.school_translations t
      where t.locale = p_locale and t.ready and private.school_live(t.school_id) and private.school_audience(t.school_id) = v_aud
        and (t.title ilike v_like or t.description ilike v_like or extensions.similarity(t.title, v_q) > 0.3)
      union all
      select 'course', t.course_id, t.title, t.description,
             extensions.similarity(t.title, v_q) + case when t.title ilike v_like then 1 else 0 end
      from public.course_translations t
      where t.locale = p_locale and t.ready and private.course_live(t.course_id) and private.course_audience(t.course_id) = v_aud
        and (t.title ilike v_like or t.description ilike v_like or extensions.similarity(t.title, v_q) > 0.3)
      union all
      select 'module', t.module_id, t.title, t.description,
             extensions.similarity(t.title, v_q) + case when t.title ilike v_like then 1 else 0 end
      from public.module_translations t
      where t.locale = p_locale and t.ready and private.module_live(t.module_id) and private.module_audience(t.module_id) = v_aud
        and (t.title ilike v_like or extensions.similarity(t.title, v_q) > 0.3)
      union all
      select 'topic', t.topic_id, t.title, t.description,
             extensions.similarity(t.title, v_q) + case when t.title ilike v_like then 1 else 0 end
      from public.topic_translations t
      where t.locale = p_locale and t.ready and private.topic_live(t.topic_id) and private.topic_audience(t.topic_id) = v_aud
        and (t.title ilike v_like or extensions.similarity(t.title, v_q) > 0.3)
      union all
      select 'lesson', i.lesson_id, i.title,
             case when not private.can_open(auth.uid(), private.lesson_tier(i.lesson_id)) then null
                  when strpos(lower(i.body), lower(v_q)) > 0
                  then substr(i.body, greatest(strpos(lower(i.body), lower(v_q)) - 60, 1), 180) end,
             extensions.similarity(i.title, v_q) + case when i.title ilike v_like then 1 else 0 end
               + case when i.body ilike v_like then 0.5 else 0 end
      from public.lesson_search_index i
      where i.locale = p_locale and private.lesson_live(i.lesson_id) and private.lesson_audience(i.lesson_id) = v_aud
        and (i.title ilike v_like or i.body ilike v_like or extensions.similarity(i.title, v_q) > 0.3)
    ) u order by u.score desc limit least(greatest(p_limit, 1), 50)) r), '[]'::jsonb);
end $function$;

-- public.api_start_quiz_attempt: the same, with the three plans' check
create or replace function public.api_start_quiz_attempt(p_quiz uuid, p_locale public.locale_code default 'tg')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  z public.quizzes%rowtype;
  a public.quiz_attempts%rowtype;
  v_snap jsonb;
  v_used int;
begin
  if v_uid is null then perform private.fail('auth_required'); end if;
  select * into z from public.quizzes where id = p_quiz;
  if not found or not private.quiz_live(p_quiz) then perform private.fail('not_found'); end if;
  if not private.can_open(v_uid, private.quiz_tier(p_quiz)) then
    perform private.fail('premium_required');
  end if;

  select * into a from public.quiz_attempts x
  where x.user_id = v_uid and x.quiz_id = p_quiz and x.revision_id = z.published_revision_id and x.status = 'in_progress'
  order by x.started_at desc limit 1;

  if not found then
    if (select count(*) from public.quiz_attempts x where x.user_id = v_uid and x.started_at > now() - interval '1 minute') >= 10 then
      perform private.fail('rate_limited');
    end if;
    select count(*) into v_used from public.quiz_attempts x
    where x.user_id = v_uid and x.quiz_id = p_quiz and x.status <> 'in_progress';
    if z.max_attempts is not null and v_used >= z.max_attempts then perform private.fail('attempt_limit_reached'); end if;
    if not z.allow_retry and v_used > 0 then perform private.fail('retry_not_allowed'); end if;
    select snapshot into v_snap from public.content_revisions where id = z.published_revision_id;
    insert into public.quiz_attempts (user_id, quiz_id, revision_id, locale, display)
    values (v_uid, p_quiz, z.published_revision_id, p_locale, private.quiz_display_order(v_snap))
    returning * into a;
  else
    select snapshot into v_snap from public.content_revisions where id = a.revision_id;
  end if;

  return jsonb_build_object(
    'attempt', jsonb_build_object('id', a.id, 'status', a.status, 'started_at', a.started_at,
                                  'answers', a.answers, 'checked', to_jsonb(a.checked)),
    'player', private.quiz_player_payload(v_snap, a.locale::text, a.display));
end $$;

-- public.api_track_progress: the same, with the three plans' check
create or replace function public.api_track_progress(p_lesson uuid, p_percent int default null,
  p_position jsonb default null, p_completed boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_row public.lesson_progress%rowtype;
  v_done boolean;
  v_new int := 0;
begin
  if v_uid is null then perform private.fail('auth_required'); end if;
  if not private.lesson_live(p_lesson) then perform private.fail('not_found'); end if;
  if not private.can_open(v_uid, private.lesson_tier(p_lesson)) then perform private.fail('premium_required'); end if;
  if p_position is not null and jsonb_typeof(p_position) <> 'object' then perform private.fail('validation_failed'); end if;
  v_done := coalesce(p_completed, false) or coalesce(p_percent, 0) >= 100;
  insert into public.lesson_progress as lp (user_id, lesson_id, status, progress_percent, position, completed_at)
  values (v_uid, p_lesson, case when v_done then 'completed' else 'started' end,
          least(greatest(coalesce(p_percent, case when v_done then 100 else 0 end), 0), 100), p_position,
          case when v_done then now() end)
  on conflict (user_id, lesson_id) do update set
    status = case when lp.status = 'completed' or v_done then 'completed' else 'started' end,
    progress_percent = greatest(lp.progress_percent, excluded.progress_percent),
    position = coalesce(excluded.position, lp.position),
    completed_at = coalesce(lp.completed_at, excluded.completed_at)
  returning * into v_row;
  if v_row.status = 'completed' then v_new := private.evaluate_achievements(v_uid); end if;
  return jsonb_build_object('lesson_id', v_row.lesson_id, 'status', v_row.status, 'percent', v_row.progress_percent,
                            'position', v_row.position, 'completed_at', v_row.completed_at, 'new_achievements', v_new);
end $$;
