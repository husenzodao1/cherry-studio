-- LifeHub · boys and girls: every school is for girls or for boys (its courses, modules, topics and
-- lessons follow it). The catalogue, a school, the search and the offline bundle are asked for one.

alter table public.schools add column if not exists audience text not null default 'girls' check (audience in ('girls', 'boys'));
create index if not exists schools_audience_idx on public.schools (audience, position);

-- the audience of anything in the catalogue (by its school)
create or replace function private.school_audience(p_school uuid) returns text language sql stable security definer set search_path = '' as $$
  select audience from public.schools where id = p_school
$$;
create or replace function private.course_audience(p_course uuid) returns text language sql stable security definer set search_path = '' as $$
  select s.audience from public.courses c join public.schools s on s.id = c.school_id where c.id = p_course
$$;
create or replace function private.module_audience(p_module uuid) returns text language sql stable security definer set search_path = '' as $$
  select private.course_audience(m.course_id) from public.modules m where m.id = p_module
$$;
create or replace function private.topic_audience(p_topic uuid) returns text language sql stable security definer set search_path = '' as $$
  select private.module_audience(t.module_id) from public.topics t where t.id = p_topic
$$;
create or replace function private.lesson_audience(p_lesson uuid) returns text language sql stable security definer set search_path = '' as $$
  select private.topic_audience(l.topic_id) from public.lessons l where l.id = p_lesson
$$;

-- the boys' seven schools (their courses and lessons are added in the panel, in boys' mode)
insert into public.schools (slug, position, theme_color, status, publish_at, first_published_at, audience) values
  ('odobi-umumi', 0, '#BFD3F2', 'published', now(), now(), 'boys'),
  ('pisar-dar-jamiyat', 1, '#C7DDF0', 'published', now(), now(), 'boys'),
  ('khislathoi-mardona', 2, '#C9D6EA', 'published', now(), now(), 'boys'),
  ('farhangi-tojik-pisaron', 3, '#D6E2EE', 'published', now(), now(), 'boys'),
  ('zamoni-muosir', 4, '#C2E0EC', 'published', now(), now(), 'boys'),
  ('odobi-oiladori', 5, '#CFDAF0', 'published', now(), now(), 'boys'),
  ('sakhtihoi-hayot', 6, '#BCCBE3', 'published', now(), now(), 'boys')
on conflict (slug) do nothing;

insert into public.school_translations (school_id, locale, title, ready)
select s.id, 'tg', v.title, true
from (values
  ('odobi-umumi', 'Одоби умумӣ'),
  ('pisar-dar-jamiyat', 'Писар дар ҷамъият'),
  ('khislathoi-mardona', 'Хислатҳои мардона'),
  ('farhangi-tojik-pisaron', 'Фарҳанги тоҷик'),
  ('zamoni-muosir', 'Замони муосир'),
  ('odobi-oiladori', 'Одоби оиладорӣ'),
  ('sakhtihoi-hayot', 'Сахтиҳои ҳаёт барои писар')
) as v(slug, title)
join public.schools s on s.slug = v.slug
on conflict (school_id, locale) do nothing;

-- the catalogue for girls or boys
drop function if exists public.api_schools(public.locale_code);
create function public.api_schools(p_locale public.locale_code default 'tg', p_audience text default 'girls')
returns jsonb language sql stable security definer set search_path = '' as $function$
  select coalesce(jsonb_agg(x.j order by x.position, x.id), '[]'::jsonb) from (
    select s.position, s.id, jsonb_build_object(
      'id', s.id, 'slug', s.slug, 'position', s.position, 'theme_color', s.theme_color, 'access_tier', s.access_tier,
      'title', tr ->> 'title', 'description', tr ->> 'description', 'locale', tr ->> 'locale', 'audience', s.audience,
      'icon', private.asset_json(s.icon_asset_id, p_locale::text),
      'hero', private.asset_json(s.hero_asset_id, p_locale::text),
      'course_count', (select count(*) from public.courses c where c.school_id = s.id and private.course_live(c.id) and private.course_has_lessons(c.id))) j
    from public.schools s
    cross join lateral (select private.struct_tr('school', s.id, p_locale::text) as tr) t
    where s.audience = coalesce(nullif(p_audience, ''), 'girls') and private.is_live_status(s.status, s.publish_at) and t.tr is not null
  ) x;
$function$;
grant execute on function public.api_schools(public.locale_code, text) to anon, authenticated;

-- the search finds only what is for her (or him)
drop function if exists public.api_search(text, public.locale_code, integer);
create function public.api_search(p_q text, p_locale public.locale_code default 'tg', p_limit integer default 20, p_audience text default 'girls')
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
             case when private.lesson_tier(i.lesson_id) = 'premium' and not v_premium then null
                  when strpos(lower(i.body), lower(v_q)) > 0
                  then substr(i.body, greatest(strpos(lower(i.body), lower(v_q)) - 60, 1), 180) end,
             extensions.similarity(i.title, v_q) + case when i.title ilike v_like then 1 else 0 end
               + case when i.body ilike v_like then 0.5 else 0 end
      from public.lesson_search_index i
      where i.locale = p_locale and private.lesson_live(i.lesson_id) and private.lesson_audience(i.lesson_id) = v_aud
        and (i.title ilike v_like or i.body ilike v_like or extensions.similarity(i.title, v_q) > 0.3)
    ) u order by u.score desc limit least(greatest(p_limit, 1), 50)) r), '[]'::jsonb);
end $function$;
grant execute on function public.api_search(text, public.locale_code, integer, text) to anon, authenticated;
