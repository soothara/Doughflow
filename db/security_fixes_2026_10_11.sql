-- DoughFlow security and integrity fixes (2026-10-11)
-- Apply AFTER schema.sql, hardening_2026_10_08.sql, pin_login_2026_10_10.sql,
-- and admin_inventory_history_2026_10_10.sql.
-- This migration is intentionally additive; it does not rewrite historical rows.

begin;
set local search_path = public, extensions;

-- Protect inventory integrity even when a caller bypasses the UI and writes to
-- the table directly. Future business dates and non-positive movements are
-- rejected in the database; production movements inherit their run's date.
create or replace function public.set_inventory_transaction_effective_date()
returns trigger
language plpgsql
set search_path=public
as $
begin
  if new.production_run_id is not null then
    select r.production_date into new.effective_date
    from public.production_runs r
    where r.id=new.production_run_id;
    if not found then
      raise exception 'Production run was not found';
    end if;
  elsif new.effective_date is null then
    new.effective_date=(coalesce(new.created_at,now()) at time zone 'Asia/Bishkek')::date;
  end if;

  if new.effective_date is null
     or new.effective_date>(now() at time zone 'Asia/Bishkek')::date then
    raise exception 'Choose today or a past date';
  end if;
  if new.qty_base is null or new.qty_base<=0 then
    raise exception 'Inventory movement quantity must be greater than zero';
  end if;
  if new.package_count is not null and new.package_count<=0 then
    raise exception 'Package count must be greater than zero';
  end if;
  if nullif(trim(coalesce(new.reason,'')),'') is null then
    raise exception 'Inventory movement reason is required';
  end if;
  return new;
end;
$;

drop trigger if exists inventory_transaction_effective_date_trg on public.inventory_transactions;
create trigger inventory_transaction_effective_date_trg
before insert or update on public.inventory_transactions
for each row execute function public.set_inventory_transaction_effective_date();

do $
begin
  alter table public.inventory_transactions
    add constraint inventory_transactions_qty_positive_chk check (qty_base>0) not valid;
exception when duplicate_object then null;
end $;

