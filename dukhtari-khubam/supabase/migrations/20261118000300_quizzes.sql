-- Духтари хубам · 0003 quizzes (Manual Quiz Builder, Part III of the spec)
-- Every question, option, correct answer, score and explanation is entered by a person.
-- Answer keys live in their own table and are never sent to readers before submission.
-- Grading happens here, in the backend, against the published revision the attempt started on.

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  school_id uuid references public.schools (id) on delete restrict,
  course_id uuid references public.courses (id) on delete restrict,
  module_id uuid references public.modules (id) on delete restrict,
  topic_id uuid references public.topics (id) on delete restrict,
  lesson_id uuid references public.lessons (id) on delete restrict,
  position int not null default 0,
  pass_score_percent numeric(5, 2) not null default 60 check (pass_score_percent between 0 and 100),
  time_limit_seconds int check (time_limit_seconds > 0),
  max_attempts int check (max_attempts > 0),
  allow_retry boolean not null default true,
  shuffle_questions boolean not null default false,
  shuffle_options boolean not null default false,
  show_correct_answers public.reveal_policy not null default 'after_submit',
  show_explanations public.reveal_policy not null default 'after_submit',
  access_tier public.access_tier not null default 'free',
  cover_asset_id uuid references public.media_assets (id) on delete restrict,
  status public.content_status not null default 'draft',
  publish_at timestamptz,
  first_published_at timestamptz,
  published_revision_id uuid references public.content_revisions (id) on delete set null,
  published_at timestamptz,
  version int not null default 1,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(school_id, course_id, module_id, topic_id, lesson_id) <= 1)
);

create table public.quiz_translations (
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  locale public.locale_code not null,
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 1000),
  instructions text check (char_length(instructions) <= 2000),
  completion_text text check (char_length(completion_text) <= 2000),
  ready boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (quiz_id, locale)
);

create table public.quiz_sections (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  position int not null default 0
);
create table public.quiz_section_translations (
  section_id uuid not null references public.quiz_sections (id) on delete cascade,
  locale public.locale_code not null,
  title text not null check (char_length(title) between 1 and 200),
  primary key (section_id, locale)
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  section_id uuid references public.quiz_sections (id) on delete set null,
  position int not null default 0,
  type public.question_type not null,
  points numeric(6, 2) not null default 1 check (points > 0),
  partial_credit boolean not null default false,
  penalty numeric(6, 2) not null default 0 check (penalty >= 0),
  media_asset_id uuid references public.media_assets (id) on delete restrict,
  media_required boolean not null default false,
  exclude_from_shuffle boolean not null default false,
  required boolean not null default true,
  case_sensitive boolean not null default false,
  ignore_punctuation boolean not null default true,
  manual_review_on_mismatch boolean not null default false,
  related_lesson_id uuid references public.lessons (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quiz_questions_quiz_idx on public.quiz_questions (quiz_id, position);

create table public.quiz_question_translations (
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  locale public.locale_code not null,
  prompt text not null check (char_length(prompt) between 1 and 4000),
  hint text check (char_length(hint) <= 1000),
  explanation_correct text check (char_length(explanation_correct) <= 4000),
  explanation_incorrect text check (char_length(explanation_incorrect) <= 4000),
  rubric text check (char_length(rubric) <= 4000),
  updated_at timestamptz not null default now(),
  primary key (question_id, locale)
);

create table public.quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  position int not null default 0,
  side text check (side in ('left', 'right')),
  media_asset_id uuid references public.media_assets (id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quiz_options_question_idx on public.quiz_options (question_id, position);

create table public.quiz_option_translations (
  option_id uuid not null references public.quiz_options (id) on delete cascade,
  locale public.locale_code not null,
  text text check (char_length(text) <= 1000),
  feedback text check (char_length(feedback) <= 2000),
  primary key (option_id, locale)
);

create table public.quiz_answer_keys (
  question_id uuid primary key references public.quiz_questions (id) on delete cascade,
  correct_option_ids uuid[] not null default '{}',
  correct_order uuid[] not null default '{}',
  matching jsonb not null default '{}'::jsonb check (jsonb_typeof(matching) = 'object'),
  accepted_answers jsonb not null default '{}'::jsonb check (jsonb_typeof(accepted_answers) = 'object'),
  updated_at timestamptz not null default now()
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  revision_id uuid not null references public.content_revisions (id) on delete restrict,
  locale public.locale_code not null default 'tg',
  display jsonb not null default '{}'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  checked uuid[] not null default '{}',
  results jsonb,
  score numeric(8, 2),
  max_score numeric(8, 2),
  percent numeric(5, 2),
  passed boolean,
  status public.attempt_status not null default 'in_progress',
  late boolean not null default false,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  graded_at timestamptz,
  duration_seconds int,
  reviewer_id uuid references auth.users (id) on delete set null
);
create index quiz_attempts_user_idx on public.quiz_attempts (user_id, quiz_id, started_at desc);
create index quiz_attempts_quiz_idx on public.quiz_attempts (quiz_id, status);

do $$
declare t text;
begin
  foreach t in array array['quizzes', 'quiz_translations', 'quiz_questions', 'quiz_question_translations',
    'quiz_options', 'quiz_answer_keys'] loop
    execute format('create trigger %I before update on public.%I for each row execute function private.set_updated_at()',
                   t || '_updated_at', t);
  end loop;
  foreach t in array array['quizzes', 'quiz_translations', 'quiz_sections', 'quiz_questions',
    'quiz_question_translations', 'quiz_options', 'quiz_option_translations', 'quiz_answer_keys'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_row()',
                   t || '_audit', t);
  end loop;
end $$;
create trigger quizzes_guard before insert or update on public.quizzes
  for each row execute function private.content_row_guard();

-- ---------------------------------------------------------------- helpers
create or replace function private.can_edit_quiz(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select private.can_edit_owned(z.created_by) from public.quizzes z where z.id = p_id), false);
$$;
create or replace function private.can_edit_question(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select private.can_edit_quiz(q.quiz_id) from public.quiz_questions q where q.id = p_id), false);
$$;
create or replace function private.can_edit_option(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select private.can_edit_question(o.question_id) from public.quiz_options o where o.id = p_id), false);
$$;
create or replace function private.can_edit_section(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select private.can_edit_quiz(s.quiz_id) from public.quiz_sections s where s.id = p_id), false);
$$;

