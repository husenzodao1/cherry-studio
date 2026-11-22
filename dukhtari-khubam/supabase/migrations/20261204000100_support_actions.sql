-- Support that can help: the phone tells its conversation which account it writes for (its e-mail); the
-- consultant can change that account's e-mail, give a new PIN or turn the PIN off. Each of these is a
-- message with an `action`, which the learner's phone carries out itself when it reads it.

alter table public.support_threads add column if not exists email text check (email is null or char_length(email) <= 200);
alter table public.support_messages add column if not exists action text check (action is null or action in ('pin', 'unlock', 'email'));

create or replace function private.support_payload(p_thread uuid)
 returns jsonb language sql stable security definer set search_path to '' as $function$
  select jsonb_build_object(
    'id', t.id, 'name', t.name, 'username', t.username, 'email', t.email, 'status', t.status,
    'unread_staff', t.unread_staff, 'unread_learner', t.unread_learner, 'last_message_at', t.last_message_at,
    'rating', t.rating, 'rating_note', t.rating_note,
    'needs_rating', t.status = 'closed' and (t.rated_at is null or t.rated_at < t.closed_at)
      and exists (select 1 from public.support_messages m where m.thread_id = t.id and m.from_staff and m.kind = 'text'),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'from_staff', m.from_staff, 'kind', m.kind, 'action', m.action, 'body', m.body, 'at', m.created_at) order by m.created_at)
      from (select * from public.support_messages where thread_id = t.id order by created_at desc limit 200) m), '[]'::jsonb))
  from public.support_threads t where t.id = p_thread;
$function$;

-- the phone's account e-mail, kept on its conversation (the consultant sees whom she helps)
create or replace function public.api_support_email(p_token_hash text, p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 200 then return; end if;
  update public.support_threads set email = v_email where token_hash = p_token_hash;
end $$;
grant execute on function public.api_support_email(text, text) to anon, authenticated;

-- the consultant's help: a new PIN (four digits), the PIN turned off, or the account's e-mail changed
create or replace function public.admin_support_action(p_thread uuid, p_action text, p_value text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_t public.support_threads;
  v_body text;
  v_new text := lower(trim(coalesce(p_value, '')));
  v_user uuid;
begin
  if not private.is_staff() then perform private.fail('forbidden'); end if;
  select * into v_t from public.support_threads where id = p_thread;
  if v_t.id is null then perform private.fail('not_found'); end if;
  if p_action = 'pin' then
    v_body := lpad(floor(random() * 10000)::int::text, 4, '0');
  elsif p_action = 'unlock' then
    v_body := 'unlock';
  elsif p_action = 'email' then
    if v_new !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_new) > 200 then perform private.fail('validation_failed'); end if;
    if exists (select 1 from auth.users where lower(email) = v_new) then perform private.fail('taken'); end if;
    -- her account (the e-mail her phone told), if she has one: its address changes, already confirmed
    if v_t.email is not null then
      select id into v_user from auth.users where lower(email) = v_t.email limit 1;
      if v_user is not null then
        update auth.users set email = v_new, email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = v_user;
        update auth.identities set identity_data = identity_data || jsonb_build_object('email', v_new), updated_at = now()
          where user_id = v_user and provider = 'email';
      end if;
    end if;
    update public.support_threads set email = v_new where id = p_thread;
    v_body := v_new;
  else
    perform private.fail('validation_failed');
  end if;
  insert into public.support_messages (thread_id, from_staff, staff_id, kind, action, body)
  values (p_thread, true, (select auth.uid()), 'text', p_action, v_body);
  update public.support_threads set unread_learner = unread_learner + 1, last_message_at = now() where id = p_thread;
  return private.support_payload(p_thread);
end $$;
