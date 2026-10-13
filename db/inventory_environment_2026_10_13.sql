-- DoughFlow inventory environment: structured movements, supplier/reference metadata,
-- low-stock thresholds, searchable activity, editable manual transactions, and audit viewing.
-- Run after db/admin_inventory_transaction_management_2026_10_13.sql.
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
revoke all on public.inventory_transaction_audit from anon,authenticated;

alter table public.materials add column if not exists minimum_stock numeric not null default 0;
do $$ begin
  alter table public.materials add constraint materials_minimum_stock_nonnegative_chk check(minimum_stock>=0);
exception when duplicate_object then null; end $$;

alter table public.inventory_transactions
  add column if not exists movement_type text,
  add column if not exists supplier_name text,
  add column if not exists reference_code text;

update public.inventory_transactions set movement_type=case
  when production_run_id is not null then 'production'
  when direction='adjust' then 'adjustment'
  when reason ilike 'Historical stock correction:%' then 'adjustment'
  when reason ilike '%waste%' or reason ilike '%damaged%' or reason ilike '%spoiled%' then 'waste'
  when direction='in' and (reason ilike '%return from customer%' or reason ilike '%customer return%') then 'customer_return'
  when direction='in' and (reason ilike '%supplier%' or reason ilike '%delivery%' or reason ilike '%purchase%') then 'purchase'
  when direction='in' then 'manual_receipt'
  else 'manual_issue'
end where movement_type is null;
alter table public.inventory_transactions drop constraint if exists inventory_transactions_movement_type_chk;
alter table public.inventory_transactions drop constraint if exists inventory_transactions_movement_type_chk;
alter table public.inventory_transactions alter column movement_type set default 'manual_receipt';
alter table public.inventory_transactions alter column movement_type set not null;
do $$ begin
  alter table public.inventory_transactions add constraint inventory_transactions_movement_type_chk
    check(movement_type in ('purchase','customer_return','opening_balance','manual_receipt','manual_issue','waste','supplier_return','adjustment','production'));
exception when duplicate_object then null; end $$;

create index if not exists inventory_transactions_type_date_idx on public.inventory_transactions(movement_type,effective_date desc);
create index if not exists inventory_transactions_material_date_idx on public.inventory_transactions(material_code,effective_date desc);

create or replace function public.set_inventory_transaction_effective_date()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.production_run_id is not null then
    select r.production_date into new.effective_date from public.production_runs r where r.id=new.production_run_id;
    new.movement_type='production';
  elsif new.reason ilike 'Historical stock correction:%' then
    new.movement_type='adjustment';
  end if;
  if new.movement_type not in ('purchase','customer_return','opening_balance','manual_receipt','manual_issue','waste','supplier_return','adjustment','production') then
    raise exception 'Invalid inventory movement type';
  end if;
  if new.movement_type in ('purchase','customer_return','opening_balance','manual_receipt') and new.direction<>'in' then
    raise exception 'This movement type must add stock';
  end if;
  if new.movement_type in ('manual_issue','waste','supplier_return','production') and new.direction<>'out' then
    raise exception 'This movement type must remove stock';
  end if;
  return new;
end;
$$;
drop trigger if exists inventory_transaction_effective_date_trg on public.inventory_transactions;
create trigger inventory_transaction_effective_date_trg
before insert or update of production_run_id,effective_date,movement_type,direction,reason
on public.inventory_transactions for each row execute function public.set_inventory_transaction_effective_date();

