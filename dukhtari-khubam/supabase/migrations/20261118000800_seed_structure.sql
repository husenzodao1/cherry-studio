-- Духтари хубам · 0008 seed: the seven schools and spec-defined UI texts.
-- Only names and UI labels given verbatim in the Master Prompt are seeded. No lesson content,
-- no quiz questions and no quotes are created here (spec §0.3): authors add those in the Admin Panel.

insert into public.schools (slug, position, theme_color, status, publish_at, first_published_at) values
  ('marifati-dini', 0, '#A78BCB', 'published', now(), now()),
  ('odob-va-akhloq', 1, '#EBDCE4', 'published', now(), now()),
  ('farhangi-tojik', 2, '#E8D7B9', 'published', now(), now()),
  ('oila-va-munosibatho', 3, '#DCCCEB', 'published', now(), now()),
  ('ilm-va-salomati', 4, '#DDE9DF', 'published', now(), now()),
  ('rushdi-shakhsiyat', 5, '#EEE7F6', 'published', now(), now()),
  ('zindagii-muosir', 6, '#D8C8EA', 'published', now(), now())
on conflict (slug) do nothing;

insert into public.school_translations (school_id, locale, title, ready)
select s.id, 'tg', v.title, true
from (values
  ('marifati-dini', 'Маърифати динӣ'),
  ('odob-va-akhloq', 'Одоб ва ахлоқ'),
  ('farhangi-tojik', 'Фарҳанги тоҷик'),
  ('oila-va-munosibatho', 'Оила ва муносибатҳо'),
  ('ilm-va-salomati', 'Илм ва саломатӣ'),
  ('rushdi-shakhsiyat', 'Рушди шахсият'),
  ('zindagii-muosir', 'Зиндагии муосир')
) as v(slug, title)
join public.schools s on s.slug = v.slug
on conflict (school_id, locale) do nothing;

insert into public.ui_strings (key, locale, value) values
  ('app.name', 'tg', 'Духтари хубам'),
  ('nav.home', 'tg', 'Асосӣ'),
  ('nav.schools', 'tg', 'Мактабҳо'),
  ('nav.saved', 'tg', 'Захираҳо'),
  ('nav.profile', 'tg', 'Профил'),
  ('home.greeting', 'tg', 'Салом'),
  ('home.continue_learning', 'tg', 'Идомаи омӯзиш'),
  ('home.seven_schools', 'tg', 'Ҳафт мактаби дониш'),
  ('home.all_schools', 'tg', 'Ҳамаи мактабҳо'),
  ('action.continue', 'tg', 'Идома'),
  ('action.start_course', 'tg', 'Оғози курс'),
  ('action.save', 'tg', 'Захира'),
  ('section.progress', 'tg', 'Пешрафт'),
  ('section.your_progress', 'tg', 'Пешрафти шумо'),
  ('section.results', 'tg', 'Натиҷаҳо'),
  ('settings.title', 'tg', 'Танзимот'),
  ('settings.language', 'tg', 'Забон'),
  ('settings.theme', 'tg', 'Режими намоиш'),
  ('settings.notifications', 'tg', 'Огоҳиҳо'),
  ('settings.notifications_permission', 'tg', 'Огоҳиҳоро иҷозат диҳед'),
  ('settings.animation', 'tg', 'Аниматсия'),
  ('settings.text_size', 'tg', 'Андозаи матн'),
  ('settings.privacy', 'tg', 'Махфият'),
  ('settings.about', 'tg', 'Дар бораи барнома')
on conflict (key, locale) do nothing;

insert into public.help_texts (key, icon) values ('settings.notifications', 'info') on conflict do nothing;
insert into public.help_text_translations (key, locale, body, ready)
values ('settings.notifications', 'tg', 'Барои гирифтани хабарҳои курсҳо ва ёдрасии дарсҳо.', true)
on conflict do nothing;
