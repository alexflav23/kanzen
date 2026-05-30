-- W9.4b-ii: comments are editable. `updated_at` lets the UI show an "edited" badge; edit authz is enforced server-side
-- (author-only). Mentions are re-derived on edit, but `comment_mentioned` is emitted only for *newly added* mentions so
-- editing a comment doesn't double-notify the existing recipients.
alter table entity_comments add column if not exists updated_at timestamptz;
