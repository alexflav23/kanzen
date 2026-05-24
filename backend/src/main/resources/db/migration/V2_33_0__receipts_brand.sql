-- F13 — receipts gain a source-document link + property; line items gain brand/product
-- resolution (powers product-level spend queries, F32) + a parsed quantity.
alter table receipts
  add column document_id uuid references documents(id),
  add column property_id uuid references properties(id);

alter table receipt_line_items
  add column brand_norm text,
  add column product_id uuid references products(id),
  add column quantity   numeric;

create index receipt_line_items_brand_idx on receipt_line_items (brand_norm);

-- Finance carve-out: Manager manages receipts; Staff none; Principal via '*'.
insert into permission_rules (role_name, resource, field, level) values
  ('manager', 'receipt', null, 'write')
on conflict (role_name, resource, field) do nothing;
