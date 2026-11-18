-- Духтари хубам · 0006 reader API (used by Web and Android through /api/v1)
-- Content is returned only when published; lessons come from their published snapshot.
-- Locale fallback: requested → tg → any ready translation.

create or replace function private.struct_tr(p_entity text, p_id uuid, p_locale text, p_ready_only boolean default true)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_tr text[] := private.entity_translation(p_entity);
  v_row jsonb;
begin
  execute format('select to_jsonb(t) from public.%I t where t.%I = $1 and (t.ready or not $3)
                  order by t.ready desc, (t.locale::text = $2) desc, (t.locale = ''tg'') desc, t.locale limit 1',
                 v_tr[1], v_tr[2])
    into v_row using p_id, p_locale, p_ready_only;
  return v_row;
end $$;

create or replace function private.lesson_title(p_lesson uuid, p_locale text) returns text
language sql stable security definer set search_path = '' as $$
  select private.pick_text(r.snapshot -> 'translations', private.pick_locale(r.snapshot -> 'translations', p_locale), 'title')
  from public.lessons l join public.content_revisions r on r.id = l.published_revision_id
  where l.id = p_lesson;
$$;

create or replace function private.course_progress(p_course uuid, p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with ids as (select * from private.course_lesson_ids(p_course) id)
  select jsonb_build_object(
    'total', (select count(*) from ids),
    'completed', (select count(*) from ids join public.lesson_progress p on p.lesson_id = ids.id
                  where p.user_id = p_user and p.status = 'completed'),
    'percent', case when (select count(*) from ids) = 0 or p_user is null then 0
                    else round((select count(*) from ids join public.lesson_progress p on p.lesson_id = ids.id
                                where p.user_id = p_user and p.status = 'completed') * 100.0 / (select count(*) from ids)) end);
$$;

create or replace function private.quiz_card(p_quiz uuid, p_locale text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', z.id, 'slug', z.slug,
    'title', private.pick_text(r.snapshot -> 'translations', private.pick_locale(r.snapshot -> 'translations', p_locale), 'title'),
    'question_count', jsonb_array_length(r.snapshot -> 'questions'),
    'time_limit_seconds', z.time_limit_seconds, 'access_tier', private.quiz_tier(z.id),
    'best_percent', (select max(a.percent) from public.quiz_attempts a where a.quiz_id = z.id and a.user_id = auth.uid()),
    'passed', (select bool_or(a.passed) from public.quiz_attempts a where a.quiz_id = z.id and a.user_id = auth.uid()))
  from public.quizzes z join public.content_revisions r on r.id = z.published_revision_id
  where z.id = p_quiz and private.quiz_live(z.id);
$$;

create or replace function private.render_lesson(p_lesson uuid, p_snap jsonb, p_locale text, p_locked boolean)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_loc text := private.pick_locale(p_snap -> 'translations', p_locale);
  v_uid uuid := auth.uid();
  v_blocks jsonb := '[]'::jsonb;
  v_assets jsonb := '{}'::jsonb;
  v_ctx jsonb;
  v_course uuid;
  v_order uuid[];
  v_idx int;
  v_ref jsonb;
  b jsonb;
  v_aid uuid;
begin
  select m.course_id,
         jsonb_build_object(
           'topic', jsonb_build_object('id', t.id, 'title', private.struct_tr('topic', t.id, v_loc, false) ->> 'title'),
           'module', jsonb_build_object('id', m.id, 'title', private.struct_tr('module', m.id, v_loc, false) ->> 'title'),
           'course', jsonb_build_object('id', c.id, 'slug', c.slug, 'title', private.struct_tr('course', c.id, v_loc, false) ->> 'title'),
           'school', jsonb_build_object('id', s.id, 'slug', s.slug, 'title', private.struct_tr('school', s.id, v_loc, false) ->> 'title'))
    into v_course, v_ctx
  from public.lessons l
  join public.topics t on t.id = l.topic_id
  join public.modules m on m.id = t.module_id
  join public.courses c on c.id = m.course_id
  join public.schools s on s.id = c.school_id
  where l.id = p_lesson;

  if not p_locked then
    for b in select * from jsonb_array_elements(coalesce(p_snap -> 'blocks', '[]'::jsonb)) loop
      v_ref := null;
      if b ->> 'type' = 'quiz' and private.is_uuid(b -> 'props' ->> 'quiz_id') then
        v_ref := private.quiz_card((b -> 'props' ->> 'quiz_id')::uuid, v_loc);
      elsif b ->> 'type' = 'related_lesson' and private.is_uuid(b -> 'props' ->> 'lesson_id')
            and private.lesson_live((b -> 'props' ->> 'lesson_id')::uuid) then
        v_ref := jsonb_build_object('id', b -> 'props' -> 'lesson_id',
                                    'title', private.lesson_title((b -> 'props' ->> 'lesson_id')::uuid, v_loc));
      end if;
      v_blocks := v_blocks || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'id', b -> 'id', 'type', b -> 'type', 'schema_version', b -> 'schema_version', 'props', b -> 'props',
        'content', coalesce(b -> 'content' -> v_loc, b -> 'content' -> 'tg',
                            (select e.value from jsonb_each(coalesce(b -> 'content', '{}'::jsonb)) e order by e.key limit 1),
                            '{}'::jsonb),
        'ref', v_ref)));
      for v_aid in select * from private.block_asset_ids(b -> 'props') loop
        if not v_assets ? v_aid::text then
          v_assets := v_assets || jsonb_build_object(v_aid::text, private.asset_json(v_aid, v_loc));
        end if;
      end loop;
    end loop;
  end if;

  select array_agg(x.id order by x.mp, x.tp, x.lp) into v_order
  from (select l2.id, m.position mp, t2.position tp, l2.position lp
        from public.lessons l2 join public.topics t2 on t2.id = l2.topic_id join public.modules m on m.id = t2.module_id
        where m.course_id = v_course and private.lesson_live(l2.id)) x;
  v_idx := array_position(v_order, p_lesson);

  return jsonb_build_object(
    'id', p_lesson, 'locale', v_loc,
    'available_locales', (select coalesce(jsonb_agg(e.key order by e.key), '[]'::jsonb)
                          from jsonb_each(coalesce(p_snap -> 'translations', '{}'::jsonb)) e
                          where coalesce((e.value ->> 'ready')::boolean, false)),
    'title', private.pick_text(p_snap -> 'translations', v_loc, 'title'),
    'summary', private.pick_text(p_snap -> 'translations', v_loc, 'summary'),
    'estimated_minutes', p_snap -> 'lesson' -> 'estimated_minutes',
    'access_tier', private.lesson_tier(p_lesson),
    'locked', p_locked,
    'context', v_ctx,
    'blocks', v_blocks,
    'assets', v_assets,
    'position', jsonb_build_object('index', v_idx, 'total', coalesce(cardinality(v_order), 0)),
    'prev_lesson_id', case when v_idx > 1 then v_order[v_idx - 1] end,
    'next_lesson_id', case when v_idx < cardinality(v_order) then v_order[v_idx + 1] end,
    'user', case when v_uid is null then null else jsonb_build_object(
      'bookmarked', exists (select 1 from public.bookmarks bk where bk.user_id = v_uid and bk.lesson_id = p_lesson),
      'progress', (select jsonb_build_object('status', p.status, 'percent', p.progress_percent, 'position', p.position)
                   from public.lesson_progress p where p.user_id = v_uid and p.lesson_id = p_lesson)) end);
