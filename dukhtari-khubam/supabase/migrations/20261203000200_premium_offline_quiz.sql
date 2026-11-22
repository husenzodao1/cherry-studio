-- a Premium test is given to a Premium learner too (her own Premium bundle), never to others; the test
-- says its tier
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
  if not found or not private.quiz_live(p_quiz) or (private.quiz_tier(p_quiz) = 'premium' and not private.has_premium(auth.uid())) then return null; end if;
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
