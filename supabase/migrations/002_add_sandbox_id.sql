-- Add E2B sandbox_id to projects table
alter table projects add column if not exists sandbox_id text;
