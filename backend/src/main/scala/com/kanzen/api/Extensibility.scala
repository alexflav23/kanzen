package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Authz, Level}
import com.kanzen.ext.{CustomFieldDef, CustomFieldRepo, Tag, TagRepo, Taxonomy, TaxonomyRepo}
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

/** F33 — extensibility: polymorphic tags, user-defined infinite taxonomies, and typed custom-field definitions.
  * Principal defines taxonomies/fields; Manager uses them (tag/categorise); Staff read. Values live in each host
  * entity's `attributes` and inherit its permissions/scope (a `sensitive` field is stripped for non-Principal —
  * [[Attributes]]).
  */
object Extensibility {
  private type Out[A] = Either[(StatusCode, ApiError), A]
  private val ENTITIES = Set("asset", "vendor", "product", "person", "property", "document", "list_item")
  private val TYPES = Set("text", "number", "money", "date", "bool", "enum", "url")

  final case class TagView(id: UUID, name: String)
  final case class CreateTagReq(name: String)
  final case class TagLinkReq(tagId: UUID, entityType: String, entityId: UUID)
  final case class TaggedEntity(entityType: String, entityId: UUID)

  final case class TaxonomyView(id: UUID, name: String, appliesTo: String, isSystem: Boolean)
  final case class CreateTaxonomyReq(name: String, appliesTo: String)
  final case class NodeReq(parentId: Option[UUID], name: String)
  final case class NodeView(id: UUID, parentId: Option[UUID], name: String)
  final case class TaxonomyLinkReq(nodeId: UUID, entityType: String, entityId: UUID)

  final case class CustomFieldView(
      id: UUID,
      entityType: String,
      key: String,
      label: String,
      `type`: String,
      enumValues: Option[List[String]],
      sensitive: Boolean
  )
  final case class CreateFieldReq(
      entityType: String,
      key: String,
      label: String,
      `type`: String,
      enumValues: Option[List[String]],
      sensitive: Option[Boolean]
  )
  final case class Ok(ok: Boolean)

  private def enums(j: Option[Json]): Option[List[String]] = j.flatMap(_.asArray).map(_.flatMap(_.asString).toList)
  private def tv(t: Tag): TagView = TagView(t.id, t.name)
  private def xv(t: Taxonomy): TaxonomyView = TaxonomyView(t.id, t.name, t.appliesTo, t.isSystem)
  private def cv(d: CustomFieldDef): CustomFieldView =
    CustomFieldView(d.id, d.entityType, d.key, d.label, d.`type`, enums(d.enumValues), d.sensitive)

  private val forbidden: (StatusCode, ApiError) = (StatusCode.Forbidden, ApiError(403, "forbidden", "no access"))
  private val notFound: (StatusCode, ApiError) = (StatusCode.NotFound, ApiError(404, "not_found", "not found"))
  private def badReq(m: String): (StatusCode, ApiError) = (StatusCode.BadRequest, ApiError(400, "bad_request", m))

  private def gate[A](p: Principal, level: Level, resource: String)(q: ConnectionIO[A]): ConnectionIO[Out[A]] =
    Authz
      .authorizer(p.role)
      .flatMap(a =>
        if (a.can(level, resource)) q.map(Right(_): Out[A]) else (Left(forbidden): Out[A]).pure[ConnectionIO]
      )

  // ---- tags -------------------------------------------------------------------------------
  def tags(xa: Transactor[IO], p: Principal): IO[Out[List[TagView]]] =
    gate(p, Level.Read, "tag")(TagRepo.list.map(_.map(tv))).transact(xa)
  def createTag(xa: Transactor[IO], p: Principal, r: CreateTagReq): IO[Out[TagView]] =
    if (r.name.trim.isEmpty) IO.pure(Left(badReq("name required")))
    else gate(p, Level.Write, "tag")(TagRepo.createTag(r.name, None).map(id => TagView(id, r.name))).transact(xa)
  def tagEntity(xa: Transactor[IO], p: Principal, r: TagLinkReq): IO[Out[Ok]] =
    if (!ENTITIES.contains(r.entityType)) IO.pure(Left(badReq(s"entityType must be one of ${ENTITIES.mkString(", ")}")))
    else gate(p, Level.Write, "tag")(TagRepo.tagEntity(r.tagId, r.entityType, r.entityId).as(Ok(true))).transact(xa)
  def entitiesWithTag(xa: Transactor[IO], p: Principal, tagId: UUID): IO[Out[List[TaggedEntity]]] =
    gate(p, Level.Read, "tag")(TagRepo.entitiesWithTag(tagId).map(_.map { case (t, i) => TaggedEntity(t, i) }))
      .transact(xa)
  /** The tags on a given entity (asset/property/…) — for chip display + removal. */
  def tagsForEntity(xa: Transactor[IO], p: Principal, entityType: String, entityId: UUID): IO[Out[List[TagView]]] =
    if (!ENTITIES.contains(entityType)) IO.pure(Left(badReq(s"entityType must be one of ${ENTITIES.mkString(", ")}")))
    else gate(p, Level.Read, "tag")(TagRepo.tagsForEntity(entityType, entityId).map(_.map(tv))).transact(xa)
  def untagEntity(xa: Transactor[IO], p: Principal, tagId: UUID, entityType: String, entityId: UUID): IO[Out[Ok]] =
    if (!ENTITIES.contains(entityType)) IO.pure(Left(badReq(s"entityType must be one of ${ENTITIES.mkString(", ")}")))
    else gate(p, Level.Write, "tag")(TagRepo.untagEntity(tagId, entityType, entityId).as(Ok(true))).transact(xa)

