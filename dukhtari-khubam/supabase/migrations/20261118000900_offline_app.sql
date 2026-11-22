-- Духтари хубам · 0009 offline app
-- The app works offline: the published catalogue is shipped as one bundle and quizzes are graded on
-- the phone. Learners have no e-mail account: a learner is a name plus a 15-digit code generated on the
-- phone. Progress lives on the phone and is backed up under sha256(code), so typing the code after a
-- reinstall brings it back. Staff still sign in with Supabase Auth.

create table public.device_profiles (
  code_hash text primary key check (code_hash ~ '^[0-9a-f]{64}$'),
  name text not null check (char_length(name) between 1 and 80),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 524288),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- No policies: the table is reachable only through the two functions below.
alter table public.device_profiles enable row level security;

create or replace function public.api_profile_load(p_code_hash text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name', p.name, 'data', p.data, 'updated_at', p.updated_at)
  from public.device_profiles p where p.code_hash = p_code_hash;
$$;

create or replace function public.api_profile_save(p_code_hash text, p_name text, p_data jsonb) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := left(trim(coalesce(p_name, '')), 80);
  v_at timestamptz;
begin
  if p_code_hash !~ '^[0-9a-f]{64}$' or v_name = '' or jsonb_typeof(p_data) <> 'object' then
    perform private.fail('validation_failed');
  end if;
  insert into public.device_profiles as p (code_hash, name, data) values (p_code_hash, v_name, p_data)
  on conflict (code_hash) do update set name = excluded.name, data = excluded.data, updated_at = now()
  returning p.updated_at into v_at;
  return v_at;
end $$;

-- A published, free quiz with its answer key and explanations, for grading on the phone without a
-- connection. Questions and options keep their authored order; the app shuffles when the quiz asks.
create or replace function public.api_offline_quiz(p_quiz uuid, p_locale public.locale_code default 'tg') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  z public.quizzes%rowtype;
  r public.content_revisions%rowtype;
  v_display jsonb;
  v_payload jsonb;
  v_loc text;
begin
  select * into z from public.quizzes where id = p_quiz;
  if not found or not private.quiz_live(p_quiz) or private.quiz_tier(p_quiz) = 'premium' then return null; end if;
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
end $$;

-- Published achievements with their rules; the app awards them on the phone.
create or replace function public.api_achievements(p_locale public.locale_code default 'tg') returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'key', a.key, 'rule', a.rule, 'title', tr.title, 'description', tr.description,
    'icon', private.asset_json(a.icon_asset_id, p_locale::text)) order by a.position, a.key), '[]'::jsonb)
  from public.achievements a
  join lateral (
    select t.title, t.description from public.achievement_translations t
    where t.achievement_id = a.id and t.ready
    order by (t.locale = p_locale) desc, (t.locale = 'tg') desc, t.locale limit 1
  ) tr on true
  where private.is_live_status(a.status, a.publish_at);
$$;
