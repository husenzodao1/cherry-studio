-- Духтари хубам · 0034 Content in every interface language: the catalogue (schools, courses, lessons,
-- tests, the words of the day) is written in Tajik and Russian; for English, Uzbek, Turkish, Persian and
-- Dari (and Russian where a text was left in Tajik) the server translates it with the AI, once per text,
-- and keeps the translation here — a new lesson is translated as soon as it is published. Only the
-- server reads and writes (its proof, as in 0031). Add-only.

create table private.content_mt (
  hash text not null check (char_length(hash) between 8 and 64),
  locale text not null check (locale in ('ru', 'en', 'uz', 'tr', 'fa', 'prs')),
  text text not null check (char_length(text) <= 20000),
  created_at timestamptz not null default now(),
  primary key (hash, locale)
);
alter table private.content_mt alter column text set compression lz4;
revoke all on private.content_mt from public, anon, authenticated;

create or replace function public.api_mt_get(p_proof text, p_locale text, p_hashes text[]) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.server_ok(p_proof) then perform private.fail('forbidden'); end if;
  return coalesce((select jsonb_object_agg(m.hash, m.text) from private.content_mt m
                    where m.locale = p_locale and m.hash = any (p_hashes)), '{}'::jsonb);
end $$;

create or replace function public.api_mt_put(p_proof text, p_locale text, p_items jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if not private.server_ok(p_proof) then perform private.fail('forbidden'); end if;
  insert into private.content_mt (hash, locale, text)
    select i ->> 'h', p_locale, left(i ->> 't', 20000) from jsonb_array_elements(p_items) i
     where coalesce(i ->> 'h', '') <> '' and coalesce(trim(i ->> 't'), '') <> ''
    on conflict (hash, locale) do update set text = excluded.text, created_at = now();
  get diagnostics v_count = row_count;
  return v_count;
end $$;
