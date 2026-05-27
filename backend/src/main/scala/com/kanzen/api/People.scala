package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Authz, Level}
import com.kanzen.people.{Person, PeopleRepo}
import com.kanzen.property.PropertyRepo
import doobie.ConnectionIO
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.generic.auto._
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

  final case class PersonView(
      id: UUID,
      userId: Option[UUID],
      name: String,
      role: Option[String],
      jurisdiction: Option[String],
      propertyId: Option[UUID],
      permitExpiry: Option[LocalDate],
      reviewDue: Option[LocalDate]
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

  private def view(p: Person): PersonView =
    PersonView(p.id, p.userId, p.name, p.role, p.jurisdiction, p.propertyId, p.permitExpiry, p.reviewDue)

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "no access to people"))
  private val notFound: (StatusCode, ApiError) = (StatusCode.NotFound, ApiError(404, "not_found", "No such person."))

  private def scopedSet(p: Principal): ConnectionIO[Set[UUID]] =
    PropertyRepo.listForPrincipal(p.userId).map(_.map(_.id).toSet)

  def list(xa: Transactor[IO], p: Principal): IO[Out[List[PersonView]]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      scoped <- scopedSet(p)
      rows <-
        if (!authz.canRead("person")) List.empty[Person].pure[ConnectionIO]
        else if (p.role == "staff") PeopleRepo.listForUser(p.userId)
        else PeopleRepo.list.map(_.filter(_.propertyId.forall(scoped.contains)))
    } yield if (!authz.canRead("person")) Left(forbidden) else Right(rows.map(view))
    tx.transact(xa)
  }

  def detail(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[PersonView]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      scoped <- scopedSet(p)
      person <- PeopleRepo.find(id)
    } yield
      if (!authz.canRead("person")) Left(forbidden)
      else
        person match {
          case None => Left(notFound)
          case Some(per) =>
            if (p.role == "staff") {
              if (per.userId.contains(p.userId)) Right(view(per))
              else Left(forbidden) // other staff records denied (AC3)
            } else if (per.propertyId.forall(scoped.contains)) Right(view(per))
            else Left(notFound) // out of scope — no leak
        }
    tx.transact(xa)
  }

  def create(xa: Transactor[IO], p: Principal, req: CreateReq): IO[Out[PersonView]] = {
    val tx = Authz.forUser(p.userId, p.role).flatMap { authz =>
      if (!authz.can(Level.Write, "person")) (Left(forbidden): Out[PersonView]).pure[ConnectionIO]
      else
        PeopleRepo
          .insert(
            p.userId,
            req.userId,
            req.name,
            req.role,
            req.jurisdiction,
            req.propertyId,
            req.permitExpiry,
            req.reviewDue
          )
          .map(per => Right(view(per)): Out[PersonView])
    }
    tx.transact(xa)
  }

  def expiring(xa: Transactor[IO], p: Principal, days: Int): IO[Out[List[PersonView]]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      scoped <- scopedSet(p)
      rows <- if (authz.canRead("person")) PeopleRepo.expiringPermits(days) else List.empty[Person].pure[ConnectionIO]
    } yield
      if (!authz.canRead("person")) Left(forbidden)
      else {
        val visible = rows.filter(per =>
          if (p.role == "staff") per.userId.contains(p.userId) else per.propertyId.forall(scoped.contains)
        )
        Right(visible.map(view))
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
