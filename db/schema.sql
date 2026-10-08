-- DoughFlow v1 schema
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'hamurchi',
  preferred_language text not null default 'en' check (preferred_language in ('en','ru','ky')),
  created_at timestamptz not null default now()
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'kg',
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id),
  transaction_type text not null check (transaction_type in ('stock_in','stock_out','adjustment')),
  quantity_kg numeric not null,
  package_label text,
  reference_type text,
  reference_id uuid,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  material_id uuid not null references public.materials(id),
  quantity_kg numeric not null,
  note text
);

create table if not exists public.production_batches (
  id uuid primary key default gen_random_uuid(),
  mishok_count numeric not null,
  piece_count integer,
  recipe_id uuid references public.recipes(id),
  status text not null default 'completed',
  actual_consumption jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.materials enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_items enable row level security;
alter table public.production_batches enable row level security;
