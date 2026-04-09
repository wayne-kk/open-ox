-- Optional thinking_level per generation step (e.g. generate_section → upstream chat/completions)
ALTER TABLE step_model_configs
  ADD COLUMN IF NOT EXISTS thinking_level TEXT NULL;
