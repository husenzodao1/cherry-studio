-- Духтари хубам · 0033 Smaller storage: the large text and JSON columns are compressed with LZ4 (faster
-- and usually smaller than the default pglz; new and changed values), and an answer's blocks — which
-- only the asking phone needs, once — are let go two days after the answer (its text stays for the staff).
-- Nothing is removed but those blocks.

alter table public.audit_logs alter column new_data set compression lz4, alter column old_data set compression lz4;
alter table public.content_revisions alter column snapshot set compression lz4, alter column answer_key set compression lz4;
alter table public.device_profiles alter column data set compression lz4;
alter table public.lesson_search_index alter column body set compression lz4;
alter table public.mahliyo_questions alter column answer set compression lz4, alter column blocks set compression lz4;
alter table private.mahliyo_book_chunks alter column text set compression lz4;
alter table private.mahliyo_shares alter column turns set compression lz4;

create index if not exists mahliyo_questions_blocks_kept on public.mahliyo_questions (answered_at) where blocks is not null;

-- the blocks of answers older than two days: the phone has them
create or replace function private.mahliyo_tidy() returns void
language sql security definer set search_path = '' as $$
  update public.mahliyo_questions set blocks = null where blocks is not null and answered_at < now() - interval '2 days'
$$;
select private.mahliyo_tidy();

-- a question also tidies the old answers' blocks
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
  perform private.mahliyo_tidy();
  insert into public.mahliyo_questions (token_hash, code_hash, name, question)
  values (p_token_hash, p_code_hash, nullif(left(trim(coalesce(p_name, '')), 80), ''), v_q)
  returning id into v_id;
  return v_id;
end $$;
