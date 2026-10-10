-- DoughFlow PIN gate + dated inventory audit
-- Apply once in Supabase SQL Editor after schema.sql and hardening_2026_10_08.sql.
begin;

alter table public.profiles
  add column if not exists pin_hash text,
  add column if not exists pin_failed_attempts integer not null default 0,
  add column if not exists pin_locked_until timestamptz;

alter table public.inventory_transactions
  add column if not exists effective_at timestamptz,
  add column if not exists correction_of uuid references public.inventory_transactions(id);

update public.inventory_transactions
set effective_at=created_at
where effective_at is null;

alter table public.inventory_transactions
  alter column effective_at set default now(),
  alter column effective_at set not null;

create index if not exists inventory_tx_effective_idx
  on public.inventory_transactions(material_code,effective_at desc);
create index if not exists inventory_tx_correction_idx
  on public.inventory_transactions(correction_of);

create or replace function public.my_pin_is_set()
returns boolean
language sql
security definer
set search_path=public
as $$
  select coalesce((select pin_hash is not null from public.profiles where id=auth.uid()),false);
$$;

create or replace function public.set_my_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path=public,extensions
as $$
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  if p_pin !~ '^[0-9]{4}$' then raise exception 'PIN must contain exactly four digits'; end if;
  update public.profiles
  set pin_hash=crypt(p_pin,gen_salt('bf',12)),
      pin_failed_attempts=0,
      pin_locked_until=null,
      updated_at=now()
  where id=auth.uid();
  if not found then raise exception 'Profile not found'; end if;
end;
$$;

create or replace function public.verify_my_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_hash text;
  v_attempts integer;
  v_locked_until timestamptz;
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  if p_pin !~ '^[0-9]{4}$' then return false; end if;

  select pin_hash,pin_failed_attempts,pin_locked_until
  into v_hash,v_attempts,v_locked_until
  from public.profiles
  where id=auth.uid()
  for update;

  if not found or v_hash is null then return false; end if;
  if v_locked_until is not null and v_locked_until>now() then
    raise exception 'PIN temporarily locked. Try again later';
  end if;

  if crypt(p_pin,v_hash)=v_hash then
    update public.profiles
    set pin_failed_attempts=0,pin_locked_until=null,updated_at=now()
    where id=auth.uid();
    return true;
  end if;

  v_attempts:=coalesce(v_attempts,0)+1;
  update public.profiles
  set pin_failed_attempts=case when v_attempts>=5 then 0 else v_attempts end,
      pin_locked_until=case when v_attempts>=5 then now()+interval '15 minutes' else null end,
      updated_at=now()
  where id=auth.uid();
  return false;
end;
$$;

revoke all on function public.my_pin_is_set() from public;
revoke all on function public.set_my_pin(text) from public;
revoke all on function public.verify_my_pin(text) from public;
grant execute on function public.my_pin_is_set() to authenticated;
grant execute on function public.set_my_pin(text) to authenticated;
grant execute on function public.verify_my_pin(text) to authenticated;

