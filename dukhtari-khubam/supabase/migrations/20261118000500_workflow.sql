-- Духтари хубам · 0005 publication workflow, revisions, validation and admin operations
-- Draft → In Review → Approved / Changes Requested → Scheduled → Published → Archived (spec §6).
-- Lessons and quizzes publish an immutable snapshot (revision); readers only ever see snapshots.

create table public.workflow_events (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id uuid not null,
  from_status public.content_status,
  to_status public.content_status not null,
  revision_id uuid references public.content_revisions (id) on delete set null,
  actor_id uuid,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index workflow_events_entity_idx on public.workflow_events (entity_type, entity_id, created_at desc);
alter table public.workflow_events enable row level security;
create policy workflow_events_select on public.workflow_events for select to authenticated using (private.is_staff());
revoke insert, update, delete on public.workflow_events from anon, authenticated;

-- ---------------------------------------------------------------- entity registry
create or replace function private.entity_table(p_entity text) returns text
language plpgsql immutable set search_path = '' as $$
begin
  return case p_entity
    when 'school' then 'schools' when 'course' then 'courses' when 'module' then 'modules'
    when 'topic' then 'topics' when 'lesson' then 'lessons' when 'quiz' then 'quizzes'
    when 'inspiration' then 'daily_inspirations' when 'banner' then 'banners' when 'page' then 'cms_pages'
    when 'achievement' then 'achievements'
    else null end;
end $$;

create or replace function private.entity_translation(p_entity text) returns text[]
language sql immutable set search_path = '' as $$
  select case p_entity
    when 'school' then array['school_translations', 'school_id']
    when 'course' then array['course_translations', 'course_id']
    when 'module' then array['module_translations', 'module_id']
    when 'topic' then array['topic_translations', 'topic_id']
    when 'lesson' then array['lesson_translations', 'lesson_id']
    when 'quiz' then array['quiz_translations', 'quiz_id']
    when 'inspiration' then array['daily_inspiration_translations', 'inspiration_id']
    when 'banner' then array['banner_translations', 'banner_id']
    when 'page' then array['cms_page_translations', 'page_id']
    when 'achievement' then array['achievement_translations', 'achievement_id']
  end;
$$;

create or replace function private.is_uuid(p text) returns boolean
language sql immutable set search_path = '' as $$
  select p is not null and p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;

create or replace function private.block_asset_ids(p_props jsonb) returns setof uuid
language sql immutable set search_path = '' as $$
  select distinct v::uuid from (
    select p_props ->> 'asset_id' as v
    union all select p_props ->> 'poster_asset_id'
    union all select p_props ->> 'cover_asset_id'
    union all select jsonb_array_elements_text(
      case when jsonb_typeof(p_props -> 'asset_ids') = 'array' then p_props -> 'asset_ids' else '[]'::jsonb end)
  ) s where private.is_uuid(v);
$$;

-- ---------------------------------------------------------------- snapshots & revisions
create or replace function private.build_lesson_snapshot(p_lesson uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'lesson', jsonb_build_object('id', l.id, 'topic_id', l.topic_id, 'access_tier', l.access_tier,
                                 'estimated_minutes', l.estimated_minutes, 'version', l.version),
    'translations', coalesce((
      select jsonb_object_agg(t.locale, jsonb_build_object('title', t.title, 'summary', t.summary, 'ready', t.ready))
      from public.lesson_translations t where t.lesson_id = l.id), '{}'::jsonb),
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'type', b.type, 'schema_version', b.schema_version, 'position', b.position, 'props', b.props,
        'content', coalesce((select jsonb_object_agg(bt.locale, bt.content)
                             from public.content_block_translations bt where bt.block_id = b.id), '{}'::jsonb))
        order by b.position)
      from public.content_blocks b where b.lesson_id = l.id), '[]'::jsonb))
  from public.lessons l where l.id = p_lesson;
$$;

