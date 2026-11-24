-- Logins, profiles and contacts. Every profile gets a login made from its name the moment it reaches the
-- server ("Малика Каримова" → malika.karimova, malika.karimova2…); she may change it. Anyone may open a profile
-- by its login: the name, the login and what she achieved. Her WhatsApp, Telegram and Instagram are shown only to
-- contacts she accepted. Safety by age: under 16 (or the age not known), a contact request comes only from
-- someone who shares a class with her (a classmate or her teacher). Anyone can be blocked and reported; the
-- staff see the reports. A profile acts by its 15-digit code (as everywhere in the app): only the phone that
-- holds it can change it.

alter table public.device_profiles
  add column if not exists links jsonb not null default '{}'::jsonb check (jsonb_typeof(links) = 'object' and pg_column_size(links) <= 2000);

-- a name as a login: Latin letters (Tajik and Russian letters transliterated), a dot between the words
create or replace function private.login_from(p_name text) returns text
language plpgsql immutable set search_path = '' as $$
declare v text := lower(coalesce(p_name, ''));
begin
  v := replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(v,
    'ш', 'sh'), 'щ', 'sh'), 'ч', 'ch'), 'ҷ', 'j'), 'ж', 'zh'), 'х', 'kh'), 'ғ', 'gh'), 'ё', 'yo'), 'ю', 'yu'), 'я', 'ya');
  v := replace(replace(v, 'ц', 'ts'), 'ӯ', 'u');
  v := translate(v, 'абвгдеэзийклмнопрстуфҳқӣыъь', 'abvgdeeziyklmnoprstufhqiy');
  v := regexp_replace(v, '[^a-z0-9]+', '.', 'g');
  v := trim(both '.' from v);
  v := left(v, 24);
  v := trim(both '.' from v);
  if char_length(v) < 3 then v := 'lifehub'; end if;
  return v;
end $$;

-- a free login from a name: the name itself, else with a number after it
create or replace function private.free_login(p_name text, p_self text default null) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_base text := private.login_from(p_name); v text := v_base; n int := 1;
begin
  while exists (select 1 from public.device_profiles where username = v and code_hash is distinct from p_self) loop
    n := n + 1;
    v := left(v_base, 28) || n::text;
  end loop;
  return v;
end $$;

create or replace function private.profile_login() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.username is null then new.username := private.free_login(new.name, new.code_hash); end if;
  return new;
end $$;
drop trigger if exists device_profiles_login on public.device_profiles;
create trigger device_profiles_login before insert or update on public.device_profiles
  for each row execute function private.profile_login();
-- the profiles already there get theirs
update public.device_profiles set username = private.free_login(name, code_hash) where username is null;

-- the classes (a teacher and her students): who may write to whom under 16
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  teacher text not null references public.device_profiles (code_hash) on delete cascade,
  join_code text not null unique check (join_code ~ '^[A-Z0-9]{6}$'),
  created_at timestamptz not null default now()
);
create table if not exists public.class_members (
  class_id uuid not null references public.classes (id) on delete cascade,
  member text not null references public.device_profiles (code_hash) on delete cascade,
  role text not null default 'student' check (role in ('student', 'teacher')),
  joined_at timestamptz not null default now(),
  primary key (class_id, member)
);
alter table public.classes enable row level security;
alter table public.class_members enable row level security;

create table if not exists public.social_contacts (
  requester text not null references public.device_profiles (code_hash) on delete cascade,
  addressee text not null references public.device_profiles (code_hash) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  primary key (requester, addressee),
  check (requester <> addressee)
);
create table if not exists public.social_blocks (
  blocker text not null references public.device_profiles (code_hash) on delete cascade,
  blocked text not null references public.device_profiles (code_hash) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);
create table if not exists public.social_reports (
  id uuid primary key default gen_random_uuid(),
  reporter text not null references public.device_profiles (code_hash) on delete cascade,
  reported text not null references public.device_profiles (code_hash) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 500),
  handled boolean not null default false,
  created_at timestamptz not null default now()
);
-- reached only through the functions below
alter table public.social_contacts enable row level security;
alter table public.social_blocks enable row level security;
alter table public.social_reports enable row level security;
create policy social_reports_staff on public.social_reports for select to authenticated using (private.is_staff());
grant select on public.social_reports to authenticated;