  // ---- taxonomies -------------------------------------------------------------------------
  def taxonomies(xa: Transactor[IO], p: Principal): IO[Out[List[TaxonomyView]]] =
    gate(p, Level.Read, "taxonomy")(TaxonomyRepo.list.map(_.map(xv))).transact(xa)
  def createTaxonomy(xa: Transactor[IO], p: Principal, r: CreateTaxonomyReq): IO[Out[TaxonomyView]] =
    if (r.name.trim.isEmpty) IO.pure(Left(badReq("name required")))
    else
      gate(p, Level.Write, "taxonomy")(
        TaxonomyRepo.create(r.name, r.appliesTo).map(id => TaxonomyView(id, r.name, r.appliesTo, isSystem = false))
      ).transact(xa)
  def nodes(xa: Transactor[IO], p: Principal, taxonomyId: UUID): IO[Out[List[NodeView]]] =
    gate(p, Level.Read, "taxonomy")(
      TaxonomyRepo.nodes(taxonomyId).map(_.map { case (id, par, n) => NodeView(id, par, n) })
    ).transact(xa)
  def addNode(xa: Transactor[IO], p: Principal, taxonomyId: UUID, r: NodeReq): IO[Out[NodeView]] = {
    val tx = for {
      a <- Authz.authorizer(p.role)
      exists <- TaxonomyRepo.exists(taxonomyId)
      res <-
        if (!a.can(Level.Write, "taxonomy")) (Left(forbidden): Out[NodeView]).pure[ConnectionIO]
        else if (!exists) (Left(notFound): Out[NodeView]).pure[ConnectionIO]
        else
          TaxonomyRepo
            .addNode(taxonomyId, r.parentId, r.name)
            .map(id => Right(NodeView(id, r.parentId, r.name)): Out[NodeView])
    } yield res
    tx.transact(xa)
  }
  def linkTaxonomy(xa: Transactor[IO], p: Principal, r: TaxonomyLinkReq): IO[Out[Ok]] =
    if (!ENTITIES.contains(r.entityType)) IO.pure(Left(badReq(s"entityType must be one of ${ENTITIES.mkString(", ")}")))
    else
      gate(p, Level.Write, "taxonomy")(TaxonomyRepo.link(r.nodeId, r.entityType, r.entityId).as(Ok(true))).transact(xa)

  // ---- custom fields ----------------------------------------------------------------------
  def customFields(xa: Transactor[IO], p: Principal, entityType: String): IO[Out[List[CustomFieldView]]] =
    gate(p, Level.Read, "custom_field")(CustomFieldRepo.listFor(entityType).map(_.map(cv))).transact(xa)
  def createField(xa: Transactor[IO], p: Principal, r: CreateFieldReq): IO[Out[CustomFieldView]] =
    if (!ENTITIES.contains(r.entityType)) IO.pure(Left(badReq(s"entityType must be one of ${ENTITIES.mkString(", ")}")))
    else if (!TYPES.contains(r.`type`)) IO.pure(Left(badReq(s"type must be one of ${TYPES.mkString(", ")}")))
    else {
      val enumJson = r.enumValues.map(vs => Json.fromValues(vs.map(Json.fromString)))
      gate(p, Level.Write, "custom_field")(
        CustomFieldRepo
          .create(p.userId, r.entityType, r.key, r.label, r.`type`, enumJson, r.sensitive.getOrElse(false))
          .map(cv)
      ).transact(xa)
    }
  def deleteField(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[Ok]] =
    gate(p, Level.Write, "custom_field")(CustomFieldRepo.delete(id).map(n => Ok(n > 0))).transact(xa)

  private val err = statusCode.and(jsonBody[ApiError])
  private def bearer = auth.bearer[String]()

