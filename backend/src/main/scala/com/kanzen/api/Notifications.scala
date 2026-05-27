package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Actions, Authz}
import com.kanzen.notify.{Device, DeviceRepo, Notification, NotificationRepo, Subscription, SubscriptionRepo}
import doobie.ConnectionIO
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import io.circe.generic.auto._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

import java.util.UUID

/** F34 — the consumer-side API: a user's notification centre, subscription preferences and push-device registry.
  * Everything is **self-scoped** — the repo filters by the principal's own `user_id`, so one user can never read or
  * mutate another's notifications.
  */
object Notifications {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class NotificationView(
      id: UUID,
      `type`: String,
      title: String,
      body: Option[String],
      subjectType: Option[String],
      subjectId: Option[UUID],
      channels: List[String],
      read: Boolean,
      createdAt: String
  )
  final case class Inbox(unread: Long, items: List[NotificationView])
  final case class SubscriptionView(id: UUID, eventTypePattern: String, channels: List[String])
  final case class CreateSubReq(eventTypePattern: String, channels: List[String])
  final case class DeviceReq(platform: String, token: String)
  final case class DeviceView(id: UUID, platform: String, token: String, lastSeenAt: String)
  final case class Ok(ok: Boolean)

  private def chans(j: Json): List[String] = j.asArray.map(_.flatMap(_.asString).toList).getOrElse(Nil)
  private def nv(n: Notification): NotificationView =
    NotificationView(
      n.id,
      n.`type`,
      n.title,
      n.body,
      n.subjectType,
      n.subjectId,
      chans(n.channelsSent),
      n.readAt.isDefined,
      n.createdAt
    )
  private def sv(s: Subscription): SubscriptionView = SubscriptionView(s.id, s.pattern, chans(s.channels))
  private def dv(d: Device): DeviceView = DeviceView(d.id, d.platform, d.token, d.lastSeenAt)

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "no access to notifications"))
  private val notFound: (StatusCode, ApiError) =
    (StatusCode.NotFound, ApiError(404, "not_found", "No such notification."))
  private def badReq(m: String): (StatusCode, ApiError) = (StatusCode.BadRequest, ApiError(400, "bad_request", m))
  private val PLATFORMS = Set("apns", "fcm", "webpush")

  private def authed[A](p: Principal, q: ConnectionIO[A]): ConnectionIO[Out[A]] =
    Authz
      .forUser(p.userId, p.role)
      .flatMap(a =>
        if (a.can(Actions.byKey("notification:manage"))) q.map(Right(_): Out[A])
        else (Left(forbidden): Out[A]).pure[ConnectionIO]
      )

  def inbox(xa: Transactor[IO], p: Principal): IO[Out[Inbox]] =
    authed(
      p,
      (NotificationRepo.unreadCount(p.userId), NotificationRepo.forUser(p.userId)).mapN((u, ns) => Inbox(u, ns.map(nv)))
    ).transact(xa)

  def markRead(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[Ok]] =
    authed(p, NotificationRepo.markRead(p.userId, id).map(n => Ok(n > 0))).transact(xa)

  def subscriptions(xa: Transactor[IO], p: Principal): IO[Out[List[SubscriptionView]]] =
    authed(p, SubscriptionRepo.forUser(p.userId).map(_.map(sv))).transact(xa)

  def createSub(xa: Transactor[IO], p: Principal, r: CreateSubReq): IO[Out[SubscriptionView]] =
    if (r.eventTypePattern.isEmpty) IO.pure(Left(badReq("eventTypePattern required")))
    else
      authed(
        p, {
          val channels = Json.fromValues(r.channels.map(Json.fromString))
          SubscriptionRepo
            .create(p.userId, p.userId, r.eventTypePattern, channels)
            .map(id => SubscriptionView(id, r.eventTypePattern, r.channels))
        }
      ).transact(xa)

  def deleteSub(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[Ok]] =
    authed(p, SubscriptionRepo.delete(p.userId, id).map(n => if (n > 0) Right(Ok(true)): Out[Ok] else Left(notFound)))
      .map(_.flatten)
      .transact(xa)

  def registerDevice(xa: Transactor[IO], p: Principal, r: DeviceReq): IO[Out[DeviceView]] =
    if (!PLATFORMS.contains(r.platform)) IO.pure(Left(badReq(s"platform must be one of ${PLATFORMS.mkString(", ")}")))
    else
      authed(
        p,
        DeviceRepo.register(p.userId, r.platform, r.token) *> DeviceRepo
          .forUser(p.userId)
          .map(_.find(_.token == r.token).map(dv).toRight(notFound))
      ).map(_.flatten).transact(xa)

  private val err = statusCode.and(jsonBody[ApiError])
  private def bearer = auth.bearer[String]()

  val inboxEndpoint = sttp.tapir.endpoint.get
    .securityIn(bearer)
    .in("api" / "notifications")
    .errorOut(err)
    .out(jsonBody[Inbox])
    .summary("My notifications + unread count")
  val readEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "notifications" / path[UUID]("id") / "read")
    .errorOut(err)
    .out(jsonBody[Ok])
    .summary("Mark a notification read")
  val subsEndpoint = sttp.tapir.endpoint.get
    .securityIn(bearer)
    .in("api" / "notification-subscriptions")
    .errorOut(err)
    .out(jsonBody[List[SubscriptionView]])
    .summary("My subscriptions")
  val createSubEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "notification-subscriptions")
    .in(jsonBody[CreateSubReq])
    .errorOut(err)
    .out(jsonBody[SubscriptionView])
    .summary("Subscribe to an event type")
  val deleteSubEndpoint = sttp.tapir.endpoint.delete
    .securityIn(bearer)
    .in("api" / "notification-subscriptions" / path[UUID]("id"))
    .errorOut(err)
    .out(jsonBody[Ok])
    .summary("Unsubscribe")
  val deviceEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "devices")
    .in(jsonBody[DeviceReq])
    .errorOut(err)
    .out(jsonBody[DeviceView])
    .summary("Register a push device (APNs/FCM/webpush)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    inboxEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => inbox(xa, p)),
    readEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => markRead(xa, p, id)),
    subsEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => subscriptions(xa, p)),
    createSubEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: CreateSubReq) => createSub(xa, p, r)),
    deleteSubEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => deleteSub(xa, p, id)),
    deviceEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: DeviceReq) => registerDevice(xa, p, r))
  )

  val endpoints: List[AnyEndpoint] =
    List(inboxEndpoint, readEndpoint, subsEndpoint, createSubEndpoint, deleteSubEndpoint, deviceEndpoint)
}
