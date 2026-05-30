package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Authz, Level}
import com.kanzen.property.{Defect, DefectRepo, PropertyRepo}
import com.kanzen.tasks.TaskRepo
import com.kanzen.vendor.VendorRepo
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

/** F03 — defects on a property. Staff may **raise** (write `defect`) but not transition status (field-level deny on
  * `defect.status`); Managers manage fully. Lifecycle: open → in_progress → resolved|wont_fix, reopening allowed
  * (AC5/AC6).
  */
object Defects {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class DefectView(
      id: UUID,
      propertyId: UUID,
      locationId: Option[UUID],
      title: String,
      description: Option[String],
      severity: String,
      status: String,
      reportedBy: Option[UUID],
      // W4: the vendor responsible (resolved to its name) + whether a fix-task has been spawned
      assignedVendorId: Option[UUID] = None,
      assignedVendorName: Option[String] = None,
      hasTask: Boolean = false
  )
  final case class RaiseReq(
      propertyId: UUID,
      locationId: Option[UUID],
      title: String,
      description: Option[String],
      severity: String
  )
  final case class PatchReq(title: String, description: Option[String], severity: String)
  final case class StatusReq(status: String)
  final case class AssignReq(vendorId: Option[UUID])

  private val STATUSES = Set("open", "in_progress", "resolved", "wont_fix")
  private val SEVERITIES = Set("low", "medium", "high")

