-- Духтари хубам · 0032 Mahliyo AI: a chat shared by its learner as a link (read-only, anyone with the link).
-- The phone sends the chat's words (her questions, Mahliyo's answers as blocks); the link shows them.
-- Add-only.

create table private.mahliyo_shares (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null,
  title text not null check (char_length(title) between 1 and 200),
  turns jsonb not null check (jsonb_typeof(turns) = 'array' and pg_column_size(turns) <= 400000),
  created_at timestamptz not null default now()
);
revoke all on private.mahliyo_shares from public, anon, authenticated;

create or replace function public.api_mahliyo_share(p_token_hash text, p_title text, p_turns jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if jsonb_typeof(p_turns) <> 'array' or jsonb_array_length(p_turns) = 0 or jsonb_array_length(p_turns) > 80 then perform private.fail('bad_turns'); end if;
  -- at most 30 links a day from one phone
  if (select count(*) from private.mahliyo_shares where token_hash = p_token_hash and created_at > now() - interval '1 day') >= 30 then
    perform private.fail('too_many');
  end if;
  insert into private.mahliyo_shares (token_hash, title, turns) values (p_token_hash, left(coalesce(nullif(trim(p_title), ''), 'Маҳлиё AI'), 200), p_turns)
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.api_mahliyo_shared(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s private.mahliyo_shares;
begin
  select * into s from private.mahliyo_shares where id = p_id;
  if not found then perform private.fail('not_found'); end if;
  return jsonb_build_object('title', s.title, 'turns', s.turns, 'at', s.created_at);
end $$;
