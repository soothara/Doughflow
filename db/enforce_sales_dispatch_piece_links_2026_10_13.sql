-- Enforce the link between sold pieces and actually dispatched production.
begin;

create or replace function public.validate_sales_dispatch_link()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_status text;
  v_capacity integer;
  v_sold integer;
begin
  if new.dispatch_id is null then return new; end if;
  select d.status,d.total_pieces
    into v_status,v_capacity
  from public.naan_dispatches d
  where d.id=new.dispatch_id
  for share;
  if not found then raise exception 'Linked dispatch does not exist'; end if;
  if v_status<>'dispatched' then raise exception 'Sales may only link to a dispatch marked Dispatched'; end if;
  select coalesce(sum(s.quantity_pieces),0)::integer
    into v_sold
  from public.sales_records s
  where s.dispatch_id=new.dispatch_id
    and s.id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid);
  if v_sold+new.quantity_pieces>v_capacity then
    raise exception 'Sold pieces linked to this dispatch exceed the dispatched piece count';
  end if;
  return new;
end;
$$;
drop trigger if exists sales_dispatch_capacity_guard on public.sales_records;
create trigger sales_dispatch_capacity_guard
before insert or update of dispatch_id,quantity_pieces
on public.sales_records
for each row execute function public.validate_sales_dispatch_link();
revoke all on function public.validate_sales_dispatch_link() from anon,authenticated,public;

create or replace function public.prevent_dispatch_status_downgrade_with_sales()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if old.status='dispatched' and new.status<>'dispatched'
     and exists(select 1 from public.sales_records s where s.dispatch_id=old.id) then
    raise exception 'This dispatch has linked sales. Correct or unlink those sales before changing its status.';
  end if;
  return new;
end;
$$;
drop trigger if exists dispatch_linked_sales_status_guard on public.naan_dispatches;
create trigger dispatch_linked_sales_status_guard
before update of status on public.naan_dispatches
for each row execute function public.prevent_dispatch_status_downgrade_with_sales();
revoke all on function public.prevent_dispatch_status_downgrade_with_sales() from anon,authenticated,public;

commit;
notify pgrst,'reload schema';
