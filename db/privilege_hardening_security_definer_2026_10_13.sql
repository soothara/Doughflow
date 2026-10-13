-- Close anonymous/direct client access to privileged security-definer RPCs.
-- The browser uses authenticated sessions for production, PIN management and preferences.
-- PIN verification is intentionally server-side and callable only by the service-role Edge Function.
BEGIN;

REVOKE ALL ON FUNCTION public.complete_production(date,numeric,uuid,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_production(date,numeric,uuid,jsonb,jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_inventory_snapshot(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_inventory_snapshot(date) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_list_pin_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_pin_users() TO authenticated;

REVOKE ALL ON FUNCTION public.admin_set_user_pin(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_pin(uuid,text,text) TO authenticated;

REVOKE ALL ON FUNCTION public.create_recipe_version(jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_recipe_version(jsonb,text) TO authenticated;

REVOKE ALL ON FUNCTION public.set_preferred_language(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_preferred_language(text) TO authenticated;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_role(public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_role(public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.verify_pin_login(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_pin_login(text,text) TO service_role;

REVOKE ALL ON FUNCTION public.audit_business_record_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
