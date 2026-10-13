-- Share aggregate production totals with signed-in team members. The function
-- returns only aggregate counts, not run-level or ingredient details.
CREATE OR REPLACE FUNCTION public.production_summary(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
) RETURNS TABLE(
  total_sacks numeric,
  total_pieces bigint,
  run_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT
    COALESCE(SUM(r.mishok_count),0)::numeric AS total_sacks,
    COALESCE(SUM(COALESCE(b.pieces,0)),0)::bigint AS total_pieces,
    COUNT(*)::bigint AS run_count
  FROM public.production_runs r
  LEFT JOIN LATERAL (
    SELECT SUM(pb.pieces)::bigint AS pieces
    FROM public.production_batches pb
    WHERE pb.production_run_id=r.id
  ) b ON true
  WHERE auth.uid() IS NOT NULL
    AND (p_from IS NULL OR r.production_date>=p_from)
    AND (p_to IS NULL OR r.production_date<=p_to)
    AND r.status='completed';
$$;

REVOKE ALL ON FUNCTION public.production_summary(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.production_summary(date,date) TO authenticated, service_role;
