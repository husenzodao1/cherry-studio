-- Духтари хубам · progress backup straight from the phone to Supabase (no Vercel function on the way).
-- The phone sends its progress with the time of the last backup it saw (p_base). If nobody wrote since,
-- it is saved at once (one request). If another phone wrote meanwhile, the stored progress comes back
-- (conflict) for the phone to merge (mergeProgress) and send again. The code itself proves ownership,
-- as before; the table stays reachable only through functions.
create or replace function public.api_profile_push(p_code text, p_name text, p_data jsonb, p_base timestamptz default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_hash text;
  v_name text := left(trim(coalesce(p_name, '')), 80);
  v_row public.device_profiles%rowtype;
  v_at timestamptz;
begin
  if coalesce(p_code, '') !~ '^[1-9][0-9]{14}$' or v_name = '' or jsonb_typeof(p_data) <> 'object'
     or pg_column_size(p_data) > 262144 or coalesce(p_data->>'v', '') <> '1' then
    perform private.fail('validation_failed');
  end if;
  v_hash := encode(extensions.digest(p_code, 'sha256'), 'hex');
  select * into v_row from public.device_profiles where code_hash = v_hash for update;
  if found and (p_base is null or v_row.updated_at > p_base) then
    return jsonb_build_object('conflict', true, 'name', v_row.name, 'data', v_row.data, 'updated_at', v_row.updated_at);
  end if;
  insert into public.device_profiles as p (code_hash, name, data) values (v_hash, v_name, p_data)
  on conflict (code_hash) do update set name = excluded.name, data = excluded.data, updated_at = clock_timestamp()
  returning p.updated_at into v_at;
  return jsonb_build_object('updated_at', v_at);
end $$;
revoke execute on function public.api_profile_push(text, text, jsonb, timestamptz) from public;
grant execute on function public.api_profile_push(text, text, jsonb, timestamptz) to anon, authenticated, service_role;