create or replace function private.course_tier(p_course uuid) returns public.access_tier
language sql stable security definer set search_path = '' as $$
  select case when c.access_tier = 'premium' or s.access_tier = 'premium'
              then 'premium'::public.access_tier else 'free'::public.access_tier end
  from public.courses c join public.schools s on s.id = c.school_id where c.id = p_course;
$$;

create or replace function private.quiz_live(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.quizzes z
    where z.id = p_id and z.published_revision_id is not null and z.status <> 'archived'
      and (z.publish_at is null or z.publish_at <= now())
      and case
            when z.lesson_id is not null then private.lesson_live(z.lesson_id)
            when z.topic_id is not null then private.topic_live(z.topic_id)
            when z.module_id is not null then private.module_live(z.module_id)
            when z.course_id is not null then private.course_live(z.course_id)
            when z.school_id is not null then private.school_live(z.school_id)
            else true
          end
  );
$$;

create or replace function private.quiz_tier(p_id uuid) returns public.access_tier
language sql stable security definer set search_path = '' as $$
  select case
    when z.access_tier = 'premium' then 'premium'::public.access_tier
    when z.lesson_id is not null then private.lesson_tier(z.lesson_id)
    when z.topic_id is not null then (select private.course_tier(m.course_id) from public.topics t join public.modules m on m.id = t.module_id where t.id = z.topic_id)
    when z.module_id is not null then (select private.course_tier(m.course_id) from public.modules m where m.id = z.module_id)
    when z.course_id is not null then private.course_tier(z.course_id)
    when z.school_id is not null then (select s.access_tier from public.schools s where s.id = z.school_id)
    else 'free'::public.access_tier end
  from public.quizzes z where z.id = p_id;
$$;

-- Asset as delivered to clients (live row, so replacing a file reaches every client without a rebuild).
create or replace function private.asset_json(p_asset uuid, p_locale text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', a.id, 'kind', a.kind, 'bucket', a.bucket, 'path', a.path, 'mime_type', a.mime_type,
    'width', a.width, 'height', a.height, 'duration_seconds', a.duration_seconds,
    'focal', case when a.focal_x is null then null else jsonb_build_object('x', a.focal_x, 'y', a.focal_y) end,
    'crop', a.crop, 'variants', a.variants, 'hls_path', a.hls_path, 'version', a.version,
    'title', tr.title, 'alt', tr.alt_text, 'caption', tr.caption, 'transcript', tr.transcript,
    'subtitles_path', tr.subtitles_path,
    'poster', (select jsonb_build_object('id', p.id, 'bucket', p.bucket, 'path', p.path, 'width', p.width, 'height', p.height)
               from public.media_assets p where p.id = a.poster_asset_id and p.status = 'active')
  )
  from public.media_assets a
  left join lateral (
    select t.* from public.media_asset_translations t where t.asset_id = a.id
    order by (t.locale::text = p_locale) desc, (t.locale = 'tg') desc, t.locale limit 1
  ) tr on true
  where a.id = p_asset and a.status = 'active';
$$;

-- Pick the locale to render from a {locale: {ready, ...}} map: requested → tg → any ready → any.
create or replace function private.pick_locale(p_translations jsonb, p_locale text) returns text
language sql immutable set search_path = '' as $$
  select coalesce(
    case when coalesce((p_translations -> p_locale ->> 'ready')::boolean, false) then p_locale end,
    case when coalesce((p_translations -> 'tg' ->> 'ready')::boolean, false) then 'tg' end,
    (select e.key from jsonb_each(coalesce(p_translations, '{}'::jsonb)) e where coalesce((e.value ->> 'ready')::boolean, false) order by e.key limit 1),
    case when p_translations ? p_locale then p_locale end,
    (select k from jsonb_object_keys(coalesce(p_translations, '{}'::jsonb)) k order by k limit 1),
    p_locale);
$$;

create or replace function private.pick_text(p_obj jsonb, p_locale text, p_field text) returns text
language sql immutable set search_path = '' as $$
  select coalesce(
    p_obj -> p_locale ->> p_field,
    p_obj -> 'tg' ->> p_field,
    (select e.value ->> p_field from jsonb_each(coalesce(p_obj, '{}'::jsonb)) e where e.value ->> p_field is not null order by e.key limit 1));
$$;

create or replace function private.normalize_answer(p_text text, p_case_sensitive boolean, p_ignore_punct boolean)
returns text language sql immutable set search_path = '' as $$
  with base as (
    select case when p_case_sensitive then coalesce(p_text, '') else lower(coalesce(p_text, '')) end as t
  )
  select trim(regexp_replace(
    case when p_ignore_punct then regexp_replace(t, '[[:punct:]«»“”„‘’—–…]', '', 'g') else t end,
    '\s+', ' ', 'g'))
  from base;
$$;

