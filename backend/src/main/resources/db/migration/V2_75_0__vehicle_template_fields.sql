-- F24/Vehicles — extend the vehicle template with colour + MOT/Tax/Insurance due dates so the bespoke Vehicles
-- card can render a reg plate + due-soon pills. Still the 'vehicle' vertical (not a separate module).
update category_templates
set schema = '[
  {"key":"make","type":"string","required":false},
  {"key":"model","type":"string","required":false},
  {"key":"colour","type":"string","required":false},
  {"key":"year","type":"number","required":false},
  {"key":"registration","type":"string","required":false},
  {"key":"vin","type":"string","required":false},
  {"key":"mileage","type":"number","required":false},
  {"key":"mot_due","type":"date","required":false},
  {"key":"tax_due","type":"date","required":false},
  {"key":"insurance_due","type":"date","required":false}
]'::jsonb
where vertical_key = 'vehicle';

-- Seed the Range Rover with vehicle specifics (relative dates → live MOT-soon / insurance-overdue pills).
update assets set attributes = coalesce(attributes, '{}'::jsonb) || jsonb_build_object(
  'registration', 'KA21 NZN',
  'colour', 'Santorini Black',
  'make', 'Land Rover',
  'model', 'Range Rover Autobiography',
  'mot_due', (current_date + 18)::text,
  'tax_due', (current_date + 140)::text,
  'insurance_due', (current_date - 4)::text
) where id = '40000000-0000-0000-0000-000000000006';
