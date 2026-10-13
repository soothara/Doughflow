-- DoughFlow: admin inventory transaction management and audit trail.
begin;

create table if not exists public.inventory_transaction_audit (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null,
  action text not null check (action in ('update','delete')),
  actor_id uuid not null,
  occurred_at timestamptz not null default now(),
  before_record jsonb not null,
  after_record jsonb,
  note text not null
);
alter table public.inventory_transaction_audit enable row level security;
revoke all on public.inventory_transaction_audit from anon, authenticated;

drop function if exists public.admin_inventory_history(date);
create function public.admin_inventory_history(p_effective_date date)
returns table(
  transaction_id uuid, production_run_id uuid, effective_date date, material_code text,
  material_name text, direction text, qty_base numeric, reason text, package_count numeric,
  package_label text, created_by_name text, created_at timestamptz
)
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Not authorized'; end if;
  if p_effective_date is null or p_effective_date>(now() at time zone 'Asia/Bishkek')::date then
    raise exception 'Choose today or a past date';
  end if;
  return query
  select t.id,t.production_run_id,t.effective_date,t.material_code,m.name,t.direction::text,
         t.qty_base,t.reason,t.package_count,t.package_label,coalesce(p.full_name,'Unknown'),t.created_at
  from public.inventory_transactions t
  join public.materials m on m.code=t.material_code
  left join public.profiles p on p.id=t.created_by
  where t.effective_date=p_effective_date and m.inventory_tracked and m.active
  order by t.created_at desc,t.id desc;
end $$;

create or replace function public.admin_update_inventory_transaction(
  p_transaction_id uuid,p_material_code text,p_direction text,p_qty_base numeric,
  p_effective_date date,p_reason text,p_package_count numeric default null,p_package_label text default null
) returns void
language plpgsql security definer set search_path=public as $$
declare
  v_old public.inventory_transactions%rowtype;
  v_new public.inventory_transactions%rowtype;
  v_codes text[];
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Not authorized'; end if;
  if p_effective_date is null or p_effective_date>(now() at time zone 'Asia/Bishkek')::date then
    raise exception 'Choose today or a past date';
  end if;
  if p_direction not in ('in','out') then raise exception 'Invalid stock movement'; end if;
  if p_qty_base is null or p_qty_base<=0 then raise exception 'Quantity must be greater than zero'; end if;
  if coalesce(length(trim(p_reason)),0)<3 then raise exception 'Enter a reason of at least 3 characters'; end if;
  if p_package_count is not null and p_package_count<=0 then raise exception 'Package count must be greater than zero'; end if;
  if not exists(select 1 from public.materials m where m.code=p_material_code and m.active and m.inventory_tracked) then
    raise exception 'Unknown or untracked material';
  end if;
  select * into v_old from public.inventory_transactions where id=p_transaction_id for update;
  if not found then raise exception 'Inventory transaction not found'; end if;
  if v_old.production_run_id is not null then
    raise exception 'Production consumption is linked to its production record. Correct the production record instead of editing its stock movement directly.';
  end if;
  if not exists(select 1 from public.materials m where m.code=v_old.material_code and m.active and m.inventory_tracked) then
    raise exception 'Original material is no longer tracked';
  end if;
  v_codes:=array(select distinct x from unnest(array[v_old.material_code,p_material_code]) x);
  update public.inventory_transactions
  set material_code=p_material_code,direction=p_direction::public.inventory_direction,
      qty_base=p_qty_base,effective_date=p_effective_date,reason=trim(p_reason),
      package_count=p_package_count,package_label=nullif(trim(coalesce(p_package_label,'')),'')
  where id=p_transaction_id returning * into v_new;
  if exists(
    with daily as (
      select effective_date,material_code,
        sum(case when direction='in' then qty_base when direction='out' then -qty_base else qty_base end) as delta
      from public.inventory_transactions where material_code=any(v_codes) group by effective_date,material_code
    ), running as (
      select material_code,effective_date,
        sum(delta) over(partition by material_code order by effective_date rows between unbounded preceding and current row) as balance
      from daily
    )
    select 1 from running where balance < -0.000001
  ) then raise exception 'This edit would make stock negative on a date. Correct later entries or choose a valid quantity/date.'; end if;
  insert into public.inventory_transaction_audit(transaction_id,action,actor_id,before_record,after_record,note)
  values(p_transaction_id,'update',auth.uid(),to_jsonb(v_old),to_jsonb(v_new),'Admin edited historical inventory movement');
end $$;

create or replace function public.admin_delete_inventory_transaction(p_transaction_id uuid,p_reason text)
returns void
language plpgsql security definer set search_path=public as $$
declare v_old public.inventory_transactions%rowtype; v_codes text[];
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Not authorized'; end if;
  if coalesce(length(trim(p_reason)),0)<3 then raise exception 'Enter a reason of at least 3 characters'; end if;
  select * into v_old from public.inventory_transactions where id=p_transaction_id for update;
  if not found then raise exception 'Inventory transaction not found'; end if;
  if v_old.production_run_id is not null then
    raise exception 'Production consumption is linked to its production record. Correct the production record instead of deleting its stock movement directly.';
  end if;
  v_codes:=array[v_old.material_code];
  delete from public.inventory_transactions where id=p_transaction_id;
  if exists(
    with daily as (
      select effective_date,material_code,
        sum(case when direction='in' then qty_base when direction='out' then -qty_base else qty_base end) as delta
      from public.inventory_transactions where material_code=any(v_codes) group by effective_date,material_code
    ), running as (
      select material_code,effective_date,
        sum(delta) over(partition by material_code order by effective_date rows between unbounded preceding and current row) as balance
      from daily
    )
    select 1 from running where balance < -0.000001
  ) then raise exception 'Removing this entry would make stock negative on a date. Correct later entries first.'; end if;
  insert into public.inventory_transaction_audit(transaction_id,action,actor_id,before_record,after_record,note)
  values(p_transaction_id,'delete',auth.uid(),to_jsonb(v_old),null,'Admin removed historical inventory movement: '||trim(p_reason));
end $$;

revoke all on function public.admin_inventory_history(date) from public;
revoke all on function public.admin_update_inventory_transaction(uuid,text,text,numeric,date,text,numeric,text) from public;
revoke all on function public.admin_delete_inventory_transaction(uuid,text) from public;
grant execute on function public.admin_inventory_history(date) to authenticated;
grant execute on function public.admin_update_inventory_transaction(uuid,text,text,numeric,date,text,numeric,text) to authenticated;
grant execute on function public.admin_delete_inventory_transaction(uuid,text) to authenticated;

commit;
notify pgrst, 'reload schema';
