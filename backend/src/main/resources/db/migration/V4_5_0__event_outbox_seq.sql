-- F48 RT.1b — a monotonic cursor on the event outbox so a websocket can resume after a disconnect: on reconnect the
-- client sends the highest seq it has seen and the server replays everything after it (durable here, authz-filtered on
-- the way out). bigserial backfills existing rows + auto-increments on every future insert.
alter table event_outbox add column seq bigserial;
create index event_outbox_seq_idx on event_outbox (seq);