-- Production creation must not be backdated/future-dated through a direct RPC,
-- and every batch / consumption payload is validated server-side.
create or replace function public.complete_production(
  p_production_date date,
  p_mishok_count numeric,
  p_recipe_version_id uuid,
  p_batches jsonb,
  p_consumption jsonb default null
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_run uuid;
  r record;
  v_expected numeric;
  v_actual numeric;
  v_stock numeric;
  v_batch_sum numeric;
  v_batch_count integer;
  v_half_count integer;
  v_full_count integer;
  v_distinct_batch_count integer;
begin
  if auth.uid() is null or not (public.is_admin() or public.is_role('hamurchi')) then
    raise exception 'Not authorized';
  end if;

  if p_production_date is null
     or p_production_date <> (now() at time zone 'Asia/Bishkek')::date then
    raise exception 'Production date must be today in Bishkek';
  end if;

  if p_mishok_count is null
     or p_mishok_count < 0.5
     or p_mishok_count > 9.5
     or mod(p_mishok_count*2,1) <> 0 then
    raise exception 'Sack count must be between 0.5 and 9.5 in 0.5 increments';
  end if;

  if jsonb_typeof(p_batches) is distinct from 'array' then
    raise exception 'Batches must be a JSON array';
  end if;
  if jsonb_array_length(p_batches) > 10 then
    raise exception 'Too many batches';
  end if;

  if p_consumption is not null and jsonb_typeof(p_consumption) is distinct from 'array' then
    raise exception 'Consumption must be a JSON array';
  end if;

  if p_recipe_version_id is null or not exists (
    select 1 from public.recipe_versions
    where id=p_recipe_version_id and active=true
  ) then
    raise exception 'Recipe version is not active';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_batches) as b(x)
    where jsonb_typeof(b.x) is distinct from 'object'
  ) then
    raise exception 'Each batch must be an object';
  end if;

  -- Validate textual numeric forms separately before any casts so malformed
  -- client payloads fail with a controlled error instead of a cast exception.
  if exists (
    select 1
    from jsonb_array_elements(p_batches) as b(x)
    where coalesce(b.x->>'batch_no','') not in ('1','2','3','4','5','6','7','8','9','10')
       or coalesce(b.x->>'mishok_fraction','') not in ('0.5','1','1.0')
       or coalesce(b.x->>'pieces','0') !~ '^[0-9]+$'
  ) then
    raise exception 'Invalid batch number, sack fraction, or pieces value';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_batches) as b(x)
    where (b.x->>'pieces')::numeric > 2147483647
  ) then
    raise exception 'Pieces value is too large';
  end if;

  -- Batch numbers must be exactly 1..N in the submitted order.
  if exists (
    select 1
    from jsonb_array_elements(p_batches) with ordinality as b(x,ord)
    where (b.x->>'batch_no')::integer <> b.ord
  ) then
    raise exception 'Batch numbers must be sequential starting at 1';
  end if;

  select
    coalesce(sum((b.x->>'mishok_fraction')::numeric),0),
    count(*)::integer,
    (count(*) filter (where (b.x->>'mishok_fraction')::numeric = 0.5))::integer,
    (count(*) filter (where (b.x->>'mishok_fraction')::numeric = 1))::integer,
    count(distinct (b.x->>'batch_no')::integer)::integer
  into v_batch_sum,v_batch_count,v_half_count,v_full_count,v_distinct_batch_count
  from jsonb_array_elements(p_batches) as b(x);

  if v_batch_count <> ceil(p_mishok_count)::integer
     or v_distinct_batch_count <> v_batch_count
     or abs(v_batch_sum-p_mishok_count) > 0.00001
     or v_full_count <> floor(p_mishok_count)::integer
     or v_half_count <> case when mod(p_mishok_count,1)=0.5 then 1 else 0 end
  then
    raise exception 'Batches do not match the selected sack count';
  end if;

  if p_consumption is not null then
    if exists (
      select 1
      from jsonb_array_elements(p_consumption) as c(x)
      where jsonb_typeof(c.x) is distinct from 'object'
    ) then
      raise exception 'Each consumption entry must be an object';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_consumption) as c(x)
      where coalesce(c.x->>'material_code','') !~ '^[a-z][a-z0-9_]{0,31}$'
         or coalesce(c.x->>'actual_qty','') !~ '^[0-9]+([.][0-9]+)?$'
    ) then
      raise exception 'Invalid material code or actual consumption quantity';
    end if;

    if exists (
      select c.x->>'material_code'
      from jsonb_array_elements(p_consumption) as c(x)
      group by c.x->>'material_code'
      having count(*) > 1
    ) then
      raise exception 'Consumption contains duplicate materials';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_consumption) as c(x)
      where not exists (
        select 1 from public.recipe_items ri
        where ri.recipe_version_id=p_recipe_version_id
          and ri.material_code=c.x->>'material_code'
      )
    ) then
      raise exception 'Consumption contains an unknown material';
    end if;
  end if;

  insert into public.production_runs(
    production_date,created_by,mishok_count,recipe_version_id,status
  )
  values(
    p_production_date,auth.uid(),p_mishok_count,p_recipe_version_id,'completed'
  )
  returning id into v_run;

  insert into public.production_batches(
    production_run_id,batch_no,mishok_fraction,pieces
  )
  select
    v_run,
    (b.x->>'batch_no')::integer,
    (b.x->>'mishok_fraction')::numeric,
    coalesce((b.x->>'pieces')::integer,0)
  from jsonb_array_elements(p_batches) as b(x);

  for r in
    select
      ri.material_code,
      ri.qty_per_mishok,
      ri.unit,
      coalesce(m.inventory_tracked,true) as inventory_tracked
    from public.recipe_items ri
    join public.materials m on m.code=ri.material_code
    where ri.recipe_version_id=p_recipe_version_id
    order by ri.sort_order
  loop
    v_expected := r.qty_per_mishok*p_mishok_count;

    v_actual := coalesce(
      (
        select (c.x->>'actual_qty')::numeric
        from jsonb_array_elements(coalesce(p_consumption,'[]'::jsonb)) as c(x)
        where c.x->>'material_code'=r.material_code
        limit 1
      ),
      v_expected
    );

    if v_actual < 0 then
      raise exception 'Actual consumption cannot be negative';
    end if;

    insert into public.production_materials(
      production_run_id,material_code,expected_qty,actual_qty,unit
    )
    values(v_run,r.material_code,v_expected,v_actual,r.unit);

    if r.inventory_tracked then
      -- Material-row lock serializes concurrent production deductions for each
      -- material before the balance is checked and ledger deductions are added.
      perform 1 from public.materials where code=r.material_code for update;

      select coalesce(sum(
        case
          when direction='in' then qty_base
          when direction='out' then -qty_base
          else qty_base
        end
      ),0)
      into v_stock
      from public.inventory_transactions
      where material_code=r.material_code;

      if v_stock < v_actual then
        raise exception 'Insufficient stock for % (available %, required %)',
          r.material_code, v_stock, v_actual;
      end if;

      if v_actual > 0 then
        insert into public.inventory_transactions(
          material_code,direction,qty_base,reason,production_run_id,created_by
        )
        values(
          r.material_code,'out',v_actual,
          'Automatic production consumption',v_run,auth.uid()
        );
      end if;
    end if;
  end loop;

  return v_run;
