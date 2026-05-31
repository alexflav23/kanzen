package com.kanzen.bank

import cats.effect.IO

import java.time.LocalDate

/** F12 — the bank-feed seam (AIS, **read-only** — Kanzen never initiates payments, no PIS). A connected account's
  * transactions are pulled through this interface; [[StubBankFeed]] returns a deterministic, idempotent set so the
  * sandbox can exercise sync → reconcile without a live aggregator, and the real `GoCardlessBankFeed` (operator-gated:
  * AIS consent + token per `SETUP.md`) drops in behind the same trait. Idempotency rides `providerTxId` (the repo
  * upserts on it), so re-syncing never duplicates.
  */
trait BankFeed {
  def fetch(accountId: java.util.UUID, since: LocalDate): IO[List[TxIn]]
}

/** Deterministic stand-in: a stable handful of plausible transactions per account (fixed providerTxIds → re-sync is a
  * no-op), dated over the last few weeks. Reproducible, never random.
  */
object StubBankFeed extends BankFeed {
  private case class Seed(daysAgo: Int, amountMinor: Long, direction: String, description: String)
  private val seeds = List(
    Seed(2, 4_250L, "debit", "Waitrose, Canary Wharf"),
    Seed(5, 120_000L, "debit", "Thames Water — DD"),
    Seed(9, 1_850L, "debit", "Pret a Manger"),
    Seed(14, 5_400_000L, "credit", "Salary"),
    Seed(21, 38_000L, "debit", "Stratstone service dept")
  )

  def fetch(accountId: java.util.UUID, since: LocalDate): IO[List[TxIn]] =
    IO.realTimeInstant.map { now =>
      val today = now.atZone(java.time.ZoneOffset.UTC).toLocalDate
      seeds.zipWithIndex
        .map { case (s, i) =>
          TxIn(
            providerTxId = s"stub:$accountId:$i", // stable ⇒ idempotent on re-sync
            bookedOn = today.minusDays(s.daysAgo.toLong),
            amountMinor = s.amountMinor,
            currency = "GBP",
            direction = s.direction,
            description = s.description
          )
        }
        .filter(!_.bookedOn.isBefore(since))
    }
}
