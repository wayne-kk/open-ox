-- Export governance audit trail for dataset procurement

create table if not exists trajectory_export_audits (
  id                    uuid primary key default gen_random_uuid(),
  exported_at           timestamptz not null default now(),
  schema_version        text not null,
  run_id_filter         text,
  sample_count          integer not null default 0,
  record_count          integer not null default 0,
  redaction_applied     boolean not null default true,
  canary_detected       boolean not null default false,
  field_coverage        jsonb not null default '{}'::jsonb,
  sha256                text not null,
  manifest              jsonb not null default '{}'::jsonb
);

create index if not exists trajectory_export_audits_exported_at_idx
  on trajectory_export_audits (exported_at desc);