end $$;

-- ---------------------------------------------------------------- catalog
create or replace function public.api_schools(p_locale public.locale_code default 'tg') returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x.j order by x.position, x.id), '[]'::jsonb) from (
    select s.position, s.id, jsonb_build_object(
      'id', s.id, 'slug', s.slug, 'position', s.position, 'theme_color', s.theme_color, 'access_tier', s.access_tier,
      'title', tr ->> 'title', 'description', tr ->> 'description', 'locale', tr ->> 'locale',
      'icon', private.asset_json(s.icon_asset_id, p_locale::text),
      'hero', private.asset_json(s.hero_asset_id, p_locale::text),
      'course_count', (select count(*) from public.courses c where c.school_id = s.id and private.course_live(c.id))) j
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
      where c.school_id = s.id and private.course_live(c.id) and t.ctr is not null), '[]'::jsonb),
    'quizzes', coalesce((select jsonb_agg(private.quiz_card(z.id, p_locale::text) order by z.position)
                         from public.quizzes z where z.school_id = s.id and private.quiz_live(z.id)), '[]'::jsonb),
    'progress', (select jsonb_build_object(
        'completed', coalesce(sum((private.course_progress(c.id, v_uid) ->> 'completed')::int), 0),
        'total', coalesce(sum((private.course_progress(c.id, v_uid) ->> 'total')::int), 0))
      from public.courses c where c.school_id = s.id and private.course_live(c.id)));
