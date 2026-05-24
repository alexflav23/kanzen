-- Wave E demo seed — proposed agent actions (so the Inbox Triage stream renders) + a few
-- search_index rows (so the ⌘K palette returns hits). No audit rows written (MigrationsIT clean).
insert into incoming_emails (id, mailbox, from_addr, subject, category, status) values
  ('45000000-0000-0000-0000-000000000001', 'deliveries@kanzen.family', 'Amazon',     'Your order has been dispatched · delivery Tue', 'Delivery', 'pending'),
  ('45000000-0000-0000-0000-000000000002', 'accounts@kanzen.family',   'Selfridges', 'Your receipt for the purchase',                 'Receipt',  'pending')
on conflict (id) do nothing;

insert into agent_actions (id, email_id, action_type, status) values
  ('46000000-0000-0000-0000-000000000001', '45000000-0000-0000-0000-000000000001', 'create_task',   'proposed'),
  ('46000000-0000-0000-0000-000000000002', '45000000-0000-0000-0000-000000000001', 'create_event',  'proposed'),
  ('46000000-0000-0000-0000-000000000003', '45000000-0000-0000-0000-000000000002', 'propose_asset', 'proposed')  -- financial → Review (F27)
on conflict (id) do nothing;

-- Denormalised search projection (F28). entity_type drives the per-role read filter.
insert into search_index (entity_type, entity_id, owner_id, title, subtitle, fts) values
  ('asset',  '47000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Royal Oak',         'Audemars Piguet watch', to_tsvector('english', 'Royal Oak Audemars Piguet watch')),
  ('asset',  '47000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Les Paul Standard', 'Gibson guitar',         to_tsvector('english', 'Les Paul Standard Gibson guitar')),
  ('vendor', '47000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Bonhams',           'auction house',         to_tsvector('english', 'Bonhams auction house'))
on conflict (entity_type, entity_id) do nothing;