-- ---------------------------------------------------------------- snapshots
create or replace function private.build_quiz_snapshot(p_quiz uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'quiz', jsonb_build_object(
      'id', z.id, 'slug', z.slug, 'pass_score_percent', z.pass_score_percent,
      'time_limit_seconds', z.time_limit_seconds, 'max_attempts', z.max_attempts, 'allow_retry', z.allow_retry,
      'shuffle_questions', z.shuffle_questions, 'shuffle_options', z.shuffle_options,
      'show_correct_answers', z.show_correct_answers, 'show_explanations', z.show_explanations,
      'access_tier', z.access_tier, 'cover_asset_id', z.cover_asset_id, 'version', z.version,
      'school_id', z.school_id, 'course_id', z.course_id, 'module_id', z.module_id,
      'topic_id', z.topic_id, 'lesson_id', z.lesson_id),
    'translations', coalesce((
      select jsonb_object_agg(t.locale, jsonb_build_object('title', t.title, 'description', t.description,
        'instructions', t.instructions, 'completion_text', t.completion_text, 'ready', t.ready))
      from public.quiz_translations t where t.quiz_id = z.id), '{}'::jsonb),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'position', s.position,
        'translations', coalesce((select jsonb_object_agg(st.locale, jsonb_build_object('title', st.title))
                                  from public.quiz_section_translations st where st.section_id = s.id), '{}'::jsonb))
        order by s.position)
      from public.quiz_sections s where s.quiz_id = z.id), '[]'::jsonb),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'section_id', q.section_id, 'position', q.position, 'type', q.type, 'points', q.points,
        'partial_credit', q.partial_credit, 'penalty', q.penalty, 'media_asset_id', q.media_asset_id,
        'media_required', q.media_required, 'exclude_from_shuffle', q.exclude_from_shuffle,
        'required', q.required, 'case_sensitive', q.case_sensitive, 'ignore_punctuation', q.ignore_punctuation,
        'manual_review_on_mismatch', q.manual_review_on_mismatch, 'related_lesson_id', q.related_lesson_id,
        'translations', coalesce((
          select jsonb_object_agg(qt.locale, jsonb_build_object('prompt', qt.prompt, 'hint', qt.hint,
            'explanation_correct', qt.explanation_correct, 'explanation_incorrect', qt.explanation_incorrect,
            'rubric', qt.rubric))
          from public.quiz_question_translations qt where qt.question_id = q.id), '{}'::jsonb),
        'options', coalesce((
          select jsonb_agg(jsonb_build_object('id', o.id, 'position', o.position, 'side', o.side,
            'media_asset_id', o.media_asset_id,
            'translations', coalesce((
              select jsonb_object_agg(ot.locale, jsonb_build_object('text', ot.text, 'feedback', ot.feedback))
              from public.quiz_option_translations ot where ot.option_id = o.id), '{}'::jsonb))
            order by o.position)
          from public.quiz_options o where o.question_id = q.id and o.is_active), '[]'::jsonb))
        order by q.position)
      from public.quiz_questions q where q.quiz_id = z.id and q.is_active), '[]'::jsonb))
  from public.quizzes z where z.id = p_quiz;
$$;

create or replace function private.build_quiz_key(p_quiz uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(k.question_id, jsonb_build_object(
    'correct_option_ids', to_jsonb(k.correct_option_ids), 'correct_order', to_jsonb(k.correct_order),
    'matching', k.matching, 'accepted_answers', k.accepted_answers)), '{}'::jsonb)
  from public.quiz_answer_keys k join public.quiz_questions q on q.id = k.question_id
  where q.quiz_id = p_quiz and q.is_active;
$$;

-- Display order is fixed per attempt; results are bound to question/option ids, not positions (QZ-11).
create or replace function private.quiz_display_order(p_snapshot jsonb) returns jsonb
language plpgsql volatile set search_path = '' as $$
declare
  v_ids text[];
  v_fixed boolean[];
  v_pool text[];
  v_result text[] := '{}';
  v_opts jsonb := '{}'::jsonb;
  v_q jsonb;
  v_shuffle_o boolean := coalesce((p_snapshot -> 'quiz' ->> 'shuffle_options')::boolean, false);
  i int;
  j int := 1;
begin
  select coalesce(array_agg(q ->> 'id' order by (q ->> 'position')::int), '{}'),
         coalesce(array_agg(coalesce((q ->> 'exclude_from_shuffle')::boolean, false) order by (q ->> 'position')::int), '{}')
    into v_ids, v_fixed
  from jsonb_array_elements(coalesce(p_snapshot -> 'questions', '[]'::jsonb)) q;

  if coalesce((p_snapshot -> 'quiz' ->> 'shuffle_questions')::boolean, false) then
    select coalesce(array_agg(t.id order by random()), '{}') into v_pool
    from unnest(v_ids, v_fixed) as t(id, fixed) where not t.fixed;
    for i in 1 .. coalesce(array_length(v_ids, 1), 0) loop
      if v_fixed[i] then
        v_result := v_result || v_ids[i];
      else
        v_result := v_result || v_pool[j];
        j := j + 1;
      end if;
    end loop;
  else
    v_result := v_ids;
  end if;

  for v_q in select * from jsonb_array_elements(coalesce(p_snapshot -> 'questions', '[]'::jsonb)) loop
    v_opts := v_opts || jsonb_build_object(v_q ->> 'id', coalesce((
      select jsonb_agg(o ->> 'id' order by
        case when v_q ->> 'type' = 'matching' then (o ->> 'side' = 'right')::int else 0 end,
        case
          when v_q ->> 'type' = 'ordering' then random()
          when v_q ->> 'type' = 'matching' and o ->> 'side' = 'right' then random()
          when v_q ->> 'type' in ('single_choice', 'multiple_choice') and v_shuffle_o then random()
          else (o ->> 'position')::float8
        end)
      from jsonb_array_elements(v_q -> 'options') o), '[]'::jsonb));
  end loop;
  return jsonb_build_object('questions', to_jsonb(v_result), 'options', v_opts);
end $$;

