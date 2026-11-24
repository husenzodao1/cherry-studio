-- What Mahliyo found and said once, kept to be given again at once: her answers to general questions (the
-- same for everyone: "Фотосинтез чист?") for 30 days, the internet's results for a question for a week.
-- Only the server reads and writes it; nothing personal is kept (the server decides what may be).

create table private.ai_cache (
  kind text not null check (kind in ('answer', 'web')),
  key text not null check (char_length(key) between 1 and 300),
  value jsonb not null,
  hits integer not null default 0,
  at timestamptz not null default now(),
  primary key (kind, key)
);
create index ai_cache_at on private.ai_cache (at);

create or replace function public.api_cache_get(p_proof text, p_kind text, p_key text, p_days integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  if not private.server_ok(p_proof) then perform private.fail('forbidden'); end if;
  update private.ai_cache c set hits = c.hits + 1
    where c.kind = p_kind and c.key = p_key and c.at > now() - make_interval(days => greatest(1, least(p_days, 90)))
    returning c.value into v;
  return v;
end $$;

create or replace function public.api_cache_put(p_proof text, p_kind text, p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.server_ok(p_proof) then perform private.fail('forbidden'); end if;
  if pg_column_size(p_value) > 200000 then perform private.fail('too_big'); end if;
  insert into private.ai_cache (kind, key, value) values (p_kind, p_key, p_value)
    on conflict (kind, key) do update set value = excluded.value, at = now();
  delete from private.ai_cache where at < now() - interval '90 days';
end $$;

revoke all on function public.api_cache_get(text, text, text, integer), public.api_cache_put(text, text, text, jsonb) from public;
grant execute on function public.api_cache_get(text, text, text, integer), public.api_cache_put(text, text, text, jsonb) to anon, authenticated;
