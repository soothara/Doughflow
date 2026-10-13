-- Shared production history is operational data used by Reports, Naan dispatch,
-- Sales reconciliation, and dashboard totals. Keep all writes behind the
-- validated complete_production RPC; grant only authenticated read access.
DROP POLICY IF EXISTS production_runs_team_read ON public.production_runs;
CREATE POLICY production_runs_team_read
  ON public.production_runs
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS production_batches_team_read ON public.production_batches;
CREATE POLICY production_batches_team_read
  ON public.production_batches
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.production_runs r
    WHERE r.id = production_batches.production_run_id
  ));

DROP POLICY IF EXISTS production_materials_team_read ON public.production_materials;
CREATE POLICY production_materials_team_read
  ON public.production_materials
  FOR SELECT
  TO authenticated
  USING (is_admin() OR is_role('hamurchi'::app_role));