end $$;

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
  v_locked := private.course_tier(c.id) = 'premium' and not private.has_premium(v_uid);
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
                'locked', private.lesson_tier(l.id) = 'premium' and not private.has_premium(v_uid),
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
  return private.render_lesson(p_lesson, v_snap, p_locale::text, v_locked);
end $$;

-- Preview of the working copy exactly as readers would see it (FR-CMS-004).
create or replace function public.admin_lesson_preview(p_lesson uuid, p_locale public.locale_code default 'tg') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_snap jsonb;
begin
  if not (private.can_edit_lesson(p_lesson) or private.can_review() or private.can_publish()) then
    perform private.fail('forbidden');
  end if;
  v_snap := private.build_lesson_snapshot(p_lesson);
  if v_snap is null then perform private.fail('not_found'); end if;
  -- preview shows every translation, ready or not
  v_snap := jsonb_set(v_snap, '{translations}', coalesce((
    select jsonb_object_agg(e.key, e.value || '{"ready":true}'::jsonb) from jsonb_each(v_snap -> 'translations') e), '{}'::jsonb));
  return private.render_lesson(p_lesson, v_snap, p_locale::text, false)
         || jsonb_build_object('preview', true, 'validation', private.validate_lesson(p_lesson));
end $$;

-- ---------------------------------------------------------------- search
create or replace function public.api_search(p_q text, p_locale public.locale_code default 'tg', p_limit int default 20)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_q text := trim(coalesce(p_q, ''));
  v_like text;
  v_premium boolean := private.has_premium(auth.uid());
begin
  if char_length(v_q) < 2 then return '[]'::jsonb; end if;
  v_q := left(v_q, 100);
  v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return coalesce((select jsonb_agg(r order by r.score desc) from (
    select * from (
      select 'school' as type, t.school_id as id, t.title, t.description as snippet,
             extensions.similarity(t.title, v_q) + case when t.title ilike v_like then 1 else 0 end as score
      from public.school_translations t
      where t.locale = p_locale and t.ready and private.school_live(t.school_id)
        and (t.title ilike v_like or t.description ilike v_like or extensions.similarity(t.title, v_q) > 0.3)
      union all
      select 'course', t.course_id, t.title, t.description,
             extensions.similarity(t.title, v_q) + case when t.title ilike v_like then 1 else 0 end
      from public.course_translations t
      where t.locale = p_locale and t.ready and private.course_live(t.course_id)
        and (t.title ilike v_like or t.description ilike v_like or extensions.similarity(t.title, v_q) > 0.3)
      union all
      select 'module', t.module_id, t.title, t.description,
             extensions.similarity(t.title, v_q) + case when t.title ilike v_like then 1 else 0 end
      from public.module_translations t
      where t.locale = p_locale and t.ready and private.module_live(t.module_id)
        and (t.title ilike v_like or extensions.similarity(t.title, v_q) > 0.3)
      union all
      select 'topic', t.topic_id, t.title, t.description,
             extensions.similarity(t.title, v_q) + case when t.title ilike v_like then 1 else 0 end
      from public.topic_translations t
      where t.locale = p_locale and t.ready and private.topic_live(t.topic_id)
        and (t.title ilike v_like or extensions.similarity(t.title, v_q) > 0.3)
      union all
      select 'lesson', i.lesson_id, i.title,
             case when private.lesson_tier(i.lesson_id) = 'premium' and not v_premium then null
                  when strpos(lower(i.body), lower(v_q)) > 0
                  then substr(i.body, greatest(strpos(lower(i.body), lower(v_q)) - 60, 1), 180) end,
             extensions.similarity(i.title, v_q) + case when i.title ilike v_like then 1 else 0 end
               + case when i.body ilike v_like then 0.5 else 0 end
      from public.lesson_search_index i
      where i.locale = p_locale and private.lesson_live(i.lesson_id)
        and (i.title ilike v_like or i.body ilike v_like or extensions.similarity(i.title, v_q) > 0.3)
    ) u order by u.score desc limit least(greatest(p_limit, 1), 50)) r), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------- CMS-driven home content
create or replace function public.api_inspiration(p_locale public.locale_code default 'tg', p_placement text default 'home')
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', d.id, 'body', t.body, 'author_name', t.author_name, 'source_title', t.source_title,
                            'source_url', t.source_url, 'locale', t.locale, 'publish_at', d.publish_at,
                            'image', private.asset_json(d.image_asset_id, p_locale::text))
  from public.daily_inspirations d
  cross join lateral (
    select x.* from public.daily_inspiration_translations x where x.inspiration_id = d.id and x.ready
    order by (x.locale = p_locale) desc, (x.locale = 'tg') desc, x.locale limit 1) t
  where d.placement = p_placement and private.is_live_status(d.status, d.publish_at)
  order by d.publish_at desc nulls last
  limit 1;
