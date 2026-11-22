-- Духтари хубам · 0030 Mahliyo AI: the learner marks her answer 👍 or 👎 (and may change her mind);
-- the staff see it beside the question. Add-only: a column and a function; the staff's list shows it.

alter table public.mahliyo_questions
  add column rating smallint check (rating is null or rating in (-1, 1));

-- 1 (👍), -1 (👎) or null (taken back), only by the phone that asked
create or replace function public.api_mahliyo_rate(p_id uuid, p_token_hash text, p_rating smallint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_rating is not null and p_rating not in (-1, 1) then perform private.fail('bad_rating'); end if;
  update public.mahliyo_questions set rating = p_rating
   where id = p_id and token_hash = p_token_hash and answered_at is not null;
end $$;

create or replace function public.admin_mahliyo_questions() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', q.id, 'name', q.name, 'question', q.question, 'answer', q.answer,
      'tajik', q.tajik, 'rating', q.rating, 'at', q.created_at) order by q.created_at desc)
    from (select * from public.mahliyo_questions order by created_at desc limit 300) q), '[]'::jsonb);
end $$;
