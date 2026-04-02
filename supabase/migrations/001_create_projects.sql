-- Projects table for open-ox
-- Run this in your Supabase SQL editor or via supabase db push

create table if not exists projects (
  id                   text primary key,
  name                 text not null,
  user_prompt          text not null,
  status               text not null check (status in ('generating', 'ready', 'failed')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  completed_at         timestamptz,
  error                text,
  verification_status  text check (verification_status in ('passed', 'failed')),
  blueprint            jsonb,
  build_steps          jsonb,
  generated_files      text[],
  log_directory        text,
  modification_history jsonb not null default '[]'::jsonb
);

-- Index for listing projects by creation time (most common query)
create index if not exists projects_created_at_idx on projects (created_at desc);

-- Storage bucket for generated site files
-- Run this once in Supabase dashboard → Storage → New bucket
-- Name: project-files, Public: false
