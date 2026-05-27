package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.asset.{TemplateRepo, TemplateService}
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Authz, Level}
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

/** F22 — category templates: typed per-vertical attribute schemas that validate the asset JSONB (wired into asset
  * create) and drive the Specifications UI.
  */
object Templates {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class FieldView(key: String, fieldType: String, required: Boolean)
  final case class CreateReq(verticalKey: String, name: Option[String], fields: List[FieldView])

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "no access to templates"))

  private def toJson(fields: List[FieldView]): Json =
    Json.arr(
      fields.map(f =>
        Json.obj(
          "key" -> Json.fromString(f.key),
          "type" -> Json.fromString(f.fieldType),
          "required" -> Json.fromBoolean(f.required)
        )
      ): _*
    )

  def schema(xa: Transactor[IO], p: Principal, vertical: String): IO[Out[List[FieldView]]] = {
    val tx = Authz.forUser(p.userId, p.role).flatMap { authz =>
      if (!authz.canRead("asset")) (Left(forbidden): Out[List[FieldView]]).pure[ConnectionIO]
      else
        TemplateRepo.schemaFor(vertical).map { s =>
          val fields = s.fold(List.empty[FieldView])(j =>
            TemplateService.parseSchema(j).map(f => FieldView(f.key, f.fieldType, f.required))
          )
          Right(fields): Out[List[FieldView]]
        }
    }
    tx.transact(xa)
  }

  def create(xa: Transactor[IO], p: Principal, req: CreateReq): IO[Out[List[FieldView]]] = {
    val tx = Authz.forUser(p.userId, p.role).flatMap { authz =>
      if (!authz.can(Level.Write, "asset")) (Left(forbidden): Out[List[FieldView]]).pure[ConnectionIO]
      else
        TemplateRepo.create(req.verticalKey, req.name, toJson(req.fields)).as(Right(req.fields): Out[List[FieldView]])
    }
    tx.transact(xa)
  }

  private val err = statusCode.and(jsonBody[ApiError])

  val schemaEndpoint: Endpoint[String, String, (StatusCode, ApiError), List[FieldView], Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "templates" / path[String]("vertical"))
      .errorOut(err)
      .out(jsonBody[List[FieldView]])
      .summary("Typed attribute schema for a vertical")

  val createEndpoint: Endpoint[String, CreateReq, (StatusCode, ApiError), List[FieldView], Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "templates")
      .in(jsonBody[CreateReq])
      .errorOut(err)
      .out(jsonBody[List[FieldView]])
      .summary("Create/version a category template (Manager+)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    schemaEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (v: String) => schema(xa, p, v)),
    createEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: CreateReq) => create(xa, p, r))
  )

  val endpoints: List[AnyEndpoint] = List(schemaEndpoint, createEndpoint)
}
