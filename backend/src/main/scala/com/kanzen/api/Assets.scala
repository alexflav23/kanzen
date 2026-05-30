package com.kanzen.api

import cats.data.NonEmptyList
import cats.effect.IO
import cats.syntax.all._
import com.kanzen.asset.{
  Asset,
  AssetRepo,
  Category,
  CustodyHistoryRow,
  LocationHistoryRow,
  TemplateRepo,
  TemplateService,
  ValuationRepo
}
import com.kanzen.audit.AuditRepo
import com.kanzen.events.{Actor, Envelope, EventRepo, Events, Subject}
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Actions, Authz, Scope}
import com.kanzen.docs.DocumentRepo
import com.kanzen.property.PropertyRepo
import com.kanzen.s3.ObjectStore
import doobie.ConnectionIO
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import io.circe.syntax._
import io.circe.generic.auto._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

import java.time.LocalDate
import java.util.UUID

/** F04 — the asset registry. Principal-private with the Manager carve-out (F02): Staff get 403 (asset = none);
  * Manager/Principal read+write. Field-level stripping of valuation fields is applied here once F20 adds them
  * (mechanism: Authorizer.filterReadable).
  */
object Assets {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  // F02 v2 — the catalogue actions this domain gates on. `can(action)` falls back to the legacy level (asset:view=Read,
  // the rest=Write) for un-granted roles, so this is behaviour-preserving while enabling per-action set grants + scope.
  private val viewA = Actions.byKey("asset:view")
  private val createA = Actions.byKey("asset:create")
  private val editA = Actions.byKey("asset:edit")
  private val moveA = Actions.byKey("asset:move")
  private val custodyA = Actions.byKey("asset:custody")
  private val heroA = Actions.byKey("asset:set_hero")

  private val MODES = Set("unique", "grouped_quantity", "structured_set")
  private val STATUSES = Set("owned", "sold", "gifted", "lost", "stolen", "archived")

