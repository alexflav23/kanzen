package com.kanzen.calendar

import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

import java.time.{Instant, LocalDate, LocalTime}
import java.util.UUID

/** F07 iCal — the signed feed token round-trip + RFC 5545 rendering. */
class CalendarFeedSpec extends AnyFreeSpec with Matchers {
  private val secret = "feed-secret-xyz"
  private val tenant = UUID.fromString("7e000000-0000-0000-0000-000000000001")
  private val user = UUID.fromString("10000000-0000-0000-0000-000000000001")
  private val now = Instant.parse("2026-05-31T08:00:00Z")

  "the feed token" - {
    "round-trips (tenant, user) for a valid, unexpired token" in {
      val tok = CalendarFeed.tokenFor(tenant, user, secret, now.getEpochSecond)
      CalendarFeed.parse(tok, secret, now.getEpochSecond) shouldBe Some((tenant, user))
    }
    "rejects a forged secret" in {
      val tok = CalendarFeed.tokenFor(tenant, user, secret, now.getEpochSecond)
      CalendarFeed.parse(tok, "other", now.getEpochSecond) shouldBe None
    }
    "expires after a year" in {
      val tok = CalendarFeed.tokenFor(tenant, user, secret, now.getEpochSecond)
      CalendarFeed.parse(tok, secret, now.getEpochSecond + 366L * 24 * 3600) shouldBe None
    }
    "rejects a non-calfeed capability token (wrong prefix)" in {
      val foreign = com.kanzen.s3.BlobToken.sign("documents/x/y.png", now.getEpochSecond + 1000, secret)
      CalendarFeed.parse(foreign, secret, now.getEpochSecond) shouldBe None
    }
  }

  "the ICS document" - {
    val timed = CalendarFeed.Entry(
      UUID.fromString("aaaaaaaa-0000-0000-0000-000000000001"),
      "Plumber visit", LocalDate.of(2026, 6, 1), Some(LocalTime.of(9, 30)), Some(LocalTime.of(11, 0)), "maintenance"
    )
    val allDay = CalendarFeed.Entry(
      UUID.fromString("bbbbbbbb-0000-0000-0000-000000000002"),
      "Waitrose delivery; groceries", LocalDate.of(2026, 6, 2), None, None, "delivery"
    )
    val ics = CalendarFeed.ics("Kanzen — Household", List(timed, allDay), now)

    "wraps a valid VCALENDAR envelope with CRLF line endings" in {
      ics should startWith("BEGIN:VCALENDAR\r\n")
      ics should include("VERSION:2.0")
      ics should include("PRODID:-//Kanzen//Household Calendar//EN")
      ics should endWith("END:VCALENDAR\r\n")
    }
    "renders a timed event with floating local DTSTART/DTEND" in {
      ics should include("UID:aaaaaaaa-0000-0000-0000-000000000001@kanzen")
      ics should include("DTSTART:20260601T093000")
      ics should include("DTEND:20260601T110000")
      ics should include("SUMMARY:Plumber visit")
      ics should include("CATEGORIES:MAINTENANCE")
    }
    "renders an all-day event with VALUE=DATE and an exclusive next-day DTEND" in {
      ics should include("DTSTART;VALUE=DATE:20260602")
      ics should include("DTEND;VALUE=DATE:20260603")
    }
    "escapes RFC-5545 special characters in text (the semicolon in the title)" in {
      ics should include("SUMMARY:Waitrose delivery\\; groceries")
    }
    "defaults a timed event with no end to +1h" in {
      val noEnd = CalendarFeed.Entry(UUID.randomUUID(), "Call", LocalDate.of(2026, 6, 1), Some(LocalTime.of(14, 0)), None, "manual")
      CalendarFeed.ics("c", List(noEnd), now) should include("DTEND:20260601T150000")
    }
  }
}