$$;

create or replace function public.api_ui_bundle(p_locale public.locale_code default 'tg') returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'locale', p_locale,
    'strings', coalesce((
      select jsonb_object_agg(k.key, k.value) from (
        select distinct on (u.key) u.key, u.value from public.ui_strings u
        where u.locale in (p_locale, 'tg') order by u.key, (u.locale = p_locale) desc) k), '{}'::jsonb),
    'help', coalesce((
      select jsonb_object_agg(h.key, jsonb_build_object('title', tr.title, 'body', tr.body, 'icon', h.icon))
      from public.help_texts h
      cross join lateral (
        select x.* from public.help_text_translations x where x.key = h.key and x.ready
        order by (x.locale = p_locale) desc, (x.locale = 'tg') desc limit 1) tr
      where h.enabled), '{}'::jsonb));
$$;

create or replace function public.api_page(p_slug text, p_locale public.locale_code default 'tg') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  p public.cms_pages%rowtype;
  t public.cms_page_translations%rowtype;
begin
  select * into p from public.cms_pages where slug = p_slug and private.is_live_status(status, publish_at);
  if not found then perform private.fail('not_found'); end if;
  select * into t from public.cms_page_translations x where x.page_id = p.id and x.ready
  order by (x.locale = p_locale) desc, (x.locale = 'tg') desc, x.locale limit 1;
  if not found then perform private.fail('not_found'); end if;
  return jsonb_build_object('slug', p.slug, 'title', t.title, 'locale', t.locale, 'body', t.body,
    'assets', coalesce((select jsonb_object_agg(a::text, private.asset_json(a, p_locale::text))
                        from (select distinct private.block_asset_ids(b -> 'props') a from jsonb_array_elements(t.body) b) s), '{}'::jsonb),
    'updated_at', t.updated_at);
end $$;

create or replace function public.api_banners(p_placement text, p_locale public.locale_code default 'tg') returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'title', t.title, 'subtitle', t.subtitle, 'cta_label', t.cta_label,
    'link_url', b.link_url, 'deep_link', b.deep_link, 'image', private.asset_json(b.image_asset_id, p_locale::text))
    order by b.position), '[]'::jsonb)
  from public.banners b
  cross join lateral (
    select x.* from public.banner_translations x where x.banner_id = b.id and x.ready
    order by (x.locale = p_locale) desc, (x.locale = 'tg') desc limit 1) t
  where b.placement = p_placement and private.is_live_status(b.status, b.publish_at)
    and (b.ends_at is null or b.ends_at > now());
$$;

-- ---------------------------------------------------------------- learner state
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
  if private.lesson_tier(p_lesson) = 'premium' and not private.has_premium(v_uid) then perform private.fail('premium_required'); end if;
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

create or replace function public.api_continue_learning(p_locale public.locale_code default 'tg') returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'lesson_id', p.lesson_id, 'title', private.lesson_title(p.lesson_id, p_locale::text), 'percent', p.progress_percent,
    'course', (select jsonb_build_object('id', c.id, 'title', private.struct_tr('course', c.id, p_locale::text) ->> 'title',
                                         'progress', private.course_progress(c.id, auth.uid()))
               from public.lessons l join public.topics t on t.id = l.topic_id join public.modules m on m.id = t.module_id
               join public.courses c on c.id = m.course_id where l.id = p.lesson_id),
    'updated_at', p.updated_at)
  from public.lesson_progress p
  where p.user_id = auth.uid() and p.status = 'started' and private.lesson_live(p.lesson_id)
  order by p.updated_at desc limit 1;
$$;

