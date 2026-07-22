-- Inline generation inserts runs as already leased/running so shared legacy
-- workers can never win the enqueue-to-claim race. Any executor may recover a
-- genuinely abandoned run only after its heartbeat-backed lease expires.

CREATE OR REPLACE FUNCTION claim_next_generation_run(p_worker text, p_lease_seconds int)
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
  WHERE gr.status = 'queued'
     OR (
       gr.status = 'running'
       AND gr.lease_until IS NOT NULL
       AND gr.lease_until < NOW()
     )
  ORDER BY
    CASE WHEN gr.status = 'queued' THEN 0 ELSE 1 END,
    gr.created_at ASC
  LIMIT 1
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

REVOKE ALL ON FUNCTION claim_next_generation_run(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_next_generation_run(text, int) TO service_role;
GRANT EXECUTE ON FUNCTION claim_next_generation_run(text, int) TO postgres;
