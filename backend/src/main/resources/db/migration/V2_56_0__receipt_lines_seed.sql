-- F13 demo seed — a parsed grocery receipt with line items (brand-normalised + categorised)
-- so the Receipts surface shows product-level detail. (ReceiptApiIT scopes to its own inserts.)
insert into receipts (id, owner_id, kind, merchant, total_minor, currency, status) values
  ('4b000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'receipt', 'Waitrose', 5470, 'GBP', 'parsed')
on conflict (id) do nothing;

insert into receipt_line_items (receipt_id, line_no, description, total_minor, currency, brand_norm, suggested_category, status) values
  ('4b000000-0000-0000-0000-000000000001', 1, 'Nespresso pods Arpeggio',  3200, 'GBP', 'nespresso',  'Groceries', 'parsed'),
  ('4b000000-0000-0000-0000-000000000001', 2, 'Frantoia olive oil 1L',    1280, 'GBP', 'frantoia',   'Groceries', 'parsed'),
  ('4b000000-0000-0000-0000-000000000001', 3, 'Finish dishwasher tablets', 990, 'GBP', 'finish',     'Household', 'parsed')
on conflict do nothing;
