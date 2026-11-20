-- Духтари хубам · the "Garden of verse" holds poems and stories: a story is an inspiration with the
-- placement 'story' (body = its text, flowing on; author_name = the writer; source_title = its title).
alter table public.daily_inspirations drop constraint if exists daily_inspirations_placement_check;
alter table public.daily_inspirations add constraint daily_inspirations_placement_check
  check (placement in ('home', 'lesson', 'notification', 'poem', 'story'));
-- stories and long poems need more room than a line of inspiration
alter table public.daily_inspiration_translations drop constraint if exists daily_inspiration_translations_body_check;
alter table public.daily_inspiration_translations add constraint daily_inspiration_translations_body_check
  check (char_length(body) between 1 and 20000);
