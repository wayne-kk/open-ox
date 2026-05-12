-- Desktop viewport cover (screenshot) metadata; file lives in Storage under project-files/{id}/.open-ox-cover/
-- Status values enforced in application: pending | ready | failed
alter table projects
  add column if not exists cover_image_status text;

alter table projects
  add column if not exists cover_image_storage_path text;

alter table projects
  add column if not exists cover_image_error text;

alter table projects
  add column if not exists cover_image_updated_at timestamptz;