drop function if exists public.admin_inventory_history(date);
create function public.admin_inventory_history(p_effective_date date)
returns table(
 transaction_id uuid,production_run_id uuid,effective_date date,material_code text,material_name text,
 direction text,movement_type text,qty_base numeric,reason text,package_count numeric,package_label text,
 supplier_name text,reference_code text,created_by_name text,created_at timestamptz
)
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Not authorized'; end if;
 if p_effective_date is null or p_effective_date>(now() at time zone 'Asia/Bishkek')::date then raise exception 'Choose today or a past date'; end if;
 return query
 select t.id,t.production_run_id,t.effective_date,t.material_code,m.name,t.direction::text,t.movement_type,
        t.qty_base,t.reason,t.package_count,t.package_label,t.supplier_name,t.reference_code,
        coalesce(p.full_name,'Unknown'),t.created_at
 from public.inventory_transactions t join public.materials m on m.code=t.material_code
 left join public.profiles p on p.id=t.created_by
 where t.effective_date=p_effective_date and m.inventory_tracked and m.active
 order by t.created_at desc,t.id desc;
end $$;

create or replace function public.admin_record_inventory_movement(
 p_material_code text,p_direction text,p_movement_type text,p_qty_base numeric,p_effective_date date,
 p_reason text,p_package_count numeric default null,p_package_label text default null,
 p_supplier_name text default null,p_reference_code text default null
) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_asof numeric; v_current numeric; v_min_later numeric;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Not authorized'; end if;
 if p_effective_date is null or p_effective_date>(now() at time zone 'Asia/Bishkek')::date then raise exception 'Choose today or a past date'; end if;
 if p_direction not in ('in','out') then raise exception 'Invalid stock direction'; end if;
 if p_movement_type not in ('purchase','customer_return','manual_receipt','manual_issue','waste','supplier_return','adjustment') then raise exception 'Invalid manual inventory movement type'; end if;
 if p_movement_type in ('purchase','customer_return','opening_balance','manual_receipt') and p_direction<>'in' then raise exception 'This movement type must add stock'; end if;
 if p_movement_type in ('manual_issue','waste','supplier_return') and p_direction<>'out' then raise exception 'This movement type must remove stock'; end if;
 if p_qty_base is null or p_qty_base<=0 then raise exception 'Quantity must be greater than zero'; end if;
 if coalesce(length(trim(p_reason)),0)<3 then raise exception 'Enter a reason of at least 3 characters'; end if;
 if p_package_count is not null and p_package_count<=0 then raise exception 'Package count must be greater than zero'; end if;
 if not exists(select 1 from public.materials m where m.code=p_material_code and m.active and m.inventory_tracked) then raise exception 'Material is not tracked as inventory'; end if;

 perform 1 from public.materials where code=p_material_code for update;
 select coalesce(sum(case when direction='in' then qty_base when direction='out' then -qty_base else qty_base end),0)
 into v_asof from public.inventory_transactions where material_code=p_material_code and effective_date<=p_effective_date;
 select coalesce(sum(case when direction='in' then qty_base when direction='out' then -qty_base else qty_base end),0)
 into v_current from public.inventory_transactions where material_code=p_material_code;
 if p_direction='out' then
   if v_asof-p_qty_base < -0.00005 then raise exception 'Insufficient stock on the selected date'; end if;
   select min(balance) into v_min_later from (
     select effective_date,sum(sum(case when direction='in' then qty_base when direction='out' then -qty_base else qty_base end))
       over(order by effective_date rows between unbounded preceding and current row) as balance
     from public.inventory_transactions where material_code=p_material_code group by effective_date
   ) day_balances where effective_date>p_effective_date;
   if v_min_later is not null and v_min_later-p_qty_base < -0.00005 then raise exception 'This issue would make a later daily stock balance negative. Correct later entries or choose a valid date/quantity.'; end if;
   if v_current-p_qty_base < -0.00005 then raise exception 'Insufficient current stock'; end if;
 end if;
 insert into public.inventory_transactions(material_code,direction,qty_base,reason,package_count,package_label,created_by,effective_date,movement_type,supplier_name,reference_code)
 values(p_material_code,p_direction::public.inventory_direction,p_qty_base,trim(p_reason),p_package_count,
   nullif(trim(coalesce(p_package_label,'')),''),auth.uid(),p_effective_date,p_movement_type,
   nullif(trim(coalesce(p_supplier_name,'')),''),nullif(trim(coalesce(p_reference_code,'')),''))
 returning id into v_id;
 return v_id;
