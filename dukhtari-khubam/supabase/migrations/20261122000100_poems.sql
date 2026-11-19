-- Духтари хубам · poems for the "Garden of verse" tile on the schools screen
-- A poem is an inspiration with the placement 'poem': body = its lines (one per line),
-- author_name = the poet, source_title = the poem's title. Edited in the panel (Матнҳо → Шеърҳо).
alter table public.daily_inspirations drop constraint if exists daily_inspirations_placement_check;
alter table public.daily_inspirations add constraint daily_inspirations_placement_check
  check (placement in ('home', 'lesson', 'notification', 'poem'));
