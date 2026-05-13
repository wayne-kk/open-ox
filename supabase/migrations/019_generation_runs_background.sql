-- Background generation: queue + step events (worker claim + progress replay)

CREATE TABLE IF NOT EXISTS generation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  kind TEXT NOT NULL CHECK (kind IN ('new', 'retry', 'resume')),
  resume_from_checkpoint BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  lease_owner TEXT,
  lease_until TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS generation_runs_status_created_idx
  ON generation_runs (status, created_at);

CREATE INDEX IF NOT EXISTS generation_runs_project_id_idx
  ON generation_runs (project_id);

CREATE TABLE IF NOT EXISTS generation_events (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES generation_runs (id) ON DELETE CASCADE,
  seq BIGINT NOT NULL,
  step JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, seq)
);

CREATE INDEX IF NOT EXISTS generation_events_run_seq_idx ON generation_events (run_id, seq);

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS current_generation_run_id UUID REFERENCES generation_runs (id) ON DELETE SET NULL;

ALTER TABLE generation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "generation_runs_select_own" ON generation_runs;
CREATE POLICY "generation_runs_select_own"
  ON generation_runs FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = generation_runs.project_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "generation_runs_insert_own" ON generation_runs;
CREATE POLICY "generation_runs_insert_own"
  ON generation_runs FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = generation_runs.project_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "generation_runs_update_own" ON generation_runs;
CREATE POLICY "generation_runs_update_own"
  ON generation_runs FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = generation_runs.project_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = generation_runs.project_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "generation_events_select_own" ON generation_events;
CREATE POLICY "generation_events_select_own"
  ON generation_events FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM generation_runs gr
      JOIN projects p ON p.id = gr.project_id
      WHERE gr.id = generation_events.run_id AND p.user_id = auth.uid()
    )
  );

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
  ORDER BY gr.created_at ASC
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
