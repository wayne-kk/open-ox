-- Custom model configurations
CREATE TABLE IF NOT EXISTS model_configs (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  context_window INTEGER DEFAULT 128000,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Step-level model assignments
CREATE TABLE IF NOT EXISTS step_model_configs (
  step_name TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
