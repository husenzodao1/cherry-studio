-- Духтари хубам · two catalogue fixes.
-- 1. A course was counted on its school's tile ("1 курс") as soon as it was published, even before any
--    of its lessons were: inside, the learner found nothing ("Курс нест"). A course now reaches learners
--    (count, list and progress) only once it has at least one published lesson.
-- 2. Tests made from a lesson's "Тестҳо" tab (quizzes.lesson_id) never reached the app: the lesson now
--    carries them (api_lesson.quizzes), so the offline bundle includes them and the lesson shows them.

create or replace function private.course_has_lessons(p_course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.course_lesson_ids(p_course));
$$;

create or replace function public.api_schools(p_locale public.locale_code default 'tg') returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x.j order by x.position, x.id), '[]'::jsonb) from (
    select s.position, s.id, jsonb_build_object(
      'id', s.id, 'slug', s.slug, 'position', s.position, 'theme_color', s.theme_color, 'access_tier', s.access_tier,
      'title', tr ->> 'title', 'description', tr ->> 'description', 'locale', tr ->> 'locale',
      'icon', private.asset_json(s.icon_asset_id, p_locale::text),
      'hero', private.asset_json(s.hero_asset_id, p_locale::text),
      'course_count', (select count(*) from public.courses c where c.school_id = s.id and private.course_live(c.id) and private.course_has_lessons(c.id))) j
    from public.schools s
    cross join lateral (select private.struct_tr('school', s.id, p_locale::text) as tr) t
    where private.is_live_status(s.status, s.publish_at) and t.tr is not null
  ) x;
$$;

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
        'locked', private.course_tier(c.id) = 'premium' and not private.has_premium(v_uid),
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

create or replace function public.api_lesson(p_lesson uuid, p_locale public.locale_code default 'tg') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_snap jsonb;
  v_locked boolean;
begin
  if not private.lesson_live(p_lesson) then perform private.fail('not_found'); end if;
  select r.snapshot into v_snap
  from public.lessons l join public.content_revisions r on r.id = l.published_revision_id where l.id = p_lesson;
  v_locked := private.lesson_tier(p_lesson) = 'premium' and not private.has_premium(auth.uid());
  -- the tests made for this lesson (admin: the lesson's "Тестҳо" tab) come with it
  return private.render_lesson(p_lesson, v_snap, p_locale::text, v_locked) || jsonb_build_object(
    'quizzes', coalesce((select jsonb_agg(private.quiz_card(z.id, p_locale::text) order by z.position, z.id)
                         from public.quizzes z where z.lesson_id = p_lesson and private.quiz_live(z.id)), '[]'::jsonb));
end $$;
