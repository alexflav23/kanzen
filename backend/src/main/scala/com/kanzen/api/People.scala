package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Actions, Authz}
import com.kanzen.people.{Person, PeopleRepo}
import com.kanzen.property.PropertyRepo
import doobie.ConnectionIO
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor
import io.circe.{Decoder, Json}
import com.kanzen.events.{Actor, Envelope, EventRepo, Events, Subject}
import io.circe.Json
import io.circe.generic.auto._
import io.circe.syntax._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

import java.time.LocalDate
import java.util.UUID

/** F10 — people/HR. Principal admin; Manager writes (HR ops); Staff read their **own** record only (own-only enforced
  * server-side). Manager/Principal see the roster, scoped by property. Permit/review expiry is surfaced for the
  * Inbox/dashboard (F11).
  */
object People {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class EmergencyContact(name: String, relation: Option[String], phone: Option[String])
  final case class PersonView(
      id: UUID,
      userId: Option[UUID],
      name: String,
      role: Option[String],
      jurisdiction: Option[String],
      propertyId: Option[UUID],
      permitExpiry: Option[LocalDate],
      reviewDue: Option[LocalDate],
      contractType: Option[String],
      startDate: Option[LocalDate],
      endDate: Option[LocalDate],
      workPermitNo: Option[String],
      emergencyContacts: List[EmergencyContact],
      payrollRef: Option[String],
      notes: Option[String],
      // F47 — the identity colour of the underlying login user (palette key / hex). Drives the avatar glow.
      colour: Option[String]
  )
  final case class CreateReq(
      name: String,
      role: Option[String],
      jurisdiction: Option[String],
      userId: Option[UUID],
      propertyId: Option[UUID],
      permitExpiry: Option[LocalDate],
      reviewDue: Option[LocalDate]
  )

  private def contacts(j: Json): List[EmergencyContact] =
    Decoder[List[EmergencyContact]].decodeJson(j).getOrElse(Nil)

  private def view(p: Person, colours: Map[UUID, String]): PersonView =
    PersonView(
      p.id,
      p.userId,
      p.name,
      p.role,
      p.jurisdiction,
      p.propertyId,
      p.permitExpiry,
      p.reviewDue,
      p.contractType,
      p.startDate,
      p.endDate,
      p.workPermitNo,
      contacts(p.emergencyContacts),
      p.payrollRef,
      p.notes,
      p.userId.flatMap(colours.get)
    )

