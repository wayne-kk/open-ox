-- Run once in Supabase SQL Editor after migration 010 and after you have signed in
-- with the admin account (so the UUID exists in auth.users).
--
-- Replace YOUR_ADMIN_USER_UUID with the UUID from Supabase Dashboard → Authentication → Users.

-- UPDATE projects
-- SET user_id = 'YOUR_ADMIN_USER_UUID'::uuid
-- WHERE user_id IS NULL;
