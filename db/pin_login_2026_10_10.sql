-- DoughFlow PIN login migration (2026-10-10)
-- Requires the Supabase Edge Function at supabase/functions/pin-login/index.ts.
begin;
set local search_path=public, extensions;

create table if not exists public.user_pin_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  login_alias text not null unique,
  pin_hash text,
  failed_attempts integer not null default 0 check (failed_attempts>=0),
  lock_level integer not null default 0 check (lock_level between 0 and 10),
  locked_until timestamptz,
  last_failed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint pin_alias_format check (login_alias ~ '^[a-z0-9][a-z0-9._-]{1,31}$'),
  constraint pin_hash_format check (pin_hash is null or pin_hash like '$2%')
);
alter table public.user_pin_credentials enable row level security;
revoke all on public.user_pin_credentials from anon, authenticated, public;

insert into public.user_pin_credentials(user_id,login_alias,pin_hash)
select p.id,
  case when lower(u.email)='askat@gmail.com' and p.role='admin' then 'askat'
    else left(coalesce(nullif(regexp_replace(lower(split_part(coalesce(u.email,''),'@',1)),'[^a-z0-9._-]','','g'),''),'user'),24)
      || '-' || left(replace(p.id::text,'-',''),4) end,
  null
from public.profiles p join auth.users u on u.id=p.id
on conflict(user_id) do nothing;

create or replace function public.admin_list_pin_users()
returns table(user_id uuid,full_name text,role text,login_alias text,pin_configured boolean,locked_until timestamptz)
language plpgsql security definer set search_path=public, extensions as $
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Not authorized'; end if;
  return query
  select p.id,p.full_name,p.role::text,c.login_alias,(c.pin_hash is not null),c.locked_until
  from public.profiles p left join public.user_pin_credentials c on c.user_id=p.id
  order by case when p.role='admin' then 0 else 1 end,p.full_name;
end $$;

create or replace function public.admin_set_user_pin(p_user_id uuid,p_pin text,p_login_alias text)
returns void language plpgsql security definer set search_path=public, extensions as $
declare v_alias text;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Not authorized'; end if;
  if p_pin !~ '^[0-9]{4}$' then raise exception 'PIN must contain exactly four digits'; end if;
  v_alias=lower(trim(p_login_alias));
  if v_alias !~ '^[a-z0-9][a-z0-9._-]{1,31}$' then
    raise exception 'Username must be 2 to 32 characters (letters, numbers, dot, underscore or hyphen)';
  end if;
  if not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'Profile not found'; end if;
  insert into public.user_pin_credentials(user_id,login_alias,pin_hash,failed_attempts,lock_level,locked_until,last_failed_at,updated_at)
  values(p_user_id,v_alias,crypt(p_pin,gen_salt('bf',12)),0,0,null,null,now())
  on conflict(user_id) do update set login_alias=excluded.login_alias,pin_hash=excluded.pin_hash,
    failed_attempts=0,lock_level=0,locked_until=null,last_failed_at=null,updated_at=now();
end $$;

create or replace function public.verify_pin_login(p_alias text,p_pin text)
returns table(success boolean,authenticated_user_id uuid,authenticated_email text,retry_after timestamptz)
language plpgsql security definer set search_path=public, extensions as $
declare v record; v_attempts integer; v_level integer; v_lock timestamptz;
begin
  if coalesce(p_pin,'') !~ '^[0-9]{4}$' or coalesce(trim(p_alias),'')='' then
    return query select false,null::uuid,null::text,null::timestamptz; return;
  end if;
  select c.user_id,c.pin_hash,c.failed_attempts,c.lock_level,c.locked_until,u.email into v
  from public.user_pin_credentials c join auth.users u on u.id=c.user_id
  where lower(c.login_alias)=lower(trim(p_alias)) for update of c;
  if not found then
    perform pg_sleep(0.35);
    return query select false,null::uuid,null::text,null::timestamptz; return;
  end if;
  if v.locked_until is not null and v.locked_until>now() then
    return query select false,null::uuid,null::text,v.locked_until; return;
  end if;
  if v.pin_hash is null or crypt(p_pin,v.pin_hash)<>v.pin_hash then
    v_attempts:=v.failed_attempts+1;
    v_level:=case when v_attempts>=5 then least(10,v.lock_level+1) else v.lock_level end;
    v_lock:=case when v_attempts>=5 then now()+(least(240,15*(2^least(v_level-1,4))::integer)*interval '1 minute') else null end;
    update public.user_pin_credentials set failed_attempts=v_attempts,lock_level=v_level,locked_until=v_lock,last_failed_at=now(),updated_at=now()
      where user_id=v.user_id;
    return query select false,null::uuid,null::text,v_lock; return;
  end if;
  update public.user_pin_credentials set failed_attempts=0,locked_until=null,last_failed_at=null,updated_at=now() where user_id=v.user_id;
  return query select true,v.user_id,v.email,null::timestamptz;
end $$;

revoke all on function public.admin_list_pin_users() from public;
revoke all on function public.admin_set_user_pin(uuid,text,text) from public;
revoke all on function public.verify_pin_login(text,text) from public;
grant execute on function public.admin_list_pin_users() to authenticated;
grant execute on function public.admin_set_user_pin(uuid,text,text) to authenticated;
grant execute on function public.verify_pin_login(text,text) to service_role;

-- Set the initial admin PIN only when it is not already configured.
update public.user_pin_credentials c
set pin_hash=crypt('1214',gen_salt('bf',12)),failed_attempts=0,lock_level=0,locked_until=null,updated_at=now()
from public.profiles p join auth.users u on u.id=p.id
where c.user_id=p.id and p.role='admin' and lower(u.email)='askat@gmail.com'
  and c.pin_hash is null;

commit;
