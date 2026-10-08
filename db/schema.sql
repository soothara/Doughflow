-- DoughFlow v1 database schema for Supabase/PostgreSQL.
-- Run in Supabase SQL Editor.
-- Do NOT place a service-role key in the browser.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('admin','hamurchi','naan','sales');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.inventory_direction as enum ('in','out','adjust');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'hamurchi',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists preferred_language text not null default 'en' check (preferred_language in ('en','ru','ky'));

create table if not exists public.materials (
  code text primary key,
  name text not null,
  base_unit text not null,
  decimals integer not null default 2,
  package_options jsonb not null default '[]'::jsonb,
  active boolean not null default true
);

create table if not exists public.recipe_versions (
  id uuid primary key default gen_random_uuid(),
  version_number integer not null,
  active boolean not null default false,
  effective_from date not null default current_date,
  created_by uuid references auth.users(id),
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists recipe_versions_version_uq on public.recipe_versions(version_number);
create unique index if not exists recipe_versions_one_active_uq on public.recipe_versions(active) where active;

create table if not exists public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_version_id uuid not null references public.recipe_versions(id) on delete cascade,
  material_code text not null references public.materials(code),
  qty_per_mishok numeric(14,4) not null check (qty_per_mishok >= 0),
  unit text not null,
  note text,
  sort_order integer not null default 0
);
create index if not exists recipe_items_version_idx on public.recipe_items(recipe_version_id);

