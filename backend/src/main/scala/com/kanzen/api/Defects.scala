package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Authz, Level}
import com.kanzen.property.{Defect, DefectRepo, PropertyRepo}
import doobie.ConnectionIO
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.generic.auto._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

import java.util.UUID

/** F03 — defects on a property. Staff may **raise** (write `defect`) but not transition
  * status (field-level deny on `defect.status`); Managers manage fully. Lifecycle:
  * open → in_progress → resolved|wont_fix, reopening allowed (AC5/AC6). */
object Defects {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class DefectView(id: UUID, propertyId: UUID, locationId: Option[UUID], title: String,
                              description: Option[String], severity: String, status: String, reportedBy: Option[UUID])
  final case class RaiseReq(propertyId: UUID, locationId: Option[UUID], title: String,
                            description: Option[String], severity: String)
  final case class PatchReq(title: String, description: Option[String], severity: String)
  final case class StatusReq(status: String)

  private val STATUSES  = Set("open", "in_progress", "resolved", "wont_fix")
  private val SEVERITIES = Set("low", "medium", "high")

  private def view(d: Defect): DefectView =
    DefectView(d.id, d.propertyId, d.locationId, d.title, d.description, d.severity, d.status, d.reportedBy)

  private val forbidden: (StatusCode, ApiError) = (StatusCode.Forbidden, ApiError(403, "forbidden", "not permitted on defect"))
  private val notFound: (StatusCode, ApiError)  = (StatusCode.NotFound, ApiError(404, "not_found", "No such property or defect."))
  private def badReq(msg: String): (StatusCode, ApiError) = (StatusCode.BadRequest, ApiError(400, "bad_request", msg))

  /** Property in scope? (else 404, no leak) then the role check on `defect`(+field). */
  private def authorize(p: Principal, propertyId: UUID, level: Level, field: Option[String]): ConnectionIO[Out[Unit]] =
    for {
      authz <- Authz.authorizer(p.role)
      visible <- PropertyRepo.listForPrincipal(p.userId).map(_.exists(_.id == propertyId))
    } yield
      if (!visible) Left(notFound)
      else if (!authz.can(level, "defect", field)) Left(forbidden)
      else Right(())

  def list(xa: Transactor[IO], p: Principal, propertyId: UUID, status: Option[String]): IO[Out[List[DefectView]]] = {
    val tx = authorize(p, propertyId, Level.Read, None).flatMap {
      case Left(e)  => (Left(e): Out[List[DefectView]]).pure[ConnectionIO]
      case Right(_) => DefectRepo.list(propertyId, status).map(ds => Right(ds.map(view)): Out[List[DefectView]])
    }
    tx.transact(xa)
  }

  def raise(xa: Transactor[IO], p: Principal, req: RaiseReq): IO[Out[DefectView]] = {
    if (!SEVERITIES.contains(req.severity)) IO.pure(Left(badReq(s"severity must be one of ${SEVERITIES.mkString(", ")}")))
    else {
      val tx = authorize(p, req.propertyId, Level.Write, None).flatMap {
        case Left(e) => (Left(e): Out[DefectView]).pure[ConnectionIO]
        case Right(_) =>
          DefectRepo.raise(p.userId, req.propertyId, req.locationId, req.title, req.description, req.severity, p.userId)
            .map(d => Right(view(d)): Out[DefectView])
      }
      tx.transact(xa)
    }
  }

  def transition(xa: Transactor[IO], p: Principal, id: UUID, status: String): IO[Out[DefectView]] = {
    if (!STATUSES.contains(status)) IO.pure(Left(badReq(s"status must be one of ${STATUSES.mkString(", ")}")))
    else {
      val tx = DefectRepo.find(id).flatMap {
        case None => (Left(notFound): Out[DefectView]).pure[ConnectionIO]
        case Some(d) =>
          authorize(p, d.propertyId, Level.Write, Some("status")).flatMap {
            case Left(e)  => (Left(e): Out[DefectView]).pure[ConnectionIO]
            case Right(_) => DefectRepo.setStatus(id, status) *> DefectRepo.find(id).map(_.map(view).toRight(notFound))
          }
      }
      tx.transact(xa)
    }
  }

  def patch(xa: Transactor[IO], p: Principal, id: UUID, req: PatchReq): IO[Out[DefectView]] = {
    if (!SEVERITIES.contains(req.severity)) IO.pure(Left(badReq(s"severity must be one of ${SEVERITIES.mkString(", ")}")))
    else {
      val tx = DefectRepo.find(id).flatMap {
        case None => (Left(notFound): Out[DefectView]).pure[ConnectionIO]
        case Some(d) =>
          authorize(p, d.propertyId, Level.Write, None).flatMap {
            case Left(e)  => (Left(e): Out[DefectView]).pure[ConnectionIO]
            case Right(_) => DefectRepo.patch(id, req.title, req.description, req.severity) *> DefectRepo.find(id).map(_.map(view).toRight(notFound))
          }
      }
      tx.transact(xa)
    }
  }

  // ---- endpoints ----
  private val err = statusCode.and(jsonBody[ApiError])

  val listEndpoint: Endpoint[String, (UUID, Option[String]), (StatusCode, ApiError), List[DefectView], Any] =
    sttp.tapir.endpoint.get.securityIn(auth.bearer[String]())
      .in("api" / "properties" / path[UUID]("id") / "defects").in(query[Option[String]]("status"))
      .errorOut(err).out(jsonBody[List[DefectView]]).summary("Defects for a property (scoped; optional ?status=)")

  val raiseEndpoint: Endpoint[String, RaiseReq, (StatusCode, ApiError), DefectView, Any] =
    sttp.tapir.endpoint.post.securityIn(auth.bearer[String]())
      .in("api" / "defects").in(jsonBody[RaiseReq]).errorOut(err).out(jsonBody[DefectView])
      .summary("Raise a defect (Staff+ on their property)")

  val patchEndpoint: Endpoint[String, (UUID, PatchReq), (StatusCode, ApiError), DefectView, Any] =
    sttp.tapir.endpoint.patch.securityIn(auth.bearer[String]())
      .in("api" / "defects" / path[UUID]("id")).in(jsonBody[PatchReq]).errorOut(err).out(jsonBody[DefectView])
      .summary("Edit a defect's particulars")

  val statusEndpoint: Endpoint[String, (UUID, StatusReq), (StatusCode, ApiError), DefectView, Any] =
    sttp.tapir.endpoint.post.securityIn(auth.bearer[String]())
      .in("api" / "defects" / path[UUID]("id") / "status").in(jsonBody[StatusReq]).errorOut(err).out(jsonBody[DefectView])
      .summary("Transition a defect's status (Manager+)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    listEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, st) => list(xa, p, id, st) }),
    raiseEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: RaiseReq) => raise(xa, p, r)),
    patchEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => patch(xa, p, id, r) }),
    statusEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => transition(xa, p, id, r.status) }),
  )

  val endpoints: List[AnyEndpoint] = List(listEndpoint, raiseEndpoint, patchEndpoint, statusEndpoint)
}
