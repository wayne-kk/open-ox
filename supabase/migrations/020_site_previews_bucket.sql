-- Public static preview: Supabase Storage bucket + optional DB columns for sync status.
-- Server uploads use SUPABASE_SERVICE_ROLE_KEY (bypasses RLS). Only public read is required for browsers.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-previews',
  'site-previews',
  true,
  52428800,
  null
)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "site_previews_public_select" on storage.objects;
create policy "site_previews_public_select"
on storage.objects for select
to public
using (bucket_id = 'site-previews');

alter table projects add column if not exists static_preview_synced_at timestamptz;
alter table projects add column if not exists static_preview_last_error text;
