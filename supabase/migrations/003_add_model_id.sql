-- Add model_id column to track which model was used for each project
ALTER TABLE projects ADD COLUMN IF NOT EXISTS model_id TEXT DEFAULT 'gemini-3-flash-preview';
