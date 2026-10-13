-- Shared audit log and role-guarded production availability for Sales and Naan/Leposhka.
begin;

create table if not exists public.business_activity_audit (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('sales','dispatch')),
  record_id uuid not null,
  action text not null check (action in ('insert','update','delete')),
  actor_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now(),
  before_record jsonb,
  after_record jsonb
);
alter table public.business_activity_audit enable row level security;
revoke all on public.business_activity_audit from anon,authenticated;
drop policy if exists business_activity_audit_admin_read on public.business_activity_audit;
create policy business_activity_audit_admin_read on public.business_activity_audit for select to authenticated using (public.is_admin());
grant select on public.business_activity_audit to authenticated;

create or replace function public.audit_business_record_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    insert into public.business_activity_audit(entity_type,record_id,action,actor_id,after_record)
    values(tg_argv[0],new.id,'insert',auth.uid(),to_jsonb(new));
    return new;
  elsif tg_op='UPDATE' then
    insert into public.business_activity_audit(entity_type,record_id,action,actor_id,before_record,after_record)
    values(tg_argv[0],new.id,'update',auth.uid(),to_jsonb(old),to_jsonb(new));
    return new;
  else
    insert into public.business_activity_audit(entity_type,record_id,action,actor_id,before_record)
    values(tg_argv[0],old.id,'delete',auth.uid(),to_jsonb(old));
    return old;
  end if;
end;
$$;
drop trigger if exists naan_dispatch_audit_trigger on public.naan_dispatches;
create trigger naan_dispatch_audit_trigger after insert or update or delete on public.naan_dispatches
for each row execute function public.audit_business_record_change('dispatch');
drop trigger if exists sales_record_audit_trigger on public.sales_records;
create trigger sales_record_audit_trigger after insert or update or delete on public.sales_records
for each row execute function public.audit_business_record_change('sales');

create or replace function public.available_production_for_dispatch()
returns table(
  production_date date,
  produced_sacks numeric,
  produced_pieces bigint,
  reserved_sacks numeric,
  reserved_pieces bigint,
  remaining_sacks numeric,
  remaining_pieces bigint
)
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not (public.is_admin() or public.is_role('naan'::public.app_role)) then
    raise exception 'Not authorized';
  end if;
  return query
  with output_by_date as (
    select r.production_date,
      sum(r.mishok_count)::numeric as sacks,
      sum(x.pieces)::bigint as pieces
    from public.production_runs r
    cross join lateral (
      select coalesce(sum(pb.pieces),0)::bigint as pieces
      from public.production_batches pb where pb.production_run_id=r.id
    ) x
    where r.status='completed'
    group by r.production_date
  ), reserved_by_date as (
    select d.source_production_date,
      sum(d.sack_count)::numeric as sacks,
      sum(d.total_pieces)::bigint as pieces
    from public.naan_dispatches d
    where d.status in ('prepared','dispatched')
    group by d.source_production_date
  )
  select o.production_date,o.sacks,o.pieces,
    coalesce(r.sacks,0),coalesce(r.pieces,0),
    greatest(o.sacks-coalesce(r.sacks,0),0),
    greatest(o.pieces-coalesce(r.pieces,0),0)
  from output_by_date o left join reserved_by_date r on r.source_production_date=o.production_date
  order by o.production_date desc;
end;
$$;
revoke all on function public.available_production_for_dispatch() from anon,public;
grant execute on function public.available_production_for_dispatch() to authenticated;

commit;
notify pgrst,'reload schema';