create or replace function private.save_revision(p_entity text, p_id uuid, p_kind text, p_note text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_snap jsonb;
  v_key jsonb;
  v_ver int;
  v_id uuid;
begin
  if p_entity = 'lesson' then
    v_snap := private.build_lesson_snapshot(p_id);
  elsif p_entity = 'quiz' then
    v_snap := private.build_quiz_snapshot(p_id);
    v_key := private.build_quiz_key(p_id);
  else
    perform private.fail('unknown_entity');
  end if;
  if v_snap is null then perform private.fail('not_found'); end if;
  select coalesce(max(version), 0) + 1 into v_ver from public.content_revisions
  where entity_type = p_entity and entity_id = p_id;
  insert into public.content_revisions (entity_type, entity_id, version, kind, snapshot, answer_key, note, created_by)
  values (p_entity, p_id, v_ver, p_kind, v_snap, v_key, left(p_note, 500), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function private.refresh_lesson_search(p_lesson uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_snap jsonb;
begin
  delete from public.lesson_search_index where lesson_id = p_lesson;
  select r.snapshot into v_snap
  from public.lessons l join public.content_revisions r on r.id = l.published_revision_id
  where l.id = p_lesson;
  if v_snap is null then return; end if;
  insert into public.lesson_search_index (lesson_id, locale, title, body)
  select p_lesson, e.key::public.locale_code, e.value ->> 'title',
    left(coalesce((
      select string_agg(s #>> '{}', ' ')
      from jsonb_array_elements(v_snap -> 'blocks') b,
           jsonb_path_query(coalesce(b -> 'content' -> e.key, '{}'::jsonb), 'strict $.**') s
      where jsonb_typeof(s) = 'string'
        and (s #>> '{}') !~ '^(https?://|mailto:)'
        and (s #>> '{}') not in ('bold', 'italic', 'underline', 'strike', 'ink', 'plum', 'lavender', 'rose',
                                 'champagne', 'sage', 'left', 'center', 'right')), ''), 100000)
  from jsonb_each(v_snap -> 'translations') e
  where coalesce((e.value ->> 'ready')::boolean, false);
end $$;

-- ---------------------------------------------------------------- validation (publish gates)
create or replace function private.validate_lesson(p_lesson uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_errors jsonb := '[]'::jsonb;
  v_locales text[];
  v_loc text;
  b record;
  a record;
  v_aid uuid;
  text_types text[] := array['heading', 'subheading', 'paragraph', 'lead', 'rich_text', 'ordered_list', 'bullet_list',
                             'quote', 'callout', 'table', 'source', 'practical_task', 'side_by_side', 'caption', 'footnote'];
  asset_types text[] := array['image', 'video', 'audio', 'file', 'illustration', 'full_width_media', 'side_by_side', 'model3d'];
  image_types text[] := array['image', 'gallery', 'illustration', 'full_width_media', 'side_by_side'];
begin
  if not exists (select 1 from public.lessons where id = p_lesson) then
    return '[{"code":"not_found"}]'::jsonb;
  end if;
  select coalesce(array_agg(locale::text order by locale), '{}') into v_locales
  from public.lesson_translations where lesson_id = p_lesson and ready;
  if cardinality(v_locales) = 0 then v_errors := v_errors || '[{"code":"no_ready_locale"}]'::jsonb; end if;
  if not exists (select 1 from public.content_blocks where lesson_id = p_lesson) then
    v_errors := v_errors || '[{"code":"no_blocks"}]'::jsonb;
  end if;

  for b in select * from public.content_blocks where lesson_id = p_lesson order by position loop
    if b.type::text = any (text_types) then
      foreach v_loc in array v_locales loop
        if not exists (select 1 from public.content_block_translations t
                       where t.block_id = b.id and t.locale::text = v_loc and t.content <> '{}'::jsonb) then
          v_errors := v_errors || jsonb_build_array(jsonb_build_object('code', 'missing_translation', 'block_id', b.id, 'locale', v_loc));
        end if;
      end loop;
    end if;
    if b.type::text = any (asset_types) and not private.is_uuid(b.props ->> 'asset_id') then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('code', 'missing_asset', 'block_id', b.id));
    end if;
    if b.type = 'gallery' and coalesce(jsonb_array_length(case when jsonb_typeof(b.props -> 'asset_ids') = 'array' then b.props -> 'asset_ids' end), 0) = 0 then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('code', 'missing_asset', 'block_id', b.id));
    end if;
    if b.type = 'quiz' and not (private.is_uuid(b.props ->> 'quiz_id')
                                and exists (select 1 from public.quizzes z where z.id = (b.props ->> 'quiz_id')::uuid)) then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('code', 'missing_quiz', 'block_id', b.id));
    end if;
    if b.type = 'related_lesson' and not (private.is_uuid(b.props ->> 'lesson_id')
                                          and exists (select 1 from public.lessons x where x.id = (b.props ->> 'lesson_id')::uuid)) then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('code', 'missing_lesson', 'block_id', b.id));
    end if;
    for v_aid in select * from private.block_asset_ids(b.props) loop
      select * into a from public.media_assets where id = v_aid;
      if not found or a.status <> 'active' then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('code', 'asset_unavailable', 'block_id', b.id, 'asset_id', v_aid));
        continue;
      end if;
      if coalesce(trim(a.license), '') = '' then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('code', 'asset_missing_license', 'block_id', b.id, 'asset_id', v_aid));
      end if;
      if a.is_ai_generated then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('code', 'asset_ai_generated', 'block_id', b.id, 'asset_id', v_aid));
      end if;
      if b.type::text = any (image_types) and a.kind = 'image' then
        foreach v_loc in array v_locales loop
          if not exists (select 1 from public.media_asset_translations t
                         where t.asset_id = v_aid and t.locale::text = v_loc and coalesce(trim(t.alt_text), '') <> '') then
            v_errors := v_errors || jsonb_build_array(jsonb_build_object('code', 'missing_alt_text', 'block_id', b.id,
                                                                         'asset_id', v_aid, 'locale', v_loc));
          end if;
        end loop;
      end if;
    end loop;
  end loop;
  return v_errors;
end $$;

-- QZ-13 publish validation. Purely structural: it never edits the author's text.
create or replace function private.validate_quiz(p_quiz uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_errors jsonb := '[]'::jsonb;
  v_locales text[];
  v_loc text;
  q record;
  k public.quiz_answer_keys%rowtype;
  v_opts uuid[];
  v_left uuid[];
  v_right uuid[];
  v_correct int;
  v_err text;
begin
  if not exists (select 1 from public.quizzes where id = p_quiz) then return '[{"code":"not_found"}]'::jsonb; end if;
  select coalesce(array_agg(locale::text order by locale), '{}') into v_locales
  from public.quiz_translations where quiz_id = p_quiz and ready;
  if cardinality(v_locales) = 0 then v_errors := v_errors || '[{"code":"no_ready_locale"}]'::jsonb; end if;
  if not exists (select 1 from public.quiz_questions where quiz_id = p_quiz and is_active) then
    v_errors := v_errors || '[{"code":"no_questions"}]'::jsonb;
  end if;

  for q in select * from public.quiz_questions where quiz_id = p_quiz and is_active order by position loop
    select * into k from public.quiz_answer_keys where question_id = q.id;
    v_opts := array(select o.id from public.quiz_options o where o.question_id = q.id and o.is_active order by o.position);
    v_left := array(select o.id from public.quiz_options o where o.question_id = q.id and o.is_active and o.side = 'left' order by o.position);
    v_right := array(select o.id from public.quiz_options o where o.question_id = q.id and o.is_active and o.side = 'right' order by o.position);
    v_correct := (select count(*) from unnest(coalesce(k.correct_option_ids, '{}')) c where c = any (v_opts));
    v_err := null;

    foreach v_loc in array v_locales loop
      if not exists (select 1 from public.quiz_question_translations t
                     where t.question_id = q.id and t.locale::text = v_loc and trim(t.prompt) <> '') then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('code', 'missing_translation', 'question_id', q.id, 'locale', v_loc));
      end if;
      if q.type in ('single_choice', 'multiple_choice', 'true_false', 'matching', 'ordering') and exists (
        select 1 from public.quiz_options o
        where o.question_id = q.id and o.is_active and o.media_asset_id is null
          and not exists (select 1 from public.quiz_option_translations ot
                          where ot.option_id = o.id and ot.locale::text = v_loc and coalesce(trim(ot.text), '') <> '')) then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('code', 'missing_option_text', 'question_id', q.id, 'locale', v_loc));
      end if;
      if q.type = 'short_answer' and coalesce(jsonb_array_length(
           case when jsonb_typeof(k.accepted_answers -> v_loc) = 'array' then k.accepted_answers -> v_loc end), 0) = 0 then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('code', 'missing_accepted_answers', 'question_id', q.id, 'locale', v_loc));
      end if;
      if q.type = 'long_answer' and not exists (select 1 from public.quiz_question_translations t
          where t.question_id = q.id and t.locale::text = v_loc and coalesce(trim(t.rubric), '') <> '') then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('code', 'missing_rubric', 'question_id', q.id, 'locale', v_loc));
      end if;
    end loop;

    if q.media_required and (q.media_asset_id is null
        or not exists (select 1 from public.media_assets a where a.id = q.media_asset_id and a.status = 'active')) then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('code', 'missing_media', 'question_id', q.id));
    end if;

    v_err := case q.type
      when 'single_choice' then
        case when cardinality(v_opts) < 2 then 'too_few_options' when v_correct <> 1 then 'needs_exactly_one_correct' end
      when 'true_false' then
        case when cardinality(v_opts) <> 2 then 'true_false_needs_two_options' when v_correct <> 1 then 'needs_exactly_one_correct' end
      when 'multiple_choice' then
        case when v_correct < 2 then 'needs_two_correct' when cardinality(v_opts) - v_correct < 1 then 'needs_one_incorrect' end
      when 'matching' then
        case when cardinality(v_left) < 2 or cardinality(v_right) < 2 then 'too_few_pairs'
             when exists (select 1 from unnest(v_left) l
                          where not ((coalesce(k.matching, '{}'::jsonb) ->> l::text) = any (array(select unnest(v_right)::text)))) then 'matching_incomplete' end
      when 'ordering' then
        case when cardinality(v_opts) < 2 then 'too_few_options'
             when cardinality(coalesce(k.correct_order, '{}')) <> cardinality(v_opts)
                  or exists (select 1 from unnest(v_opts) o where not (o = any (coalesce(k.correct_order, '{}')))) then 'ordering_incomplete' end
      else null end;
    if v_err is not null then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('code', v_err, 'question_id', q.id));
    end if;
  end loop;
  return v_errors;