  val tagsEndpoint = sttp.tapir.endpoint.get
    .securityIn(bearer)
    .in("api" / "tags")
    .errorOut(err)
    .out(jsonBody[List[TagView]])
    .summary("All tags")
  val createTagEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "tags")
    .in(jsonBody[CreateTagReq])
    .errorOut(err)
    .out(jsonBody[TagView])
    .summary("Create a tag")
  val tagLinkEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "tag-links")
    .in(jsonBody[TagLinkReq])
    .errorOut(err)
    .out(jsonBody[Ok])
    .summary("Tag any entity (polymorphic)")
  val taggedEndpoint = sttp.tapir.endpoint.get
    .securityIn(bearer)
    .in("api" / "tags" / path[UUID]("id") / "entities")
    .errorOut(err)
    .out(jsonBody[List[TaggedEntity]])
    .summary("Entities carrying a tag")
  val entityTagsEndpoint = sttp.tapir.endpoint.get
    .securityIn(bearer)
    .in("api" / "tag-links" / path[String]("entityType") / path[UUID]("entityId"))
    .errorOut(err)
    .out(jsonBody[List[TagView]])
    .summary("Tags on an entity")
  val untagEndpoint = sttp.tapir.endpoint.delete
    .securityIn(bearer)
    .in("api" / "tag-links" / path[UUID]("tagId") / path[String]("entityType") / path[UUID]("entityId"))
    .errorOut(err)
    .out(jsonBody[Ok])
    .summary("Remove a tag from an entity")
  val taxonomiesEndpoint = sttp.tapir.endpoint.get
    .securityIn(bearer)
    .in("api" / "taxonomies")
    .errorOut(err)
    .out(jsonBody[List[TaxonomyView]])
    .summary("All taxonomies")
  val createTaxEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "taxonomies")
    .in(jsonBody[CreateTaxonomyReq])
    .errorOut(err)
    .out(jsonBody[TaxonomyView])
    .summary("Create a taxonomy (Manager+)")
  val nodesEndpoint = sttp.tapir.endpoint.get
    .securityIn(bearer)
    .in("api" / "taxonomies" / path[UUID]("id") / "nodes")
    .errorOut(err)
    .out(jsonBody[List[NodeView]])
    .summary("A taxonomy's nodes")
  val addNodeEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "taxonomies" / path[UUID]("id") / "nodes")
    .in(jsonBody[NodeReq])
    .errorOut(err)
    .out(jsonBody[NodeView])
    .summary("Add a node at any depth")
  val taxLinkEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "taxonomy-links")
    .in(jsonBody[TaxonomyLinkReq])
    .errorOut(err)
    .out(jsonBody[Ok])
    .summary("Categorise any entity under a node")
  val fieldsEndpoint = sttp.tapir.endpoint.get
    .securityIn(bearer)
    .in("api" / "custom-fields")
    .in(query[String]("entityType"))
    .errorOut(err)
    .out(jsonBody[List[CustomFieldView]])
    .summary("Custom-field definitions for an entity type")
  val createFieldEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "custom-fields")
    .in(jsonBody[CreateFieldReq])
    .errorOut(err)
    .out(jsonBody[CustomFieldView])
    .summary("Define a custom field (Principal)")
  val deleteFieldEndpoint = sttp.tapir.endpoint.delete
    .securityIn(bearer)
    .in("api" / "custom-fields" / path[UUID]("id"))
    .errorOut(err)
    .out(jsonBody[Ok])
    .summary("Delete a custom-field definition")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    tagsEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => tags(xa, p)),
    createTagEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: CreateTagReq) => createTag(xa, p, r)),
    tagLinkEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: TagLinkReq) => tagEntity(xa, p, r)),
    taggedEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => entitiesWithTag(xa, p, id)),
    entityTagsEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (et, eid) => tagsForEntity(xa, p, et, eid) }),
    untagEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (tid, et, eid) => untagEntity(xa, p, tid, et, eid) }),
    taxonomiesEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => taxonomies(xa, p)),
    createTaxEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => (r: CreateTaxonomyReq) => createTaxonomy(xa, p, r)),
    nodesEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => nodes(xa, p, id)),
    addNodeEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => addNode(xa, p, id, r) }),
    taxLinkEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => (r: TaxonomyLinkReq) => linkTaxonomy(xa, p, r)),
    fieldsEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (et: String) => customFields(xa, p, et)),
    createFieldEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => (r: CreateFieldReq) => createField(xa, p, r)),
    deleteFieldEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => deleteField(xa, p, id))
  )

  val endpoints: List[AnyEndpoint] = List(
    tagsEndpoint,
    createTagEndpoint,
    tagLinkEndpoint,
    taggedEndpoint,
    entityTagsEndpoint,
    untagEndpoint,
    taxonomiesEndpoint,
    createTaxEndpoint,
    nodesEndpoint,
    addNodeEndpoint,
    taxLinkEndpoint,
    fieldsEndpoint,
    createFieldEndpoint,
    deleteFieldEndpoint
  )
}
