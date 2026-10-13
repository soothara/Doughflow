-- Remove direct anonymous access to admin-only inventory RPCs.
-- The functions remain executable by signed-in users; each function enforces public.is_admin().
begin;
revoke all on function public.admin_inventory_history(date) from anon, public;
revoke all on function public.admin_record_inventory_movement(text,text,text,numeric,date,text,numeric,text,text,text) from anon, public;
revoke all on function public.admin_update_inventory_transaction(uuid,text,text,numeric,date,text,numeric,text,text,text,text) from anon, public;
revoke all on function public.admin_delete_inventory_transaction(uuid,text) from anon, public;
revoke all on function public.admin_set_reorder_level(text,numeric) from anon, public;
revoke all on function public.admin_inventory_activity(date,date,text,text,text) from anon, public;
revoke all on function public.admin_inventory_audit(date,date) from anon, public;
revoke all on function public.admin_set_stock_as_of_date(text,date,numeric,text) from anon, public;

grant execute on function public.admin_inventory_history(date) to authenticated;
grant execute on function public.admin_record_inventory_movement(text,text,text,numeric,date,text,numeric,text,text,text) to authenticated;
grant execute on function public.admin_update_inventory_transaction(uuid,text,text,numeric,date,text,numeric,text,text,text,text) to authenticated;
grant execute on function public.admin_delete_inventory_transaction(uuid,text) to authenticated;
grant execute on function public.admin_set_reorder_level(text,numeric) to authenticated;
grant execute on function public.admin_inventory_activity(date,date,text,text,text) to authenticated;
grant execute on function public.admin_inventory_audit(date,date) to authenticated;
grant execute on function public.admin_set_stock_as_of_date(text,date,numeric,text) to authenticated;
commit;
