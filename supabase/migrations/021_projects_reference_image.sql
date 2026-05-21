-- Optional screenshot / mockup pasted at project creation (data URL), for vision in intent + generation worker.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS reference_image_data_url text;

COMMENT ON COLUMN projects.reference_image_data_url IS
  'Optional data URL (image/*) from hero or API; cleared after intent consumes it.';
