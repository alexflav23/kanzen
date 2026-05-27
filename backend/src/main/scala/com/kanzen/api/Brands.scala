package com.kanzen.api

import cats.effect.IO
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.brand.BrandRepo
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.generic.auto._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

import java.util.UUID

/** The global brand catalogue (specs/03-brand-catalogue.md): shared, crowd-enriched maker/brand reference data with
  * per-account hot caches. Any **authenticated** principal may read + add — brands are shared reference data, not
  * Principal-private. Stays global under future multi-tenancy.
  */
object Brands {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class BrandView(id: UUID, name: String, category: String, status: String)
  final case class RecordReq(name: String, category: String)

  // Asset category name → canonical catalogue key (case-insensitive, with a few aliases).
  private val ALIASES = Map(
    "jewelry" -> "jewellery",
    "cars" -> "vehicles",
    "car" -> "vehicles",
    "vehicle" -> "vehicles",
    "automobiles" -> "vehicles",
    "fashion" -> "clothing",
    "apparel" -> "clothing",
    "watch" -> "watches",
    "guitar" -> "guitars",
    "instrument" -> "guitars",
    "instruments" -> "guitars"
  )
  private def normCat(c: String): String = {
    val k = c.trim.toLowerCase
    ALIASES.getOrElse(k, k)
  }
  private def view(b: com.kanzen.brand.Brand): BrandView = BrandView(b.id, b.name, b.category, b.status)
  private def badReq(m: String): (StatusCode, ApiError) = (StatusCode.BadRequest, ApiError(400, "bad_request", m))

  /** Ranked suggestions for a category (hot cache → global usage → verified → alpha). */
  def search(
      xa: Transactor[IO],
      p: Principal,
      category: String,
      q: Option[String],
      limit: Option[Int]
  ): IO[Out[List[BrandView]]] =
    BrandRepo
      .search(normCat(category), q, p.userId, limit.getOrElse(8).max(1).min(50))
      .map(bs => Right(bs.map(view)): Out[List[BrandView]])
      .transact(xa)

  /** Find-or-create + record a use — populates the catalogue + this account's hot cache. */
  def record(xa: Transactor[IO], p: Principal, req: RecordReq): IO[Out[BrandView]] =
    if (req.name.trim.isEmpty) IO.pure(Left(badReq("name is required")))
    else if (req.category.trim.isEmpty) IO.pure(Left(badReq("category is required")))
    else
      BrandRepo
        .findOrCreateAndUse(normCat(req.category), req.name.trim, p.userId)
        .map(b => Right(view(b)): Out[BrandView])
        .transact(xa)

  // ---- endpoints ----
  private val err = statusCode.and(jsonBody[ApiError])

  val searchEndpoint
      : Endpoint[String, (String, Option[String], Option[Int]), (StatusCode, ApiError), List[BrandView], Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "brands")
      .in(query[String]("category"))
      .in(query[Option[String]]("q"))
      .in(query[Option[Int]]("limit"))
      .errorOut(err)
      .out(jsonBody[List[BrandView]])
      .summary("Search the brand catalogue for a category (ranked: hot cache → usage → verified)")

  val recordEndpoint: Endpoint[String, RecordReq, (StatusCode, ApiError), BrandView, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "brands")
      .in(jsonBody[RecordReq])
      .errorOut(err)
      .out(jsonBody[BrandView])
      .summary("Add a brand to the global catalogue + record a use (find-or-create; crowd enrichment)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    searchEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (cat, q, lim) => search(xa, p, cat, q, lim) }),
    recordEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: RecordReq) => record(xa, p, r))
  )

  val endpoints: List[AnyEndpoint] = List(searchEndpoint, recordEndpoint)
}