end $$;

drop function if exists public.admin_update_inventory_transaction(uuid,text,text,numeric,date,text,numeric,text,text,text,text);
drop function if exists public.admin_update_inventory_transaction(uuid,text,text,numeric,date,text,numeric,text);
create function public.admin_update_inventory_transaction(
 p_transaction_id uuid,p_material_code text,p_direction text,p_qty_base numeric,p_effective_date date,
 p_reason text,p_package_count numeric default null,p_package_label text default null,
 p_movement_type text default 'manual_receipt',p_supplier_name text default null,p_reference_code text default null
) returns void
language plpgsql security definer set search_path=public as $$
declare v_old public.inventory_transactions%rowtype; v_new public.inventory_transactions%rowtype; v_codes text[];
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Not authorized'; end if;
 if p_effective_date is null or p_effective_date>(now() at time zone 'Asia/Bishkek')::date then raise exception 'Choose today or a past date'; end if;
 if p_direction not in ('in','out') then raise exception 'Invalid stock movement'; end if;
 if p_movement_type not in ('purchase','customer_return','opening_balance','manual_receipt','manual_issue','waste','supplier_return','adjustment','production') then raise exception 'Invalid inventory movement type'; end if;
 if p_movement_type='production' then raise exception 'Production movements must be edited through production history'; end if;
 if p_movement_type in ('purchase','customer_return','opening_balance','manual_receipt') and p_direction<>'in' then raise exception 'This movement type must add stock'; end if;
 if p_movement_type in ('manual_issue','waste','supplier_return') and p_direction<>'out' then raise exception 'This movement type must remove stock'; end if;
 if p_qty_base is null or p_qty_base<=0 then raise exception 'Quantity must be greater than zero'; end if;
 if coalesce(length(trim(p_reason)),0)<3 then raise exception 'Enter a reason of at least 3 characters'; end if;
 if p_package_count is not null and p_package_count<=0 then raise exception 'Package count must be greater than zero'; end if;
 if not exists(select 1 from public.materials m where m.code=p_material_code and m.active and m.inventory_tracked) then raise exception 'Unknown or untracked material'; end if;
 select * into v_old from public.inventory_transactions where id=p_transaction_id for update;
 if not found then raise exception 'Inventory transaction not found'; end if;
 if v_old.production_run_id is not null or v_old.movement_type='production' then raise exception 'Production consumption is linked to production history'; end if;
 if not exists(select 1 from public.materials m where m.code=v_old.material_code and m.active and m.inventory_tracked) then raise exception 'Original material is no longer tracked'; end if;
 v_codes:=array(select distinct x from unnest(array[v_old.material_code,p_material_code]) x);
 update public.inventory_transactions set material_code=p_material_code,direction=p_direction::public.inventory_direction,
  qty_base=p_qty_base,effective_date=p_effective_date,reason=trim(p_reason),package_count=p_package_count,
  package_label=nullif(trim(coalesce(p_package_label,'')),''),movement_type=p_movement_type,
  supplier_name=nullif(trim(coalesce(p_supplier_name,'')),''),reference_code=nullif(trim(coalesce(p_reference_code,'')),'')
 where id=p_transaction_id returning * into v_new;
 if exists(
  with daily as (select effective_date,material_code,sum(case when direction='in' then qty_base when direction='out' then -qty_base else qty_base end) as delta
    from public.inventory_transactions where material_code=any(v_codes) group by effective_date,material_code),
  running as (select material_code,effective_date,sum(delta) over(partition by material_code order by effective_date rows between unbounded preceding and current row) as balance from daily)
  select 1 from running where balance < -0.000001
 ) then raise exception 'This edit would make stock negative on a date. Correct later entries or choose a valid quantity/date.'; end if;
 insert into public.inventory_transaction_audit(transaction_id,action,actor_id,before_record,after_record,note)
 values(p_transaction_id,'update',auth.uid(),to_jsonb(v_old),to_jsonb(v_new),'Admin edited historical inventory movement');