-- Reader payload: never contains answer keys, explanations or option feedback.
create or replace function private.quiz_player_payload(p_snapshot jsonb, p_locale text, p_display jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_loc text := private.pick_locale(p_snapshot -> 'translations', p_locale);
  v_questions jsonb := '[]'::jsonb;
  v_qid text;
  v_q jsonb;
  v_section jsonb;
begin
  for v_qid in select jsonb_array_elements_text(coalesce(p_display -> 'questions', '[]'::jsonb)) loop
    select q into v_q from jsonb_array_elements(p_snapshot -> 'questions') q where q ->> 'id' = v_qid;
    if v_q is null then continue; end if;
    select s into v_section from jsonb_array_elements(p_snapshot -> 'sections') s where s ->> 'id' = v_q ->> 'section_id';
    v_questions := v_questions || jsonb_build_object(
      'id', v_q -> 'id', 'type', v_q -> 'type', 'points', v_q -> 'points', 'required', v_q -> 'required',
      'section', case when v_section is null then null
                      else private.pick_text(v_section -> 'translations', v_loc, 'title') end,
      'prompt', private.pick_text(v_q -> 'translations', v_loc, 'prompt'),
      'hint', private.pick_text(v_q -> 'translations', v_loc, 'hint'),
      'media', case when v_q ->> 'media_asset_id' is null then null
                    else private.asset_json((v_q ->> 'media_asset_id')::uuid, v_loc) end,
      'options', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', o -> 'id', 'side', o -> 'side',
          'text', private.pick_text(o -> 'translations', v_loc, 'text'),
          'media', case when o ->> 'media_asset_id' is null then null
                        else private.asset_json((o ->> 'media_asset_id')::uuid, v_loc) end)
          order by array_position(array(select jsonb_array_elements_text(p_display -> 'options' -> v_qid)), o ->> 'id'))
        from jsonb_array_elements(v_q -> 'options') o), '[]'::jsonb));
  end loop;
  return jsonb_build_object(
    'locale', v_loc,
    'quiz', jsonb_build_object(
      'id', p_snapshot -> 'quiz' -> 'id',
      'title', private.pick_text(p_snapshot -> 'translations', v_loc, 'title'),
      'description', private.pick_text(p_snapshot -> 'translations', v_loc, 'description'),
      'instructions', private.pick_text(p_snapshot -> 'translations', v_loc, 'instructions'),
      'time_limit_seconds', p_snapshot -> 'quiz' -> 'time_limit_seconds',
      'pass_score_percent', p_snapshot -> 'quiz' -> 'pass_score_percent',
      'show_correct_answers', p_snapshot -> 'quiz' -> 'show_correct_answers',
      'show_explanations', p_snapshot -> 'quiz' -> 'show_explanations',
      'question_count', jsonb_array_length(v_questions),
      'total_points', (select coalesce(sum((q ->> 'points')::numeric), 0) from jsonb_array_elements(p_snapshot -> 'questions') q)),
    'questions', v_questions);
end $$;

-- ---------------------------------------------------------------- grading (QZ-08)
create or replace function private.grade_answers(p_snapshot jsonb, p_key jsonb, p_answers jsonb, p_locale text)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  q jsonb;
  k jsonb;
  a jsonb;
  qid text;
  v_type text;
  v_points numeric;
  v_earned numeric;
  v_status text;
  v_partial boolean;
  v_total numeric := 0;
  v_max numeric := 0;
  v_pending boolean := false;
  v_results jsonb := '{}'::jsonb;
  v_correct text[];
  v_given text[];
  v_hits int;
  v_wrong int;
  v_n int;
  v_ok int;
  v_accepted jsonb;
  v_norm text;
begin
  for q in select * from jsonb_array_elements(coalesce(p_snapshot -> 'questions', '[]'::jsonb)) loop
    qid := q ->> 'id';
    v_type := q ->> 'type';
    v_points := (q ->> 'points')::numeric;
    v_partial := coalesce((q ->> 'partial_credit')::boolean, false);
    k := coalesce(p_key -> qid, '{}'::jsonb);
    a := p_answers -> qid;
    v_max := v_max + v_points;
    v_earned := 0;
    v_status := 'incorrect';

    if a is null or jsonb_typeof(a) <> 'object' then
      v_status := 'unanswered';
    elsif v_type in ('single_choice', 'true_false') then
      if a ->> 'option_id' is null then
        v_status := 'unanswered';
      elsif (a ->> 'option_id') = any (array(select jsonb_array_elements_text(coalesce(k -> 'correct_option_ids', '[]'::jsonb)))) then
        v_earned := v_points; v_status := 'correct';
      end if;
    elsif v_type = 'multiple_choice' then
      v_correct := array(select jsonb_array_elements_text(coalesce(k -> 'correct_option_ids', '[]'::jsonb)));
      v_given := array(select distinct x from jsonb_array_elements_text(
                   case when jsonb_typeof(a -> 'option_ids') = 'array' then a -> 'option_ids' else '[]'::jsonb end) x);
      v_n := coalesce(cardinality(v_correct), 0);
      v_hits := (select count(*) from unnest(v_given) g where g = any (v_correct));
      v_wrong := coalesce(cardinality(v_given), 0) - v_hits;
      if coalesce(cardinality(v_given), 0) = 0 then
        v_status := 'unanswered';
      elsif v_n > 0 and v_hits = v_n and v_wrong = 0 then
        v_earned := v_points; v_status := 'correct';
      elsif v_partial and v_n > 0 and v_hits > v_wrong then
        v_earned := round(v_points * (v_hits - v_wrong)::numeric / v_n, 2); v_status := 'partial';
      end if;
    elsif v_type = 'matching' then
      select count(*), count(*) filter (where (a -> 'pairs' ->> p.key) = p.value)
        into v_n, v_ok
      from jsonb_each_text(coalesce(k -> 'matching', '{}'::jsonb)) p;
      if jsonb_typeof(a -> 'pairs') <> 'object' then
        v_status := 'unanswered';
      elsif v_n > 0 and v_ok = v_n then
        v_earned := v_points; v_status := 'correct';
      elsif v_partial and v_n > 0 and v_ok > 0 then
        v_earned := round(v_points * v_ok::numeric / v_n, 2); v_status := 'partial';
      end if;
    elsif v_type = 'ordering' then
      v_correct := array(select jsonb_array_elements_text(coalesce(k -> 'correct_order', '[]'::jsonb)));
      v_given := array(select jsonb_array_elements_text(
                   case when jsonb_typeof(a -> 'order') = 'array' then a -> 'order' else '[]'::jsonb end));
      v_n := coalesce(cardinality(v_correct), 0);
      if coalesce(cardinality(v_given), 0) = 0 then
        v_status := 'unanswered';
      elsif v_n > 0 and v_given = v_correct then
        v_earned := v_points; v_status := 'correct';
      elsif v_partial and v_n > 0 then
        select count(*) into v_ok from generate_subscripts(v_correct, 1) i where v_given[i] = v_correct[i];
        if v_ok > 0 then v_earned := round(v_points * v_ok::numeric / v_n, 2); v_status := 'partial'; end if;
      end if;
    elsif v_type = 'short_answer' then
      v_norm := private.normalize_answer(a ->> 'text', coalesce((q ->> 'case_sensitive')::boolean, false),
                                         coalesce((q ->> 'ignore_punctuation')::boolean, true));
      v_accepted := k -> 'accepted_answers' -> p_locale;
      if v_accepted is null or jsonb_typeof(v_accepted) <> 'array' or jsonb_array_length(v_accepted) = 0 then
        select coalesce(jsonb_agg(x), '[]'::jsonb) into v_accepted
        from jsonb_each(coalesce(k -> 'accepted_answers', '{}'::jsonb)) e, jsonb_array_elements(e.value) x
        where jsonb_typeof(e.value) = 'array';
      end if;
      if v_norm = '' then
        v_status := 'unanswered';
      elsif exists (
        select 1 from jsonb_array_elements_text(v_accepted) x
        where private.normalize_answer(x, coalesce((q ->> 'case_sensitive')::boolean, false),
                                       coalesce((q ->> 'ignore_punctuation')::boolean, true)) = v_norm) then
        v_earned := v_points; v_status := 'correct';
      elsif coalesce((q ->> 'manual_review_on_mismatch')::boolean, false) then
        v_status := 'pending_review'; v_pending := true;
      end if;
    elsif v_type = 'long_answer' then
      if trim(coalesce(a ->> 'text', '')) = '' then
        v_status := 'unanswered';
      else
        v_status := 'pending_review'; v_pending := true;
      end if;
    end if;

    if v_status = 'incorrect' and coalesce((q ->> 'penalty')::numeric, 0) > 0 then
      v_earned := -1 * (q ->> 'penalty')::numeric;
    end if;
    v_total := v_total + v_earned;
    v_results := v_results || jsonb_build_object(qid,
      jsonb_build_object('status', v_status, 'points', v_earned, 'max_points', v_points));
  end loop;

  v_total := greatest(v_total, 0);
  return jsonb_build_object(
    'score', v_total, 'max_score', v_max,
    'percent', case when v_max > 0 then round(v_total * 100 / v_max, 2) else 0 end,
    'pending_review', v_pending, 'results', v_results);