  private def view(d: Defect, vendorName: Option[String] = None): DefectView =
    DefectView(
      d.id,
      d.propertyId,
      d.locationId,
      d.title,
      d.description,
      d.severity,
      d.status,
      d.reportedBy,
      d.assignedVendorId,
      vendorName,
      d.taskId.isDefined
    )
  private def viewT(t: (Defect, Option[String])): DefectView = view(t._1, t._2)

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "not permitted on defect"))
  private val notFound: (StatusCode, ApiError) =
    (StatusCode.NotFound, ApiError(404, "not_found", "No such property or defect."))
  private val conflict: (StatusCode, ApiError) =
    (StatusCode.Conflict, ApiError(409, "archived", "Property is archived; new activity is blocked."))
  private def badReq(msg: String): (StatusCode, ApiError) = (StatusCode.BadRequest, ApiError(400, "bad_request", msg))

  /** Property in scope? (else 404, no leak); writes blocked on archived (409, AC8); then the role check on
    * `defect`(+field). Reads are allowed on archived (read-only).
    */
  private def authorize(p: Principal, propertyId: UUID, level: Level, field: Option[String]): ConnectionIO[Out[Unit]] =
    for {
      authz <- Authz.forUser(p.userId, p.role)
      prop <- PropertyRepo.listForPrincipal(p.tenantId, p.userId).map(_.find(_.id == propertyId))
    } yield prop match {
      case None => Left(notFound)
      case Some(pr) if level == Level.Write && pr.status == "archived" => Left(conflict)
      case Some(_) if !authz.can(level, "defect", field) => Left(forbidden)
      case Some(_) => Right(())
    }

  def list(xa: Transactor[IO], p: Principal, propertyId: UUID, status: Option[String]): IO[Out[List[DefectView]]] = {
    val tx = authorize(p, propertyId, Level.Read, None).flatMap {
      case Left(e) => (Left(e): Out[List[DefectView]]).pure[ConnectionIO]
      case Right(_) =>
        DefectRepo.listWithVendor(propertyId, status).map(ds => Right(ds.map(viewT)): Out[List[DefectView]])
    }
    tx.transact(xa)
  }

  def raise(xa: Transactor[IO], p: Principal, req: RaiseReq): IO[Out[DefectView]] = {
    if (!SEVERITIES.contains(req.severity))
      IO.pure(Left(badReq(s"severity must be one of ${SEVERITIES.mkString(", ")}")))
    else {
      val tx = authorize(p, req.propertyId, Level.Write, None).flatMap {
        case Left(e) => (Left(e): Out[DefectView]).pure[ConnectionIO]
        case Right(_) =>
          DefectRepo
            .raise(p.userId, req.propertyId, req.locationId, req.title, req.description, req.severity, p.userId)
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
            case Left(e) => (Left(e): Out[DefectView]).pure[ConnectionIO]
            case Right(_) =>
              DefectRepo.setStatus(id, status) *> DefectRepo.findWithVendor(id).map(_.map(viewT).toRight(notFound))
          }
      }
      tx.transact(xa)
    }
  }

  def patch(xa: Transactor[IO], p: Principal, id: UUID, req: PatchReq): IO[Out[DefectView]] = {
    if (!SEVERITIES.contains(req.severity))
      IO.pure(Left(badReq(s"severity must be one of ${SEVERITIES.mkString(", ")}")))
    else {
      val tx = DefectRepo.find(id).flatMap {
        case None => (Left(notFound): Out[DefectView]).pure[ConnectionIO]
        case Some(d) =>
          authorize(p, d.propertyId, Level.Write, None).flatMap {
            case Left(e) => (Left(e): Out[DefectView]).pure[ConnectionIO]
            case Right(_) =>
              DefectRepo.patch(id, req.title, req.description, req.severity) *> DefectRepo
                .findWithVendor(id)
                .map(_.map(viewT).toRight(notFound))
          }
      }
      tx.transact(xa)
    }
  }

  /** Assign (or clear) the vendor responsible for a defect (Manager+; F09). */
  def assign(xa: Transactor[IO], p: Principal, id: UUID, req: AssignReq): IO[Out[DefectView]] = {
    val tx = DefectRepo.find(id).flatMap {
      case None => (Left(notFound): Out[DefectView]).pure[ConnectionIO]
      case Some(d) =>
        authorize(p, d.propertyId, Level.Write, None).flatMap {
          case Left(e) => (Left(e): Out[DefectView]).pure[ConnectionIO]
          case Right(_) =>
            def doAssign(v: Option[UUID]) =
              DefectRepo.assignVendor(id, v) *> DefectRepo.findWithVendor(id).map(_.map(viewT).toRight(notFound))
            req.vendorId match {
              case None => doAssign(None) // clear the assignment
              case Some(vid) =>
                // F09 scope: only a vendor approved for this property + currently insured may be assigned
                VendorRepo.selectableFor(d.propertyId).flatMap { sel =>
                  if (sel.exists(_.id == vid)) doAssign(Some(vid))
                  else
                    (Left(badReq("vendor is not approved + insured for this property")): Out[DefectView])
                      .pure[ConnectionIO]
                }
            }
        }
    }
    tx.transact(xa)
  }

  /** Spawn a "fix" task into the property's native task project (F06) and link it to the defect (Manager+). */
  def spawnTask(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[DefectView]] = {
    val tx = DefectRepo.find(id).flatMap {
      case None => (Left(notFound): Out[DefectView]).pure[ConnectionIO]
      case Some(d) =>
        authorize(p, d.propertyId, Level.Write, None).flatMap {
          case Left(e) => (Left(e): Out[DefectView]).pure[ConnectionIO]
          case Right(_) =>
            PropertyRepo.taskProjectId(d.propertyId).flatMap {
              case None =>
                (Left(badReq("this property has no linked task project")): Out[DefectView]).pure[ConnectionIO]
              case Some(projectId) =>
                TaskRepo.createTask(p.tenantId, projectId, s"Fix: ${d.title}", None, None).flatMap { t =>
                  DefectRepo.setTask(id, t.id) *> DefectRepo.findWithVendor(id).map(_.map(viewT).toRight(notFound))
                }
            }
        }
    }
    tx.transact(xa)
  }

  // ---- endpoints ----
  private val err = statusCode.and(jsonBody[ApiError])

  val listEndpoint: Endpoint[String, (UUID, Option[String]), (StatusCode, ApiError), List[DefectView], Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "properties" / path[UUID]("id") / "defects")
      .in(query[Option[String]]("status"))
      .errorOut(err)
      .out(jsonBody[List[DefectView]])
      .summary("Defects for a property (scoped; optional ?status=)")

  val raiseEndpoint: Endpoint[String, RaiseReq, (StatusCode, ApiError), DefectView, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "defects")
      .in(jsonBody[RaiseReq])
      .errorOut(err)
      .out(jsonBody[DefectView])
      .summary("Raise a defect (Staff+ on their property)")

  val patchEndpoint: Endpoint[String, (UUID, PatchReq), (StatusCode, ApiError), DefectView, Any] =
    sttp.tapir.endpoint.patch
      .securityIn(auth.bearer[String]())
      .in("api" / "defects" / path[UUID]("id"))
      .in(jsonBody[PatchReq])
      .errorOut(err)
      .out(jsonBody[DefectView])
      .summary("Edit a defect's particulars")

  val statusEndpoint: Endpoint[String, (UUID, StatusReq), (StatusCode, ApiError), DefectView, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "defects" / path[UUID]("id") / "status")
      .in(jsonBody[StatusReq])
      .errorOut(err)
      .out(jsonBody[DefectView])
      .summary("Transition a defect's status (Manager+)")

  val assignEndpoint: Endpoint[String, (UUID, AssignReq), (StatusCode, ApiError), DefectView, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "defects" / path[UUID]("id") / "vendor")
      .in(jsonBody[AssignReq])
      .errorOut(err)
      .out(jsonBody[DefectView])
      .summary("Assign (or clear) the vendor responsible for a defect (Manager+; F09)")

  val taskEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), DefectView, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "defects" / path[UUID]("id") / "task")
      .errorOut(err)
      .out(jsonBody[DefectView])
      .summary("Spawn a fix-task into the property's task project and link it (Manager+; F06)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    listEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, st) => list(xa, p, id, st) }),
    raiseEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: RaiseReq) => raise(xa, p, r)),
    patchEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => patch(xa, p, id, r) }),
    statusEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (id, r) => transition(xa, p, id, r.status) }),
    assignEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => assign(xa, p, id, r) }),
    taskEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => spawnTask(xa, p, id))
  )

  val endpoints: List[AnyEndpoint] =
    List(listEndpoint, raiseEndpoint, patchEndpoint, statusEndpoint, assignEndpoint, taskEndpoint)
}