end;
$$;

revoke all on function public.complete_production(date,numeric,uuid,jsonb,jsonb) from public;
grant execute on function public.complete_production(date,numeric,uuid,jsonb,jsonb) to authenticated;

-- Historical stock corrections are allowed only if the stock balance remains
-- nonnegative on every recorded day at or after the edited date, not just today.
create or replace function public.admin_set_stock_as_of_date(
  p_material_code text,
  p_effective_date date,
  p_target_stock numeric,
  p_reason text
) returns table(previous_stock numeric,new_stock numeric,delta numeric,transaction_id uuid)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_previous numeric;
  v_current numeric;
  v_delta numeric;
  v_min_after numeric;
  v_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  if p_effective_date is null
     or p_effective_date>(now() at time zone 'Asia/Bishkek')::date then
    raise exception 'Choose today or a past date';
  end if;
  if p_target_stock is null or p_target_stock<0 then
    raise exception 'Stock cannot be negative';
  end if;
  if length(trim(coalesce(p_reason,'')))<3 then
    raise exception 'Enter a reason of at least 3 characters';
  end if;

  -- Serialize corrections with other corrections and production stock changes.
  perform 1 from public.materials
  where code=p_material_code and active and inventory_tracked
  for update;
  if not found then
    raise exception 'Material is not tracked as inventory';
  end if;

  select coalesce(sum(case
      when direction='in' then qty_base
      when direction='out' then -qty_base
      else qty_base
    end),0)
  into v_previous
  from public.inventory_transactions
  where material_code=p_material_code and effective_date<=p_effective_date;

  select coalesce(sum(case
      when direction='in' then qty_base
      when direction='out' then -qty_base
      else qty_base
    end),0)
  into v_current
  from public.inventory_transactions
  where material_code=p_material_code;

  v_delta:=p_target_stock-v_previous;

  if v_current+v_delta < -0.00005 then
    raise exception 'Historical correction would make current inventory negative; reconcile later transactions first';
  end if;

  if abs(v_delta)<0.00005 then
    return query select v_previous,v_previous,0::numeric,null::uuid;
    return;
  end if;

  select min(day_balances.balance_after_delta)
  into v_min_after
  from (
    select d.effective_date,
           sum(d.daily_delta) over (order by d.effective_date rows between unbounded preceding and current row)
             as balance_after_delta
    from (
      select t.effective_date,
             sum(case
               when t.direction='in' then t.qty_base
               when t.direction='out' then -t.qty_base
               else t.qty_base
             end) as daily_delta
      from public.inventory_transactions t
      where t.material_code=p_material_code
      group by t.effective_date
    ) d
  ) day_balances
  where day_balances.effective_date>=p_effective_date;

  if v_min_after is not null and v_min_after+v_delta < -0.00005 then
    raise exception 'Historical correction would make a later daily inventory balance negative; reconcile later transactions first';
  end if;

  insert into public.inventory_transactions(
    material_code,direction,qty_base,reason,package_count,package_label,created_by,effective_date
  )
  values(
    p_material_code,
    case when v_delta>0 then 'in'::public.inventory_direction else 'out'::public.inventory_direction end,
    abs(v_delta),
    'Historical stock correction: '||trim(p_reason),
    null,
    'Manual correction',
    auth.uid(),
    p_effective_date
  )
  returning id into v_id;

  return query select v_previous,p_target_stock,v_delta,v_id;