end $$;

-- What a reader may see for one question after it is graded, according to the quiz policy.
create or replace function private.reveal_question(
  p_q jsonb, p_key jsonb, p_result jsonb, p_answer jsonb, p_locale text, p_reveal_key boolean, p_reveal_expl boolean)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', p_q -> 'id',
    'type', p_q -> 'type',
    'prompt', private.pick_text(p_q -> 'translations', p_locale, 'prompt'),
    'status', p_result -> 'status',
    'points', p_result -> 'points',
    'max_points', p_result -> 'max_points',
    'comment', p_result -> 'comment',
    'answer', p_answer,
    'correct_option_ids', case when p_reveal_key and p_q ->> 'type' in ('single_choice', 'multiple_choice', 'true_false')
                               then p_key -> 'correct_option_ids' end,
    'correct_order', case when p_reveal_key and p_q ->> 'type' = 'ordering' then p_key -> 'correct_order' end,
    'matching', case when p_reveal_key and p_q ->> 'type' = 'matching' then p_key -> 'matching' end,
    'accepted_answers', case when p_reveal_key and p_q ->> 'type' = 'short_answer'
                             then coalesce(p_key -> 'accepted_answers' -> p_locale, p_key -> 'accepted_answers' -> 'tg') end,
    'explanation', case when p_reveal_expl then
                     case when p_result ->> 'status' = 'correct'
                          then private.pick_text(p_q -> 'translations', p_locale, 'explanation_correct')
                          else coalesce(private.pick_text(p_q -> 'translations', p_locale, 'explanation_incorrect'),
                                        private.pick_text(p_q -> 'translations', p_locale, 'explanation_correct')) end
                   end,
    'option_feedback', case when p_reveal_expl then (
      select jsonb_agg(jsonb_build_object('option_id', o -> 'id', 'feedback', private.pick_text(o -> 'translations', p_locale, 'feedback')))
      from jsonb_array_elements(p_q -> 'options') o
      where private.pick_text(o -> 'translations', p_locale, 'feedback') is not null
        and (o ->> 'id' = p_answer ->> 'option_id'
             or (jsonb_typeof(p_answer -> 'option_ids') = 'array' and p_answer -> 'option_ids' ? (o ->> 'id'))))
    end,
    'related_lesson_id', p_q -> 'related_lesson_id'));
$$;

