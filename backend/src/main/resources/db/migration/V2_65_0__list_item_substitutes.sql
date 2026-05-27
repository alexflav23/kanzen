-- F08 — substitutions: a list item can carry "sub items" (alternatives to buy if the primary is
-- out of stock). A substitute is a list_item whose substitute_for points at its parent item.
alter table list_items add column if not exists substitute_for uuid references list_items (id) on delete cascade;
create index if not exists list_items_substitute_for_idx on list_items (substitute_for);
