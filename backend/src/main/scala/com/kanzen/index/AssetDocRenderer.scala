package com.kanzen.index

import cats.syntax.all._
import doobie._
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.postgres.circe.jsonb.implicits._
import io.circe.Json

import java.time.{Instant, LocalDate}
import java.util.UUID

/** F32 / NL-2 — render an asset (current state + location + attributes + lifecycle timeline) to the text the RAG index
  * stores. The IndexConsumer calls this on every asset event, so the document always reflects current truth.
  */
object AssetDocRenderer {
  private final case class Core(
      title: String,
      maker: Option[String],
      category: Option[String],
      vertical: Option[String],
      acquisitionDate: Option[LocalDate],
      acqCost: Option[Long],
      acqCcy: Option[String],
      ownership: String,
      condition: Option[String],
      custody: String,
      attributes: Json,
      notes: Option[String],
      owner: Option[UUID],
      loc: Option[String],
      prop: Option[String],
      propertyId: Option[UUID]
  )
  private final case class Ev(
      typ: String,
      at: Instant,
      cost: Option[Long],
      ccy: Option[String],
      party: Option[String],
      note: Option[String]
  )

  private def core(id: UUID): ConnectionIO[Option[Core]] =
    sql"""select a.title, a.maker, c.name, a.vertical, a.acquisition_date, a.acquisition_cost_minor, a.acquisition_currency,
                 a.ownership_status, a.condition_status, a.custody_status, a.attributes, a.notes, a.owner_id,
                 l.name, p.name, l.property_id
          from assets a
          left join categories c on c.id = a.category_id
          left join locations l on l.id = a.location_id
          left join properties p on p.id = l.property_id
          where a.id = $id and a.deleted_at is null""".query[Core].option

  private def events(id: UUID): ConnectionIO[List[Ev]] =
    sql"""select type, occurred_at, cost_minor, currency, party, note from asset_events
          where asset_id = $id order by occurred_at desc limit 50""".query[Ev].to[List]

  private def money(m: Option[Long], ccy: Option[String]): String =
    m.map(v => f"${ccy.getOrElse("GBP")} ${v / 100}%,d").getOrElse("—")

  // flatten the JSONB attributes (registration, colour, model, mot_due, …) into "key: value" pairs
  private def attrLine(j: Json): String =
    j.asObject
      .map(
        _.toList
          .flatMap { case (k, v) =>
            v.asString
              .orElse(v.asNumber.map(_.toString))
              .orElse(if (v.isNull) None else Some(v.noSpaces.take(48)))
              .map(s => s"${k.replace('_', ' ')} $s")
          }
          .mkString("; ")
      )
      .getOrElse("")

  def render(id: UUID): ConnectionIO[Option[RenderedDoc]] =
    core(id).flatMap {
      case None => Option.empty[RenderedDoc].pure[ConnectionIO]
      case Some(a) =>
        events(id).map { evs =>
          val where = List(a.prop, a.loc).flatten match {
            case Nil => "no location on record"; case xs => xs.mkString(" · ")
          }
          val facts = List(
            Some(a.title),
            a.maker.map(m => s"by $m"),
            a.category.map(c => s"category $c"),
            a.vertical.map(v => s"($v)"),
            Some(s"located at $where"),
            Some(s"custody ${a.custody.replace('_', ' ')}"),
            Some(s"ownership ${a.ownership}"),
            a.condition.map(c => s"condition $c"),
            a.acquisitionDate.map(d => s"acquired $d for ${money(a.acqCost, a.acqCcy)}"),
            Option(attrLine(a.attributes)).filter(_.nonEmpty),
            a.notes
          ).flatten.mkString(". ")
          val timeline = evs
            .map(e =>
              s"${e.at.toString.take(10)}: ${e.typ}${e.party.map(p => s" by $p").getOrElse("")}" +
                s"${e.note.map(n => s" — $n").getOrElse("")}${e.cost.map(c => s" (${money(Some(c), e.ccy)})").getOrElse("")}"
            )
            .mkString(" | ")
          val body = if (timeline.isEmpty) facts else s"$facts. Timeline: $timeline"
          Some(RenderedDoc("asset", id, a.owner, a.propertyId, "household", a.title, body))
        }
    }

  /** All non-deleted asset ids — for the boot backfill. */
  def allIds: ConnectionIO[List[UUID]] =
    sql"select id from assets where deleted_at is null".query[UUID].to[List]
}
