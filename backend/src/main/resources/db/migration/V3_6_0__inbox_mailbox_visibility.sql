-- W9.4: mailboxes are part of RBAC. Each mailbox has a visibility tier; combined with the existing property/assignee
-- scope it decides who sees the tab (and, server-side, who can open its threads — no bypass via the thread API).
--   staff     — any inbox-viewer in scope (staff still constrained to their property)
--   manager   — manager + principal only
--   principal — principal only
alter table mail_inboxes add column if not exists visibility text not null default 'staff';

update mail_inboxes set visibility = 'principal' where address = 'flavian@kanzen.family';     -- Principal's own mailbox
update mail_inboxes set visibility = 'manager'   where address in ('accounts@kanzen.family',  -- finances
                                                                   'lorna@kanzen.family');   -- Chief of Staff
