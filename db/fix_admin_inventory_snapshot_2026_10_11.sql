-- DoughFlow inventory RPC repair (2026-10-11)
-- Safe to rerun. Restores the Admin-only date-wise history and balance snapshot RPCs
-- that the mobile Inventory editor calls. Does not alter or delete inventory rows.
begin;

create or replace function public.admin_inventory_history(p_effective_date date)
returns table(transaction_id uuid,effective_date date,material_code text,material_name text,
  direction text,qty_base numeric,reason text,package_count numeric,package_label text,
  created_by_name text,created_at timestamptz)
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Not authorized'; end if;
  if p_effective_date is null or p_effective_date>(now() at time zone 'Asia/Bishkek')::date then
    raise exception 'Choose today or a past date';
  end if;
  return query
  select t.id,t.effective_date,t.material_code,m.name,t.direction::text,t.qty_base,t.reason,
    t.package_count,t.package_label,coalesce(p.full_name,'Unknown'),t.created_at
  from public.inventory_transactions t join public.materials m on m.code=t.material_code
  left join public.profiles p on p.id=t.created_by
  where t.effective_date=p_effective_date and m.inventory_tracked and m.active
  order by t.created_at desc,t.id desc;
end $$;

create or replace function public.admin_inventory_snapshot(p_effective_date date)
returns table(material_code text,stock numeric)
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Not authorized'; end if;
  if p_effective_date is null or p_effective_date>(now() at time zone 'Asia/Bishkek')::date then
    raise exception 'Choose today or a past date';
  end if;
  return query
  select m.code,coalesce(sum(case when t.direction='in' then t.qty_base
    when t.direction='out' then -t.qty_base else t.qty_base end),0)::numeric
  from public.materials m left join public.inventory_transactions t
    on t.material_code=m.code and t.effective_date<=p_effective_date
  where m.active and m.inventory_tracked group by m.code order by m.code;
end $$;

revoke all on function public.admin_inventory_history(date) from public;
revoke all on function public.admin_inventory_snapshot(date) from public;
grant execute on function public.admin_inventory_history(date) to authenticated;
grant execute on function public.admin_inventory_snapshot(date) to authenticated;

commit;

-- Ask PostgREST/Supabase to refresh its API schema cache immediately.
notify pgrst, 'reload schema';
