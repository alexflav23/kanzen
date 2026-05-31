package com.kanzen.notify

import cats.effect.IO
import cats.syntax.all._
import doobie.implicits._
import doobie.util.transactor.Transactor

/** F34/APNs+FCM — the device-push seam. A notification whose channels include `push` is delivered to the user's devices
  * through this interface. [[StubPushTransport]] is a no-op success (the sandbox has no devices registered); the real
  * `ApnsFcmPushTransport` (APNs + FCM, operator-gated) drops in behind the trait. A [[PushDeliveryWorker]] drains the
  * un-pushed queue through it — mirroring the SES email-delivery worker.
  */
trait PushTransport {
  def push(p: NotificationRepo.PushPending): IO[Unit]
}

object StubPushTransport extends PushTransport {
  def push(p: NotificationRepo.PushPending): IO[Unit] = IO.unit // sandbox: no registered devices; APNs/FCM swaps in here
}

/** Drains notifications awaiting a device push through the [[PushTransport]] seam, marking each pushed (or recording the
  * error for retry). Idempotent + at-least-once. Runs alongside the relay in `Main`.
  */
object PushDeliveryWorker {
  import scala.concurrent.duration._

  def drainOnce(xa: Transactor[IO], transport: PushTransport): IO[Int] =
    NotificationRepo.pendingPush(100).transact(xa).flatMap { pending =>
      pending.traverse_ { n =>
        transport.push(n).attempt.flatMap {
          case Right(_) => NotificationRepo.markPushed(n.id).transact(xa).void
          case Left(e) => NotificationRepo.markPushError(n.id, e.getMessage).transact(xa).void
        }
      }.as(pending.size)
    }

  def run(xa: Transactor[IO], transport: PushTransport, every: FiniteDuration = 5.seconds): IO[Unit] =
    (drainOnce(xa, transport).attempt *> IO.sleep(every)).foreverM
}
