-- Her flashcard decks (made by the AI from a lesson, her notes, a photo, her ММТ and notebook mistakes, or by
-- hand) with each card's memory state (FSRS: stability, difficulty, the day it is due). Kept by her code, like
-- her progress, so a new phone gets them back. A deck is written whole; the newer write wins (the phone merges
-- card by card before it writes). Her lesson questions' memory states are the deck "_lessons".

create table if not exists public.study_decks (
  profile text not null references public.device_profiles (code_hash) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9_-]{1,40}$'),
  title text not null check (char_length(title) <= 120),
  source text not null default 'manual' check (char_length(source) <= 20),
  cards jsonb not null default '[]'::jsonb check (jsonb_typeof(cards) = 'array' and pg_column_size(cards) <= 262144),
  at timestamptz not null,
  deleted boolean not null default false,
  primary key (profile, id)
);
alter table public.study_decks enable row level security;

create or replace function public.api_decks(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me public.device_profiles := private.profile_by_code(p_code);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title, 'source', d.source, 'cards', d.cards, 'at', d.at, 'del', d.deleted) order by d.at)
    from public.study_decks d where d.profile = me.code_hash), '[]'::jsonb);
end $$;

-- a deck written whole, unless the server holds a newer one; at most 300 decks a profile
create or replace function public.api_deck_put(p_code text, p_id text, p_title text, p_source text, p_cards jsonb, p_at timestamptz, p_deleted boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.device_profiles := private.profile_by_code(p_code); v public.study_decks;
begin
  if p_at > now() + interval '1 day' then perform private.fail('validation_failed'); end if;
  if not exists (select 1 from public.study_decks where profile = me.code_hash and id = p_id)
     and (select count(*) from public.study_decks where profile = me.code_hash) >= 300 then
    perform private.fail('too_many');
  end if;
  insert into public.study_decks as d (profile, id, title, source, cards, at, deleted)
  values (me.code_hash, p_id, left(coalesce(p_title, ''), 120), left(coalesce(p_source, 'manual'), 20), coalesce(p_cards, '[]'::jsonb), p_at, coalesce(p_deleted, false))
  on conflict (profile, id) do update set title = excluded.title, source = excluded.source, cards = excluded.cards, at = excluded.at, deleted = excluded.deleted
    where d.at <= excluded.at
  returning * into v;
  if v.id is null then select * into v from public.study_decks where profile = me.code_hash and id = p_id; end if;
  return jsonb_build_object('id', v.id, 'at', v.at, 'kept', v.at = p_at);
end $$;

revoke all on function public.api_decks(text), public.api_deck_put(text, text, text, text, jsonb, timestamptz, boolean) from public;
grant execute on function public.api_decks(text), public.api_deck_put(text, text, text, text, jsonb, timestamptz, boolean) to anon, authenticated;
