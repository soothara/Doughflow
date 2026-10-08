-- DoughFlow production hardening migration (2026-10-08)
-- Run once in Supabase SQL Editor after the existing schema.sql.
-- This does NOT replace or re-run the original schema.

begin;

alter table public.materials
  add column if not exists inventory_tracked boolean not null default true;

update public.materials
set inventory_tracked=false
where code='water';

create index if not exists materials_inventory_tracked_idx
  on public.materials(inventory_tracked, active);

drop view if exists public.inventory_balances;

create view public.inventory_balances as
select
  m.code,
  m.name,
  m.base_unit,
  coalesce(sum(
    case
      when t.direction='in' then t.qty_base
      when t.direction='out' then -t.qty_base
      else t.qty_base
    end
  ),0) as stock
from public.materials m
left join public.inventory_transactions t on t.material_code=m.code
where m.active and m.inventory_tracked
group by m.code,m.name,m.base_unit;

revoke all on public.inventory_balances from anon;
grant select on public.inventory_balances to authenticated;

do $$
begin
  alter table public.production_runs
    add constraint production_runs_sack_range_chk
    check (
      mishok_count >= 0.5
      and mishok_count <= 9.5
      and mod(mishok_count * 2, 1) = 0
    ) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.production_batches
    add constraint production_batches_sack_fraction_chk
    check (mishok_fraction in (0.5,1)) not valid;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.production_batches
    add constraint production_batches_positive_no_chk
    check (batch_no > 0) not valid;
exception when duplicate_object then null;
end $$;

-- Remove direct client-side writes. Production and recipes now go through
-- atomic SECURITY DEFINER functions only.
drop policy if exists production_insert on public.production_runs;
drop policy if exists production_update on public.production_runs;
drop policy if exists production_delete on public.production_runs;

drop policy if exists production_batches_write on public.production_batches;

drop policy if exists production_materials_write on public.production_materials;

drop policy if exists recipes_write on public.recipe_versions;
drop policy if exists recipes_update on public.recipe_versions;

drop policy if exists recipe_items_write on public.recipe_items;

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

  if p_mishok_count < 0.5 or p_mishok_count > 9.5 or mod(p_mishok_count*2,1) <> 0 then
    raise exception 'Sack count must be between 0.5 and 9.5 in 0.5 increments';
  end if;

  if not exists (
    select 1 from public.recipe_versions
    where id=p_recipe_version_id and active=true
  ) then
    raise exception 'Recipe version is not active';
  end if;

  select
    coalesce(sum((x->>'mishok_fraction')::numeric),0),
    count(*),
    count(*) filter (where (x->>'mishok_fraction')::numeric = 0.5),
    count(*) filter (where (x->>'mishok_fraction')::numeric = 1),
    count(distinct (x->>'batch_no')::integer)
  into v_batch_sum,v_batch_count,v_half_count,v_full_count,v_distinct_batch_count
  from jsonb_array_elements(coalesce(p_batches,'[]'::jsonb)) x;

  if v_batch_count <> ceil(p_mishok_count)::integer
     or v_distinct_batch_count <> v_batch_count
     or abs(v_batch_sum-p_mishok_count) > 0.00001
     or v_full_count <> floor(p_mishok_count)::integer
     or v_half_count <> case when mod(p_mishok_count,1)=0.5 then 1 else 0 end
  then
    raise exception 'Batches do not match the selected sack count';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_batches,'[]'::jsonb)) x
    where (x->>'mishok_fraction')::numeric not in (0.5,1)
  ) then
    raise exception 'Each batch must be 1.0 or 0.5 sack';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_batches,'[]'::jsonb)) x
    where (x->>'batch_no')::integer < 1
  ) then
    raise exception 'Invalid batch number';
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
    (x->>'batch_no')::integer,
    (x->>'mishok_fraction')::numeric,
    coalesce((x->>'pieces')::integer,0)
  from jsonb_array_elements(p_batches) x;

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
        select (x->>'actual_qty')::numeric
        from jsonb_array_elements(coalesce(p_consumption,'[]'::jsonb)) x
        where x->>'material_code'=r.material_code
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
      -- Lock the material row so two concurrent production completions
      -- cannot both consume the same last stock.
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

      insert into public.inventory_transactions(
        material_code,direction,qty_base,reason,production_run_id,created_by
      )
      values(
        r.material_code,'out',v_actual,
        'Automatic production consumption',v_run,auth.uid()
      );
    end if;
  end loop;

  return v_run;
end;
$$;

create or replace function public.create_recipe_version(
  p_items jsonb,
  p_note text default null
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_version integer;
  v_id uuid;
  x jsonb;
begin
  if auth.uid() is null or not (public.is_admin() or public.is_role('hamurchi')) then
    raise exception 'Not authorized';
  end if;

  if coalesce(jsonb_array_length(p_items),0)=0 then
    raise exception 'Recipe cannot be empty';
  end if;

  if exists (
    select 1
    from (
      select x->>'code' as code
      from jsonb_array_elements(p_items) x
    ) q
    group by code
    having count(*) > 1
  ) then
    raise exception 'Recipe contains duplicate materials';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) x
    where (x->>'qty')::numeric < 0
  ) then
    raise exception 'Recipe quantities cannot be negative';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) x
    where not exists (
      select 1 from public.materials m where m.code=x->>'code' and m.active
    )
  ) then
    raise exception 'Recipe contains an unknown material';
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
    v_version,true,auth.uid(),p_note,current_date
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
$$;

revoke all on function public.complete_production(date,numeric,uuid,jsonb,jsonb) from public;
grant execute on function public.complete_production(date,numeric,uuid,jsonb,jsonb) to authenticated;

revoke all on function public.create_recipe_version(jsonb,text) from public;
grant execute on function public.create_recipe_version(jsonb,text) to authenticated;

-- Defense in depth: unauthenticated clients get no access to app tables.
revoke all on public.profiles,
               public.materials,
               public.recipe_versions,
               public.recipe_items,
               public.production_runs,
               public.production_batches,
               public.production_materials,
               public.inventory_transactions
from anon;

commit;


create or replace function public.production_summary(
  p_from date default null,
  p_to date default null
) returns table(
  total_sacks numeric,
  total_pieces bigint,
  run_count bigint
)
language sql
security definer
set search_path=public
as $$
  select
    coalesce(sum(r.mishok_count),0)::numeric as total_sacks,
    coalesce(sum(coalesce(b.pieces,0)),0)::bigint as total_pieces,
    count(*)::bigint as run_count
  from public.production_runs r
  left join lateral (
    select sum(pb.pieces)::bigint as pieces
    from public.production_batches pb
    where pb.production_run_id=r.id
  ) b on true
  where
    (public.is_admin() or r.created_by=auth.uid())
    and (p_from is null or r.production_date>=p_from)
    and (p_to is null or r.production_date<=p_to)
    and r.status='completed';
$$;

revoke all on function public.production_summary(date,date) from public;
grant execute on function public.production_summary(date,date) to authenticated;


create or replace function public.set_preferred_language(p_language text)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  if p_language not in ('en','ru','ky') then raise exception 'Invalid language'; end if;
  update public.profiles
  set preferred_language=p_language, updated_at=now()
  where id=auth.uid();
  if not found then raise exception 'Profile not found'; end if;
end;
$$;

revoke all on function public.set_preferred_language(text) from public;
grant execute on function public.set_preferred_language(text) to authenticated;

do $$
begin
  alter table public.materials add constraint materials_water_not_tracked_chk
    check (code<>'water' or inventory_tracked=false) not valid;
exception when duplicate_object then null;
end $$;
