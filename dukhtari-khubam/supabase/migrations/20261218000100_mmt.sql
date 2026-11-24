-- ММТ (Маркази миллии тестӣ): what the staff teach the app for the national entrance tests, and what learners use.
--   * the books get shelves: general, ММТ, law (the lawyer mode), grants — each mode searches its own shelf first;
--   * subjects (each in one or more of the five clusters, with the points it carries);
--   * the test bank: questions with four (2–6) options, one right, a topic, a difficulty (1 easy … 3 hard);
--   * programmes: university, specialty, cluster, year, form (budget / contract) and last year's passing score.
-- Learners read the subjects and the programmes; the questions (with their answers) go out only through the app's
-- server, which counts a mock exam against her plan.

-- ── the books' shelves ──
alter table private.mahliyo_books add column if not exists shelf text not null default 'general'
  check (shelf in ('general', 'mmt', 'law', 'grants'));

create or replace function public.admin_books() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'title', b.title, 'file', b.file_name, 'pages', b.pages,
      'chunks', b.chunks, 'status', b.status, 'shelf', b.shelf, 'at', b.created_at) order by b.created_at desc)
    from private.mahliyo_books b where b.removed_at is null), '[]'::jsonb);
end $$;

drop function if exists public.admin_book_start(text, text, integer);
create or replace function public.admin_book_start(p_title text, p_file text, p_pages integer, p_shelf text default 'general') returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  insert into private.mahliyo_books (title, file_name, pages, shelf)
  values (left(trim(p_title), 300), left(p_file, 300), p_pages, coalesce(p_shelf, 'general')) returning id into v_id;
  return v_id;
end $$;

create or replace function public.admin_book_shelf(p_book uuid, p_shelf text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  update private.mahliyo_books set shelf = p_shelf where id = p_book;
end $$;

-- the passages nearest a question; the mode's own shelf first (ММТ books for the ММТ mode, the laws for the lawyer)
drop function if exists public.api_books_search(text, text, integer);
create or replace function public.api_books_search(p_proof text, p_query text, p_limit integer default 4, p_shelf text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_q tsquery;
begin
  if not private.server_ok(p_proof) then perform private.fail('forbidden'); end if;
  begin
    v_q := to_tsquery('simple', p_query);
  exception when others then
    return '[]'::jsonb;
  end;
  return coalesce((
    select jsonb_agg(jsonb_build_object('book', r.title, 'page', r.page, 'text', r.text) order by r.score desc)
      from (select b.title, c.page, c.text, ts_rank_cd(c.tsv, v_q) * case when b.shelf = p_shelf then 3 else 1 end as score
              from private.mahliyo_book_chunks c join private.mahliyo_books b on b.id = c.book_id
             where c.tsv @@ v_q and b.removed_at is null and b.status = 'ready'
             order by score desc limit least(greatest(p_limit, 1), 8)) r), '[]'::jsonb);
end $$;

-- ── subjects, the test bank, programmes ──
create table if not exists public.mmt_subjects (
  id text primary key check (id ~ '^[a-z0-9_]{2,40}$'),
  name text not null check (char_length(name) between 1 and 80),
  clusters smallint[] not null default '{}' check (clusters <@ array[1, 2, 3, 4, 5]::smallint[]),
  max_points smallint not null default 100 check (max_points between 1 and 1000),
  position smallint not null default 0
);

create table if not exists public.mmt_questions (
  id uuid primary key default gen_random_uuid(),
  subject text not null references public.mmt_subjects (id) on delete cascade,
  topic text check (char_length(topic) <= 120),
  difficulty smallint not null default 2 check (difficulty between 1 and 3),
  question text not null check (char_length(question) between 3 and 2000),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6),
  answer smallint not null check (answer >= 0),
  explanation text check (char_length(explanation) <= 2000),
  source text check (char_length(source) <= 200),
  created_at timestamptz not null default now(),
  check (answer < jsonb_array_length(options))
);
create index if not exists mmt_questions_subject_idx on public.mmt_questions (subject, difficulty);

create table if not exists public.mmt_programs (
  id uuid primary key default gen_random_uuid(),
  university text not null check (char_length(university) between 1 and 200),
  specialty text not null check (char_length(specialty) between 1 and 200),
  code text check (char_length(code) <= 40),
  cluster smallint not null check (cluster between 1 and 5),
  year smallint not null check (year between 2000 and 2100),
  form text not null default 'budget' check (form in ('budget', 'contract', 'quota')),
  min_score numeric(7, 2) not null check (min_score >= 0),
  places integer check (places >= 0),
  city text check (char_length(city) <= 80)
);
create index if not exists mmt_programs_cluster_idx on public.mmt_programs (cluster, year desc);

-- read through the functions below only
alter table public.mmt_subjects enable row level security;
alter table public.mmt_questions enable row level security;
alter table public.mmt_programs enable row level security;

insert into public.app_settings (key, value) values ('mmt_exam_date', 'null'::jsonb) on conflict (key) do nothing;

-- ── for everyone: the subjects (how many questions each has) and the exam's day ──
create or replace function public.api_mmt_catalog() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'exam_date', (select value from public.app_settings where key = 'mmt_exam_date'),
    'subjects', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'clusters', to_jsonb(s.clusters), 'max_points', s.max_points,
        'questions', (select count(*) from public.mmt_questions q where q.subject = s.id)) order by s.position, s.name)
      from public.mmt_subjects s), '[]'::jsonb));
