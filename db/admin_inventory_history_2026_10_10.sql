-- DoughFlow admin tools migration (2026-10-10)
-- Run after schema.sql and hardening_2026_10_08.sql.
begin;

alter table public.inventory_transactions add column if not exists effective_date date;
update public.inventory_transactions
set effective_date=(created_at at time zone 'Asia/Bishkek')::date
where effective_date is null;
alter table public.inventory_transactions alter column effective_date set default current_date;
alter table public.inventory_transactions alter column effective_date set not null;
create index if not exists inventory_tx_effective_date_idx
  on public.inventory_transactions(effective_date,material_code,created_at);

create or replace function public.admin_inventory_history(p_effective_date date)
returns table(transaction_id uuid,effective_date date,material_code text,material_name text,
  direction text,qty_base numeric,reason text,package_count numeric,package_label text,
  created_by_name text,created_at timestamptz)
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Not authorized'; end if;
  return query
  select t.id,t.effective_date,t.material_code,m.name,t.direction::text,t.qty_base,t.reason,
    t.package_count,t.package_label,coalesce(p.full_name,'Unknown'),t.created_at
  from public.inventory_transactions t join public.materials m on m.code=t.material_code
  left join public.profiles p on p.id=t.created_by
  where t.effective_date=p_effective_date and m.inventory_tracked and m.active
  order by t.created_at desc,t.id desc;
end $$;

create or replace function public.admin_inventory_snapshot(p_effective_date date)
returns table(material_code text,stock numeric)
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Not authorized'; end if;
  return query
  select m.code,coalesce(sum(case when t.direction='in' then t.qty_base
    when t.direction='out' then -t.qty_base else t.qty_base end),0)::numeric
  from public.materials m left join public.inventory_transactions t
    on t.material_code=m.code and t.effective_date<=p_effective_date
  where m.active and m.inventory_tracked group by m.code order by m.code;
end $$;

create or replace function public.admin_set_stock_as_of_date(
  p_material_code text,p_effective_date date,p_target_stock numeric,p_reason text
) returns table(previous_stock numeric,new_stock numeric,delta numeric,transaction_id uuid)
language plpgsql security definer set search_path=public as $$
declare v_previous numeric; v_current numeric; v_delta numeric; v_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Not authorized'; end if;
  if p_effective_date is null or p_effective_date>current_date then raise exception 'Choose today or a past date'; end if;
  if p_target_stock is null or p_target_stock<0 then raise exception 'Stock cannot be negative'; end if;
  if length(trim(coalesce(p_reason,'')))<3 then raise exception 'Enter a reason of at least 3 characters'; end if;
  perform 1 from public.materials where code=p_material_code and active and inventory_tracked for update;
  if not found then raise exception 'Material is not tracked as inventory'; end if;
  select coalesce(sum(case when direction='in' then qty_base when direction='out' then -qty_base else qty_base end),0)
    into v_previous from public.inventory_transactions
    where material_code=p_material_code and effective_date<=p_effective_date;
  select coalesce(sum(case when direction='in' then qty_base
                           when direction='out' then -qty_base
                           else qty_base end),0)
  into v_current
  from public.inventory_transactions where material_code=p_material_code;

  v_delta:=p_target_stock-v_previous;
  if v_current+v_delta < -0.00005 then
    raise exception 'Historical correction would make current inventory negative; reconcile later transactions first';
  end if;
  if abs(v_delta)<0.00005 then return query select v_previous,v_previous,0::numeric,null::uuid; return; end if;
  insert into public.inventory_transactions(material_code,direction,qty_base,reason,package_count,package_label,created_by,effective_date)
  values(p_material_code,case when v_delta>0 then 'in'::public.inventory_direction else 'out'::public.inventory_direction end,
    abs(v_delta),'Historical stock correction: '||trim(p_reason),null,'Manual correction',auth.uid(),p_effective_date)
  returning id into v_id;
  return query select v_previous,p_target_stock,v_delta,v_id;
end $$;

revoke all on function public.admin_inventory_history(date) from public;
revoke all on function public.admin_inventory_snapshot(date) from public;
revoke all on function public.admin_set_stock_as_of_date(text,date,numeric,text) from public;
grant execute on function public.admin_inventory_history(date) to authenticated;
grant execute on function public.admin_inventory_snapshot(date) to authenticated;
grant execute on function public.admin_set_stock_as_of_date(text,date,numeric,text) to authenticated;

commit;
