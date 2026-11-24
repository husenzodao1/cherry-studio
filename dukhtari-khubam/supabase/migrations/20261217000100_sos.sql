-- SOS and "walk me home". She keeps up to three trusted people (a mother, a father…) with their WhatsApp
-- numbers. An alert (SOS, a walk home, or "I arrived") is opened by the phone that holds her code; the app's
-- server then writes to her people from the owner's WhatsApp number with a link to a live map. The map
-- (api_sos_where) is opened by its secret token only, shows her first name and her last place, and closes when
-- she says she is safe or after a few hours. Safety is free: no plan or trial is counted here.

create table if not exists public.sos_guardians (
  profile text not null references public.device_profiles (code_hash) on delete cascade,
  position smallint not null check (position between 1 and 3),
  name text not null check (char_length(name) between 1 and 40),
  phone text not null check (phone ~ '^[1-9][0-9]{8,14}$'),
  primary key (profile, position)
);

create table if not exists public.sos_alerts (
  id uuid primary key default gen_random_uuid(),
  token text not null unique check (token ~ '^[0-9a-f]{24}$'),
  profile text not null references public.device_profiles (code_hash) on delete cascade,
  kind text not null check (kind in ('sos', 'walk')),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  accuracy real check (accuracy >= 0),
  battery smallint check (battery between 0 and 100),
  -- a walk home: when she should be there (the phone raises an SOS if she does not say she arrived)
  due_at timestamptz,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- the map closes by itself then
  ends_at timestamptz not null,
  stopped_at timestamptz,
  safe boolean
);
create index if not exists sos_alerts_profile_idx on public.sos_alerts (profile, started_at desc);
-- reachable only through the functions below
alter table public.sos_guardians enable row level security;
alter table public.sos_alerts enable row level security;

create or replace function public.api_sos_guardians(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me public.device_profiles := private.profile_by_code(p_code);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('name', g.name, 'phone', g.phone) order by g.position)
                     from public.sos_guardians g where g.profile = me.code_hash), '[]'::jsonb);
end $$;

