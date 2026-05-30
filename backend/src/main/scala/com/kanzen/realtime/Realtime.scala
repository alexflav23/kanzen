package com.kanzen.realtime

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.Auth
import com.kanzen.authz.Authz
import com.kanzen.people.{AssigneeScope, PeopleRepo}
import doobie.ConnectionIO
import doobie.implicits._
import doobie.util.transactor.Transactor
import fs2.{Pipe, Stream}
import org.http4s.dsl.io._
import org.http4s.server.websocket.WebSocketBuilder2
import org.http4s.websocket.WebSocketFrame
import org.http4s.{HttpRoutes, Response, Status}

import scala.concurrent.duration._

/** F48 W10-RT.1 — the single realtime websocket. `GET /api/ws?token=<jwt>` handshakes (browsers can't set WS headers,
  * so the bearer rides the query string), validates the JWT exactly as the REST path does, snapshots the connection's
  * `Authorizer` + (Staff) assignee scope, then streams authz-filtered [[RtEvent]]s as JSON text frames. A 25s keepalive
  * ping keeps the connection warm through proxies. Inbound frames are ignored for now (heartbeat handling + presence
  * arrive in W10-RT.3).
  */
object Realtime {
  private object TokenQ extends OptionalQueryParamDecoderMatcher[String]("token")

  def routes(auth: Auth, xa: Transactor[IO], hub: RealtimeHub, wsb: WebSocketBuilder2[IO]): HttpRoutes[IO] =
    HttpRoutes.of[IO] { case GET -> Root / "api" / "ws" :? TokenQ(tokenOpt) =>
      tokenOpt match {
        case None => IO.pure(Response[IO](Status.Unauthorized))
        case Some(token) =>
          auth.securityLogic(token).flatMap {
            // 401/403 from the JWT path → close the upgrade with Unauthorized (no body, no detail — it's a socket).
            case Left(_) => IO.pure(Response[IO](Status.Unauthorized))
            case Right(p) =>
              val setup: ConnectionIO[(com.kanzen.authz.Authorizer, Option[AssigneeScope])] =
                for {
                  authz <- Authz.forUser(p.userId, p.role)
                  scope <-
                    if (p.role == "staff") PeopleRepo.assigneeScope(p.userId)
                    else Option.empty[AssigneeScope].pure[ConnectionIO]
                } yield (authz, scope)

              setup.transact(xa).flatMap { case (authz, scope) =>
                cats.effect.Ref[IO].of(Option.empty[(String, String)]).flatMap { viewing =>
                  val events: Stream[IO, WebSocketFrame] =
                    hub
                      .subscribe()
                      .evalFilter(ev => RealtimeFilter.visible(ev, p, authz, scope, xa))
                      .map(ev => WebSocketFrame.Text(ev.wire.noSpaces))
                  val keepAlive: Stream[IO, WebSocketFrame] =
                    Stream.awakeEvery[IO](25.seconds).as(WebSocketFrame.Ping())
                  val send = events.merge(keepAlive)

                  // F48 RT.3 — the client publishes which entity it's viewing: `{kind:"presence",entityType,entityId}`
                  // (empty entityId clears it). We leave the previous entity, enter the new, and clean up on close.
                  def onPresence(et: String, eid: String): IO[Unit] =
                    viewing.getAndSet(if (eid.isEmpty) None else Some((et, eid))).flatMap { prev =>
                      prev.traverse_ { case (pet, peid) =>
                        hub.leave(pet, peid, p.userId)
                      } *>
                        (if (eid.nonEmpty) hub.enter(et, eid, p.userId) else IO.unit)
                    }
                  def handle(f: WebSocketFrame): IO[Unit] = f match {
                    case WebSocketFrame.Text(txt, _) =>
                      io.circe.parser
                        .parse(txt)
                        .toOption
                        .flatMap { j =>
                          val c = j.hcursor
                          if (c.get[String]("kind").toOption.contains("presence"))
                            for {
                              et <- c.get[String]("entityType").toOption
                              eid <- c.get[String]("entityId").toOption
                            } yield onPresence(et, eid)
                          else None
                        }
                        .getOrElse(IO.unit)
                    case _ => IO.unit
                  }
                  val receive: Pipe[IO, WebSocketFrame, Unit] =
                    _.evalMap(handle).onFinalize(
                      viewing.get.flatMap(_.traverse_ { case (et, eid) => hub.leave(et, eid, p.userId) })
                    )
                  wsb.build(send, receive)
                }
              }
          }
      }
    }
}