create table if not exists public.production_runs (
  id uuid primary key default gen_random_uuid(),
  production_date date not null default current_date,
  created_by uuid not null references auth.users(id),
  mishok_count numeric(8,2) not null check (mishok_count > 0),
  recipe_version_id uuid not null references public.recipe_versions(id),
  status text not null default 'completed' check (status in ('draft','completed','void')),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists production_runs_date_idx on public.production_runs(production_date);

create table if not exists public.production_batches (
  id uuid primary key default gen_random_uuid(),
  production_run_id uuid not null references public.production_runs(id) on delete cascade,
  batch_no integer not null,
  mishok_fraction numeric(4,2) not null check (mishok_fraction > 0 and mishok_fraction <= 1),
  pieces integer not null default 0 check (pieces >= 0)
);
create unique index if not exists production_batches_uq on public.production_batches(production_run_id,batch_no);

create table if not exists public.production_materials (
  id uuid primary key default gen_random_uuid(),
  production_run_id uuid not null references public.production_runs(id) on delete cascade,
  material_code text not null references public.materials(code),
  expected_qty numeric(16,4) not null check (expected_qty >= 0),
  actual_qty numeric(16,4) not null check (actual_qty >= 0),
  unit text not null
);
create unique index if not exists production_materials_uq on public.production_materials(production_run_id,material_code);

create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  material_code text not null references public.materials(code),
  direction public.inventory_direction not null,
  qty_base numeric(16,4) not null,
  reason text not null,
  package_count numeric(14,3),
  package_label text,
  production_run_id uuid references public.production_runs(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists inventory_tx_material_idx on public.inventory_transactions(material_code,created_at);

create or replace view public.inventory_balances as
select m.code,m.name,m.base_unit,
       coalesce(sum(case when t.direction='in' then t.qty_base when t.direction='out' then -t.qty_base else t.qty_base end),0) as stock
from public.materials m
left join public.inventory_transactions t on t.material_code=m.code
group by m.code,m.name,m.base_unit;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin');
$$;

create or replace function public.is_role(r public.app_role) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role=r);
$$;

-- Protect the profiles table.
alter table public.profiles enable row level security;
alter table public.materials enable row level security;
alter table public.recipe_versions enable row level security;
alter table public.recipe_items enable row level security;
alter table public.production_runs enable row level security;
alter table public.production_batches enable row level security;
alter table public.production_materials enable row level security;
alter table public.inventory_transactions enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (auth.uid()=id or public.is_admin());

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists materials_read on public.materials;
create policy materials_read on public.materials for select using (auth.uid() is not null);
drop policy if exists materials_admin_write on public.materials;
create policy materials_admin_write on public.materials for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists recipes_read on public.recipe_versions;
create policy recipes_read on public.recipe_versions for select using (auth.uid() is not null);
drop policy if exists recipes_write on public.recipe_versions;
create policy recipes_write on public.recipe_versions for insert with check (public.is_admin() or public.is_role('hamurchi'));
drop policy if exists recipes_update on public.recipe_versions;
create policy recipes_update on public.recipe_versions for update using (public.is_admin() or public.is_role('hamurchi')) with check (public.is_admin() or public.is_role('hamurchi'));

drop policy if exists recipe_items_read on public.recipe_items;
create policy recipe_items_read on public.recipe_items for select using (auth.uid() is not null);
drop policy if exists recipe_items_write on public.recipe_items;
create policy recipe_items_write on public.recipe_items for all using (public.is_admin() or public.is_role('hamurchi')) with check (public.is_admin() or public.is_role('hamurchi'));

-- Production: admin and hamurchi can write. Others can only read their permitted data through the app.
drop policy if exists production_read on public.production_runs;
create policy production_read on public.production_runs for select using (public.is_admin() or created_by=auth.uid());
drop policy if exists production_insert on public.production_runs;
create policy production_insert on public.production_runs for insert with check (public.is_admin() or public.is_role('hamurchi'));

drop policy if exists production_batches_read on public.production_batches;
create policy production_batches_read on public.production_batches for select using (exists(select 1 from public.production_runs r where r.id=production_run_id and (public.is_admin() or r.created_by=auth.uid())));
drop policy if exists production_batches_write on public.production_batches;
create policy production_batches_write on public.production_batches for all using (exists(select 1 from public.production_runs r where r.id=production_run_id and (public.is_admin() or r.created_by=auth.uid()))) with check (exists(select 1 from public.production_runs r where r.id=production_run_id and (public.is_admin() or r.created_by=auth.uid())));

drop policy if exists production_materials_read on public.production_materials;
create policy production_materials_read on public.production_materials for select using (exists(select 1 from public.production_runs r where r.id=production_run_id and (public.is_admin() or r.created_by=auth.uid())));
drop policy if exists production_materials_write on public.production_materials;
create policy production_materials_write on public.production_materials for all using (exists(select 1 from public.production_runs r where r.id=production_run_id and (public.is_admin() or r.created_by=auth.uid()))) with check (exists(select 1 from public.production_runs r where r.id=production_run_id and (public.is_admin() or r.created_by=auth.uid())));

-- Inventory: everyone authorized can read balances, but manual stock-in/adjustment remains admin-only.
drop policy if exists inventory_read on public.inventory_transactions;
create policy inventory_read on public.inventory_transactions for select using (public.is_admin() or created_by=auth.uid());
drop policy if exists inventory_admin_insert on public.inventory_transactions;
create policy inventory_admin_insert on public.inventory_transactions for insert with check (public.is_admin());

-- Atomic production completion. Consumption is always recipe_qty_per_mishok × mishok_count.
create or replace function public.complete_production(
  p_production_date date,
  p_mishok_count numeric,
  p_recipe_version_id uuid,
  p_batches jsonb,
  p_consumption jsonb default null
) returns uuid
language plpgsql security definer set search_path=public
as $$
declare
  v_run uuid;
  r record;
  v_expected numeric;
  v_actual numeric;
  v_unit text;
begin
  if not (public.is_admin() or public.is_role('hamurchi')) then
    raise exception 'Not authorized';
  end if;
  if p_mishok_count <= 0 then raise exception 'Invalid mishok count'; end if;

  insert into public.production_runs(production_date,created_by,mishok_count,recipe_version_id,status)
  values(p_production_date,auth.uid(),p_mishok_count,p_recipe_version_id,'completed') returning id into v_run;

  insert into public.production_batches(production_run_id,batch_no,mishok_fraction,pieces)
  select v_run, (x->>'batch_no')::integer, (x->>'mishok_fraction')::numeric, coalesce((x->>'pieces')::integer,0)
  from jsonb_array_elements(p_batches) x;

  for r in select material_code,qty_per_mishok,unit from public.recipe_items where recipe_version_id=p_recipe_version_id loop
    v_expected := r.qty_per_mishok*p_mishok_count;
    v_actual := coalesce((select (x->>'actual_qty')::numeric from jsonb_array_elements(coalesce(p_consumption,'[]'::jsonb)) x where x->>'material_code'=r.material_code limit 1),v_expected);
    v_unit := r.unit;
    insert into public.production_materials(production_run_id,material_code,expected_qty,actual_qty,unit)
    values(v_run,r.material_code,v_expected,v_actual,v_unit);
    insert into public.inventory_transactions(material_code,direction,qty_base,reason,production_run_id,created_by)
    values(r.material_code,'out',v_actual,'Automatic production consumption',v_run,auth.uid());
  end loop;
  return v_run;
end;
$$;

-- Create a new immutable recipe version and activate it atomically.
create or replace function public.create_recipe_version(p_items jsonb, p_note text default null) returns uuid
language plpgsql security definer set search_path=public
as $$
declare
  v_version integer; v_id uuid;
  x jsonb;
begin
  if not (public.is_admin() or public.is_role('hamurchi')) then raise exception 'Not authorized'; end if;
  select coalesce(max(version_number),0)+1 into v_version from public.recipe_versions;
  update public.recipe_versions set active=false where active=true;
  insert into public.recipe_versions(version_number,active,created_by,note) values(v_version,true,auth.uid(),p_note) returning id into v_id;
  for x in select * from jsonb_array_elements(p_items) loop
    insert into public.recipe_items(recipe_version_id,material_code,qty_per_mishok,unit,note,sort_order)
    values(v_id,x->>'code',(x->>'qty')::numeric,x->>'unit',x->>'note',coalesce((x->>'sort_order')::integer,0));
  end loop;
  return v_id;
end;
$$;

-- Seed materials.
insert into public.materials(code,name,base_unit,decimals,package_options) values
('flour','Flour','kg',2,'[{"label":"Bulk","qty":1}]'),
('water','Water','kg',2,'[{"label":"Bulk","qty":1}]'),
('oil','Oil','kg',2,'[{"label":"20 kg carton","qty":20}]'),
('salt','Salt','kg',3,'[{"label":"1 kg packet","qty":1},{"label":"750 g packet","qty":0.75},{"label":"20 × 1 kg bundle","qty":20}]'),
('sugar','Sugar','kg',2,'[{"label":"Bulk","qty":1}]'),
('yeast','Yeast','kg',3,'[{"label":"500 g packet","qty":0.5},{"label":"20 × 500 g box","qty":10}]')
on conflict (code) do update set package_options=excluded.package_options, name=excluded.name;

-- Seed first recipe version once.
insert into public.recipe_versions(version_number,active,note)
select 1,true,'Initial DoughFlow recipe'
where not exists(select 1 from public.recipe_versions);

insert into public.recipe_items(recipe_version_id,material_code,qty_per_mishok,unit,note,sort_order)
select rv.id,v.code,v.qty,v.unit,v.note,v.ord
from public.recipe_versions rv
cross join (values
 ('flour',50::numeric,'kg','Operational reference per mishok; actual flour is not weighed for the entry screen.',1),
 ('water',31.2::numeric,'kg','Combined water; no hot/cold split.',2),
 ('oil',1::numeric,'kg','Standard.',3),
 ('yeast',0.045::numeric,'kg','Default 45 g; operational range 35–55 g.',4),
 ('salt',1.2::numeric,'kg','1 kg or 750 g packets.',5),
 ('sugar',0.5::numeric,'kg','Standard.',6)
) v(code,qty,unit,note,ord)
where rv.version_number=1
and not exists(select 1 from public.recipe_items ri where ri.recipe_version_id=rv.id and ri.material_code=v.code);