-- replaces her people (at most three); numbers as digits with the country code
create or replace function public.api_sos_set_guardians(p_code text, p_list jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me public.device_profiles := private.profile_by_code(p_code);
  g jsonb;
  n int := 0;
  v_phone text;
  v_name text;
begin
  if jsonb_typeof(p_list) <> 'array' or jsonb_array_length(p_list) > 3 then perform private.fail('validation_failed'); end if;
  delete from public.sos_guardians where profile = me.code_hash;
  for g in select * from jsonb_array_elements(p_list) loop
    v_name := trim(coalesce(g->>'name', ''));
    v_phone := regexp_replace(coalesce(g->>'phone', ''), '[\s()+.-]', '', 'g');
    if char_length(v_name) not between 1 and 40 or v_phone !~ '^[1-9][0-9]{8,14}$' then perform private.fail('bad_phone'); end if;
    n := n + 1;
    insert into public.sos_guardians (profile, position, name, phone) values (me.code_hash, n, v_name, v_phone);
  end loop;
  return public.api_sos_guardians(p_code);
end $$;

-- An alert: SOS (the map open 6 hours) or a walk home (open until she arrives, at most 4 hours). The same kind
-- opened again while one is open goes on with it. At most 8 a day, so the owner's number is never used to spam.
create or replace function public.api_sos_start(p_code text, p_kind text, p_lat double precision, p_lng double precision,
  p_accuracy real default null, p_minutes int default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me public.device_profiles := private.profile_by_code(p_code);
  v public.sos_alerts;
  v_new boolean := false;
begin
  if p_kind not in ('sos', 'walk') or (p_kind = 'walk' and coalesce(p_minutes, 0) not between 5 and 180) then perform private.fail('validation_failed'); end if;
  if (p_lat is null) <> (p_lng is null) or p_lat not between -90 and 90 or p_lng not between -180 and 180 then perform private.fail('validation_failed'); end if;
  select * into v from public.sos_alerts
   where profile = me.code_hash and stopped_at is null and ends_at > now() and kind = p_kind
   order by started_at desc limit 1;
  if not found then
    if (select count(*) from public.sos_alerts where profile = me.code_hash and started_at > now() - interval '1 day') >= 8 then
      perform private.fail('rate_limited');
    end if;
    insert into public.sos_alerts (token, profile, kind, lat, lng, accuracy, due_at, ends_at)
    values (encode(extensions.gen_random_bytes(12), 'hex'), me.code_hash, p_kind, p_lat, p_lng, p_accuracy,
            case when p_kind = 'walk' then now() + make_interval(mins => p_minutes) end,
            now() + case when p_kind = 'sos' then interval '6 hours' else interval '4 hours' end)
    returning * into v;
    v_new := true;
  else
    update public.sos_alerts set lat = coalesce(p_lat, lat), lng = coalesce(p_lng, lng), accuracy = coalesce(p_accuracy, accuracy), updated_at = now()
     where id = v.id returning * into v;
  end if;
  return jsonb_build_object('token', v.token, 'kind', v.kind, 'new', v_new, 'name', split_part(trim(me.name), ' ', 1),
    'due_at', v.due_at, 'ends_at', v.ends_at, 'guardians', public.api_sos_guardians(p_code));
end $$;

-- her place while the alert is open (every half minute or so)
create or replace function public.api_sos_update(p_code text, p_token text, p_lat double precision, p_lng double precision,
  p_accuracy real default null, p_battery int default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.device_profiles := private.profile_by_code(p_code);
begin
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then perform private.fail('validation_failed'); end if;
  update public.sos_alerts set lat = p_lat, lng = p_lng, accuracy = p_accuracy,
         battery = case when p_battery between 0 and 100 then p_battery else battery end, updated_at = now()
   where token = p_token and profile = me.code_hash and stopped_at is null and ends_at > now();
  return jsonb_build_object('open', found);
end $$;

-- "I am safe" / "I arrived": the map closes; her people and her place are given back for the last message
create or replace function public.api_sos_stop(p_code text, p_token text, p_safe boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.device_profiles := private.profile_by_code(p_code); v public.sos_alerts;
begin
  update public.sos_alerts set stopped_at = now(), safe = coalesce(p_safe, true)
   where token = p_token and profile = me.code_hash and stopped_at is null
   returning * into v;
  if not found then return jsonb_build_object('stopped', false); end if;
  return jsonb_build_object('stopped', true, 'kind', v.kind, 'name', split_part(trim(me.name), ' ', 1),
    'lat', v.lat, 'lng', v.lng, 'guardians', public.api_sos_guardians(p_code));
end $$;

-- the live map her people open (by its token only): her first name and her last place, while it is open
create or replace function public.api_sos_where(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name', split_part(trim(p.name), ' ', 1), 'kind', a.kind,
    'open', a.stopped_at is null and a.ends_at > now(), 'safe', a.safe,
    'lat', case when a.stopped_at is null and a.ends_at > now() then a.lat end,
    'lng', case when a.stopped_at is null and a.ends_at > now() then a.lng end,
    'accuracy', a.accuracy, 'battery', a.battery, 'due_at', a.due_at, 'started_at', a.started_at, 'updated_at', a.updated_at)
  from public.sos_alerts a join public.device_profiles p on p.code_hash = a.profile
  where a.token = p_token and coalesce(p_token, '') ~ '^[0-9a-f]{24}$' and a.started_at > now() - interval '1 day';
$$;

-- the panel: may this staff member link the owner's WhatsApp number
create or replace function public.admin_is_super() returns boolean
language sql stable security definer set search_path = '' as $$ select private.is_super_admin(); $$;

revoke all on function public.api_sos_guardians(text), public.api_sos_set_guardians(text, jsonb),
  public.api_sos_start(text, text, double precision, double precision, real, int),
  public.api_sos_update(text, text, double precision, double precision, real, int), public.api_sos_stop(text, text, boolean),
  public.api_sos_where(text), public.admin_is_super() from public;
grant execute on function public.api_sos_guardians(text), public.api_sos_set_guardians(text, jsonb),
  public.api_sos_start(text, text, double precision, double precision, real, int),
  public.api_sos_update(text, text, double precision, double precision, real, int), public.api_sos_stop(text, text, boolean),
  public.api_sos_where(text) to anon, authenticated;
grant execute on function public.admin_is_super() to authenticated;

-- ── classes (the teacher feature) are off unless the panel turns them on ──
-- Off: under 16, requests go only between those under 16 (never from an adult). On: under 16, only between
-- those who share a class (classmates and their teacher), and classes can be made and joined.
insert into public.app_settings (key, value) values ('classes_enabled', 'false'::jsonb) on conflict (key) do nothing;

create or replace function private.classes_on() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select value = 'true'::jsonb from public.app_settings where key = 'classes_enabled'), false)
$$;

create or replace function private.may_request(me public.device_profiles, other public.device_profiles) returns boolean
language sql stable security definer set search_path = '' as $$
  select me.code_hash <> other.code_hash
     and not exists (select 1 from public.social_blocks b where (b.blocker = other.code_hash and b.blocked = me.code_hash) or (b.blocker = me.code_hash and b.blocked = other.code_hash))
     and ((not private.is_minor(other) and not private.is_minor(me))
          or (private.classes_on() and private.share_class(me.code_hash, other.code_hash))
          or (not private.classes_on() and private.is_minor(other) and private.is_minor(me)))
$$;

create or replace function public.api_social_me(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me public.device_profiles := private.profile_by_code(p_code);
begin
  return jsonb_build_object('login', me.username, 'links', me.links, 'minor', private.is_minor(me), 'classes', private.classes_on(),
    'requests', (select count(*) from public.social_contacts c where c.addressee = me.code_hash and c.status = 'pending'));
end $$;

create or replace function public.api_class_create(p_code text, p_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.device_profiles := private.profile_by_code(p_code); v public.classes; v_join text;
begin
  if not private.classes_on() then perform private.fail('not_allowed'); end if;
  if (select count(*) from public.classes where teacher = me.code_hash) >= 20 then perform private.fail('too_many'); end if;
  loop
    v_join := upper(substr(translate(encode(extensions.gen_random_bytes(6), 'base64'), '+/=0OI1L', 'ABCDEFGH'), 1, 6));
    exit when v_join ~ '^[A-Z0-9]{6}$' and not exists (select 1 from public.classes where join_code = v_join);
  end loop;
  insert into public.classes (name, teacher, join_code) values (left(trim(p_name), 80), me.code_hash, v_join) returning * into v;
  insert into public.class_members (class_id, member, role) values (v.id, me.code_hash, 'teacher');
  return jsonb_build_object('id', v.id, 'name', v.name, 'join_code', v.join_code);
end $$;

create or replace function public.api_class_join(p_code text, p_join text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.device_profiles := private.profile_by_code(p_code); v public.classes;
begin
  if not private.classes_on() then perform private.fail('not_allowed'); end if;
  select * into v from public.classes where join_code = upper(trim(coalesce(p_join, '')));
  if not found then perform private.fail('not_found'); end if;
  insert into public.class_members (class_id, member) values (v.id, me.code_hash) on conflict do nothing;
  return jsonb_build_object('id', v.id, 'name', v.name);
end $$;

-- Every profile now holds a login made from its name: when she sets a password login, the login made for her
-- is hers to take (the phone sends its code's hash), only someone else's counts as taken.
drop function if exists public.api_profile_username_free(text);
create or replace function public.api_profile_username_free(p_username text, p_code_hash text default null) returns boolean
language sql stable security definer set search_path = '' as $$
  select lower(trim(coalesce(p_username, ''))) ~ '^[a-z0-9_.]{3,32}$'
     and not exists (select 1 from public.device_profiles where username = lower(trim(p_username)) and code_hash is distinct from p_code_hash);
$$;
grant execute on function public.api_profile_username_free(text, text) to anon, authenticated;
