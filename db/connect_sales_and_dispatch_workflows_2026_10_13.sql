-- Connect Sales and Naan/Leposhka dispatch workflows using persisted records and RLS.
begin;

create table if not exists public.naan_dispatches (
  id uuid primary key default gen_random_uuid(),
  dispatch_date date not null default ((now() at time zone 'Asia/Bishkek')::date),
  recipient_name text not null,
  sack_count numeric(8,2) not null check (sack_count > 0 and mod(sack_count * 2, 1) = 0),
  total_pieces integer not null default 0 check (total_pieces >= 0),
  vehicle_registration text,
  driver_name text,
  status text not null default 'prepared' check (status in ('prepared','dispatched','returned','cancelled')),
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_records (
  id uuid primary key default gen_random_uuid(),
  sale_date date not null default ((now() at time zone 'Asia/Bishkek')::date),
  customer_name text not null default 'Walk-in',
  product_name text not null default 'Leposhka',
  quantity_pieces integer not null check (quantity_pieces > 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  total_amount numeric(14,2) generated always as (quantity_pieces::numeric * unit_price) stored,
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0 and paid_amount <= quantity_pieces::numeric * unit_price),
  payment_method text not null default 'cash' check (payment_method in ('cash','transfer','credit','other')),
  dispatch_id uuid references public.naan_dispatches(id) on delete set null,
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists naan_dispatches_date_idx on public.naan_dispatches(dispatch_date desc);
create index if not exists naan_dispatches_status_idx on public.naan_dispatches(status,dispatch_date desc);
create index if not exists sales_records_date_idx on public.sales_records(sale_date desc);
create index if not exists sales_records_dispatch_idx on public.sales_records(dispatch_id);
create index if not exists sales_records_creator_idx on public.sales_records(created_by,sale_date desc);

create or replace function public.set_workflow_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin new.updated_at=now(); return new; end $$;
drop trigger if exists naan_dispatches_updated_at_trg on public.naan_dispatches;
create trigger naan_dispatches_updated_at_trg before update on public.naan_dispatches for each row execute function public.set_workflow_updated_at();
drop trigger if exists sales_records_updated_at_trg on public.sales_records;
create trigger sales_records_updated_at_trg before update on public.sales_records for each row execute function public.set_workflow_updated_at();

alter table public.naan_dispatches enable row level security;
alter table public.sales_records enable row level security;

drop policy if exists naan_dispatches_select on public.naan_dispatches;
create policy naan_dispatches_select on public.naan_dispatches for select to authenticated
using (public.is_admin() or (public.is_role('naan') and created_by=auth.uid()) or (public.is_role('sales') and status='dispatched'));
drop policy if exists naan_dispatches_insert on public.naan_dispatches;
create policy naan_dispatches_insert on public.naan_dispatches for insert to authenticated
with check ((public.is_admin() or public.is_role('naan')) and created_by=auth.uid());
drop policy if exists naan_dispatches_update on public.naan_dispatches;
create policy naan_dispatches_update on public.naan_dispatches for update to authenticated
using (public.is_admin() or (public.is_role('naan') and created_by=auth.uid()))
with check (public.is_admin() or (public.is_role('naan') and created_by=auth.uid()));
drop policy if exists naan_dispatches_delete on public.naan_dispatches;
create policy naan_dispatches_delete on public.naan_dispatches for delete to authenticated
using (public.is_admin() or (public.is_role('naan') and created_by=auth.uid() and status='prepared'));

drop policy if exists sales_records_select on public.sales_records;
create policy sales_records_select on public.sales_records for select to authenticated
using (public.is_admin() or public.is_role('sales'));
drop policy if exists sales_records_insert on public.sales_records;
create policy sales_records_insert on public.sales_records for insert to authenticated
with check ((public.is_admin() or public.is_role('sales')) and created_by=auth.uid());
drop policy if exists sales_records_update on public.sales_records;
create policy sales_records_update on public.sales_records for update to authenticated
using (public.is_admin() or (public.is_role('sales') and created_by=auth.uid()))
with check (public.is_admin() or (public.is_role('sales') and created_by=auth.uid()));
drop policy if exists sales_records_delete on public.sales_records;
create policy sales_records_delete on public.sales_records for delete to authenticated
using (public.is_admin() or (public.is_role('sales') and created_by=auth.uid()));

grant select,insert,update,delete on public.naan_dispatches to authenticated;
grant select,insert,update,delete on public.sales_records to authenticated;
commit;
notify pgrst,'reload schema';
