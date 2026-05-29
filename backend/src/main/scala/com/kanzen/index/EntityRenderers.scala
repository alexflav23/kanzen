package com.kanzen.index

import cats.syntax.all._
import doobie._
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.postgres.circe.jsonb.implicits._
import io.circe.Json

import java.time.LocalDate
import java.util.UUID

/** F32 / NL-2b — render the *other* entity groups (beyond assets) to the text the RAG index stores, so open-ended
  * questions about people, properties and documents resolve too. Each mirrors [[AssetDocRenderer]]: a `render(id)`
  * producing a [[RenderedDoc]] (current truth, idempotent) and an `allIds` for the reconcile pass. Money is never
  * rendered for these groups (the registry is the value surface); these are operational facts.
  */
object PersonDocRenderer {
  private final case class P(
      name: String,
      role: Option[String],
      jurisdiction: Option[String],
      owner: Option[UUID],
      propertyId: Option[UUID],
      prop: Option[String],
      contractType: Option[String],
      startDate: Option[LocalDate],
      endDate: Option[LocalDate],
      permitNo: Option[String],
      permitExpiry: Option[LocalDate],
      reviewDue: Option[LocalDate],
      payrollRef: Option[String],
      notes: Option[String],
      emergency: Json
  )

  private def row(id: UUID): ConnectionIO[Option[P]] =
    sql"""select e.name, e.role, e.jurisdiction, e.owner_id, e.property_id, p.name,
                 e.contract_type, e.start_date, e.end_date, e.work_permit_no, e.permit_expiry,
                 e.review_due, e.payroll_ref, e.notes, e.emergency_contacts
          from employment_records e left join properties p on p.id = e.property_id
          where e.id = $id and e.deleted_at is null""".query[P].option

  private def contactNames(j: Json): String =
    j.asArray.map(_.flatMap(_.hcursor.get[String]("name").toOption).mkString(", ")).getOrElse("")

  def render(id: UUID): ConnectionIO[Option[RenderedDoc]] = row(id).map(_.map { p =>
    val facts = List(
      Some(p.name),
      p.role.map(r => s"role $r"),
      p.prop.map(x => s"based at $x"),
      p.jurisdiction.map(j => s"jurisdiction $j"),
      p.contractType.map(c => s"$c contract"),
      p.startDate.map(d => s"started $d"),
      p.endDate.map(d => s"ends $d"),
      p.permitNo.map(n => s"work permit $n"),
      p.permitExpiry.map(d => s"permit expires $d"),
      p.reviewDue.map(d => s"review due $d"),
      p.payrollRef.map(r => s"payroll ref $r"),
      Option(contactNames(p.emergency)).filter(_.nonEmpty).map(n => s"emergency contacts: $n"),
      p.notes
    ).flatten.mkString(". ")
    RenderedDoc("person", id, p.owner, p.propertyId, "household", p.name, facts)
  })

  def allIds: ConnectionIO[List[UUID]] =
    sql"select id from employment_records where deleted_at is null".query[UUID].to[List]
}

object PropertyDocRenderer {
  private final case class Pr(
      name: String,
      typ: Option[String],
      address: Option[String],
      jurisdiction: Option[String],
      ownership: Option[String],
      status: String,
      ccy: String,
      owner: Option[UUID]
  )

  private def row(id: UUID): ConnectionIO[Option[Pr]] =
    sql"""select name, type, address, jurisdiction, ownership, status, default_currency, owner_id
          from properties where id = $id and deleted_at is null""".query[Pr].option

  private def locations(id: UUID): ConnectionIO[List[String]] =
    sql"select name from locations where property_id = $id and deleted_at is null order by sort_order limit 40"
      .query[String]
      .to[List]

  private def openDefects(id: UUID): ConnectionIO[List[String]] =
    sql"""select title from defects where property_id = $id and status in ('open', 'in_progress')
          order by created_at desc limit 12""".query[String].to[List]

  def render(id: UUID): ConnectionIO[Option[RenderedDoc]] =
    (row(id), locations(id), openDefects(id)).tupled.map { case (r, locs, defs) =>
      r.map { p =>
        val facts = List(
          Some(p.name),
          p.typ.map(t => s"type $t"),
          p.address.map(a => s"at $a"),
          p.jurisdiction.map(j => s"jurisdiction $j"),
          p.ownership.map(o => s"ownership $o"),
          Some(s"status ${p.status}"),
          Some(s"base currency ${p.ccy}")
        ).flatten.mkString(". ")
        val rooms = if (locs.isEmpty) "" else s" Locations: ${locs.mkString(", ")}."
        val issues = if (defs.isEmpty) "" else s" Open issues: ${defs.mkString("; ")}."
        RenderedDoc("property", id, p.owner, Some(id), "household", p.name, facts + rooms + issues)
      }
    }

  def allIds: ConnectionIO[List[UUID]] =
    sql"select id from properties where deleted_at is null".query[UUID].to[List]
}

object DocumentDocRenderer {
  private final case class D(
      name: String,
      category: String,
      contentType: Option[String],
      immutable: Boolean,
      visibility: String,
      owner: Option[UUID],
      propertyId: Option[UUID],
      prop: Option[String]
  )

  private def row(id: UUID): ConnectionIO[Option[D]] =
    sql"""select d.name, d.category, d.content_type, d.immutable, d.visibility, d.owner_id, d.property_id, p.name
          from documents d left join properties p on p.id = d.property_id
          where d.id = $id and d.deleted_at is null""".query[D].option

  private def links(id: UUID): ConnectionIO[List[(String, Option[String])]] =
    sql"select target_type, role from document_links where document_id = $id limit 20"
      .query[(String, Option[String])]
      .to[List]

  def render(id: UUID): ConnectionIO[Option[RenderedDoc]] =
    (row(id), links(id)).tupled.map { case (r, ls) =>
      r.map { d =>
        val facts = List(
          Some(s"Document ${d.name}"),
          Some(s"category ${d.category}"),
          d.contentType.map(c => s"type $c"),
          d.prop.map(x => s"filed under $x"),
          if (d.immutable) Some("immutable original") else None
        ).flatten.mkString(". ")
        val attached =
          if (ls.isEmpty) ""
          else s" Attached to: ${ls.map { case (t, role) => role.map(rr => s"$t ($rr)").getOrElse(t) }.mkString(", ")}."
        // the document's own visibility carries into the index (principal_private vs household) for scoped NL later
        RenderedDoc("document", id, d.owner, d.propertyId, d.visibility, d.name, facts + attached)
      }
    }

  def allIds: ConnectionIO[List[UUID]] =
    sql"select id from documents where deleted_at is null".query[UUID].to[List]
}
