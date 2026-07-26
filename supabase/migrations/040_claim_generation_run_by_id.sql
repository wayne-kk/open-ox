-- Redis carries only a wake-up signal. This RPC remains the atomic database
-- boundary that grants a queued (or expired) run to one worker.
CREATE OR REPLACE FUNCTION claim_generation_run_by_id(
  p_run_id uuid,
  p_worker text,
  p_lease_seconds int
)
RETURNS SETOF generation_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r generation_runs%ROWTYPE;
BEGIN
  SELECT * INTO r
  FROM generation_runs gr
  WHERE gr.id = p_run_id
    AND (
      gr.status = 'queued'
      OR (
        gr.status = 'running'
        AND gr.lease_until IS NOT NULL
        AND gr.lease_until < NOW()
      )
    )
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE generation_runs
     SET status = 'running',
         lease_owner = p_worker,
         lease_until = NOW() + (p_lease_seconds * interval '1 second'),
         last_heartbeat_at = NOW(),
         started_at = COALESCE(started_at, NOW()),
         updated_at = NOW()
   WHERE id = r.id;

  RETURN QUERY SELECT * FROM generation_runs WHERE id = r.id;
END;
$$;

REVOKE ALL ON FUNCTION claim_generation_run_by_id(uuid, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_generation_run_by_id(uuid, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION claim_generation_run_by_id(uuid, text, int) TO postgres;
