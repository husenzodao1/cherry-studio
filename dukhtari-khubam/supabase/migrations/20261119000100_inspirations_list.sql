-- Духтари хубам · 0012 several inspirations for the "words of the day" on the home screen
-- The newest live inspirations for a placement (each in the asked language, else Tajik), newest first.
create or replace function public.api_inspirations(p_locale public.locale_code default 'tg', p_placement text default 'home', p_limit int default 12)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x.item order by x.at desc nulls last), '[]'::jsonb)
  from (
    select jsonb_build_object('id', d.id, 'body', t.body, 'author_name', t.author_name, 'source_title', t.source_title) as item,
           d.publish_at as at
    from public.daily_inspirations d
    cross join lateral (
      select y.* from public.daily_inspiration_translations y where y.inspiration_id = d.id and y.ready
      order by (y.locale = p_locale) desc, (y.locale = 'tg') desc, y.locale limit 1) t
    where d.placement = p_placement and private.is_live_status(d.status, d.publish_at)
    order by d.publish_at desc nulls last
    limit least(greatest(coalesce(p_limit, 12), 1), 30)
  ) x;
$$;

-- Settings now offer colour themes: the heading is "Мавзӯъ" (kept in step with the app's built-in text).
update public.ui_strings set value = 'Мавзӯъ', updated_at = now()
 where key = 'settings.theme' and locale = 'tg' and value = 'Режими намоиш';
