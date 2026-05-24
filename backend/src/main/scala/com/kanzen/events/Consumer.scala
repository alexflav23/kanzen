package com.kanzen.events

import doobie.ConnectionIO

/** F34 — an independent, idempotent consumer of the unified event stream. In production each consumer is a separate
  * Pulsar subscription with its own retry/DLQ; in sandbox they run in-process inside the relay's transaction (so
  * `handle` must be idempotent — dedup by `event_id` — because a redelivered event re-runs it).
  */
trait Consumer {
  def name: String
  def handle(evt: EventRepo.OutboxRow): ConnectionIO[Unit]
}
