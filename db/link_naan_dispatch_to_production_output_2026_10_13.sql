-- Tie each Naan/Leposhka dispatch to a production date and enforce available output.
begin;
alter table public.naan_dispatches
  add column if not exists source_production_date date not null default ((now() at time zone 'Asia/Bishkek')::date);
create index if not exists naan_dispatches_source_production_date_idx
  on public.naan_dispatches(source_production_date,status);

create or replace function public.validate_naan_dispatch_against_production()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_available_sacks numeric;
  v_available_pieces bigint;
  v_reserved_sacks numeric;
  v_reserved_pieces bigint;
begin
  if new.status in ('cancelled','returned') then return new; end if;
  if new.total_pieces<=0 then raise exception 'Enter a positive number of dispatched pieces'; end if;
  select coalesce(sum(r.mishok_count),0),coalesce(sum(x.pieces),0)
    into v_available_sacks,v_available_pieces
  from public.production_runs r
  cross join lateral (
    select coalesce(sum(pb.pieces),0)::bigint as pieces
    from public.production_batches pb where pb.production_run_id=r.id
  ) x
  where r.production_date=new.source_production_date and r.status='completed';
  select coalesce(sum(d.sack_count),0),coalesce(sum(d.total_pieces),0)
    into v_reserved_sacks,v_reserved_pieces
  from public.naan_dispatches d
  where d.source_production_date=new.source_production_date
    and d.status in ('prepared','dispatched')
    and d.id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid);
  if v_available_pieces<=0 then
    raise exception 'No completed production with piece counts exists for the selected production date';
  end if;
  if v_reserved_pieces+new.total_pieces>v_available_pieces then
    raise exception 'Dispatch exceeds the available pieces produced on that date';
  end if;
  if v_available_sacks<=0 or v_reserved_sacks+new.sack_count>v_available_sacks then
    raise exception 'Dispatch exceeds the available sacks produced on that date';
  end if;
  return new;
end;
$$;

drop trigger if exists naan_dispatch_production_capacity_trg on public.naan_dispatches;
create trigger naan_dispatch_production_capacity_trg
before insert or update of source_production_date,sack_count,total_pieces,status
on public.naan_dispatches for each row
execute function public.validate_naan_dispatch_against_production();
revoke all on function public.validate_naan_dispatch_against_production() from anon,authenticated,public;
commit;
notify pgrst,'reload schema';