end;
$$;

revoke all on function public.admin_set_stock_as_of_date(text,date,numeric,text) from public;
grant execute on function public.admin_set_stock_as_of_date(text,date,numeric,text) to authenticated;


-- Recipe versions also validate units and quantity syntax inside the database
-- so an authorized but malformed direct RPC cannot reinterpret kg as another unit.
create or replace function public.create_recipe_version(
  p_items jsonb,
  p_note text default null
) returns uuid
language plpgsql
security definer
set search_path=public
as $
declare
  v_version integer;
  v_id uuid;
  x jsonb;
begin
  if auth.uid() is null or not (public.is_admin() or public.is_role('hamurchi')) then
    raise exception 'Not authorized';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Recipe items must be a JSON array';
  end if;
  if jsonb_array_length(p_items)=0 then
    raise exception 'Recipe cannot be empty';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) as i(x)
    where jsonb_typeof(i.x) is distinct from 'object'
  ) then
    raise exception 'Each recipe item must be an object';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) as i(x)
    where coalesce(i.x->>'code','') !~ '^[a-z][a-z0-9_]{0,31}
       or coalesce(i.x->>'qty','') !~ '^[0-9]+([.][0-9]+)?
       or coalesce(i.x->>'unit','') = ''
  ) then
    raise exception 'Recipe contains an invalid material code, quantity, or unit';
  end if;

  if exists (
    select i.x->>'code'
    from jsonb_array_elements(p_items) as i(x)
    group by i.x->>'code'
    having count(*) > 1
  ) then
    raise exception 'Recipe contains duplicate materials';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as i(x)
    where not exists (
      select 1 from public.materials m
      where m.code=i.x->>'code' and m.active
    )
  ) then
    raise exception 'Recipe contains an unknown material';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as i(x)
    join public.materials m on m.code=i.x->>'code'
    where m.active and m.base_unit<>i.x->>'unit'
  ) then
    raise exception 'Recipe unit does not match the material base unit';
  end if;

  perform pg_advisory_xact_lock(41720261008);

  select coalesce(max(version_number),0)+1
  into v_version
  from public.recipe_versions;

  update public.recipe_versions set active=false where active=true;

  insert into public.recipe_versions(
    version_number,active,created_by,note,effective_from
  )
  values(
    v_version,true,auth.uid(),p_note,(now() at time zone 'Asia/Bishkek')::date
  )
  returning id into v_id;

  for x in select * from jsonb_array_elements(p_items) loop
    insert into public.recipe_items(
      recipe_version_id,material_code,qty_per_mishok,unit,note,sort_order
    )
    values(
      v_id,
      x->>'code',
      (x->>'qty')::numeric,
      x->>'unit',
      x->>'note',
      coalesce((x->>'sort_order')::integer,0)
    );
  end loop;

  return v_id;
end;
$;

revoke all on function public.create_recipe_version(jsonb,text) from public;
grant execute on function public.create_recipe_version(jsonb,text) to authenticated;

commit;
