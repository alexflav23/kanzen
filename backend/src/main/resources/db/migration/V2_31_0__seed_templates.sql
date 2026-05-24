-- F22 — seed typed attribute templates for the core verticals (all non-required, so
-- existing assets validate; the test creates its own required-field template).
insert into category_templates (vertical_key, name, schema) values
  ('watch', 'Watch', '[{"key":"serial","type":"string","required":false},{"key":"movement","type":"string","required":false},{"key":"case_mm","type":"number","required":false}]'::jsonb),
  ('guitar', 'Guitar', '[{"key":"year","type":"number","required":false},{"key":"body_wood","type":"string","required":false},{"key":"scale_in","type":"number","required":false}]'::jsonb),
  ('art', 'Art', '[{"key":"medium","type":"string","required":false},{"key":"year","type":"number","required":false}]'::jsonb);
