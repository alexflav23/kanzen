-- W9.2 (LinkedEmails loop): the Range Rover service proposal also carries the asset id, so confirming the calendar
-- event links the thread to the car — its AssetDetail page then answers "what mail concerns this?" (entity_links).
update agent_actions
  set payload = payload || jsonb_build_object('assetId','40000000-0000-0000-0000-000000000006')
  where id = '49300000-0000-0000-0000-000000000003';
