-- Духтари хубам · 0029 Mahliyo AI in the background: the phone sends a question and gets its id at once;
-- the server answers after (her answer, as the blocks the app draws, is kept with the question), and the
-- phone asks for it — also after the learner left her chat, or closed and opened the app again. A question
-- can be stopped (her late answer is then not kept), and one she could not answer says so.

alter table public.mahliyo_questions
  add column blocks jsonb check (blocks is null or jsonb_typeof(blocks) = 'array'),
  -- why there is no answer: 'stopped' by the learner, or the AI failed ('busy', 'limit', …)
  add column failed text check (char_length(failed) <= 40);

-- Her answer, once, and only soon after the question (not after it was stopped or failed).
drop function public.api_mahliyo_answer(uuid, text, boolean);
create function public.api_mahliyo_answer(p_id uuid, p_answer text, p_tajik boolean, p_blocks jsonb default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.mahliyo_questions
     set answer = left(coalesce(p_answer, ''), 4000), tajik = p_tajik, answered_at = now(),
         blocks = case when jsonb_typeof(p_blocks) = 'array' then p_blocks end
   where id = p_id and answered_at is null and failed is null and created_at > now() - interval '10 minutes';
end $$;

-- No answer: the AI failed (the server), or the learner stopped the question (her phone, with its token).
create or replace function public.api_mahliyo_fail(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.mahliyo_questions set failed = left(coalesce(nullif(trim(p_reason), ''), 'failed'), 40)
   where id = p_id and answered_at is null and failed is null;
end $$;

create or replace function public.api_mahliyo_stop(p_id uuid, p_token_hash text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.mahliyo_questions set failed = 'stopped'
   where id = p_id and token_hash = p_token_hash and answered_at is null and failed is null;
end $$;

-- Where her answer is, for the phone that asked: 'pending' while she thinks (at most 5 minutes), 'done'
-- with her answer, or 'failed' with why.
create or replace function public.api_mahliyo_result(p_id uuid, p_token_hash text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  q public.mahliyo_questions;
begin
  select * into q from public.mahliyo_questions where id = p_id and token_hash = p_token_hash;
  if not found then perform private.fail('not_found'); end if;
  if q.answered_at is not null then
    return jsonb_build_object('status', 'done', 'tajik', q.tajik, 'reply', q.answer, 'blocks', q.blocks);
  end if;
  if q.failed is not null or q.created_at < now() - interval '5 minutes' then
    return jsonb_build_object('status', 'failed', 'reason', coalesce(q.failed, 'timeout'));
  end if;
  return jsonb_build_object('status', 'pending');
end $$;