  final case class AssetView(
      id: UUID,
      title: String,
      maker: Option[String],
      categoryId: Option[UUID],
      trackingMode: String,
      quantity: Int,
      ownershipStatus: String,
      acquisitionCostMinor: Option[Long],
      acquisitionCurrency: Option[String],
      propertyId: Option[UUID],
      locationId: Option[UUID] = None, // F03 W4: current node, for grouping under the Bible's location tree
      heroUrl: Option[String] = None, // F04: signed blob URL of the hero photo (for the grid card thumbnail)
      attributes: Json =
        Json.obj() // F22/F24: typed vertical attributes (e.g. vehicle reg/colour/MOT) for bespoke cards
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
      acquisitionDate: Option[LocalDate],
      ownershipStatus: String,
      locationId: Option[UUID],
      attributes: Json,
      custodyStatus: String,
      heroDocumentId: Option[UUID],
      // resolved current-location label (W1.4)
      locationName: Option[String] = None,
      propertyName: Option[String] = None,
      // F20 — Principal-only; stripped server-side for Manager (F02/F04 AC5)
      marketValueMinor: Option[Long] = None,
      insuredValueMinor: Option[Long] = None,
      valuationCurrency: Option[String] = None
  )
  final case class CategoryView(id: UUID, name: String, parentId: Option[UUID])
  // W1.4 — move / custody / hero requests + history views
  final case class MoveReq(locationId: Option[UUID], note: Option[String])
  final case class CustodyReq(custodyStatus: String, note: Option[String])
  final case class HeroReq(documentId: UUID)
  final case class LocationHistoryView(
      id: UUID,
      locationName: Option[String],
      propertyName: Option[String],
      movedBy: Option[String],
      movedAt: String,
      note: Option[String]
  )
  final case class CustodyHistoryView(
      id: UUID,
      custodyStatus: String,
      changedBy: Option[String],
      changedAt: String,
      note: Option[String]
  )
  final case class HistoryView(location: List[LocationHistoryView], custody: List[CustodyHistoryView])
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
      acquisitionDate: Option[LocalDate] = None,
      locationId: Option[UUID],
      attributes: Option[Json]
  )
  final case class EditReq(title: String, maker: Option[String], categoryId: UUID, ownershipStatus: String)

  private def view(a: Asset, propertyId: Option[UUID], heroUrl: Option[String]): AssetView =
    AssetView(
      a.id,
      a.title,
      a.maker,
      a.categoryId,
      a.trackingMode,
      a.quantity,
      a.ownershipStatus,
      a.acquisitionCostMinor,
      a.acquisitionCurrency,
      propertyId,
      a.locationId,
      heroUrl,
      a.attributes
    )
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
      a.acquisitionDate,
      a.ownershipStatus,
      a.locationId,
      a.attributes,
      a.custodyStatus,
      a.heroDocumentId
    )

  private val CUSTODY =
    Set("with_owner", "with_manager", "on_loan", "in_storage", "with_repair_shop", "in_transit")

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "no access to the registry"))
  private val notFound: (StatusCode, ApiError) = (StatusCode.NotFound, ApiError(404, "not_found", "No such asset."))
  private def badReq(msg: String): (StatusCode, ApiError) = (StatusCode.BadRequest, ApiError(400, "bad_request", msg))

  private val HERO_TTL = 3600 // grid thumbnails — long enough to outlast a browsing session

  def list(
      xa: Transactor[IO],
      p: Principal,
      store: ObjectStore,
      category: Option[UUID],
      q: Option[String],
      vertical: Option[String] = None,
      property: Option[UUID] = None,
      collection: Option[UUID] = None,
      status: Option[String] = None,
      tag: Option[UUID] = None,
      location: Option[UUID] = None
  ): IO[Out[List[AssetView]]] = {
    type Rows = List[(Asset, Option[UUID], Option[String])]
    val tx: ConnectionIO[Out[Rows]] = Authz.forUser(p.userId, p.role).flatMap { authz =>
      // Own-scope (F02 v2): a grant scoped to records I created restricts the list to my own assets.
      val owner = if (authz.scopeFor(viewA) == Scope.Own) Some(p.userId) else None
      def run(cats: Option[NonEmptyList[UUID]]) =
        AssetRepo.list(cats, q, vertical, property, collection, status, owner, tag, location).map(Right(_): Out[Rows])
      if (!authz.can(viewA)) (Left(forbidden): Out[Rows]).pure[ConnectionIO]
      else
        category match {
          case None => run(None)
          case Some(cid) =>
            AssetRepo.categoryDescendants(cid).flatMap { ds =>
              NonEmptyList.fromList(ds) match {
                case None => (Right(List.empty[(Asset, Option[UUID], Option[String])]): Out[Rows]).pure[ConnectionIO]
                case Some(nel) => run(Some(nel))
              }
            }
        }
    }
    // Presign each hero key into a browser-fetchable blob URL (one signature per card; assets without a hero stay None).
    tx.transact(xa).flatMap {
      case Left(e) => IO.pure(Left(e))
      case Right(rows) =>
        rows
          .traverse { case (a, propId, heroKey) =>
            heroKey
              .fold(IO.pure(Option.empty[String]))(k => store.presignGet(k, HERO_TTL).map(Some(_)))
              .map(view(a, propId, _))
          }
          .map(vs => Right(vs): Out[List[AssetView]])
    }
  }

  def categories(xa: Transactor[IO], p: Principal): IO[Out[List[CategoryView]]] = {
    val tx = Authz.forUser(p.userId, p.role).flatMap { authz =>
      if (!authz.can(viewA)) (Left(forbidden): Out[List[CategoryView]]).pure[ConnectionIO]
      else
        AssetRepo.listCategories.map(cs =>
          Right(cs.map(c => CategoryView(c.id, c.name, c.parentId))): Out[List[CategoryView]]
        )
    }
    tx.transact(xa)
  }

  /** Build the field-filtered detail (valuation stripping + resolved location label) for a principal. */
  private def loadDetail(p: Principal, id: UUID): ConnectionIO[Out[AssetDetail]] =
    Authz.forUser(p.userId, p.role).flatMap { authz =>
      if (!authz.can(viewA)) (Left(forbidden): Out[AssetDetail]).pure[ConnectionIO]
      else
        AssetRepo.get(id).flatMap {
          case None => (Left(notFound): Out[AssetDetail]).pure[ConnectionIO]
          case Some(a) =>
            // Own-scope (F02 v2): a view grant scoped to records I created hides others (no leak → 404).
            val ownerOk =
              if (authz.scopeFor(viewA) == Scope.Own) AssetRepo.ownerOf(id).map(_.contains(p.userId))
              else true.pure[ConnectionIO]
            ownerOk.flatMap {
              case false => (Left(notFound): Out[AssetDetail]).pure[ConnectionIO]
              case true =>
                // Field-level stripping (F02/F04 AC5): valuation is read only if the role may
                // read the field — Manager is denied (asset.market_value/insured_value = none).
                val mkt =
                  if (authz.canRead("asset", Some("market_value"))) ValuationRepo.latest(a.id, "market")
                  else Option.empty[com.kanzen.asset.Valuation].pure[ConnectionIO]
                val ins =
                  if (authz.canRead("asset", Some("insured_value"))) ValuationRepo.latest(a.id, "insured")
                  else Option.empty[com.kanzen.asset.Valuation].pure[ConnectionIO]
                val lbl = a.locationId
                  .fold(Option.empty[com.kanzen.asset.LocationLabel].pure[ConnectionIO])(AssetRepo.locationLabel)
                for { m <- mkt; i <- ins; l <- lbl } yield Right(
                  detailOf(a).copy(
                    locationName = l.map(_.locationName),
                    propertyName = l.map(_.propertyName),
                    marketValueMinor = m.map(_.amountMinor),
                    insuredValueMinor = i.map(_.amountMinor),
                    valuationCurrency = m.map(_.currency).orElse(i.map(_.currency))
                  )
                ): Out[AssetDetail]
            }
        }
    }

  def detail(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[AssetDetail]] =
    loadDetail(p, id).transact(xa)

  /** F34 — emit an asset-subject event (the realtime layer (F48) live-updates the asset view; the RAG IndexConsumer
    * re-indexes immediately rather than waiting on the ~15s reconcile loop). Runs in the caller's tx beside the write.
    */
  private def emitAsset(p: Principal, id: UUID, eventType: String, payload: Json): ConnectionIO[Unit] =
    EventRepo.emit(Envelope(eventType, Actor.user(p.userId), Subject("asset", id), p.userId, None, payload)).void

  def create(xa: Transactor[IO], p: Principal, req: CreateReq): IO[Out[AssetDetail]] = {
    if (!MODES.contains(req.trackingMode))
      IO.pure(Left(badReq(s"tracking_mode must be one of ${MODES.mkString(", ")}")))
    else if (req.quantity < 1) IO.pure(Left(badReq("quantity must be ≥ 1")))
    else {
      val attrs = req.attributes.getOrElse(Json.obj())
      val tx = for {
        authz <- Authz.forUser(p.userId, p.role)
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
          if (!authz.can(createA)) (Left(forbidden): Out[AssetDetail]).pure[ConnectionIO]
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
                req.acquisitionDate,
                req.locationId,
                attrs
              )
              .flatMap(a =>
                emitAsset(
                  p,
                  a.id,
                  Events.Asset.Created,
                  Json.obj(
                    "title" -> req.title.asJson,
                    "categoryId" -> req.categoryId.asJson,
                    "vertical" -> req.vertical.asJson
                  )
                ).as(Right(detailOf(a)): Out[AssetDetail])
              )
      } yield res
      tx.transact(xa)
    }
  }

  /** Edit an existing asset's key facts (the generic record edit — Manager+). */
  def update(xa: Transactor[IO], p: Principal, id: UUID, req: EditReq): IO[Out[AssetDetail]] = {
    if (req.title.trim.isEmpty) IO.pure(Left(badReq("title is required")))
    else if (!STATUSES.contains(req.ownershipStatus))
      IO.pure(Left(badReq(s"status must be one of ${STATUSES.mkString(", ")}")))
    else {
      val tx = for {
        authz <- Authz.forUser(p.userId, p.role)
        exists <- AssetRepo.exists(id)
        catOk <- AssetRepo.categoryExists(req.categoryId)
        res <-
          if (!authz.can(editA)) (Left(forbidden): Out[AssetDetail]).pure[ConnectionIO]
          else if (!exists) (Left(notFound): Out[AssetDetail]).pure[ConnectionIO]
          else if (!catOk) (Left(badReq("category not found")): Out[AssetDetail]).pure[ConnectionIO]
          else
            AssetRepo.update(id, req.title.trim, req.maker, req.categoryId, req.ownershipStatus) *>
              emitAsset(
                p,
                id,
                Events.Asset.Updated,
                Json.obj(
                  "title" -> req.title.trim.asJson,
                  "ownershipStatus" -> req.ownershipStatus.asJson,
                  "categoryId" -> req.categoryId.asJson
                )
              ) *>
              AssetRepo.get(id).map(_.map(detailOf).toRight(notFound): Out[AssetDetail])
      } yield res
      tx.transact(xa)
    }
  }

  /** Move the asset to a new location — Manager+. The target location must be in the actor's scope (AC4: a
    * Wardian-scoped Manager moving to a Singapore location → 403). Updates the current location AND writes an
    * `asset_location_history` row (corrections are events) + audit.
    */
  def move(xa: Transactor[IO], p: Principal, id: UUID, req: MoveReq): IO[Out[AssetDetail]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      exists <- AssetRepo.exists(id)
      scoped <- PropertyRepo.listForPrincipal(p.userId).map(_.map(_.id).toSet)
      targetProp <- req.locationId.fold(Option.empty[UUID].pure[ConnectionIO])(AssetRepo.propertyOfLocation)
      res <-
        if (!authz.can(moveA)) (Left(forbidden): Out[Unit]).pure[ConnectionIO]
        else if (!exists) (Left(notFound): Out[Unit]).pure[ConnectionIO]
        else if (req.locationId.isDefined && targetProp.isEmpty)
          (Left(badReq("location not found")): Out[Unit]).pure[ConnectionIO]
        else if (targetProp.exists(tp => !scoped.contains(tp)))
          (Left(forbidden): Out[Unit]).pure[ConnectionIO] // AC4 — target location out of the actor's scope
        else
          (AssetRepo.move(id, req.locationId, p.userId, req.note) *>
            AuditRepo.write(
              "user",
              Some(p.userId),
              "asset.move",
              Some("asset"),
              Some(id),
              Json.obj("locationId" -> req.locationId.map(_.toString).asJson, "note" -> req.note.asJson),
              Some(p.userId)
            ) *>
            emitAsset(
              p,
              id,
              Events.Asset.Moved,
              Json.obj(
                "to_location_id" -> req.locationId.map(_.toString).asJson,
                "moved_by" -> p.userId.asJson,
                "note" -> req.note.asJson
              )
            )).as(Right(()): Out[Unit])
    } yield res
    tx.transact(xa).flatMap {
      case Left(e) => IO.pure(Left(e))
      case Right(_) => detail(xa, p, id) // refreshed detail (resolved location label)
    }
  }

  /** Change custody — Manager+. Updates current custody AND writes an `asset_custody_history` row + audit. */
  def changeCustody(xa: Transactor[IO], p: Principal, id: UUID, req: CustodyReq): IO[Out[AssetDetail]] =
    if (!CUSTODY.contains(req.custodyStatus))
      IO.pure(Left(badReq(s"custody_status must be one of ${CUSTODY.mkString(", ")}")))
    else {
      val tx = for {
        authz <- Authz.forUser(p.userId, p.role)
        exists <- AssetRepo.exists(id)
        res <-
          if (!authz.can(custodyA)) (Left(forbidden): Out[Unit]).pure[ConnectionIO]
          else if (!exists) (Left(notFound): Out[Unit]).pure[ConnectionIO]
          else
            (AssetRepo.changeCustody(id, req.custodyStatus, p.userId, req.note) *>
              AuditRepo.write(
                "user",
                Some(p.userId),
                "asset.custody",
                Some("asset"),
                Some(id),
                Json.obj("custodyStatus" -> req.custodyStatus.asJson, "note" -> req.note.asJson),
                Some(p.userId)
              ) *>
              emitAsset(
                p,
                id,
                Events.Asset.CustodyChanged,
                Json.obj(
                  "to_status" -> req.custodyStatus.asJson,
                  "changed_by" -> p.userId.asJson,
                  "note" -> req.note.asJson
                )
              )).as(Right(()): Out[Unit])
      } yield res
      tx.transact(xa).flatMap {
        case Left(e) => IO.pure(Left(e))
        case Right(_) => detail(xa, p, id)
      }
    }

  /** Set the hero photo from an existing document (F05) — Manager+. */
  def setHero(xa: Transactor[IO], p: Principal, id: UUID, req: HeroReq): IO[Out[AssetDetail]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      exists <- AssetRepo.exists(id)
      doc <- DocumentRepo.find(req.documentId)
      res <-
        if (!authz.can(heroA)) (Left(forbidden): Out[Unit]).pure[ConnectionIO]
        else if (!exists) (Left(notFound): Out[Unit]).pure[ConnectionIO]
        else if (doc.isEmpty) (Left(badReq("document not found")): Out[Unit]).pure[ConnectionIO]
        else
          (AssetRepo.setHero(id, req.documentId) *>
            AuditRepo.write(
              "user",
              Some(p.userId),
              "asset.hero",
              Some("asset"),
              Some(id),
              Json.obj("documentId" -> req.documentId.toString.asJson),
              Some(p.userId)
            ) *>
            emitAsset(p, id, Events.Asset.SetHero, Json.obj("document_id" -> req.documentId.toString.asJson)))
            .as(Right(()): Out[Unit])
    } yield res
    tx.transact(xa).flatMap {
      case Left(e) => IO.pure(Left(e))
      case Right(_) => detail(xa, p, id)
    }
  }

  /** Location + custody history (newest first) — Manager+ read. */
  def history(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[HistoryView]] = {
    val tx = Authz.forUser(p.userId, p.role).flatMap { authz =>
      if (!authz.can(viewA)) (Left(forbidden): Out[HistoryView]).pure[ConnectionIO]
      else
        for {
          loc <- AssetRepo.locationHistory(id)
          cus <- AssetRepo.custodyHistory(id)
        } yield Right(
          HistoryView(
            loc.map((r: LocationHistoryRow) =>
              LocationHistoryView(r.id, r.locationName, r.propertyName, r.movedBy, r.movedAt.toString, r.note)
            ),
            cus.map((r: CustodyHistoryRow) =>
              CustodyHistoryView(r.id, r.custodyStatus, r.changedBy, r.changedAt.toString, r.note)
            )
          )
        ): Out[HistoryView]
    }
    tx.transact(xa)
  }

  // ---- endpoints ----
  private val err = statusCode.and(jsonBody[ApiError])

  val listEndpoint: Endpoint[
    String,
    (
        Option[UUID],
        Option[String],
        Option[String],
        Option[UUID],
        Option[UUID],
        Option[String],
        Option[UUID],
        Option[UUID]
    ),
    (StatusCode, ApiError),
    List[AssetView],
    Any
  ] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "assets")
      .in(query[Option[UUID]]("category"))
      .in(query[Option[String]]("q"))
      .in(query[Option[String]]("vertical"))
      .in(query[Option[UUID]]("property"))
      .in(query[Option[UUID]]("collection"))
      .in(query[Option[String]]("status"))
      .in(query[Option[UUID]]("tag"))
      .in(query[Option[UUID]]("location"))
      .errorOut(err)
      .out(jsonBody[List[AssetView]])
      .summary(
        "List assets (Principal-private; faceted by category/q/vertical/property/collection/status/tag/location)"
      )

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

  val patchEndpoint: Endpoint[String, (UUID, EditReq), (StatusCode, ApiError), AssetDetail, Any] =
    sttp.tapir.endpoint.patch
      .securityIn(auth.bearer[String]())
      .in("api" / "assets" / path[UUID]("id"))
      .in(jsonBody[EditReq])
      .errorOut(err)
      .out(jsonBody[AssetDetail])
      .summary("Edit an asset's key facts (Manager+)")

  val categoriesEndpoint: Endpoint[String, Unit, (StatusCode, ApiError), List[CategoryView], Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "categories")
      .errorOut(err)
      .out(jsonBody[List[CategoryView]])
      .summary("The asset category tree (Principal-private)")

  val moveEndpoint: Endpoint[String, (UUID, MoveReq), (StatusCode, ApiError), AssetDetail, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "assets" / path[UUID]("id") / "location")
      .in(jsonBody[MoveReq])
      .errorOut(err)
      .out(jsonBody[AssetDetail])
      .summary("Move an asset to a location (Manager+; target must be in scope) — writes location history")

  val custodyEndpoint: Endpoint[String, (UUID, CustodyReq), (StatusCode, ApiError), AssetDetail, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "assets" / path[UUID]("id") / "custody")
      .in(jsonBody[CustodyReq])
      .errorOut(err)
      .out(jsonBody[AssetDetail])
      .summary("Change an asset's custody (Manager+) — writes custody history")

  val heroEndpoint: Endpoint[String, (UUID, HeroReq), (StatusCode, ApiError), AssetDetail, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "assets" / path[UUID]("id") / "hero-photo")
      .in(jsonBody[HeroReq])
      .errorOut(err)
      .out(jsonBody[AssetDetail])
      .summary("Set an asset's hero photo from a document (Manager+)")

  val historyEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), HistoryView, Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "assets" / path[UUID]("id") / "history")
      .errorOut(err)
      .out(jsonBody[HistoryView])
      .summary("Location + custody history for an asset (newest first)")

  def serverEndpoints(a: Auth, xa: Transactor[IO], store: ObjectStore): List[ServerEndpoint[Any, IO]] = List(
    listEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (cat, q, vert, prop, coll, st, tag, loc) =>
        list(xa, p, store, cat, q, vert, prop, coll, st, tag, loc)
      }),
    detailEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => detail(xa, p, id)),
    createEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: CreateReq) => create(xa, p, r)),
    patchEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (id: UUID, r: EditReq) => update(xa, p, id, r) }),
    categoriesEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => categories(xa, p)),
    moveEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => move(xa, p, id, r) }),
    custodyEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (id, r) => changeCustody(xa, p, id, r) }),
    heroEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => setHero(xa, p, id, r) }),
    historyEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => history(xa, p, id))
  )

  val endpoints: List[AnyEndpoint] =
    List(
      listEndpoint,
      detailEndpoint,
      createEndpoint,
      patchEndpoint,
      categoriesEndpoint,
      moveEndpoint,
      custodyEndpoint,
      heroEndpoint,
      historyEndpoint
    )
}
