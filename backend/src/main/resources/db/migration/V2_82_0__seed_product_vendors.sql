-- F35 — preferred vendors + buy-links for the seeded consumables shelf, so the
-- Supplies view shows the *right* place to buy (and an out/low item carries its link).
insert into product_vendors (product_id, vendor_name, buy_url, preferred) values
  ('e0000000-0000-0000-0000-000000000001', 'Nespresso',  'https://www.nespresso.com/uk/en/order/capsules/original/arpeggio', true),
  ('e0000000-0000-0000-0000-000000000002', 'Ocado',      'https://www.ocado.com/search?entry=finish%20dishwasher%20tablets', true),
  ('e0000000-0000-0000-0000-000000000003', 'Natoora',    'https://www.natoora.co.uk/products/frantoia-extra-virgin-olive-oil', true),
  ('e0000000-0000-0000-0000-000000000003', 'Waitrose',   'https://www.waitrose.com/ecom/products/frantoia', false)
on conflict do nothing;
