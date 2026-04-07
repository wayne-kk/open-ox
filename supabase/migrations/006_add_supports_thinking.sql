-- Add thinking mode support flag to model configs
ALTER TABLE model_configs ADD COLUMN IF NOT EXISTS supports_thinking BOOLEAN DEFAULT false;