create or replace function private.attempt_result(p_attempt uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  a public.quiz_attempts%rowtype;
  r public.content_revisions%rowtype;
  z public.quizzes%rowtype;
  v_loc text;
  v_policy_key text;
  v_policy_expl text;
  v_done boolean;
  v_used int;
begin
  select * into a from public.quiz_attempts where id = p_attempt;
  select * into r from public.content_revisions where id = a.revision_id;
  select * into z from public.quizzes where id = a.quiz_id;
  v_loc := private.pick_locale(r.snapshot -> 'translations', a.locale::text);
  v_policy_key := r.snapshot -> 'quiz' ->> 'show_correct_answers';
  v_policy_expl := r.snapshot -> 'quiz' ->> 'show_explanations';
  v_done := a.status <> 'in_progress';
  select count(*) into v_used from public.quiz_attempts x
  where x.user_id = a.user_id and x.quiz_id = a.quiz_id and x.status <> 'in_progress';
  return jsonb_build_object(
    'id', a.id, 'quiz_id', a.quiz_id, 'status', a.status, 'locale', v_loc,
    'title', private.pick_text(r.snapshot -> 'translations', v_loc, 'title'),
    'score', a.score, 'max_score', a.max_score, 'percent', a.percent, 'passed', a.passed, 'late', a.late,
    'pass_score_percent', r.snapshot -> 'quiz' -> 'pass_score_percent',
    'started_at', a.started_at, 'submitted_at', a.submitted_at, 'duration_seconds', a.duration_seconds,
    'completion_text', case when v_done then private.pick_text(r.snapshot -> 'translations', v_loc, 'completion_text') end,
    'can_retry', v_done and coalesce(z.allow_retry, false)
                 and (z.max_attempts is null or v_used < z.max_attempts),
    'attempts_used', v_used, 'max_attempts', z.max_attempts,
    'questions', case when not v_done then '[]'::jsonb else coalesce((
      select jsonb_agg(private.reveal_question(q, r.answer_key -> (q ->> 'id'), a.results -> (q ->> 'id'),
                       a.answers -> (q ->> 'id'), v_loc,
                       v_policy_key in ('after_submit', 'after_each'), v_policy_expl in ('after_submit', 'after_each'))
             order by array_position(array(select jsonb_array_elements_text(a.display -> 'questions')), q ->> 'id'))
      from jsonb_array_elements(r.snapshot -> 'questions') q), '[]'::jsonb) end);
end $$;

-- ---------------------------------------------------------------- reader quiz API
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
  if private.quiz_tier(p_quiz) = 'premium' and not private.has_premium(v_uid) then
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

create or replace function public.api_check_quiz_answer(p_attempt uuid, p_question uuid, p_answer jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a public.quiz_attempts%rowtype;
  r public.content_revisions%rowtype;
  v_q jsonb;
  v_grade jsonb;
  v_loc text;
begin
  select * into a from public.quiz_attempts where id = p_attempt and user_id = auth.uid();
  if not found then perform private.fail('not_found'); end if;
  if a.status <> 'in_progress' then perform private.fail('attempt_closed'); end if;
  select * into r from public.content_revisions where id = a.revision_id;
  if (r.snapshot -> 'quiz' ->> 'show_correct_answers') <> 'after_each'
     and (r.snapshot -> 'quiz' ->> 'show_explanations') <> 'after_each' then
    perform private.fail('not_allowed');
  end if;
  if p_question = any (a.checked) then perform private.fail('already_checked'); end if;
  select q into v_q from jsonb_array_elements(r.snapshot -> 'questions') q where q ->> 'id' = p_question::text;
  if v_q is null then perform private.fail('not_found'); end if;
  v_loc := private.pick_locale(r.snapshot -> 'translations', a.locale::text);
  v_grade := private.grade_answers(jsonb_build_object('questions', jsonb_build_array(v_q)), r.answer_key,
                                   jsonb_build_object(p_question::text, p_answer), v_loc);
  update public.quiz_attempts
     set answers = answers || jsonb_build_object(p_question::text, p_answer),
         checked = array_append(checked, p_question)
   where id = a.id;
  return private.reveal_question(v_q, r.answer_key -> p_question::text, v_grade -> 'results' -> p_question::text,
           p_answer, v_loc,
           (r.snapshot -> 'quiz' ->> 'show_correct_answers') = 'after_each',
           (r.snapshot -> 'quiz' ->> 'show_explanations') = 'after_each');
end $$;

create or replace function public.api_submit_quiz_attempt(p_attempt uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a public.quiz_attempts%rowtype;
  r public.content_revisions%rowtype;
  v_answers jsonb;
  v_grade jsonb;
  v_limit int;
  v_pass numeric;
  v_now timestamptz := now();
begin
  select * into a from public.quiz_attempts where id = p_attempt and user_id = auth.uid() for update;
  if not found then perform private.fail('not_found'); end if;
  if a.status <> 'in_progress' then perform private.fail('attempt_closed'); end if;
  if p_answers is not null and jsonb_typeof(p_answers) <> 'object' then perform private.fail('validation_failed'); end if;
  select * into r from public.content_revisions where id = a.revision_id;

  -- keep only answers to questions of this revision; already-checked answers are locked
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) into v_answers
  from jsonb_each(coalesce(p_answers, '{}'::jsonb)) e
  where exists (select 1 from jsonb_array_elements(r.snapshot -> 'questions') q where q ->> 'id' = e.key)
    and not (e.key = any (array(select unnest(a.checked)::text)));
  v_answers := v_answers || coalesce((
    select jsonb_object_agg(e.key, e.value) from jsonb_each(a.answers) e
    where e.key = any (array(select unnest(a.checked)::text))), '{}'::jsonb);

  v_grade := private.grade_answers(r.snapshot, r.answer_key, v_answers,
                                   private.pick_locale(r.snapshot -> 'translations', a.locale::text));
  v_limit := (r.snapshot -> 'quiz' ->> 'time_limit_seconds')::int;
  v_pass := (r.snapshot -> 'quiz' ->> 'pass_score_percent')::numeric;

  update public.quiz_attempts set
    answers = v_answers,
    results = v_grade -> 'results',
    score = (v_grade ->> 'score')::numeric,
    max_score = (v_grade ->> 'max_score')::numeric,
    percent = (v_grade ->> 'percent')::numeric,
    passed = case when (v_grade ->> 'pending_review')::boolean then null
                  else (v_grade ->> 'percent')::numeric >= v_pass end,
    status = case when (v_grade ->> 'pending_review')::boolean then 'pending_review'::public.attempt_status
                  else 'graded'::public.attempt_status end,
    late = v_limit is not null and v_now > a.started_at + make_interval(secs => v_limit + 30),
    submitted_at = v_now,
    graded_at = case when (v_grade ->> 'pending_review')::boolean then null else v_now end,
    duration_seconds = extract(epoch from (v_now - a.started_at))::int
  where id = a.id;

  perform private.evaluate_achievements(a.user_id);
  return private.attempt_result(a.id);
end $$;

create or replace function public.api_get_quiz_attempt(p_attempt uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.quiz_attempts a
    where a.id = p_attempt and (a.user_id = auth.uid() or private.can_review() or private.can_view_analytics())) then
    perform private.fail('not_found');
  end if;
  return private.attempt_result(p_attempt);
end $$;

create or replace function public.api_my_quiz_attempts(p_quiz uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'status', a.status, 'score', a.score,
    'max_score', a.max_score, 'percent', a.percent, 'passed', a.passed,
    'started_at', a.started_at, 'submitted_at', a.submitted_at) order by a.started_at desc), '[]'::jsonb)
  from public.quiz_attempts a where a.quiz_id = p_quiz and a.user_id = auth.uid();