end $$;

create or replace function private.validate_simple(p_entity text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_tr text[] := private.entity_translation(p_entity);
  v_ok boolean;
begin
  execute format('select exists (select 1 from public.%I where %I = $1 and ready)', v_tr[1], v_tr[2]) into v_ok using p_id;
  if not v_ok then return '[{"code":"no_ready_locale"}]'::jsonb; end if;
  return '[]'::jsonb;
end $$;

create or replace function public.admin_validate(p_entity text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  if private.entity_table(p_entity) is null then perform private.fail('unknown_entity'); end if;
  return case p_entity
    when 'lesson' then private.validate_lesson(p_id)
    when 'quiz' then private.validate_quiz(p_id)
    else private.validate_simple(p_entity, p_id) end;
end $$;

-- ---------------------------------------------------------------- transitions
create or replace function public.admin_transition(
  p_entity text, p_id uuid, p_to public.content_status, p_note text default null, p_publish_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_table text := private.entity_table(p_entity);
  v_from public.content_status;
  v_owner uuid;
  v_snapshot boolean := p_entity in ('lesson', 'quiz');
  v_can_edit boolean;
  v_errors jsonb;
  v_rev uuid;
  v_at timestamptz;
begin
  if v_table is null then perform private.fail('unknown_entity'); end if;
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  execute format('select status, created_by from public.%I where id = $1 for update', v_table)
    into v_from, v_owner using p_id;
  if v_from is null then perform private.fail('not_found'); end if;

  v_can_edit := case
    when p_entity in ('school', 'achievement') then private.can_publish()
    when p_entity in ('inspiration', 'banner', 'page') then private.can_edit_any()
    else private.can_edit_owned(v_owner) end;

  if p_to = v_from and p_to not in ('published', 'scheduled') then perform private.fail('invalid_transition'); end if;

  if p_to = 'in_review' then
    if v_from not in ('draft', 'changes_requested', 'approved', 'published') then perform private.fail('invalid_transition'); end if;
    if not v_can_edit then perform private.fail('forbidden'); end if;
  elsif p_to in ('approved', 'changes_requested') then
    if v_from <> 'in_review' then perform private.fail('invalid_transition'); end if;
    if not private.can_review() then perform private.fail('forbidden'); end if;
  elsif p_to = 'draft' then
    if v_from in ('published', 'scheduled', 'archived') then
      if not private.can_publish() then perform private.fail('forbidden'); end if;
    elsif not (v_can_edit or private.can_publish()) then
      perform private.fail('forbidden');
    end if;
  elsif p_to in ('published', 'scheduled') then
    if not private.can_publish() then perform private.fail('forbidden'); end if;
    if v_from = 'archived' then perform private.fail('invalid_transition'); end if;
    if v_snapshot and v_from not in ('approved', 'scheduled', 'published') and not private.is_super_admin() then
      perform private.fail('review_required');
    end if;
    if p_to = 'scheduled' and (p_publish_at is null or p_publish_at <= now()) then
      perform private.fail('validation_failed', jsonb_build_object('field', 'publish_at'));
    end if;
  elsif p_to = 'archived' then
    if not private.can_publish() then perform private.fail('forbidden'); end if;
  end if;

  if p_to in ('published', 'scheduled') then
    v_errors := case p_entity
      when 'lesson' then private.validate_lesson(p_id)
      when 'quiz' then private.validate_quiz(p_id)
      else private.validate_simple(p_entity, p_id) end;
    if jsonb_array_length(v_errors) > 0 then perform private.fail('validation_failed', v_errors); end if;
    v_at := case when p_to = 'scheduled' then p_publish_at else now() end;
    if v_snapshot then
      v_rev := private.save_revision(p_entity, p_id, 'publish', p_note);
      execute format('update public.%I set status = $2, publish_at = $3, published_revision_id = $4, published_at = now(),
                      first_published_at = coalesce(first_published_at, now()) where id = $1', v_table)
        using p_id, p_to, v_at, v_rev;
      if p_entity = 'lesson' then perform private.refresh_lesson_search(p_id); end if;
    else
      execute format('update public.%I set status = $2, publish_at = $3,
                      first_published_at = coalesce(first_published_at, now()) where id = $1', v_table)
        using p_id, p_to, v_at;
    end if;
  elsif p_to = 'archived' or (p_to = 'draft' and v_from in ('published', 'scheduled')) then
    if v_snapshot then
      execute format('update public.%I set status = $2, publish_at = null, published_revision_id = null where id = $1', v_table)
        using p_id, p_to;
      if p_entity = 'lesson' then perform private.refresh_lesson_search(p_id); end if;
    else
      execute format('update public.%I set status = $2, publish_at = null where id = $1', v_table) using p_id, p_to;
    end if;
  else
    if p_to = 'in_review' and v_snapshot then
      v_rev := private.save_revision(p_entity, p_id, 'review', p_note);
    end if;
    execute format('update public.%I set status = $2 where id = $1', v_table) using p_id, p_to;
  end if;

  insert into public.workflow_events (entity_type, entity_id, from_status, to_status, revision_id, actor_id, note)
  values (p_entity, p_id, v_from, p_to, v_rev, auth.uid(), left(p_note, 500));
  return jsonb_build_object('entity', p_entity, 'id', p_id, 'from', v_from, 'status', p_to,
                            'revision_id', v_rev, 'publish_at', v_at);
end $$;

create or replace function public.admin_workflow_history(p_entity text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  return coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc)
                   from public.workflow_events e where e.entity_type = p_entity and e.entity_id = p_id), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------- revisions API
create or replace function private.can_edit_entity(p_entity text, p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case p_entity when 'lesson' then private.can_edit_lesson(p_id)
                       when 'quiz' then private.can_edit_quiz(p_id) else false end;
$$;

create or replace function public.admin_create_revision(p_entity text, p_id uuid, p_note text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_edit_entity(p_entity, p_id) then perform private.fail('forbidden'); end if;
  return private.save_revision(p_entity, p_id, 'manual', p_note);
end $$;

create or replace function public.admin_list_revisions(p_entity text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', r.id, 'version', r.version, 'kind', r.kind, 'note', r.note,
      'created_by', r.created_by, 'author', p.display_name, 'created_at', r.created_at,
      'is_published', exists (select 1 from public.lessons l where l.published_revision_id = r.id)
                      or exists (select 1 from public.quizzes z where z.published_revision_id = r.id))
      order by r.version desc)
    from public.content_revisions r left join public.profiles p on p.id = r.created_by
    where r.entity_type = p_entity and r.entity_id = p_id), '[]'::jsonb);
end $$;

create or replace function public.admin_get_revision(p_revision uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r public.content_revisions%rowtype;
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  select * into r from public.content_revisions where id = p_revision;
  if not found then perform private.fail('not_found'); end if;
  return jsonb_build_object('id', r.id, 'entity_type', r.entity_type, 'entity_id', r.entity_id, 'version', r.version,
    'kind', r.kind, 'note', r.note, 'created_by', r.created_by, 'created_at', r.created_at, 'snapshot', r.snapshot,
    'answer_key', case when r.entity_type = 'quiz' and (private.can_edit_quiz(r.entity_id) or private.can_review())
                       then r.answer_key end);
end $$;

create or replace function public.admin_restore_revision(p_revision uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r public.content_revisions%rowtype;
  v_backup uuid;
  q jsonb;
  o jsonb;
  s jsonb;
  e record;
begin
  select * into r from public.content_revisions where id = p_revision;
  if not found then perform private.fail('not_found'); end if;
  if not private.can_edit_entity(r.entity_type, r.entity_id) then perform private.fail('forbidden'); end if;
  v_backup := private.save_revision(r.entity_type, r.entity_id, 'restore', 'before restore of v' || r.version);

  if r.entity_type = 'lesson' then
    delete from public.content_blocks where lesson_id = r.entity_id;
    delete from public.lesson_translations where lesson_id = r.entity_id;
    insert into public.lesson_translations (lesson_id, locale, title, summary, ready)
    select r.entity_id, e2.key::public.locale_code, e2.value ->> 'title', e2.value ->> 'summary',
           coalesce((e2.value ->> 'ready')::boolean, false)
    from jsonb_each(r.snapshot -> 'translations') e2;
    insert into public.content_blocks (id, lesson_id, position, type, schema_version, props)
    select (b ->> 'id')::uuid, r.entity_id, (b ->> 'position')::int, (b ->> 'type')::public.block_type,
           coalesce((b ->> 'schema_version')::smallint, 1), coalesce(b -> 'props', '{}'::jsonb)
    from jsonb_array_elements(r.snapshot -> 'blocks') b;
    insert into public.content_block_translations (block_id, locale, content)
    select (b ->> 'id')::uuid, c.key::public.locale_code, c.value
    from jsonb_array_elements(r.snapshot -> 'blocks') b, jsonb_each(coalesce(b -> 'content', '{}'::jsonb)) c;
    update public.lessons set
      access_tier = coalesce((r.snapshot -> 'lesson' ->> 'access_tier')::public.access_tier, access_tier),
      estimated_minutes = (r.snapshot -> 'lesson' ->> 'estimated_minutes')::int,
      version = version + 1
    where id = r.entity_id;
  else
    delete from public.quiz_questions where quiz_id = r.entity_id;
    delete from public.quiz_sections where quiz_id = r.entity_id;
    delete from public.quiz_translations where quiz_id = r.entity_id;
    insert into public.quiz_translations (quiz_id, locale, title, description, instructions, completion_text, ready)
    select r.entity_id, e2.key::public.locale_code, e2.value ->> 'title', e2.value ->> 'description',
           e2.value ->> 'instructions', e2.value ->> 'completion_text', coalesce((e2.value ->> 'ready')::boolean, false)
    from jsonb_each(r.snapshot -> 'translations') e2;
    for s in select * from jsonb_array_elements(r.snapshot -> 'sections') loop
      insert into public.quiz_sections (id, quiz_id, position) values ((s ->> 'id')::uuid, r.entity_id, (s ->> 'position')::int);
      insert into public.quiz_section_translations (section_id, locale, title)
      select (s ->> 'id')::uuid, t.key::public.locale_code, t.value ->> 'title' from jsonb_each(s -> 'translations') t;
    end loop;
    for q in select * from jsonb_array_elements(r.snapshot -> 'questions') loop
      insert into public.quiz_questions (id, quiz_id, section_id, position, type, points, partial_credit, penalty,
        media_asset_id, media_required, exclude_from_shuffle, required, case_sensitive, ignore_punctuation,
        manual_review_on_mismatch, related_lesson_id)
      values ((q ->> 'id')::uuid, r.entity_id, (q ->> 'section_id')::uuid, (q ->> 'position')::int,
        (q ->> 'type')::public.question_type, (q ->> 'points')::numeric, (q ->> 'partial_credit')::boolean,
        (q ->> 'penalty')::numeric, (q ->> 'media_asset_id')::uuid, (q ->> 'media_required')::boolean,
        (q ->> 'exclude_from_shuffle')::boolean, (q ->> 'required')::boolean, (q ->> 'case_sensitive')::boolean,
        (q ->> 'ignore_punctuation')::boolean, (q ->> 'manual_review_on_mismatch')::boolean,
        (select x.id from public.lessons x where x.id = (q ->> 'related_lesson_id')::uuid));
      insert into public.quiz_question_translations (question_id, locale, prompt, hint, explanation_correct, explanation_incorrect, rubric)
      select (q ->> 'id')::uuid, t.key::public.locale_code, t.value ->> 'prompt', t.value ->> 'hint',
             t.value ->> 'explanation_correct', t.value ->> 'explanation_incorrect', t.value ->> 'rubric'
      from jsonb_each(q -> 'translations') t;
      for o in select * from jsonb_array_elements(q -> 'options') loop
        insert into public.quiz_options (id, question_id, position, side, media_asset_id)
        values ((o ->> 'id')::uuid, (q ->> 'id')::uuid, (o ->> 'position')::int, o ->> 'side', (o ->> 'media_asset_id')::uuid);
        insert into public.quiz_option_translations (option_id, locale, text, feedback)
        select (o ->> 'id')::uuid, t.key::public.locale_code, t.value ->> 'text', t.value ->> 'feedback'
        from jsonb_each(o -> 'translations') t;
      end loop;
    end loop;
    insert into public.quiz_answer_keys (question_id, correct_option_ids, correct_order, matching, accepted_answers)
    select e.key::uuid,
           coalesce(array(select jsonb_array_elements_text(e.value -> 'correct_option_ids')::uuid), '{}'),
           coalesce(array(select x::uuid from jsonb_array_elements_text(e.value -> 'correct_order') with ordinality t(x, n) order by n), '{}'),
           coalesce(e.value -> 'matching', '{}'::jsonb), coalesce(e.value -> 'accepted_answers', '{}'::jsonb)
    from jsonb_each(coalesce(r.answer_key, '{}'::jsonb)) e
    where exists (select 1 from public.quiz_questions qq where qq.id = e.key::uuid);
    update public.quizzes z set
      pass_score_percent = (r.snapshot -> 'quiz' ->> 'pass_score_percent')::numeric,
      time_limit_seconds = (r.snapshot -> 'quiz' ->> 'time_limit_seconds')::int,
      max_attempts = (r.snapshot -> 'quiz' ->> 'max_attempts')::int,
      allow_retry = (r.snapshot -> 'quiz' ->> 'allow_retry')::boolean,
      shuffle_questions = (r.snapshot -> 'quiz' ->> 'shuffle_questions')::boolean,
      shuffle_options = (r.snapshot -> 'quiz' ->> 'shuffle_options')::boolean,
      show_correct_answers = (r.snapshot -> 'quiz' ->> 'show_correct_answers')::public.reveal_policy,
      show_explanations = (r.snapshot -> 'quiz' ->> 'show_explanations')::public.reveal_policy,
      version = z.version + 1
    where z.id = r.entity_id;
  end if;
  return jsonb_build_object('restored_revision', r.id, 'backup_revision', v_backup);
end $$;

-- ---------------------------------------------------------------- lesson editing
create or replace function public.admin_save_lesson_blocks(p_lesson uuid, p_expected_version int, p_blocks jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  l public.lessons%rowtype;
  b jsonb;
  c record;
  v_id uuid;
  v_pos int := 0;
  v_keep uuid[] := '{}';
begin
  select * into l from public.lessons where id = p_lesson for update;
  if not found then perform private.fail('not_found'); end if;
  if not private.can_edit_owned(l.created_by) then perform private.fail('forbidden'); end if;
  if p_expected_version is not null and p_expected_version <> l.version then
    perform private.fail('version_conflict', jsonb_build_object('current_version', l.version));
  end if;
  if jsonb_typeof(p_blocks) <> 'array' or jsonb_array_length(p_blocks) > 500 then
    perform private.fail('validation_failed', jsonb_build_object('field', 'blocks'));
  end if;

  for b in select * from jsonb_array_elements(p_blocks) loop
    v_id := case when private.is_uuid(b ->> 'id') then (b ->> 'id')::uuid else gen_random_uuid() end;
    if exists (select 1 from public.content_blocks x where x.id = v_id and x.lesson_id <> p_lesson) then
      v_id := gen_random_uuid();
    end if;
    insert into public.content_blocks (id, lesson_id, position, type, schema_version, props)
    values (v_id, p_lesson, v_pos, (b ->> 'type')::public.block_type,
            coalesce((b ->> 'schema_version')::smallint, 1), coalesce(b -> 'props', '{}'::jsonb))
    on conflict (id) do update set position = excluded.position, type = excluded.type,
      schema_version = excluded.schema_version, props = excluded.props
    where public.content_blocks.position is distinct from excluded.position
       or public.content_blocks.type is distinct from excluded.type
       or public.content_blocks.schema_version is distinct from excluded.schema_version
       or public.content_blocks.props is distinct from excluded.props;
    for c in select * from jsonb_each(coalesce(b -> 'content', '{}'::jsonb)) loop
      if c.value = 'null'::jsonb then
        delete from public.content_block_translations where block_id = v_id and locale = c.key::public.locale_code;
      else
        insert into public.content_block_translations (block_id, locale, content)
        values (v_id, c.key::public.locale_code, c.value)
        on conflict (block_id, locale) do update set content = excluded.content
        where public.content_block_translations.content is distinct from excluded.content;
      end if;
    end loop;
    v_keep := v_keep || v_id;
    v_pos := v_pos + 1;
  end loop;

  delete from public.content_blocks where lesson_id = p_lesson and not (id = any (v_keep));
  update public.lessons set version = version + 1 where id = p_lesson;
  return jsonb_build_object('version', l.version + 1, 'block_ids', to_jsonb(v_keep));
end $$;

create or replace function public.admin_duplicate_block(p_block uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  b public.content_blocks%rowtype;
  v_new uuid;
begin
  select * into b from public.content_blocks where id = p_block;
  if not found then perform private.fail('not_found'); end if;
  if not private.can_edit_lesson(b.lesson_id) then perform private.fail('forbidden'); end if;
  update public.content_blocks set position = position + 1 where lesson_id = b.lesson_id and position > b.position;
  insert into public.content_blocks (lesson_id, position, type, schema_version, props)
  values (b.lesson_id, b.position + 1, b.type, b.schema_version, b.props) returning id into v_new;
  insert into public.content_block_translations (block_id, locale, content)
  select v_new, t.locale, t.content from public.content_block_translations t where t.block_id = p_block;
  update public.lessons set version = version + 1 where id = b.lesson_id;
  return v_new;
end $$;

-- ---------------------------------------------------------------- quiz editing
-- One atomic save for a question with its translations, options and answer key.
-- Options may carry a client "ref" so a new option can be marked correct in the same call.
create or replace function public.admin_save_quiz_question(p_question jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_quiz uuid;
  v_map jsonb := '{}'::jsonb;
  v_keep uuid[] := '{}';
  v_pos int := 0;
  v_oid uuid;
  v_key jsonb;
  o jsonb;
  e record;
begin
  if jsonb_typeof(p_question) <> 'object' then perform private.fail('validation_failed'); end if;
  if private.is_uuid(p_question ->> 'id') then
    v_id := (p_question ->> 'id')::uuid;
    select quiz_id into v_quiz from public.quiz_questions where id = v_id;
    if v_quiz is null then perform private.fail('not_found'); end if;
  else
    if not private.is_uuid(p_question ->> 'quiz_id') then perform private.fail('validation_failed', '{"field":"quiz_id"}'); end if;
    v_quiz := (p_question ->> 'quiz_id')::uuid;
  end if;
  if not private.can_edit_quiz(v_quiz) then perform private.fail('forbidden'); end if;

  if v_id is null then
    insert into public.quiz_questions (quiz_id, position, type)
    values (v_quiz,
            coalesce((p_question ->> 'position')::int,
                     (select coalesce(max(position) + 1, 0) from public.quiz_questions where quiz_id = v_quiz)),
            (p_question ->> 'type')::public.question_type)
    returning id into v_id;
  end if;

  update public.quiz_questions set
    type = coalesce((p_question ->> 'type')::public.question_type, type),
    section_id = case when p_question ? 'section_id' then (p_question ->> 'section_id')::uuid else section_id end,
    position = coalesce((p_question ->> 'position')::int, position),
    points = coalesce((p_question ->> 'points')::numeric, points),
    partial_credit = coalesce((p_question ->> 'partial_credit')::boolean, partial_credit),
    penalty = coalesce((p_question ->> 'penalty')::numeric, penalty),
    media_asset_id = case when p_question ? 'media_asset_id' then (p_question ->> 'media_asset_id')::uuid else media_asset_id end,
    media_required = coalesce((p_question ->> 'media_required')::boolean, media_required),
    exclude_from_shuffle = coalesce((p_question ->> 'exclude_from_shuffle')::boolean, exclude_from_shuffle),
    required = coalesce((p_question ->> 'required')::boolean, required),
    case_sensitive = coalesce((p_question ->> 'case_sensitive')::boolean, case_sensitive),
    ignore_punctuation = coalesce((p_question ->> 'ignore_punctuation')::boolean, ignore_punctuation),
    manual_review_on_mismatch = coalesce((p_question ->> 'manual_review_on_mismatch')::boolean, manual_review_on_mismatch),
    related_lesson_id = case when p_question ? 'related_lesson_id' then (p_question ->> 'related_lesson_id')::uuid else related_lesson_id end,
    is_active = coalesce((p_question ->> 'is_active')::boolean, is_active)
  where id = v_id;

  for e in select * from jsonb_each(coalesce(p_question -> 'translations', '{}'::jsonb)) loop
    if e.value = 'null'::jsonb then
      delete from public.quiz_question_translations where question_id = v_id and locale = e.key::public.locale_code;
    else
      insert into public.quiz_question_translations (question_id, locale, prompt, hint, explanation_correct, explanation_incorrect, rubric)
      values (v_id, e.key::public.locale_code, e.value ->> 'prompt', e.value ->> 'hint', e.value ->> 'explanation_correct',
              e.value ->> 'explanation_incorrect', e.value ->> 'rubric')
      on conflict (question_id, locale) do update set prompt = excluded.prompt, hint = excluded.hint,
        explanation_correct = excluded.explanation_correct, explanation_incorrect = excluded.explanation_incorrect,
        rubric = excluded.rubric;
    end if;
  end loop;

  if p_question ? 'options' then
    for o in select * from jsonb_array_elements(coalesce(p_question -> 'options', '[]'::jsonb)) loop
      v_oid := case when private.is_uuid(o ->> 'id')
                         and exists (select 1 from public.quiz_options x where x.id = (o ->> 'id')::uuid and x.question_id = v_id)
                    then (o ->> 'id')::uuid else gen_random_uuid() end;
      insert into public.quiz_options (id, question_id, position, side, media_asset_id, is_active)
      values (v_oid, v_id, v_pos, o ->> 'side', (o ->> 'media_asset_id')::uuid, coalesce((o ->> 'is_active')::boolean, true))
      on conflict (id) do update set position = excluded.position, side = excluded.side,
        media_asset_id = excluded.media_asset_id, is_active = excluded.is_active;
      for e in select * from jsonb_each(coalesce(o -> 'translations', '{}'::jsonb)) loop
        if e.value = 'null'::jsonb then
          delete from public.quiz_option_translations where option_id = v_oid and locale = e.key::public.locale_code;
        else
          insert into public.quiz_option_translations (option_id, locale, text, feedback)
          values (v_oid, e.key::public.locale_code, e.value ->> 'text', e.value ->> 'feedback')
          on conflict (option_id, locale) do update set text = excluded.text, feedback = excluded.feedback;
        end if;
      end loop;
      v_map := v_map || jsonb_build_object(v_oid::text, v_oid::text);
      if o ->> 'ref' is not null then v_map := v_map || jsonb_build_object(o ->> 'ref', v_oid::text); end if;
      if o ->> 'id' is not null then v_map := v_map || jsonb_build_object(o ->> 'id', v_oid::text); end if;
      v_keep := v_keep || v_oid;
      v_pos := v_pos + 1;
    end loop;
    delete from public.quiz_options where question_id = v_id and not (id = any (v_keep));
  else
    select coalesce(jsonb_object_agg(id::text, id::text), '{}'::jsonb) into v_map
    from public.quiz_options where question_id = v_id;
  end if;

  if p_question ? 'answer_key' then
    v_key := coalesce(p_question -> 'answer_key', '{}'::jsonb);
    insert into public.quiz_answer_keys (question_id, correct_option_ids, correct_order, matching, accepted_answers)
    values (v_id,
      coalesce(array(select (v_map ->> x)::uuid from jsonb_array_elements_text(coalesce(v_key -> 'correct', '[]'::jsonb)) x where v_map ? x), '{}'),
      coalesce(array(select (v_map ->> t.x)::uuid from jsonb_array_elements_text(coalesce(v_key -> 'order', '[]'::jsonb)) with ordinality t(x, n)
                     where v_map ? t.x order by t.n), '{}'),
      coalesce((select jsonb_object_agg(v_map ->> m.key, v_map ->> m.value)
                from jsonb_each_text(coalesce(v_key -> 'matching', '{}'::jsonb)) m where v_map ? m.key and v_map ? m.value), '{}'::jsonb),
      coalesce(v_key -> 'accepted_answers', '{}'::jsonb))
    on conflict (question_id) do update set correct_option_ids = excluded.correct_option_ids,
      correct_order = excluded.correct_order, matching = excluded.matching, accepted_answers = excluded.accepted_answers;
  end if;

  update public.quizzes set version = version + 1 where id = v_quiz;
  return jsonb_build_object('id', v_id, 'quiz_id', v_quiz, 'option_ids', v_map);
end $$;

create or replace function private.copy_question(p_question uuid, p_quiz uuid, p_position int, p_section uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_new uuid;
  v_map jsonb := '{}'::jsonb;
  v_oid uuid;
  o record;
begin
  insert into public.quiz_questions (quiz_id, section_id, position, type, points, partial_credit, penalty, media_asset_id,
    media_required, exclude_from_shuffle, required, case_sensitive, ignore_punctuation, manual_review_on_mismatch,
    related_lesson_id, is_active)
  select p_quiz, p_section, p_position, q.type, q.points, q.partial_credit, q.penalty, q.media_asset_id, q.media_required,
    q.exclude_from_shuffle, q.required, q.case_sensitive, q.ignore_punctuation, q.manual_review_on_mismatch,
    q.related_lesson_id, q.is_active
  from public.quiz_questions q where q.id = p_question
  returning id into v_new;
  insert into public.quiz_question_translations (question_id, locale, prompt, hint, explanation_correct, explanation_incorrect, rubric)
  select v_new, t.locale, t.prompt, t.hint, t.explanation_correct, t.explanation_incorrect, t.rubric
  from public.quiz_question_translations t where t.question_id = p_question;
  for o in select * from public.quiz_options where question_id = p_question order by position loop
    insert into public.quiz_options (question_id, position, side, media_asset_id, is_active)
    values (v_new, o.position, o.side, o.media_asset_id, o.is_active) returning id into v_oid;
    insert into public.quiz_option_translations (option_id, locale, text, feedback)
    select v_oid, t.locale, t.text, t.feedback from public.quiz_option_translations t where t.option_id = o.id;
    v_map := v_map || jsonb_build_object(o.id::text, v_oid::text);
  end loop;
  insert into public.quiz_answer_keys (question_id, correct_option_ids, correct_order, matching, accepted_answers)
  select v_new,
    coalesce(array(select (v_map ->> x::text)::uuid from unnest(k.correct_option_ids) x where v_map ? x::text), '{}'),
    coalesce(array(select (v_map ->> t.x::text)::uuid from unnest(k.correct_order) with ordinality t(x, n)
                   where v_map ? t.x::text order by t.n), '{}'),
    coalesce((select jsonb_object_agg(v_map ->> m.key, v_map ->> m.value) from jsonb_each_text(k.matching) m
              where v_map ? m.key and v_map ? m.value), '{}'::jsonb),
    k.accepted_answers
  from public.quiz_answer_keys k where k.question_id = p_question;
  return v_new;
end $$;

-- QZ-06: the copy is fully independent from the original.
create or replace function public.admin_duplicate_question(p_question uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare q public.quiz_questions%rowtype;
begin
  select * into q from public.quiz_questions where id = p_question;
  if not found then perform private.fail('not_found'); end if;
  if not private.can_edit_quiz(q.quiz_id) then perform private.fail('forbidden'); end if;
  update public.quiz_questions set position = position + 1 where quiz_id = q.quiz_id and position > q.position;
  update public.quizzes set version = version + 1 where id = q.quiz_id;
  return private.copy_question(p_question, q.quiz_id, q.position + 1, q.section_id);
end $$;

create or replace function public.admin_duplicate_quiz(p_quiz uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  z public.quizzes%rowtype;
  v_new uuid;
  v_sections jsonb := '{}'::jsonb;
  v_sid uuid;
  s record;
  q record;
begin
  select * into z from public.quizzes where id = p_quiz;
  if not found then perform private.fail('not_found'); end if;
  if not (private.can_create_content() and private.is_staff()) then perform private.fail('forbidden'); end if;
  insert into public.quizzes (slug, school_id, course_id, module_id, topic_id, lesson_id, position, pass_score_percent,
    time_limit_seconds, max_attempts, allow_retry, shuffle_questions, shuffle_options, show_correct_answers,
    show_explanations, access_tier, cover_asset_id, status, created_by, updated_by)
  values (left(z.slug, 50) || '-copy-' || substr(md5(random()::text), 1, 6), z.school_id, z.course_id, z.module_id,
    z.topic_id, z.lesson_id, z.position + 1, z.pass_score_percent, z.time_limit_seconds, z.max_attempts, z.allow_retry,
    z.shuffle_questions, z.shuffle_options, z.show_correct_answers, z.show_explanations, z.access_tier, z.cover_asset_id,
    'draft', auth.uid(), auth.uid())
  returning id into v_new;
  insert into public.quiz_translations (quiz_id, locale, title, description, instructions, completion_text, ready)
  select v_new, t.locale, t.title, t.description, t.instructions, t.completion_text, false
  from public.quiz_translations t where t.quiz_id = p_quiz;
  for s in select * from public.quiz_sections where quiz_id = p_quiz loop
    insert into public.quiz_sections (quiz_id, position) values (v_new, s.position) returning id into v_sid;
    insert into public.quiz_section_translations (section_id, locale, title)
    select v_sid, t.locale, t.title from public.quiz_section_translations t where t.section_id = s.id;
    v_sections := v_sections || jsonb_build_object(s.id::text, v_sid::text);
  end loop;
  for q in select * from public.quiz_questions where quiz_id = p_quiz order by position loop
    perform private.copy_question(q.id, v_new, q.position, (v_sections ->> q.section_id::text)::uuid);
  end loop;
  return v_new;
end $$;

-- ---------------------------------------------------------------- ordering (drag-and-drop or keyboard)
create or replace function public.admin_reorder(p_entity text, p_ids uuid[]) returns int
language plpgsql security invoker set search_path = '' as $$
declare
  v_table text;
  v_count int;
begin
  v_table := case p_entity
    when 'school' then 'schools' when 'course' then 'courses' when 'module' then 'modules' when 'topic' then 'topics'
    when 'lesson' then 'lessons' when 'block' then 'content_blocks' when 'question' then 'quiz_questions'
    when 'option' then 'quiz_options' when 'section' then 'quiz_sections' when 'quiz' then 'quizzes'
    when 'banner' then 'banners' when 'achievement' then 'achievements' end;
  if v_table is null then raise exception using errcode = 'P0001', message = 'unknown_entity'; end if;
  if p_ids is null or cardinality(p_ids) = 0 then return 0; end if;
  execute format('update public.%I t set position = s.n - 1 from unnest($1) with ordinality s(id, n) where t.id = s.id', v_table)
    using p_ids;
  get diagnostics v_count = row_count;
  if v_count <> cardinality(p_ids) then raise exception using errcode = 'P0001', message = 'forbidden'; end if;
  return v_count;
end $$;

-- ---------------------------------------------------------------- media library operations
create or replace function private.asset_usage(p_asset uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('entity', u.entity, 'id', u.id, 'live', u.live)), '[]'::jsonb)
  from (
    select distinct 'lesson' as entity, b.lesson_id as id, private.lesson_live(b.lesson_id) as live
    from public.content_blocks b where p_asset in (select private.block_asset_ids(b.props))
    union
    select 'lesson_published', l.id, private.lesson_live(l.id)
    from public.lessons l join public.content_revisions r on r.id = l.published_revision_id
    where r.snapshot::text like '%' || p_asset::text || '%'
    union
    select 'quiz_published', z.id, private.quiz_live(z.id)
    from public.quizzes z join public.content_revisions r on r.id = z.published_revision_id
    where r.snapshot::text like '%' || p_asset::text || '%'
    union select 'school', id, private.school_live(id) from public.schools where p_asset in (icon_asset_id, hero_asset_id)
    union select 'course', id, private.course_live(id) from public.courses where p_asset in (cover_asset_id, model_asset_id)
    union select 'quiz', id, private.quiz_live(id) from public.quizzes where cover_asset_id = p_asset
    union select 'question', q.id, private.quiz_live(q.quiz_id) from public.quiz_questions q where q.media_asset_id = p_asset
    union select 'option', o.id, false from public.quiz_options o where o.media_asset_id = p_asset
    union select 'inspiration', id, private.is_live_status(status, publish_at) from public.daily_inspirations where image_asset_id = p_asset
    union select 'banner', id, private.is_live_status(status, publish_at) from public.banners where image_asset_id = p_asset
    union select 'achievement', id, private.is_live_status(status, publish_at) from public.achievements where icon_asset_id = p_asset
    union select 'asset_poster', id, false from public.media_assets where poster_asset_id = p_asset
    union select 'page', p.page_id, false from public.cms_page_translations p where p.body::text like '%' || p_asset::text || '%'
  ) u;
$$;

create or replace function public.admin_asset_usage(p_asset uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  return private.asset_usage(p_asset);
end $$;

-- Safe delete: an asset in use anywhere cannot be removed (spec §5.10).
create or replace function private.guard_asset_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_usage jsonb := private.asset_usage(old.id);
begin
  if jsonb_array_length(v_usage) > 0 then perform private.fail('asset_in_use', v_usage); end if;
  return old;
end $$;
create trigger media_assets_delete_guard before delete on public.media_assets
  for each row execute function private.guard_asset_delete();

-- Replace the file behind an asset; every lesson using it gets the new file without republishing.
create or replace function public.admin_replace_asset(
  p_asset uuid, p_bucket text, p_path text, p_mime_type text, p_size_bytes bigint default null,
  p_width int default null, p_height int default null, p_duration_seconds numeric default null, p_checksum text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.media_assets%rowtype;
begin
  if not private.can_manage_media() then perform private.fail('forbidden'); end if;
  select * into a from public.media_assets where id = p_asset for update;
  if not found then perform private.fail('not_found'); end if;
  insert into public.media_asset_versions (asset_id, version, bucket, path, mime_type, size_bytes, replaced_by)
  values (a.id, a.version, a.bucket, a.path, a.mime_type, a.size_bytes, auth.uid());
  update public.media_assets set bucket = p_bucket, path = p_path, mime_type = p_mime_type, size_bytes = p_size_bytes,
    width = p_width, height = p_height, duration_seconds = p_duration_seconds, checksum = p_checksum,
    version = version + 1, updated_by = auth.uid()
  where id = p_asset;
  return private.asset_json(p_asset, 'tg');
end $$;

-- ---------------------------------------------------------------- notifications
create or replace function public.admin_schedule_notification(p_notification uuid, p_send_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n public.notifications%rowtype;
begin
  if not private.can_publish() then perform private.fail('forbidden'); end if;
  select * into n from public.notifications where id = p_notification for update;
  if not found then perform private.fail('not_found'); end if;
  if n.status in ('sent', 'cancelled') then perform private.fail('invalid_transition'); end if;
  if not exists (select 1 from public.notification_translations t where t.notification_id = n.id) then
    perform private.fail('validation_failed', '[{"code":"no_translation"}]'::jsonb);
  end if;
  update public.notifications set
    send_at = coalesce(p_send_at, now()),
    status = case when coalesce(p_send_at, now()) <= now() then 'sent' else 'scheduled' end,
    sent_at = case when coalesce(p_send_at, now()) <= now() then now() end
  where id = n.id;
  return (select to_jsonb(x) from public.notifications x where x.id = n.id);
end $$;

create or replace function public.admin_cancel_notification(p_notification uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_publish() then perform private.fail('forbidden'); end if;
  update public.notifications set status = 'cancelled' where id = p_notification and status in ('draft', 'scheduled');
  if not found then perform private.fail('invalid_transition'); end if;
end $$;

-- Flips due schedules. Content is already live by time (publish_at); this keeps statuses tidy
-- and marks scheduled notifications as sent. Called by pg_cron every minute when available.
create or replace function private.run_scheduled() returns void
language plpgsql security definer set search_path = '' as $$
declare t text;
begin
  foreach t in array array['schools', 'courses', 'modules', 'topics', 'lessons', 'quizzes', 'daily_inspirations',
                           'banners', 'cms_pages', 'achievements'] loop
    execute format('update public.%I set status = ''published'' where status = ''scheduled'' and publish_at <= now()', t);
  end loop;
  update public.notifications set status = 'sent', sent_at = now() where status = 'scheduled' and send_at <= now();
end $$;

-- ---------------------------------------------------------------- dashboard & global search
create or replace function public.admin_dashboard() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  return jsonb_build_object(
    'counts', jsonb_build_object(
      'schools', (select count(*) from public.schools), 'courses', (select count(*) from public.courses),
      'modules', (select count(*) from public.modules), 'topics', (select count(*) from public.topics),
      'lessons', (select count(*) from public.lessons), 'quizzes', (select count(*) from public.quizzes),
      'questions', (select count(*) from public.quiz_questions), 'users', (select count(*) from auth.users),
      'inspirations', (select count(*) from public.daily_inspirations)),
    'media', coalesce((select jsonb_object_agg(kind, n) from (select kind, count(*) n from public.media_assets group by kind) s), '{}'::jsonb),
    'storage_bytes', (select coalesce(sum(size_bytes), 0) from public.media_assets),
    'status', coalesce((select jsonb_object_agg(status, n) from (
        select status, count(*) n from (
          select status from public.schools union all select status from public.courses
          union all select status from public.modules union all select status from public.topics
          union all select status from public.lessons union all select status from public.quizzes) x
        group by status) s), '{}'::jsonb),
    'pending_quiz_reviews', (select count(*) from public.quiz_attempts where status = 'pending_review'),
    'recent_activity', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc)
                                 from (select * from public.workflow_events order by created_at desc limit 15) e), '[]'::jsonb));
end $$;

create or replace function public.admin_search(p_q text, p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_like text;
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  if char_length(trim(coalesce(p_q, ''))) < 2 then return '[]'::jsonb; end if;
  v_like := '%' || replace(replace(replace(trim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return coalesce((select jsonb_agg(r) from (
    select * from (
      select 'school' entity, t.school_id id, t.title, t.locale, s.status::text status
        from public.school_translations t join public.schools s on s.id = t.school_id where t.title ilike v_like
      union all select 'course', t.course_id, t.title, t.locale, c.status::text
        from public.course_translations t join public.courses c on c.id = t.course_id where t.title ilike v_like
      union all select 'module', t.module_id, t.title, t.locale, m.status::text
        from public.module_translations t join public.modules m on m.id = t.module_id where t.title ilike v_like
      union all select 'topic', t.topic_id, t.title, t.locale, x.status::text
        from public.topic_translations t join public.topics x on x.id = t.topic_id where t.title ilike v_like
      union all select 'lesson', t.lesson_id, t.title, t.locale, l.status::text
        from public.lesson_translations t join public.lessons l on l.id = t.lesson_id where t.title ilike v_like
      union all select 'quiz', t.quiz_id, t.title, t.locale, z.status::text
        from public.quiz_translations t join public.quizzes z on z.id = t.quiz_id where t.title ilike v_like
      union all select 'media', a.id, coalesce(t.title, a.path), t.locale, a.status
        from public.media_assets a left join public.media_asset_translations t on t.asset_id = a.id
        where a.path ilike v_like or t.title ilike v_like
    ) u limit least(greatest(p_limit, 1), 200)) r), '[]'::jsonb);
end $$;
