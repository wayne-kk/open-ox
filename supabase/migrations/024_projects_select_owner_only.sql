-- Revert authenticated global SELECT on projects (migration 011).
-- Workspace lists are owner-only; Community reads land in a later migration via publish_preview.

drop policy if exists "projects_select_authenticated" on projects;

create policy "projects_select_own"
  on projects for select
  using (user_id = (select auth.uid()));