$$;

-- ---------------------------------------------------------------- staff quiz API
create or replace function public.admin_review_answer(p_attempt uuid, p_question uuid, p_points numeric, p_comment text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a public.quiz_attempts%rowtype;
  r public.content_revisions%rowtype;
  v_max numeric;
  v_results jsonb;
  v_score numeric;
  v_total numeric;
  v_pending boolean;
begin
  if not private.can_review() then perform private.fail('forbidden'); end if;
  select * into a from public.quiz_attempts where id = p_attempt for update;
  if not found then perform private.fail('not_found'); end if;
  if a.status not in ('pending_review', 'graded') then perform private.fail('attempt_not_submitted'); end if;
  v_max := (a.results -> p_question::text ->> 'max_points')::numeric;
  if v_max is null then perform private.fail('not_found'); end if;
  if p_points is null or p_points < 0 or p_points > v_max then
    perform private.fail('validation_failed', jsonb_build_object('field', 'points', 'max', v_max));
  end if;
  v_results := a.results || jsonb_build_object(p_question::text, jsonb_build_object(
    'status', case when p_points = v_max then 'correct' when p_points > 0 then 'partial' else 'incorrect' end,
    'points', p_points, 'max_points', v_max, 'reviewed', true, 'comment', left(p_comment, 2000)));
  select coalesce(sum((e.value ->> 'points')::numeric), 0), coalesce(sum((e.value ->> 'max_points')::numeric), 0),
         bool_or(e.value ->> 'status' = 'pending_review')
    into v_score, v_total, v_pending
  from jsonb_each(v_results) e;
  v_score := greatest(v_score, 0);
  select * into r from public.content_revisions where id = a.revision_id;
  update public.quiz_attempts set
    results = v_results, score = v_score,
    percent = case when v_total > 0 then round(v_score * 100 / v_total, 2) else 0 end,
    status = case when coalesce(v_pending, false) then 'pending_review'::public.attempt_status else 'graded'::public.attempt_status end,
    passed = case when coalesce(v_pending, false) then null
                  else (case when v_total > 0 then round(v_score * 100 / v_total, 2) else 0 end)
                       >= (r.snapshot -> 'quiz' ->> 'pass_score_percent')::numeric end,
    graded_at = case when coalesce(v_pending, false) then null else now() end,
    reviewer_id = auth.uid()
  where id = a.id;
  if not coalesce(v_pending, false) then perform private.evaluate_achievements(a.user_id); end if;
  return private.attempt_result(a.id);
end $$;

create or replace function public.admin_quiz_attempts(p_quiz uuid, p_status public.attempt_status default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not (private.can_review() or private.can_view_analytics()) then perform private.fail('forbidden'); end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', a.id, 'user_id', a.user_id, 'status', a.status, 'score', a.score,
      'max_score', a.max_score, 'percent', a.percent, 'passed', a.passed, 'submitted_at', a.submitted_at,
      'revision_id', a.revision_id) order by a.submitted_at desc nulls last)
    from public.quiz_attempts a
    where a.quiz_id = p_quiz and (p_status is null or a.status = p_status)), '[]'::jsonb);
end $$;

create or replace function public.admin_quiz_preview(p_quiz uuid, p_locale public.locale_code default 'tg')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_snap jsonb;
begin
  if not (private.can_edit_quiz(p_quiz) or private.can_review()) then perform private.fail('forbidden'); end if;
  v_snap := private.build_quiz_snapshot(p_quiz);
  if v_snap is null then perform private.fail('not_found'); end if;
  return jsonb_build_object(
    'player', private.quiz_player_payload(v_snap, p_locale::text,
                jsonb_build_object('questions', (select coalesce(jsonb_agg(q -> 'id' order by (q ->> 'position')::int), '[]'::jsonb)
                                                 from jsonb_array_elements(v_snap -> 'questions') q),
                                   'options', (select coalesce(jsonb_object_agg(q ->> 'id',
                                                 (select coalesce(jsonb_agg(o -> 'id' order by (o ->> 'position')::int), '[]'::jsonb)
                                                  from jsonb_array_elements(q -> 'options') o)), '{}'::jsonb)
                                               from jsonb_array_elements(v_snap -> 'questions') q))),
    'answer_key', private.build_quiz_key(p_quiz),
    'validation', private.validate_quiz(p_quiz));
end $$;

-- Grades the working copy for preview; nothing is stored (QZ-12).
create or replace function public.admin_quiz_preview_grade(p_quiz uuid, p_answers jsonb, p_locale public.locale_code default 'tg')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_snap jsonb;
  v_key jsonb;
  v_grade jsonb;
begin
  if not (private.can_edit_quiz(p_quiz) or private.can_review()) then perform private.fail('forbidden'); end if;
  v_snap := private.build_quiz_snapshot(p_quiz);
  if v_snap is null then perform private.fail('not_found'); end if;
  v_key := private.build_quiz_key(p_quiz);
  v_grade := private.grade_answers(v_snap, v_key, coalesce(p_answers, '{}'::jsonb), p_locale::text);
  return v_grade || jsonb_build_object(
    'passed', case when (v_grade ->> 'pending_review')::boolean then null
                   else (v_grade ->> 'percent')::numeric >= (v_snap -> 'quiz' ->> 'pass_score_percent')::numeric end,
    'questions', (select coalesce(jsonb_agg(private.reveal_question(q, v_key -> (q ->> 'id'), v_grade -> 'results' -> (q ->> 'id'),
                                   p_answers -> (q ->> 'id'), p_locale::text, true, true) order by (q ->> 'position')::int), '[]'::jsonb)
                  from jsonb_array_elements(v_snap -> 'questions') q));
