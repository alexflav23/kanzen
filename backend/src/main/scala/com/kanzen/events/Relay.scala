package com.kanzen.events

import cats.effect.{IO, Temporal}
import cats.syntax.all._
import doobie.implicits._
import doobie.util.transactor.Transactor

import scala.concurrent.duration._

/** F34 transactional-outbox relay. Reads unpublished events, applies each consumer, then marks the event published —
  * per event, in one transaction. A crash before commit leaves the event unpublished, so the next drain resumes it
  * exactly where it left off (AC3: at-least-once; consumers dedup). In production this publishes to Pulsar and
  * consumers are independent apps with per-subscription DLQ (AC4) — that transport is infra, deferred to hardening; the
  * sandbox runs consumers in-process.
  */
object Relay {

  /** Drain all currently-unpublished events once inside one tx; returns the rows processed (durable consumers ran + the
    * rows were marked published).
    */
  private def drainTx(consumers: List[Consumer]): doobie.ConnectionIO[List[EventRepo.OutboxRow]] =
    for {
      rows <- EventRepo.unpublishedRows
      _ <- rows.traverse_(r => consumers.traverse_(_.handle(r)) *> EventRepo.markPublished(r.id).void)
    } yield rows

  /** Drain all currently-unpublished events once; returns how many were processed. */
  def drainOnce(xa: Transactor[IO], consumers: List[Consumer]): IO[Int] =
    drainTx(consumers).transact(xa).map(_.size)

  /** Boot fiber: poll the outbox forever. A failed drain is logged-and-retried (events stay unpublished), so a
    * transient consumer error never loses an event. After each durable drain commits, the published rows are handed to
    * `sink` (best-effort) — F48 uses this to push to the in-process realtime hub. A sink failure never blocks the
    * durable path (the row is already published; the realtime push is fire-and-forget).
    */
  def run(
      xa: Transactor[IO],
      consumers: List[Consumer],
      every: FiniteDuration = 5.seconds,
      sink: EventRepo.OutboxRow => IO[Unit] = _ => IO.unit
  )(implicit T: Temporal[IO]): IO[Nothing] =
    (drainTx(consumers).transact(xa).flatMap(_.traverse_(r => sink(r).attempt.void)).attempt *> T.sleep(every)).foreverM
}
