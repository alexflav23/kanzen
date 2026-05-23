package com.kanzen.ledger

import com.kanzen.ledger.LedgerService.Entry
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

import java.util.UUID

/** F18 unit test (FreeSpec): double-entry balance invariant. */
class LedgerServiceSpec extends AnyFreeSpec with Matchers {
  val accA: UUID = UUID.randomUUID()
  val accB: UUID = UUID.randomUUID()

  "LedgerService.balances" - {
    "a single positive transfer balances" in { LedgerService.balances(List(Entry(accA, accB, 100L))) shouldBe true }
    "an empty group does not balance" in { LedgerService.balances(Nil) shouldBe false }
    "a zero-amount entry is rejected" in { LedgerService.balances(List(Entry(accA, accB, 0L))) shouldBe false }
  }
}
