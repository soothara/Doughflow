-- PIN-only login: resolve the user from a unique bcrypt PIN match.
-- Rate-limit failed PIN-only attempts per client key without revealing account names.
begin;

create table if not exists public.pin_login_throttle (
  client_key text primary key check (client_key ~ '^[a-f0-9]{64}$'),
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  lock_level integer not null default 0 check (lock_level between 0 and 10),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.pin_login_throttle enable row level security;
revoke all on public.pin_login_throttle from public, anon, authenticated;

create or replace function public.verify_pin_only(p_pin text, p_client_key text)
returns table(success boolean, authenticated_user_id uuid, authenticated_email text, retry_after timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_throttle public.pin_login_throttle%rowtype;
  v_matches integer := 0;
  v_user_id uuid;
  v_email text;
  v_attempts integer;
  v_level integer;
  v_lock timestamptz;
begin
  if coalesce(p_pin, '') !~ '^[0-9]{4}$'
     or coalesce(p_client_key, '') !~ '^[a-f0-9]{64}$' then
    return query select false, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  insert into public.pin_login_throttle(client_key)
  values (p_client_key)
  on conflict (client_key) do nothing;

  select * into v_throttle
  from public.pin_login_throttle
  where client_key = p_client_key
  for update;

  if v_throttle.locked_until is not null and v_throttle.locked_until > now() then
    return query select false, null::uuid, null::text, v_throttle.locked_until;
    return;
  end if;

  select count(*) into v_matches
  from public.user_pin_credentials c
  where c.pin_hash is not null
    and (c.locked_until is null or c.locked_until <= now())
    and crypt(p_pin, c.pin_hash) = c.pin_hash;

  if v_matches = 1 then
    select c.user_id, u.email into v_user_id, v_email
    from public.user_pin_credentials c
    join auth.users u on u.id = c.user_id
    where c.pin_hash is not null
      and (c.locked_until is null or c.locked_until <= now())
      and crypt(p_pin, c.pin_hash) = c.pin_hash
    limit 1;

    update public.user_pin_credentials
    set failed_attempts = 0, locked_until = null, last_failed_at = null, updated_at = now()
    where user_id = v_user_id;

    update public.pin_login_throttle
    set failed_attempts = 0, lock_level = 0, locked_until = null, updated_at = now()
    where client_key = p_client_key;

    return query select true, v_user_id, v_email, null::timestamptz;
    return;
  end if;

  v_attempts := v_throttle.failed_attempts + 1;
  v_level := case when v_attempts >= 5 then least(10, v_throttle.lock_level + 1) else v_throttle.lock_level end;
  v_lock := case when v_attempts >= 5
    then now() + (least(240, 15 * (2 ^ least(v_level - 1, 4))::integer) * interval '1 minute')
    else null end;

  update public.pin_login_throttle
  set failed_attempts = v_attempts, lock_level = v_level, locked_until = v_lock, updated_at = now()
  where client_key = p_client_key;

  return query select false, null::uuid, null::text, v_lock;
end;
$$;

revoke all on function public.verify_pin_only(text, text) from public, anon, authenticated;
grant execute on function public.verify_pin_only(text, text) to service_role;

commit;
