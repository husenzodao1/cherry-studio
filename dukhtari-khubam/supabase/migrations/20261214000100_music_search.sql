-- Songs found on YouTube, kept for a week for everyone: a search costs a hundredth of the day's YouTube quota,
-- so a song asked for again (by anyone) is not searched again. Only the server reads and writes it.

create table private.music_searches (
  q text primary key check (char_length(q) between 1 and 200),
  items jsonb not null,
  at timestamptz not null default now()
);

create or replace function public.api_music_cached(p_proof text, p_q text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.server_ok(p_proof) then perform private.fail('forbidden'); end if;
  return (select m.items from private.music_searches m where m.q = lower(trim(p_q)) and m.at > now() - interval '7 days');
end $$;

create or replace function public.api_music_keep(p_proof text, p_q text, p_items jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.server_ok(p_proof) then perform private.fail('forbidden'); end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 10 then perform private.fail('bad_items'); end if;
  insert into private.music_searches (q, items) values (lower(trim(p_q)), p_items)
    on conflict (q) do update set items = excluded.items, at = now();
  -- old searches go
  delete from private.music_searches where at < now() - interval '30 days';
end $$;

revoke all on function public.api_music_cached(text, text), public.api_music_keep(text, text, jsonb) from public;
grant execute on function public.api_music_cached(text, text), public.api_music_keep(text, text, jsonb) to anon, authenticated;
