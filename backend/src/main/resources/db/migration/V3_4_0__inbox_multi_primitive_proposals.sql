-- W9.4: the agent picks the right primitive per email (not just events/receipts). These seeds demonstrate the model
-- choosing a TASK and a LIST item — alongside the existing event/receipt proposals — so the breadth is visible.

-- Eleanor's personal email → a TASK (the model turns "shall I book Marcus?" into an actionable to-do, assigned to Lorna).
insert into agent_actions (id, email_id, thread_id, action_type, status, title, summary, confidence) values
  ('49300000-0000-0000-0000-000000000005', null, '49100000-0000-0000-0000-000000000005', 'create_task', 'proposed',
   'Book Marcus for dinner on the 14th',
   'Eleanor asked — turn it into a task for Lorna, due the 14th.', 0.82)
on conflict (id) do nothing;
update agent_actions set payload = jsonb_build_object(
  'title','Book Marcus for dinner on the 14th',
  'date',(date_trunc('month', current_date) + interval '1 month' + interval '13 days')::date::text,
  'priority','normal',
  'assigneeId','50000000-0000-0000-0000-000000000002')
  where id = '49300000-0000-0000-0000-000000000005';

-- A housekeeper note → ADD ITEMS TO THE GROCERY LIST (the model routes to the list primitive, not a receipt/event).
insert into email_threads (id, owner_id, inbox_id, subject, snippet, from_name, last_message_at, unread, has_attachments, status, assignee_id) values
  ('49100000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000001','49000000-0000-0000-0000-000000000003',
   'A few things for the next order','Could you add coffee, olive oil, kitchen roll + extra loo roll?','Marcia',
   now() - interval '20 minutes', true, false, 'open','50000000-0000-0000-0000-000000000003')
on conflict (id) do nothing;
insert into email_messages (id, owner_id, thread_id, direction, from_addr, to_addrs, subject, body_text, sent_at) values
  ('49200000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000001','49100000-0000-0000-0000-000000000008',
   'inbound','marcia@kanzen.family','groceries@kanzen.family','A few things for the next order',
   'Hi — could you add these to the next Ocado order please: coffee beans, a bottle of olive oil, kitchen roll, and an extra pack of loo roll (we''re nearly out). Thanks, Marcia',
   now() - interval '20 minutes')
on conflict (id) do nothing;
insert into agent_actions (id, email_id, thread_id, action_type, status, title, summary, confidence) values
  ('49300000-0000-0000-0000-000000000008', null, '49100000-0000-0000-0000-000000000008', 'add_to_list', 'proposed',
   'Add 4 items to Weekly groceries',
   'Marcia asked to add coffee, olive oil, kitchen roll and extra toilet paper to the next order.', 0.91)
on conflict (id) do nothing;
update agent_actions set payload = jsonb_build_object(
  'listId','c0000000-0000-0000-0000-000000000001',
  'items', jsonb_build_array(
    jsonb_build_object('description','Coffee beans','qty',1),
    jsonb_build_object('description','Extra-virgin olive oil','qty',1),
    jsonb_build_object('description','Kitchen roll (4pk)','qty',1),
    jsonb_build_object('description','Toilet paper (9pk)','qty',2)))
  where id = '49300000-0000-0000-0000-000000000008';