$$;

-- the programmes of a cluster, as of their latest year
create or replace function public.api_mmt_programs(p_cluster int) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'university', p.university, 'specialty', p.specialty, 'code', p.code,
      'year', p.year, 'form', p.form, 'min_score', p.min_score, 'places', p.places, 'city', p.city) order by p.min_score desc), '[]'::jsonb)
  from (select distinct on (university, specialty, form) * from public.mmt_programs
         where cluster = p_cluster order by university, specialty, form, year desc) p;
$$;

-- for the app's server: a mock exam's questions (with answers) — of each subject, up to p_per of each difficulty
create or replace function public.api_mmt_draw(p_proof text, p_subjects text[], p_per int) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not private.server_ok(p_proof) then perform private.fail('forbidden'); end if;
  if coalesce(array_length(p_subjects, 1), 0) not between 1 and 8 or p_per not between 1 and 40 then perform private.fail('validation_failed'); end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', q.id, 'subject', q.subject, 'topic', q.topic, 'difficulty', q.difficulty, 'question', q.question,
        'options', q.options, 'answer', q.answer, 'explanation', q.explanation, 'source', q.source))
      from (select *, row_number() over (partition by subject, difficulty order by random()) as n
              from public.mmt_questions where subject = any (p_subjects)) q
     where q.n <= p_per), '[]'::jsonb);
end $$;

-- ── the staff ──
create or replace function public.admin_mmt_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  return jsonb_build_object(
    'catalog', public.api_mmt_catalog(),
    'by_difficulty', coalesce((select jsonb_object_agg(subject || ':' || difficulty, n)
       from (select subject, difficulty, count(*) as n from public.mmt_questions group by 1, 2) x), '{}'::jsonb),
    'programs', (select count(*) from public.mmt_programs),
    'years', coalesce((select jsonb_agg(distinct year order by year desc) from public.mmt_programs), '[]'::jsonb));
end $$;

create or replace function public.admin_mmt_subject_save(p_id text, p_name text, p_clusters smallint[], p_max_points int, p_position int default 0) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  insert into public.mmt_subjects (id, name, clusters, max_points, position) values (p_id, trim(p_name), coalesce(p_clusters, '{}'), p_max_points, coalesce(p_position, 0))
  on conflict (id) do update set name = excluded.name, clusters = excluded.clusters, max_points = excluded.max_points, position = excluded.position;
end $$;