end $$;

create or replace function public.admin_quiz_analytics(p_quiz uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_view_analytics() then perform private.fail('forbidden'); end if;
  return (
    with att as (select * from public.quiz_attempts where quiz_id = p_quiz),
    done as (select * from att where status <> 'in_progress'),
    per_q as (
      select e.key as question_id,
             count(*) as answered,
             count(*) filter (where e.value ->> 'status' = 'correct') as correct,
             count(*) filter (where e.value ->> 'status' in ('incorrect', 'partial')) as wrong
      from done, jsonb_each(coalesce(done.results, '{}'::jsonb)) e
      group by e.key)
    select jsonb_build_object(
      'attempts_started', (select count(*) from att),
      'attempts_submitted', (select count(*) from done),
      'unique_users', (select count(distinct user_id) from att),
      'completion_rate', case when (select count(*) from att) > 0
                              then round((select count(*) from done)::numeric * 100 / (select count(*) from att), 2) else 0 end,
      'average_percent', (select round(avg(percent), 2) from done where status = 'graded'),
      'pass_rate', case when (select count(*) from done where status = 'graded') > 0
                        then round((select count(*) from done where passed)::numeric * 100
                                   / (select count(*) from done where status = 'graded'), 2) end,
      'average_duration_seconds', (select round(avg(duration_seconds)) from done),
      'pending_review', (select count(*) from done where status = 'pending_review'),
      'distribution', (select jsonb_build_object(
          '0-20', count(*) filter (where percent < 20), '20-40', count(*) filter (where percent >= 20 and percent < 40),
          '40-60', count(*) filter (where percent >= 40 and percent < 60), '60-80', count(*) filter (where percent >= 60 and percent < 80),
          '80-100', count(*) filter (where percent >= 80)) from done where status = 'graded'),
      'questions', (select coalesce(jsonb_agg(jsonb_build_object('question_id', question_id, 'answered', answered,
                       'correct', correct, 'wrong_rate', case when answered > 0 then round(wrong::numeric * 100 / answered, 2) else 0 end)
                       order by wrong desc), '[]'::jsonb) from per_q))
  );
end $$;

-- ---------------------------------------------------------------- RLS
alter table public.quizzes enable row level security;
alter table public.quiz_translations enable row level security;
alter table public.quiz_sections enable row level security;
alter table public.quiz_section_translations enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_question_translations enable row level security;
alter table public.quiz_options enable row level security;
alter table public.quiz_option_translations enable row level security;
alter table public.quiz_answer_keys enable row level security;
alter table public.quiz_attempts enable row level security;

create policy quizzes_select on public.quizzes for select to anon, authenticated
  using (private.quiz_live(id) or private.is_staff());
create policy quizzes_insert on public.quizzes for insert to authenticated with check (private.can_create_content());
create policy quizzes_update on public.quizzes for update to authenticated
  using (private.can_edit_owned(created_by)) with check (private.can_edit_owned(created_by));
create policy quizzes_delete on public.quizzes for delete to authenticated
  using (first_published_at is null and private.can_edit_owned(created_by));

create policy quiz_tr_select on public.quiz_translations for select to anon, authenticated
  using (private.quiz_live(quiz_id) or private.is_staff());
create policy quiz_tr_write on public.quiz_translations for all to authenticated
  using (private.can_edit_quiz(quiz_id)) with check (private.can_edit_quiz(quiz_id));

create policy quiz_sections_select on public.quiz_sections for select to authenticated using (private.is_staff());
create policy quiz_sections_write on public.quiz_sections for all to authenticated
  using (private.can_edit_quiz(quiz_id)) with check (private.can_edit_quiz(quiz_id));
create policy quiz_section_tr_select on public.quiz_section_translations for select to authenticated using (private.is_staff());
create policy quiz_section_tr_write on public.quiz_section_translations for all to authenticated
  using (private.can_edit_section(section_id)) with check (private.can_edit_section(section_id));

create policy quiz_questions_select on public.quiz_questions for select to authenticated using (private.is_staff());
create policy quiz_questions_write on public.quiz_questions for all to authenticated
  using (private.can_edit_quiz(quiz_id)) with check (private.can_edit_quiz(quiz_id));
create policy quiz_question_tr_select on public.quiz_question_translations for select to authenticated using (private.is_staff());
create policy quiz_question_tr_write on public.quiz_question_translations for all to authenticated
  using (private.can_edit_question(question_id)) with check (private.can_edit_question(question_id));

create policy quiz_options_select on public.quiz_options for select to authenticated using (private.is_staff());
create policy quiz_options_write on public.quiz_options for all to authenticated
  using (private.can_edit_question(question_id)) with check (private.can_edit_question(question_id));
create policy quiz_option_tr_select on public.quiz_option_translations for select to authenticated using (private.is_staff());
create policy quiz_option_tr_write on public.quiz_option_translations for all to authenticated
  using (private.can_edit_option(option_id)) with check (private.can_edit_option(option_id));

-- answer keys: only people who can edit the quiz, and reviewers
create policy quiz_keys_select on public.quiz_answer_keys for select to authenticated
  using (private.can_edit_question(question_id) or private.can_review());
create policy quiz_keys_write on public.quiz_answer_keys for all to authenticated
  using (private.can_edit_question(question_id)) with check (private.can_edit_question(question_id));

-- attempts are created and graded only through the API functions above
create policy quiz_attempts_select on public.quiz_attempts for select to authenticated
  using (user_id = (select auth.uid()) or private.can_review() or private.can_view_analytics());
revoke insert, update, delete on public.quiz_attempts from anon, authenticated;