create or replace function public.admin_correct_inventory_transaction(
  p_original_id uuid,
  p_new_direction public.inventory_direction,
  p_new_qty numeric,
  p_effective_at timestamptz,
  p_reason text
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_original public.inventory_transactions%rowtype;
  v_old_signed numeric;
  v_existing_corrections numeric;
  v_new_signed numeric;
  v_delta numeric;
  v_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  if p_new_qty<0 then raise exception 'Quantity cannot be negative'; end if;
  if p_new_direction not in ('in','out','adjust') then
    raise exception 'Invalid inventory direction';
  end if;
  if nullif(trim(p_reason),'') is null then
    raise exception 'Correction reason is required';
  end if;

  select * into v_original
  from public.inventory_transactions
  where id=p_original_id
  for update;
  if not found then raise exception 'Inventory transaction not found'; end if;

  if not exists(
    select 1 from public.materials
    where code=v_original.material_code and active and inventory_tracked
  ) then raise exception 'Material is not tracked as inventory'; end if;

  v_old_signed:=case when v_original.direction='out' then -v_original.qty_base else v_original.qty_base end;
  v_existing_corrections:=coalesce((
    select sum(case when direction='out' then -qty_base else qty_base end)
    from public.inventory_transactions
    where correction_of=p_original_id
  ),0);
  v_new_signed:=case when p_new_direction='out' then -p_new_qty else p_new_qty end;
  v_delta:=v_new_signed-v_old_signed-v_existing_corrections;

  if abs(v_delta)<0.00005 then raise exception 'No correction is needed'; end if;

  insert into public.inventory_transactions(
    material_code,direction,qty_base,reason,package_count,package_label,
    created_by,created_at,effective_at,correction_of
  )
  values(
    v_original.material_code,
    case when v_delta>0 then 'in'::public.inventory_direction else 'out'::public.inventory_direction end,
    abs(v_delta),
    'Correction of '||p_original_id::text||': '||trim(p_reason),
    null,
    'Audit correction',
    auth.uid(),now(),coalesce(p_effective_at,v_original.effective_at),p_original_id
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.admin_correct_inventory_transaction(uuid,public.inventory_direction,numeric,timestamptz,text) from public;
grant execute on function public.admin_correct_inventory_transaction(uuid,public.inventory_direction,numeric,timestamptz,text) to authenticated;

drop policy if exists inventory_admin_insert on public.inventory_transactions;
create policy inventory_admin_insert on public.inventory_transactions
for insert with check (
  public.is_admin()
  and exists(select 1 from public.materials m where m.code=material_code and m.active and m.inventory_tracked)
);



create or replace function public.admin_inventory_snapshot(p_effective_date date)
returns table(material_code text, stock numeric)
language plpgsql
security definer
set search_path=public
as $$
declare v_end timestamptz;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Not authorized'; end if;
  if p_effective_date is null or p_effective_date > (now() at time zone 'Asia/Bishkek')::date then
    raise exception 'Choose today or a past date';
  end if;
  v_end:=((p_effective_date+1)::timestamp at time zone 'Asia/Bishkek');
  return query
    select m.code,
      coalesce(sum(case when t.direction='out' then -t.qty_base else t.qty_base end),0)::numeric
    from public.materials m
    left join public.inventory_transactions t
      on t.material_code=m.code and t.effective_at<v_end
    where m.active and m.inventory_tracked
    group by m.code
    order by m.code;
end;
$$;

create or replace function public.admin_inventory_history(p_effective_date date)
returns table(
  effective_date date,
  material_code text,
  material_name text,
  direction public.inventory_direction,
  qty_base numeric,
  reason text,
  package_count numeric,
  package_label text,
  created_by_name text,
  created_at timestamptz,
  effective_at timestamptz,
  correction_of uuid
)
language plpgsql
security definer
set search_path=public
as $$
declare v_start timestamptz; v_end timestamptz;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Not authorized'; end if;
  if p_effective_date is null or p_effective_date > (now() at time zone 'Asia/Bishkek')::date then
    raise exception 'Choose today or a past date';
  end if;
  v_start:=p_effective_date::timestamp at time zone 'Asia/Bishkek';
  v_end:=(p_effective_date+1)::timestamp at time zone 'Asia/Bishkek';
  return query
    select (t.effective_at at time zone 'Asia/Bishkek')::date,
           t.material_code,m.name,t.direction,t.qty_base,t.reason,
           t.package_count,t.package_label,coalesce(p.full_name,'—'),
           t.created_at,t.effective_at,t.correction_of
    from public.inventory_transactions t
    join public.materials m on m.code=t.material_code
    left join public.profiles p on p.id=t.created_by
    where m.inventory_tracked and t.effective_at>=v_start and t.effective_at<v_end
    order by t.effective_at desc,t.created_at desc;
end;
$$;

create or replace function public.admin_set_stock_as_of_date(
  p_material_code text,
  p_effective_date date,
  p_target_stock numeric,
  p_reason text
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_current numeric;
  v_delta numeric;
  v_end timestamptz;
  v_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Not authorized'; end if;
  if p_target_stock is null or p_target_stock<0 then raise exception 'Target stock cannot be negative'; end if;
  if nullif(trim(p_reason),'') is null or length(trim(p_reason))<3 then raise exception 'Correction reason is required'; end if;
  if p_effective_date is null or p_effective_date > (now() at time zone 'Asia/Bishkek')::date then raise exception 'Choose today or a past date'; end if;

  perform 1 from public.materials m
    where m.code=p_material_code and m.active and m.inventory_tracked
    for update;
  if not found then raise exception 'Material is not tracked as inventory'; end if;

  v_end:=(p_effective_date+1)::timestamp at time zone 'Asia/Bishkek';
  select coalesce(sum(case when t.direction='out' then -t.qty_base else t.qty_base end),0)
    into v_current
    from public.inventory_transactions t
    where t.material_code=p_material_code and t.effective_at<v_end;

  v_delta:=p_target_stock-v_current;
  if abs(v_delta)<0.00005 then raise exception 'No stock change required'; end if;

  -- Set the correction at the end of the business day so it defines the
  -- closing balance for the selected date without rewriting prior rows.
  insert into public.inventory_transactions(
    material_code,direction,qty_base,reason,package_label,
    created_by,created_at,effective_at
  ) values(
    p_material_code,
    case when v_delta>0 then 'in'::public.inventory_direction else 'out'::public.inventory_direction end,
    abs(v_delta),
    'Historical stock correction: '||trim(p_reason),
    'Date-wise balance correction',
    auth.uid(),now(),v_end-interval '1 millisecond'
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.admin_inventory_snapshot(date) from public;
revoke all on function public.admin_inventory_history(date) from public;
revoke all on function public.admin_set_stock_as_of_date(text,date,numeric,text) from public;
grant execute on function public.admin_inventory_snapshot(date) to authenticated;
grant execute on function public.admin_inventory_history(date) to authenticated;
grant execute on function public.admin_set_stock_as_of_date(text,date,numeric,text) to authenticated;

commit;
