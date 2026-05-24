package com.kanzen.api

import cats.data.NonEmptyList
import cats.effect.IO
import cats.syntax.all._
import com.kanzen.asset.{Asset, AssetRepo, Category, TemplateRepo, TemplateService, ValuationRepo}
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

import java.util.UUID

/** F04 — the asset registry. Principal-private with the Manager carve-out (F02): Staff get 403 (asset = none);
  * Manager/Principal read+write. Field-level stripping of valuation fields is applied here once F20 adds them
  * (mechanism: Authorizer.filterReadable).
  */
object Assets {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  private val MODES = Set("unique", "grouped_quantity", "structured_set")

  final case class AssetView(
      id: UUID,
      title: String,
      maker: Option[String],
      categoryId: Option[UUID],
      trackingMode: String,
      quantity: Int,
      ownershipStatus: String
  )
  final case class AssetDetail(
      id: UUID,
      title: String,
      maker: Option[String],
      categoryId: Option[UUID],
      vertical: Option[String],
      trackingMode: String,
      quantity: Int,
      parentAssetId: Option[UUID],
      acquisitionCostMinor: Option[Long],
      acquisitionCurrency: Option[String],
      ownershipStatus: String,
      locationId: Option[UUID],
      attributes: Json,
      // F20 — Principal-only; stripped server-side for Manager (F02/F04 AC5)
      marketValueMinor: Option[Long] = None,
      insuredValueMinor: Option[Long] = None,
      valuationCurrency: Option[String] = None
  )
  final case class CategoryView(id: UUID, name: String, parentId: Option[UUID])
  final case class CreateReq(
      title: String,
      maker: Option[String],
      categoryId: UUID,
      vertical: Option[String],
      trackingMode: String,
      quantity: Int,
      parentAssetId: Option[UUID],
      acquisitionCostMinor: Option[Long],
      acquisitionCurrency: Option[String],
      locationId: Option[UUID],
      attributes: Option[Json]
  )