create or replace function public.api_my_progress(p_locale public.locale_code default 'tg') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then perform private.fail('auth_required'); end if;
  return jsonb_build_object(
    'totals', jsonb_build_object(
      'lessons_completed', (select count(*) from public.lesson_progress where user_id = v_uid and status = 'completed'),
      'courses_completed', (select count(*) from public.courses c where private.course_live(c.id)
                            and (private.course_progress(c.id, v_uid) ->> 'total')::int > 0
                            and (private.course_progress(c.id, v_uid) ->> 'percent')::int = 100),
      'quizzes_passed', (select count(distinct quiz_id) from public.quiz_attempts where user_id = v_uid and passed),
      'achievements', (select count(*) from public.user_achievements where user_id = v_uid),
      'bookmarks', (select count(*) from public.bookmarks where user_id = v_uid)),
    'schools', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'title', private.struct_tr('school', s.id, p_locale::text) ->> 'title',
        'completed', x.completed, 'total', x.total,
        'percent', case when x.total > 0 then round(x.completed * 100.0 / x.total) else 0 end) order by s.position)
      from public.schools s
      cross join lateral (
        select coalesce(sum((private.course_progress(c.id, v_uid) ->> 'completed')::int), 0) as completed,
               coalesce(sum((private.course_progress(c.id, v_uid) ->> 'total')::int), 0) as total
        from public.courses c where c.school_id = s.id and private.course_live(c.id)) x
      where private.school_live(s.id) and x.completed > 0), '[]'::jsonb),
    'achievements', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'key', a.key,
        'title', (select t.title from public.achievement_translations t where t.achievement_id = a.id and t.ready
                  order by (t.locale = p_locale) desc, (t.locale = 'tg') desc limit 1),
        'description', (select t.description from public.achievement_translations t where t.achievement_id = a.id and t.ready
                        order by (t.locale = p_locale) desc, (t.locale = 'tg') desc limit 1),
        'icon', private.asset_json(a.icon_asset_id, p_locale::text),
        'awarded_at', ua.awarded_at) order by ua.awarded_at desc nulls last, a.position)
      from public.achievements a
      left join public.user_achievements ua on ua.achievement_id = a.id and ua.user_id = v_uid
      where private.is_live_status(a.status, a.publish_at)), '[]'::jsonb));
end $$;

create or replace function public.api_my_bookmarks(p_locale public.locale_code default 'tg', p_school uuid default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('lesson_id', b.lesson_id, 'title', private.lesson_title(b.lesson_id, p_locale::text),
    'school', jsonb_build_object('id', s.id, 'title', private.struct_tr('school', s.id, p_locale::text) ->> 'title'),
    'course', jsonb_build_object('id', c.id, 'title', private.struct_tr('course', c.id, p_locale::text) ->> 'title'),
    'created_at', b.created_at) order by b.created_at desc), '[]'::jsonb)
  from public.bookmarks b
  join public.lessons l on l.id = b.lesson_id join public.topics t on t.id = l.topic_id
  join public.modules m on m.id = t.module_id join public.courses c on c.id = m.course_id
  join public.schools s on s.id = c.school_id
  where b.user_id = auth.uid() and private.lesson_live(b.lesson_id) and (p_school is null or s.id = p_school);
$$;

create or replace function public.api_my_notifications(p_locale public.locale_code default 'tg') returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'title', t.title, 'body', t.body, 'deep_link', n.deep_link,
    'sent_at', coalesce(n.sent_at, n.send_at),
    'read', exists (select 1 from public.notification_reads r where r.user_id = auth.uid() and r.notification_id = n.id))
    order by coalesce(n.sent_at, n.send_at) desc), '[]'::jsonb)
  from public.notifications n
  cross join lateral (
    select x.* from public.notification_translations x where x.notification_id = n.id
    order by (x.locale = p_locale) desc, (x.locale = 'tg') desc limit 1) t
  where auth.uid() is not null
    and (n.status = 'sent' or (n.status = 'scheduled' and n.send_at <= now()))
    and coalesce(n.sent_at, n.send_at) > now() - interval '90 days'
    and case n.audience ->> 'type'
          when 'all' then true
          when 'course' then exists (
            select 1 from public.lesson_progress p
            where p.user_id = auth.uid() and private.is_uuid(n.audience ->> 'course_id')
              and p.lesson_id in (select private.course_lesson_ids((n.audience ->> 'course_id')::uuid)))
          when 'school' then exists (
            select 1 from public.lesson_progress p
            join public.lessons l on l.id = p.lesson_id join public.topics tt on tt.id = l.topic_id
            join public.modules m on m.id = tt.module_id join public.courses c on c.id = m.course_id
            where p.user_id = auth.uid() and c.school_id::text = n.audience ->> 'school_id')
          else false end;
$$;

create or replace function public.api_health() returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('status', 'ok', 'time', now(), 'schema', '2026-11-18.1');
$$;
