package com.kanzen.calendar

import com.kanzen.s3.BlobToken

import java.time.format.DateTimeFormatter
import java.time.{Instant, LocalDate, LocalTime, ZoneOffset}
import java.util.UUID
import scala.util.Try

/** F07 — interim Path-B bridge: a signed, read-only **iCal subscription feed** so staff can subscribe to the household
  * calendar from iOS/Android/Google today, without waiting on the full Workspace two-way sync (F44 🔒). ~80% of the
  * collaboration value at ~10% of the cost.
  *
  * The feed URL carries an unguessable **capability token** (HMAC-SHA256, the same primitive as the blob capability
  * URLs) encoding `tenantId:userId`. There is no bearer (a calendar app can't send one); possession of a valid token is
  * the capability. We re-resolve the subscriber's role + tenant at request time and apply the *same* `calendar:view`
  * gate + tenant filter as the in-app calendar, so the feed can't leak more than the app would — and a revoked role
  * takes effect immediately rather than being baked into the token.
  *
  * Times are **floating local** (no TZ) — matching Kanzen's property-local wall-clock calendar decision (no cross-zone
  * conversion); all-day events use VALUE=DATE.
  */
object CalendarFeed {
  private val prefix = "calfeed"
  private val ttlSeconds = 365L * 24 * 3600 // a subscription lives a year; rotate by re-minting

  /** Mint a year-long capability token for (tenant, user). */
  def tokenFor(tenantId: UUID, userId: UUID, secret: String, nowEpochSec: Long): String =
    BlobToken.sign(s"$prefix:$tenantId:$userId", nowEpochSec + ttlSeconds, secret)

  /** (tenantId, userId) iff the token is valid + unexpired. */
  def parse(token: String, secret: String, nowEpochSec: Long): Option[(UUID, UUID)] =
    BlobToken.verify(token, secret, nowEpochSec).flatMap { key =>
      key.split(":", 3) match {
        case Array(`prefix`, t, u) => Try((UUID.fromString(t), UUID.fromString(u))).toOption
        case _ => None
      }
    }

  // ---- ICS rendering ----------------------------------------------------------------------------------------------

  /** One calendar entry to render (subset of the merged calendar view). */
  final case class Entry(
      id: UUID,
      title: String,
      startOn: LocalDate,
      startTime: Option[LocalTime],
      endTime: Option[LocalTime],
      category: String
  )

  private val dateFmt = DateTimeFormatter.ofPattern("yyyyMMdd")
  private val timeFmt = DateTimeFormatter.ofPattern("HHmmss")
  private val stampFmt = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'")

  // RFC 5545 §3.3.11 text escaping: backslash, semicolon, comma, newline.
  private def esc(s: String): String =
    s.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")

  // RFC 5545 §3.1 line folding at 75 octets (CRLF + a leading space on continuation lines).
  private def fold(line: String): String = {
    val bytes = line.getBytes(java.nio.charset.StandardCharsets.UTF_8)
    if (bytes.length <= 75) line
    else {
      val sb = new StringBuilder
      var i = 0
      var first = true
      while (i < line.length) {
        val chunk = if (first) 75 else 74
        val end = math.min(i + chunk, line.length)
        if (!first) sb.append("\r\n ")
        sb.append(line.substring(i, end))
        i = end
        first = false
      }
      sb.toString
    }
  }

  private def vevent(e: Entry, stamp: String): List[String] = {
    val dtLines = e.startTime match {
      case Some(t) =>
        val end = e.endTime.getOrElse(t.plusHours(1))
        List(
          s"DTSTART:${e.startOn.format(dateFmt)}T${t.format(timeFmt)}",
          s"DTEND:${e.startOn.format(dateFmt)}T${end.format(timeFmt)}"
        )
      case None =>
        // all-day: DTEND is exclusive (the next day)
        List(
          s"DTSTART;VALUE=DATE:${e.startOn.format(dateFmt)}",
          s"DTEND;VALUE=DATE:${e.startOn.plusDays(1).format(dateFmt)}"
        )
    }
    List("BEGIN:VEVENT", s"UID:${e.id}@kanzen", s"DTSTAMP:$stamp") ++ dtLines ++
      List(s"SUMMARY:${esc(e.title)}", s"CATEGORIES:${esc(e.category.toUpperCase)}", "STATUS:CONFIRMED", "END:VEVENT")
  }

  /** Render a full VCALENDAR document (CRLF-terminated, folded) for the given entries. */
  def ics(calName: String, entries: List[Entry], now: Instant): String = {
    val stamp = stampFmt.format(now.atOffset(ZoneOffset.UTC))
    val header = List(
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Kanzen//Household Calendar//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      s"X-WR-CALNAME:${esc(calName)}"
    )
    val body = entries.flatMap(e => vevent(e, stamp))
    (header ++ body ++ List("END:VCALENDAR")).map(fold).mkString("\r\n") + "\r\n"
  }
}