create or replace function public.admin_mmt_subject_remove(p_id text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  delete from public.mmt_subjects where id = p_id;
end $$;

-- questions of one subject: [{ question, options: [...], answer: 0.., explanation?, topic?, difficulty?, source? }]
create or replace function public.admin_mmt_questions_import(p_subject text, p_list jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  if jsonb_typeof(p_list) <> 'array' or jsonb_array_length(p_list) > 2000 then perform private.fail('validation_failed'); end if;
  if not exists (select 1 from public.mmt_subjects where id = p_subject) then perform private.fail('not_found'); end if;
  insert into public.mmt_questions (subject, topic, difficulty, question, options, answer, explanation, source)
  select p_subject, nullif(left(trim(q ->> 'topic'), 120), ''), coalesce((q ->> 'difficulty')::smallint, 2), trim(q ->> 'question'),
         q -> 'options', (q ->> 'answer')::smallint, nullif(left(trim(q ->> 'explanation'), 2000), ''), nullif(left(trim(q ->> 'source'), 200), '')
    from jsonb_array_elements(p_list) q
   -- the same question in the same subject is not taken twice
   where not exists (select 1 from public.mmt_questions x where x.subject = p_subject and x.question = trim(q ->> 'question'));
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function public.admin_mmt_questions(p_subject text, p_limit int default 50, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  return coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at desc)
    from (select * from public.mmt_questions where subject = p_subject order by created_at desc limit least(p_limit, 200) offset p_offset) q), '[]'::jsonb);
end $$;

create or replace function public.admin_mmt_question_remove(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  delete from public.mmt_questions where id = p_id;
end $$;

-- programmes: [{ university, specialty, code?, cluster, year, form?, min_score, places?, city? }]; a year given anew replaces that year
create or replace function public.admin_mmt_programs_import(p_list jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  if jsonb_typeof(p_list) <> 'array' or jsonb_array_length(p_list) > 5000 then perform private.fail('validation_failed'); end if;
  delete from public.mmt_programs where year in (select distinct (p ->> 'year')::smallint from jsonb_array_elements(p_list) p);
  insert into public.mmt_programs (university, specialty, code, cluster, year, form, min_score, places, city)
  select trim(p ->> 'university'), trim(p ->> 'specialty'), nullif(trim(p ->> 'code'), ''), (p ->> 'cluster')::smallint, (p ->> 'year')::smallint,
         coalesce(nullif(p ->> 'form', ''), 'budget'), (p ->> 'min_score')::numeric, nullif(p ->> 'places', '')::int, nullif(trim(p ->> 'city'), '')
    from jsonb_array_elements(p_list) p;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function public.admin_mmt_programs(p_query text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  return coalesce((select jsonb_agg(to_jsonb(p) order by p.year desc, p.cluster, p.university, p.specialty)
    from (select * from public.mmt_programs
           where p_query is null or university ilike '%' || p_query || '%' or specialty ilike '%' || p_query || '%'
           order by year desc, cluster, university, specialty limit 300) p), '[]'::jsonb);
end $$;

create or replace function public.admin_mmt_program_remove(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  delete from public.mmt_programs where id = p_id;
end $$;

revoke all on function public.api_mmt_catalog(), public.api_mmt_programs(int), public.api_mmt_draw(text, text[], int) from public;
grant execute on function public.api_mmt_catalog(), public.api_mmt_programs(int), public.api_mmt_draw(text, text[], int) to anon, authenticated;
revoke all on function public.admin_mmt_overview(), public.admin_mmt_subject_save(text, text, smallint[], int, int), public.admin_mmt_subject_remove(text),
  public.admin_mmt_questions_import(text, jsonb), public.admin_mmt_questions(text, int, int), public.admin_mmt_question_remove(uuid),
  public.admin_mmt_programs_import(jsonb), public.admin_mmt_programs(text), public.admin_mmt_program_remove(uuid), public.admin_book_shelf(uuid, text) from public;
grant execute on function public.admin_mmt_overview(), public.admin_mmt_subject_save(text, text, smallint[], int, int), public.admin_mmt_subject_remove(text),
  public.admin_mmt_questions_import(text, jsonb), public.admin_mmt_questions(text, int, int), public.admin_mmt_question_remove(uuid),
  public.admin_mmt_programs_import(jsonb), public.admin_mmt_programs(text), public.admin_mmt_program_remove(uuid), public.admin_book_shelf(uuid, text) to authenticated;
