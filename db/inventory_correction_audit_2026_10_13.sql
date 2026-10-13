-- Add audit records for date-wise physical stock corrections.
-- Apply after db/inventory_environment_2026_10_13.sql.
create or replace function public.admin_set_stock_as_of_date(
  p_material_code text,
  p_effective_date date,
  p_target_stock numeric,
  p_reason text
) returns table(previous_stock numeric,new_stock numeric,delta numeric,transaction_id uuid)
language plpgsql security definer set search_path=public as $$
declare
  v_previous numeric;
  v_current numeric;
  v_delta numeric;
  v_min_after numeric;
  v_id uuid;
  v_after jsonb;
  v_before jsonb;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Not authorized'; end if;
  if p_effective_date is null or p_effective_date>(now() at time zone 'Asia/Bishkek')::date then
    raise exception 'Choose today or a past date';
  end if;
  if p_target_stock is null or p_target_stock<0 then raise exception 'Stock cannot be negative'; end if;
  if length(trim(coalesce(p_reason,'')))<3 then raise exception 'Enter a reason of at least 3 characters'; end if;

  perform 1 from public.materials where code=p_material_code and active and inventory_tracked for update;
  if not found then raise exception 'Material is not tracked as inventory'; end if;

  select coalesce(sum(case when direction='in' then qty_base when direction='out' then -qty_base else qty_base end),0)
    into v_previous from public.inventory_transactions
    where material_code=p_material_code and effective_date<=p_effective_date;
  select coalesce(sum(case when direction='in' then qty_base when direction='out' then -qty_base else qty_base end),0)
    into v_current from public.inventory_transactions where material_code=p_material_code;

  v_delta:=p_target_stock-v_previous;
  if v_current+v_delta < -0.00005 then raise exception 'Historical correction would make current inventory negative; reconcile later transactions first'; end if;

  select min(day_balances.balance_after_delta) into v_min_after
  from (
    select d.effective_date,
      sum(d.daily_delta) over(order by d.effective_date rows between unbounded preceding and current row) as balance_after_delta
    from (
      select t.effective_date,
        sum(case when t.direction='in' then t.qty_base when t.direction='out' then -t.qty_base else t.qty_base end) as daily_delta
      from public.inventory_transactions t where t.material_code=p_material_code group by t.effective_date
    ) d
  ) day_balances
  where day_balances.effective_date>=p_effective_date;
  if v_min_after is not null and v_min_after+v_delta < -0.00005 then
    raise exception 'Historical correction would make a later daily inventory balance negative; reconcile later transactions first';
  end if;
  if abs(v_delta)<0.00005 then return query select v_previous,v_previous,0::numeric,null::uuid; return; end if;

  insert into public.inventory_transactions(material_code,direction,qty_base,reason,package_count,package_label,created_by,effective_date,movement_type)
  values(p_material_code,case when v_delta>0 then 'in'::public.inventory_direction else 'out'::public.inventory_direction end,
    abs(v_delta),'Historical stock correction: '||trim(p_reason),null,'Manual correction',auth.uid(),p_effective_date,'adjustment')
  returning id into v_id;

  select to_jsonb(t) into v_after from public.inventory_transactions t where t.id=v_id;
  v_before:=jsonb_build_object(
    'material_code',p_material_code,
    'effective_date',p_effective_date,
    'stock_before',v_previous,
    'target_stock',p_target_stock,
    'reason',trim(p_reason)
  );
  insert into public.inventory_transaction_audit(transaction_id,action,actor_id,before_record,after_record,note)
  values(v_id,'update',auth.uid(),v_before,v_after,'Admin date-wise physical stock correction: '||trim(p_reason));

  return query select v_previous,p_target_stock,v_delta,v_id;
end;
$$;

revoke all on function public.admin_set_stock_as_of_date(text,date,numeric,text) from public;
grant execute on function public.admin_set_stock_as_of_date(text,date,numeric,text) to authenticated;
