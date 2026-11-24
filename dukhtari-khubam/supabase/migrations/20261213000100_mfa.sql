-- Two-step sign-in (2FA) for paid accounts: once a learner with Standard or Premium has turned on her second
-- factor (a TOTP code from an authenticator app), her plan counts only in a session that passed it (aal2). A
-- password or e-mail code alone (a stolen one) then opens the app as a free account.

create or replace function private.plan_of(p_user uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_rank int;
begin
  if p_user is null then return 'free'; end if;
  -- her own session without its second step, while she has one: no plan
  if p_user = auth.uid() and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'
     and exists (select 1 from auth.mfa_factors f where f.user_id = p_user and f.status::text = 'verified') then
    return 'free';
  end if;
  if exists (select 1 from public.user_roles ur where ur.user_id = p_user) then return 'premium'; end if;
  select max(private.tier_rank(e.tier::text)) into v_rank from public.entitlements e
    where e.user_id = p_user and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now());
  return case coalesce(v_rank, 0) when 2 then 'premium' when 1 then 'standard' else 'free' end;
end $$;

-- whether her account has its second step turned on, and whether this session passed it
create or replace function public.api_my_mfa() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then perform private.fail('unauthorized'); end if;
  return jsonb_build_object(
    'enabled', exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status::text = 'verified'),
    'passed', coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2');
end $$;
grant execute on function public.api_my_mfa() to authenticated;
