-- Add total_duration column to persist project generation time.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS total_duration bigint;