  /** Batch-fetch the F47 identity colour for each unique user_id we're about to render. One small query per request. */
  private def colourMap(ids: Set[UUID]): ConnectionIO[Map[UUID, String]] =
    if (ids.isEmpty) Map.empty[UUID, String].pure[ConnectionIO]
    else {
      import doobie.util.fragments.in
      val nel = cats.data.NonEmptyList.fromListUnsafe(ids.toList)
      (fr"select id, colour from users where" ++ in(fr"id", nel))
        .query[(UUID, String)]
        .to[List]
        .map(_.collect { case (u, c) if c.nonEmpty => u -> c }.toMap)
    }

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "no access to people"))
  private val notFound: (StatusCode, ApiError) = (StatusCode.NotFound, ApiError(404, "not_found", "No such person."))

  private def scopedSet(p: Principal): ConnectionIO[Set[UUID]] =
    PropertyRepo.listForPrincipal(p.tenantId, p.userId).map(_.map(_.id).toSet)

  def list(xa: Transactor[IO], p: Principal): IO[Out[List[PersonView]]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      scoped <- scopedSet(p)
      rows <-
        if (!authz.can(Actions.byKey("person:view"))) List.empty[Person].pure[ConnectionIO]
        else if (p.role == "staff") PeopleRepo.listForUser(p.userId)
        else PeopleRepo.list(p.tenantId).map(_.filter(_.propertyId.forall(scoped.contains)))
      colours <- colourMap(rows.flatMap(_.userId).toSet)
    } yield if (!authz.can(Actions.byKey("person:view"))) Left(forbidden) else Right(rows.map(view(_, colours)))
    tx.transact(xa)
  }

  def detail(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[PersonView]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      scoped <- scopedSet(p)
      person <- PeopleRepo.find(id, p.tenantId)
      colours <- colourMap(person.flatMap(_.userId).toSet)
    } yield
      if (!authz.can(Actions.byKey("person:view"))) Left(forbidden)
      else
        person match {
          case None => Left(notFound)
          case Some(per) =>
            if (p.role == "staff") {
              if (per.userId.contains(p.userId)) Right(view(per, colours))
              else Left(forbidden) // other staff records denied (AC3)
            } else if (per.propertyId.forall(scoped.contains)) Right(view(per, colours))
            else Left(notFound) // out of scope — no leak
        }
    tx.transact(xa)
  }

  def create(xa: Transactor[IO], p: Principal, req: CreateReq): IO[Out[PersonView]] = {
    val tx = Authz.forUser(p.userId, p.role).flatMap { authz =>
      if (!authz.can(Actions.byKey("person:create"))) (Left(forbidden): Out[PersonView]).pure[ConnectionIO]
      else
        PeopleRepo
          .insert(
            p.userId,
            p.tenantId,
            req.userId,
            req.name,
            req.role,
            req.jurisdiction,
            req.propertyId,
            req.permitExpiry,
            req.reviewDue
          )
          .flatMap(per =>
            EventRepo.emit(
              Envelope(
                Events.Person.Created,
                Actor.user(p.userId),
                Subject("person", per.id),
                p.userId,
                req.propertyId,
                Json.obj("name" -> req.name.asJson, "role" -> req.role.asJson)
              )
            ) *> colourMap(per.userId.toSet).map(c => Right(view(per, c)): Out[PersonView])
          )
    }
    tx.transact(xa)
  }

  def expiring(xa: Transactor[IO], p: Principal, days: Int): IO[Out[List[PersonView]]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      scoped <- scopedSet(p)
      rows <-
        if (authz.can(Actions.byKey("person:view"))) PeopleRepo.expiringPermits(p.tenantId, days)
        else List.empty[Person].pure[ConnectionIO]
      colours <- colourMap(rows.flatMap(_.userId).toSet)
    } yield
      if (!authz.can(Actions.byKey("person:view"))) Left(forbidden)
      else {
        val visible = rows.filter(per =>
          if (p.role == "staff") per.userId.contains(p.userId) else per.propertyId.forall(scoped.contains)
        )
        Right(visible.map(view(_, colours)))
      }
    tx.transact(xa)
  }

  // ---- endpoints ----
  private val err = statusCode.and(jsonBody[ApiError])

  val listEndpoint: Endpoint[String, Unit, (StatusCode, ApiError), List[PersonView], Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "people")
      .errorOut(err)
      .out(jsonBody[List[PersonView]])
      .summary("The team roster (Staff see only themselves)")

  val expiringEndpoint: Endpoint[String, Int, (StatusCode, ApiError), List[PersonView], Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "people" / "expiring")
      .in(query[Int]("days").default(60))
      .errorOut(err)
      .out(jsonBody[List[PersonView]])
      .summary("People with a permit expiring within N days")

  val detailEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), PersonView, Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "people" / path[UUID]("id"))
      .errorOut(err)
      .out(jsonBody[PersonView])
      .summary("A person's record")

  val createEndpoint: Endpoint[String, CreateReq, (StatusCode, ApiError), PersonView, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "people")
      .in(jsonBody[CreateReq])
      .errorOut(err)
      .out(jsonBody[PersonView])
      .summary("Add a person (Manager+)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    listEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => list(xa, p)),
    expiringEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (days: Int) => expiring(xa, p, days)),
    detailEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => detail(xa, p, id)),
    createEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: CreateReq) => create(xa, p, r))
  )

  val endpoints: List[AnyEndpoint] = List(listEndpoint, expiringEndpoint, detailEndpoint, createEndpoint)
}
