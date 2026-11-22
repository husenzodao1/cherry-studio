-- Духтари хубам · 0028 Mahliyo AI: every question learners ask her in the app, and her answer, kept for
-- the staff (panel → "Маҳлиё AI"). A question is recorded before she answers (at most 30 an hour from one
-- phone, 3000 a day in all, so the AI's cost stays bounded); her answer is added to it.

create table public.mahliyo_questions (
  id uuid primary key default gen_random_uuid(),
  -- the phone (sha256 of its support token) and the learner (sha256 of her code), when known
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  code_hash text check (code_hash ~ '^[0-9a-f]{64}$'),
  name text check (char_length(name) <= 80),
  question text not null check (char_length(question) between 1 and 1000),
  answer text check (char_length(answer) <= 4000),
  -- false: she was written to in another language and pointed to the consultant
  tajik boolean,
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
create index mahliyo_questions_recent_idx on public.mahliyo_questions (created_at desc);
create index mahliyo_questions_phone_idx on public.mahliyo_questions (token_hash, created_at desc);
-- No policies: reachable only through the functions below.
alter table public.mahliyo_questions enable row level security;
revoke all on public.mahliyo_questions from anon, authenticated;

create or replace function public.api_mahliyo_ask(p_token_hash text, p_code_hash text, p_name text, p_question text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_q text := trim(coalesce(p_question, ''));
  v_id uuid;
begin
  if coalesce(p_token_hash, '') !~ '^[0-9a-f]{64}$' or char_length(v_q) not between 1 and 1000
     or (p_code_hash is not null and p_code_hash !~ '^[0-9a-f]{64}$') then
    perform private.fail('validation_failed');
  end if;
  if (select count(*) from public.mahliyo_questions where token_hash = p_token_hash and created_at > now() - interval '1 hour') >= 30
     or (select count(*) from public.mahliyo_questions where created_at > now() - interval '1 day') >= 3000 then
    perform private.fail('rate_limited');
  end if;
  insert into public.mahliyo_questions (token_hash, code_hash, name, question)
  values (p_token_hash, p_code_hash, nullif(left(trim(coalesce(p_name, '')), 80), ''), v_q)
  returning id into v_id;
  return v_id;
end $$;

-- Her answer, once, and only soon after the question.
create or replace function public.api_mahliyo_answer(p_id uuid, p_answer text, p_tajik boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.mahliyo_questions
     set answer = left(coalesce(p_answer, ''), 4000), tajik = p_tajik, answered_at = now()
   where id = p_id and answered_at is null and created_at > now() - interval '10 minutes';
end $$;

create or replace function public.admin_mahliyo_questions() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', q.id, 'name', q.name, 'question', q.question, 'answer', q.answer,
      'tajik', q.tajik, 'at', q.created_at) order by q.created_at desc)
    from (select * from public.mahliyo_questions order by created_at desc limit 300) q), '[]'::jsonb);
end $$;