end $$;

create or replace function public.admin_set_reorder_level(p_material_code text,p_minimum_stock numeric)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Not authorized'; end if;
 if p_minimum_stock is null or p_minimum_stock<0 then raise exception 'Reorder level must be zero or greater'; end if;
 update public.materials set minimum_stock=p_minimum_stock where code=p_material_code and active and inventory_tracked;
 if not found then raise exception 'Material is not tracked as inventory'; end if;
end $$;

create or replace function public.admin_inventory_activity(
 p_from date,p_to date,p_material_code text default null,p_movement_type text default null,p_search text default null
) returns table(
 transaction_id uuid,production_run_id uuid,effective_date date,material_code text,material_name text,direction text,
 movement_type text,qty_base numeric,reason text,package_count numeric,package_label text,supplier_name text,
 reference_code text,created_by_name text,created_at timestamptz
)
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Not authorized'; end if;
 if p_from is null or p_to is null or p_from>p_to or p_to>(now() at time zone 'Asia/Bishkek')::date then raise exception 'Choose a valid date range ending today or earlier'; end if;
 return query
 select t.id,t.production_run_id,t.effective_date,t.material_code,m.name,t.direction::text,t.movement_type,t.qty_base,t.reason,
  t.package_count,t.package_label,t.supplier_name,t.reference_code,coalesce(p.full_name,'Unknown'),t.created_at
 from public.inventory_transactions t join public.materials m on m.code=t.material_code
 left join public.profiles p on p.id=t.created_by
 where m.active and m.inventory_tracked and t.effective_date between p_from and p_to
  and (p_material_code is null or t.material_code=p_material_code)
  and (p_movement_type is null or t.movement_type=p_movement_type)
  and (coalesce(trim(p_search),'')='' or concat_ws(' ',t.reason,t.supplier_name,t.reference_code,m.name,t.material_code) ilike '%'||trim(p_search)||'%')
 order by t.effective_date desc,t.created_at desc,t.id desc;
end $$;

create or replace function public.admin_inventory_audit(p_from date,p_to date)
returns table(audit_id uuid,transaction_id uuid,action text,actor_id uuid,occurred_at timestamptz,before_record jsonb,after_record jsonb,note text)
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Not authorized'; end if;
 if p_from is null or p_to is null or p_from>p_to then raise exception 'Choose a valid audit date range'; end if;
 return query select a.id,a.transaction_id,a.action,a.actor_id,a.occurred_at,a.before_record,a.after_record,a.note
 from public.inventory_transaction_audit a where (a.occurred_at at time zone 'Asia/Bishkek')::date between p_from and p_to order by a.occurred_at desc;
end $$;

revoke all on function public.admin_inventory_history(date) from public;
revoke all on function public.admin_record_inventory_movement(text,text,text,numeric,date,text,numeric,text,text,text) from public;
revoke all on function public.admin_update_inventory_transaction(uuid,text,text,numeric,date,text,numeric,text,text,text,text) from public;
revoke all on function public.admin_delete_inventory_transaction(uuid,text) from public;
revoke all on function public.admin_set_reorder_level(text,numeric) from public;
revoke all on function public.admin_inventory_activity(date,date,text,text,text) from public;
revoke all on function public.admin_inventory_audit(date,date) from public;
grant execute on function public.admin_inventory_history(date) to authenticated;
grant execute on function public.admin_record_inventory_movement(text,text,text,numeric,date,text,numeric,text,text,text) to authenticated;
grant execute on function public.admin_update_inventory_transaction(uuid,text,text,numeric,date,text,numeric,text,text,text,text) to authenticated;
grant execute on function public.admin_delete_inventory_transaction(uuid,text) to authenticated;
grant execute on function public.admin_set_reorder_level(text,numeric) to authenticated;
grant execute on function public.admin_inventory_activity(date,date,text,text,text) to authenticated;
grant execute on function public.admin_inventory_audit(date,date) to authenticated;

commit;
notify pgrst,'reload schema';
