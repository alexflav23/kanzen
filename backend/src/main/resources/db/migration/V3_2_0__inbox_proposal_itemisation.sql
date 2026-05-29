-- W9.2/W9.4: enrich the agent's extracted payloads with itemised detail, so a proposal can be reviewed in a popup
-- (an itemised receipt or a dated event) before the user confirms. Amounts are integer minor units (house rule).

-- Ocado — the headline receipt: 18 grocery line items summing to £142.50.
update agent_actions set payload = payload || jsonb_build_object(
  'date', (current_date)::text,
  'items', jsonb_build_array(
    jsonb_build_object('description','Whole milk 2L ×2','amountMinor',380),
    jsonb_build_object('description','Sourdough loaf','amountMinor',320),
    jsonb_build_object('description','Free-range eggs (12)','amountMinor',295),
    jsonb_build_object('description','Roast coffee beans 1kg','amountMinor',2630),
    jsonb_build_object('description','Extra-virgin olive oil 750ml','amountMinor',1290),
    jsonb_build_object('description','Chicken breasts 1kg','amountMinor',880),
    jsonb_build_object('description','Salmon fillets ×4','amountMinor',1450),
    jsonb_build_object('description','Aged ribeye steak 500g','amountMinor',1650),
    jsonb_build_object('description','Mature cheddar 400g','amountMinor',540),
    jsonb_build_object('description','Greek yoghurt 1kg','amountMinor',410),
    jsonb_build_object('description','Organic blueberries 2pk','amountMinor',560),
    jsonb_build_object('description','Sparkling water 12×500ml','amountMinor',720),
    jsonb_build_object('description','Pasta 500g ×3','amountMinor',360),
    jsonb_build_object('description','Dark chocolate 100g ×2','amountMinor',460),
    jsonb_build_object('description','Kitchen roll 4pk','amountMinor',425),
    jsonb_build_object('description','Toilet paper 9pk','amountMinor',620),
    jsonb_build_object('description','Washing-up liquid','amountMinor',280),
    jsonb_build_object('description','Sea bass whole ×2','amountMinor',980)
  ))
  where id = '49300000-0000-0000-0000-000000000001';

-- Octopus electricity bill — 3 lines summing to £214.30.
update agent_actions set payload = payload || jsonb_build_object(
  'date', (current_date - 1)::text,
  'items', jsonb_build_array(
    jsonb_build_object('description','Electricity — 412 kWh','amountMinor',18230),
    jsonb_build_object('description','Standing charge (30 days)','amountMinor',1640),
    jsonb_build_object('description','VAT','amountMinor',1560)
  ))
  where id = '49300000-0000-0000-0000-000000000004';

-- Selfridges purchase — 4 lines summing to £1,280.00.
update agent_actions set payload = payload || jsonb_build_object(
  'date', (current_date - 2)::text,
  'items', jsonb_build_array(
    jsonb_build_object('description','Cashmere scarf','amountMinor',38000),
    jsonb_build_object('description','Leather gloves','amountMinor',22000),
    jsonb_build_object('description','Eau de parfum 100ml','amountMinor',41000),
    jsonb_build_object('description','Silk tie','amountMinor',27000)
  ))
  where id = '49300000-0000-0000-0000-000000000007';

-- Amazon delivery event — time + where it's going.
update agent_actions set payload = payload || jsonb_build_object('time','by 1:00pm','location','Wardian, Apt 5206')
  where id = '49300000-0000-0000-0000-000000000002';

-- Range Rover service event — time, place, estimate.
update agent_actions set payload = payload || jsonb_build_object(
  'time','09:00', 'location','Stratstone Land Rover, Mayfair', 'estimateMinor', 95000)
  where id = '49300000-0000-0000-0000-000000000003';