  private def view(a: Asset): AssetView =
    AssetView(a.id, a.title, a.maker, a.categoryId, a.trackingMode, a.quantity, a.ownershipStatus)
  private def detailOf(a: Asset): AssetDetail =
    AssetDetail(
      a.id,
      a.title,
      a.maker,
      a.categoryId,
      a.vertical,
      a.trackingMode,
      a.quantity,
      a.parentAssetId,
      a.acquisitionCostMinor,
      a.acquisitionCurrency,
      a.ownershipStatus,
      a.locationId,
      a.attributes
    )

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "no access to the registry"))
  private val notFound: (StatusCode, ApiError) = (StatusCode.NotFound, ApiError(404, "not_found", "No such asset."))
  private def badReq(msg: String): (StatusCode, ApiError) = (StatusCode.BadRequest, ApiError(400, "bad_request", msg))

  def list(xa: Transactor[IO], p: Principal, category: Option[UUID], q: Option[String]): IO[Out[List[AssetView]]] = {
    val tx = Authz.authorizer(p.role).flatMap { authz =>
      if (!authz.canRead("asset")) (Left(forbidden): Out[List[AssetView]]).pure[ConnectionIO]
      else
        category match {
          case None => AssetRepo.list(None, q).map(as => Right(as.map(view)): Out[List[AssetView]])
          case Some(cid) =>
            AssetRepo.categoryDescendants(cid).flatMap { ds =>
              NonEmptyList.fromList(ds) match {
                case None => (Right(List.empty[AssetView]): Out[List[AssetView]]).pure[ConnectionIO]
                case Some(nel) => AssetRepo.list(Some(nel), q).map(as => Right(as.map(view)): Out[List[AssetView]])
              }
            }
        }
    }
    tx.transact(xa)
  }

  def categories(xa: Transactor[IO], p: Principal): IO[Out[List[CategoryView]]] = {
    val tx = Authz.authorizer(p.role).flatMap { authz =>
      if (!authz.canRead("asset")) (Left(forbidden): Out[List[CategoryView]]).pure[ConnectionIO]
      else
        AssetRepo.listCategories.map(cs =>
          Right(cs.map(c => CategoryView(c.id, c.name, c.parentId))): Out[List[CategoryView]]
        )
    }
    tx.transact(xa)
  }

  def detail(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[AssetDetail]] = {
    val tx = Authz.authorizer(p.role).flatMap { authz =>
      if (!authz.canRead("asset")) (Left(forbidden): Out[AssetDetail]).pure[ConnectionIO]
      else
        AssetRepo.get(id).flatMap {
          case None => (Left(notFound): Out[AssetDetail]).pure[ConnectionIO]
          case Some(a) =>
            // Field-level stripping (F02/F04 AC5): valuation is read only if the role may
            // read the field — Manager is denied (asset.market_value/insured_value = none).
            val mkt =
              if (authz.canRead("asset", Some("market_value"))) ValuationRepo.latest(a.id, "market")
              else Option.empty[com.kanzen.asset.Valuation].pure[ConnectionIO]
            val ins =
              if (authz.canRead("asset", Some("insured_value"))) ValuationRepo.latest(a.id, "insured")
              else Option.empty[com.kanzen.asset.Valuation].pure[ConnectionIO]
            for { m <- mkt; i <- ins } yield Right(
              detailOf(a).copy(
                marketValueMinor = m.map(_.amountMinor),
                insuredValueMinor = i.map(_.amountMinor),
                valuationCurrency = m.map(_.currency).orElse(i.map(_.currency))
              )
            ): Out[AssetDetail]
        }
    }
    tx.transact(xa)
  }

  def create(xa: Transactor[IO], p: Principal, req: CreateReq): IO[Out[AssetDetail]] = {
    if (!MODES.contains(req.trackingMode))
      IO.pure(Left(badReq(s"tracking_mode must be one of ${MODES.mkString(", ")}")))
    else if (req.quantity < 1) IO.pure(Left(badReq("quantity must be ≥ 1")))
    else {
      val attrs = req.attributes.getOrElse(Json.obj())
      val tx = for {
        authz <- Authz.authorizer(p.role)
        catOk <- AssetRepo.categoryExists(req.categoryId)
        parentOk <- req.parentAssetId.fold(true.pure[ConnectionIO])(AssetRepo.exists)
        // F22: validate attributes against the vertical's template (if any). Unknown keys
        // are allowed (freehand); required/typed keys are enforced.
        tplErrors <- req.vertical.fold(List.empty[String].pure[ConnectionIO])(v =>
          TemplateRepo
            .schemaFor(v)
            .map(_.fold(List.empty[String])(s => TemplateService.validate(attrs, TemplateService.parseSchema(s))))
        )
        res <-
          if (!authz.can(Level.Write, "asset")) (Left(forbidden): Out[AssetDetail]).pure[ConnectionIO]
          else if (!catOk) (Left(badReq("category not found")): Out[AssetDetail]).pure[ConnectionIO]
          else if (!parentOk) (Left(badReq("parent asset not found")): Out[AssetDetail]).pure[ConnectionIO]
          else if (tplErrors.nonEmpty)
            (Left(badReq(s"attributes invalid: ${tplErrors.mkString("; ")}")): Out[AssetDetail]).pure[ConnectionIO]
          else
            AssetRepo
              .insert(
                p.userId,
                req.title,
                req.maker,
                req.categoryId,
                req.vertical,
                req.trackingMode,
                req.quantity,
                req.parentAssetId,
                req.acquisitionCostMinor,
                req.acquisitionCurrency,
                req.locationId,
                attrs
              )
              .map(a => Right(detailOf(a)): Out[AssetDetail])
      } yield res
      tx.transact(xa)
    }
  }

  // ---- endpoints ----
  private val err = statusCode.and(jsonBody[ApiError])

  val listEndpoint: Endpoint[String, (Option[UUID], Option[String]), (StatusCode, ApiError), List[AssetView], Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "assets")
      .in(query[Option[UUID]]("category"))
      .in(query[Option[String]]("q"))
      .errorOut(err)
      .out(jsonBody[List[AssetView]])
      .summary("List assets (Principal-private; faceted by category/q)")

  val detailEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), AssetDetail, Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "assets" / path[UUID]("id"))
      .errorOut(err)
      .out(jsonBody[AssetDetail])
      .summary("An asset (field-filtered by role)")

  val createEndpoint: Endpoint[String, CreateReq, (StatusCode, ApiError), AssetDetail, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "assets")
      .in(jsonBody[CreateReq])
      .errorOut(err)
      .out(jsonBody[AssetDetail])
      .summary("Create an asset (Manager+; tracking modes unique/grouped/structured)")

  val categoriesEndpoint: Endpoint[String, Unit, (StatusCode, ApiError), List[CategoryView], Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "categories")
      .errorOut(err)
      .out(jsonBody[List[CategoryView]])
      .summary("The asset category tree (Principal-private)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    listEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (cat, q) => list(xa, p, cat, q) }),
    detailEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => detail(xa, p, id)),
    createEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: CreateReq) => create(xa, p, r)),
    categoriesEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => categories(xa, p))
  )

  val endpoints: List[AnyEndpoint] = List(listEndpoint, detailEndpoint, createEndpoint, categoriesEndpoint)
}