-- the profile of the phone that holds the code
create or replace function private.profile_by_code(p_code text) returns public.device_profiles
language plpgsql stable security definer set search_path = '' as $$
declare v public.device_profiles;
begin
  if coalesce(p_code, '') !~ '^[1-9][0-9]{14}$' then perform private.fail('unauthorized'); end if;
  select * into v from public.device_profiles where code_hash = encode(extensions.digest(p_code, 'sha256'), 'hex');
  if not found then perform private.fail('not_found'); end if;
  return v;
end $$;

-- her age from her profile (born); null when not known
create or replace function private.age_of(p public.device_profiles) returns int
language sql stable set search_path = '' as $$
  select case when (p.data->>'born') ~ '^\d{4}$' then extract(year from now())::int - (p.data->>'born')::int end
$$;
create or replace function private.is_minor(p public.device_profiles) returns boolean
language sql stable set search_path = '' as $$ select coalesce(private.age_of(p), 0) < 16 $$;

create or replace function private.share_class(a text, b text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.class_members x join public.class_members y on y.class_id = x.class_id where x.member = a and y.member = b)
      or exists (select 1 from public.classes c join public.class_members m on m.class_id = c.id where (c.teacher = a and m.member = b) or (c.teacher = b and m.member = a))
$$;

create or replace function private.contact_status(me text, other text) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select case when c.status = 'accepted' then 'contact' when c.requester = me then 'sent' else 'received' end
       from public.social_contacts c where (c.requester = me and c.addressee = other) or (c.requester = other and c.addressee = me) limit 1),
    'none')
$$;

-- whether the one with the code may send a request to the other (age, classes, blocks)
create or replace function private.may_request(me public.device_profiles, other public.device_profiles) returns boolean
language sql stable security definer set search_path = '' as $$
  select me.code_hash <> other.code_hash
     and not exists (select 1 from public.social_blocks b where (b.blocker = other.code_hash and b.blocked = me.code_hash) or (b.blocker = me.code_hash and b.blocked = other.code_hash))
     and ((not private.is_minor(other) and not private.is_minor(me)) or private.share_class(me.code_hash, other.code_hash))
$$;

