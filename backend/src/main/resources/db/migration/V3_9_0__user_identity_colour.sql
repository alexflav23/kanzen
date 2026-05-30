-- F47: identity colour — a person *is* their colour. Stored on the login user (not on the HR record), used as a
-- rounded glow ring around the avatar everywhere. Values: a palette key ("indigo", "coral", ...) or a custom hex.
-- Server-side validation lives in the API; the column accepts any text.

alter table users add column if not exists colour text not null default '';

-- Backfill existing users with a hash-derived palette key so day-one is already legible without anyone opening the
-- picker. The 12-key palette (alphabetical for stability) is fixed in code; the bucket is hash(id) % 12. New users
-- get the same treatment at create time in the API.
update users set colour = (
  case (abs(hashtext(id::text)) % 12)
    when 0  then 'amber'
    when 1  then 'azure'
    when 2  then 'coral'
    when 3  then 'gold'
    when 4  then 'indigo'
    when 5  then 'lime'
    when 6  then 'magenta'
    when 7  then 'mint'
    when 8  then 'rose'
    when 9  then 'slate'
    when 10 then 'teal'
    else         'violet'
  end
)
where colour = '';
