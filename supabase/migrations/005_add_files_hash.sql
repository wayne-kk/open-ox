-- Add files_hash column for preview change detection.
-- startDevServer compares local file fingerprint against this value
-- to decide whether to reuse the existing sandbox or rebuild.

alter table projects add column if not exists files_hash text;