-- what is cleaned from her links: a phone number for WhatsApp, a username for Telegram and Instagram
create or replace function private.clean_links(p jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare v jsonb := '{}'::jsonb; w text; t text; i text;
begin
  w := regexp_replace(coalesce(p->>'whatsapp', ''), '[^0-9+]', '', 'g');
  t := lower(regexp_replace(coalesce(p->>'telegram', ''), '^(https?://)?(t\.me/)?@?', ''));
  i := lower(regexp_replace(coalesce(p->>'instagram', ''), '^(https?://)?(www\.)?(instagram\.com/)?@?', ''));
  i := regexp_replace(i, '/.*$', '');
  if w ~ '^\+?[0-9]{7,15}$' then v := v || jsonb_build_object('whatsapp', w); end if;
  if t ~ '^[a-z0-9_]{5,32}$' then v := v || jsonb_build_object('telegram', t); end if;
  if i ~ '^[a-z0-9_.]{1,30}$' then v := v || jsonb_build_object('instagram', i); end if;
  return v;
end $$;

-- ── her own ──
create or replace function public.api_social_me(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.device_profiles := private.profile_by_code(p_code);
begin
  return jsonb_build_object('login', me.username, 'links', me.links, 'minor', private.is_minor(me),
    'requests', (select count(*) from public.social_contacts c where c.addressee = me.code_hash and c.status = 'pending'));
end $$;

create or replace function public.api_social_set_login(p_code text, p_login text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.device_profiles := private.profile_by_code(p_code); v text := lower(trim(coalesce(p_login, '')));
begin
  if v !~ '^[a-z0-9_.]{3,32}$' or v ~ '^\.|\.$|\.\.' then perform private.fail('bad_login'); end if;
  if exists (select 1 from public.device_profiles where username = v and code_hash <> me.code_hash) then perform private.fail('login_taken'); end if;
  update public.device_profiles set username = v where code_hash = me.code_hash;
  return jsonb_build_object('login', v);
end $$;

create or replace function public.api_social_set_links(p_code text, p_links jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.device_profiles := private.profile_by_code(p_code); v jsonb := private.clean_links(coalesce(p_links, '{}'::jsonb));
begin
  update public.device_profiles set links = v where code_hash = me.code_hash;
  return v;
end $$;

-- ── a profile by its login: what anyone sees; her links only to her contacts ──
create or replace function public.api_social_profile(p_login text, p_code text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.device_profiles;
  me public.device_profiles;
  v_status text := 'none';
begin
  select * into p from public.device_profiles where username = lower(trim(coalesce(p_login, '')));
  if not found then perform private.fail('not_found'); end if;
  if p_code is not null then
    me := private.profile_by_code(p_code);
    if exists (select 1 from public.social_blocks b where b.blocker = p.code_hash and b.blocked = me.code_hash) then perform private.fail('not_found'); end if;
    v_status := case when me.code_hash = p.code_hash then 'me' else private.contact_status(me.code_hash, p.code_hash) end;
  end if;
  return jsonb_build_object(
    'login', p.username,
    -- her first name and the first letter of the rest (no full name to strangers)
    'name', split_part(p.name, ' ', 1) || coalesce(' ' || nullif(left(split_part(p.name, ' ', 2), 1), '') || '.', ''),
    'since', p.created_at,
    'achievements', (select count(*) from jsonb_object_keys(coalesce(p.data->'achievements', '{}'::jsonb))),
    'lessons', (select count(*) from jsonb_object_keys(coalesce(p.data->'lessons', '{}'::jsonb))),
    -- which links she has (icons), and the links themselves only for a contact (or herself)
    'has', (select coalesce(jsonb_agg(k), '[]'::jsonb) from jsonb_object_keys(p.links) k),
    'links', case when v_status in ('contact', 'me') then p.links else null end,
    'status', v_status,
    'can_request', v_status = 'none' and p_code is not null and private.may_request(me, p)
  );
end $$;

-- logins that begin with the words (at least three letters): no search by name
create or replace function public.api_social_search(p_query text, p_code text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v text := lower(trim(coalesce(p_query, ''))); me_hash text;
begin
  if char_length(v) < 3 or v !~ '^[a-z0-9_.]+$' then return '[]'::jsonb; end if;
  if p_code is not null then me_hash := (private.profile_by_code(p_code)).code_hash; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('login', p.username, 'name', split_part(p.name, ' ', 1)) order by p.username)
    from (select * from public.device_profiles d where d.username like v || '%'
            and not exists (select 1 from public.social_blocks b where b.blocker = d.code_hash and b.blocked = me_hash)
          order by d.username limit 20) p), '[]'::jsonb);
end $$;

-- ── contacts ──
create or replace function public.api_social_request(p_code text, p_login text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.device_profiles := private.profile_by_code(p_code); p public.device_profiles;
begin
  select * into p from public.device_profiles where username = lower(trim(coalesce(p_login, '')));
  if not found then perform private.fail('not_found'); end if;
  if private.contact_status(me.code_hash, p.code_hash) <> 'none' then
    return jsonb_build_object('status', private.contact_status(me.code_hash, p.code_hash));
  end if;
  if not private.may_request(me, p) then perform private.fail('not_allowed'); end if;
  -- at most 20 requests a day from one profile
  if (select count(*) from public.social_contacts c where c.requester = me.code_hash and c.created_at > now() - interval '1 day') >= 20 then
    perform private.fail('too_many');
  end if;
  insert into public.social_contacts (requester, addressee, note) values (me.code_hash, p.code_hash, left(nullif(trim(coalesce(p_note, '')), ''), 200));
  return jsonb_build_object('status', 'sent');
end $$;

create or replace function public.api_social_requests(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.device_profiles := private.profile_by_code(p_code);
begin
  return jsonb_build_object(
    'received', coalesce((select jsonb_agg(jsonb_build_object('login', p.username, 'name', split_part(p.name, ' ', 1), 'note', c.note, 'at', c.created_at) order by c.created_at desc)
      from public.social_contacts c join public.device_profiles p on p.code_hash = c.requester where c.addressee = me.code_hash and c.status = 'pending'), '[]'::jsonb),
    'sent', coalesce((select jsonb_agg(jsonb_build_object('login', p.username, 'name', split_part(p.name, ' ', 1), 'at', c.created_at) order by c.created_at desc)
      from public.social_contacts c join public.device_profiles p on p.code_hash = c.addressee where c.requester = me.code_hash and c.status = 'pending'), '[]'::jsonb),
    'contacts', coalesce((select jsonb_agg(jsonb_build_object('login', p.username, 'name', split_part(p.name, ' ', 1), 'links', p.links) order by p.username)
      from public.social_contacts c join public.device_profiles p on p.code_hash = case when c.requester = me.code_hash then c.addressee else c.requester end
      where (c.requester = me.code_hash or c.addressee = me.code_hash) and c.status = 'accepted'), '[]'::jsonb));
end $$;

create or replace function public.api_social_answer(p_code text, p_login text, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.device_profiles := private.profile_by_code(p_code); v_from text;
begin
  select code_hash into v_from from public.device_profiles where username = lower(trim(coalesce(p_login, '')));
  if v_from is null then perform private.fail('not_found'); end if;
  if p_accept then
    update public.social_contacts set status = 'accepted', answered_at = now() where requester = v_from and addressee = me.code_hash and status = 'pending';
  else
    delete from public.social_contacts where requester = v_from and addressee = me.code_hash and status = 'pending';
  end if;
  return jsonb_build_object('status', private.contact_status(me.code_hash, v_from));
end $$;

-- a contact taken away, a request called back
create or replace function public.api_social_remove(p_code text, p_login text) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.device_profiles := private.profile_by_code(p_code); v_other text;
begin
  select code_hash into v_other from public.device_profiles where username = lower(trim(coalesce(p_login, '')));
  delete from public.social_contacts where (requester = me.code_hash and addressee = v_other) or (requester = v_other and addressee = me.code_hash);
end $$;

create or replace function public.api_social_block(p_code text, p_login text, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare me public.device_profiles := private.profile_by_code(p_code); v_other text;
begin
  select code_hash into v_other from public.device_profiles where username = lower(trim(coalesce(p_login, '')));
  if v_other is null or v_other = me.code_hash then perform private.fail('not_found'); end if;
  delete from public.social_contacts where (requester = me.code_hash and addressee = v_other) or (requester = v_other and addressee = me.code_hash);
  insert into public.social_blocks (blocker, blocked) values (me.code_hash, v_other) on conflict do nothing;
  if nullif(trim(coalesce(p_reason, '')), '') is not null then
    insert into public.social_reports (reporter, reported, reason) values (me.code_hash, v_other, left(trim(p_reason), 500));
  end if;
end $$;

-- ── classes: a teacher makes one, students join it by its code ──
create or replace function public.api_class_create(p_code text, p_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me public.device_profiles := private.profile_by_code(p_code); v public.classes; v_join text;
begin
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
  select * into v from public.classes where join_code = upper(trim(coalesce(p_join, '')));
  if not found then perform private.fail('not_found'); end if;
  insert into public.class_members (class_id, member) values (v.id, me.code_hash) on conflict do nothing;
  return jsonb_build_object('id', v.id, 'name', v.name);
end $$;

revoke all on function public.api_social_me(text), public.api_social_set_login(text, text), public.api_social_set_links(text, jsonb),
  public.api_social_profile(text, text), public.api_social_search(text, text), public.api_social_request(text, text, text),
  public.api_social_requests(text), public.api_social_answer(text, text, boolean), public.api_social_remove(text, text),
  public.api_social_block(text, text, text), public.api_class_create(text, text), public.api_class_join(text, text) from public;
grant execute on function public.api_social_me(text), public.api_social_set_login(text, text), public.api_social_set_links(text, jsonb),
  public.api_social_profile(text, text), public.api_social_search(text, text), public.api_social_request(text, text, text),
  public.api_social_requests(text), public.api_social_answer(text, text, boolean), public.api_social_remove(text, text),
  public.api_social_block(text, text, text), public.api_class_create(text, text), public.api_class_join(text, text) to anon, authenticated;
