package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Authz, Level}
import com.kanzen.docs.{Document, DocumentRepo}
import com.kanzen.property.PropertyRepo
import com.kanzen.s3.ObjectStore
import doobie.ConnectionIO
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.generic.auto._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

import java.util.{Base64, UUID}
import scala.util.Try

/** F05 — the in-house evidence store. Originals are write-once (immutable) in the `ObjectStore`; metadata + polymorphic
  * links live in Postgres. Principal-private documents are invisible to Manager/Staff (server-side); property-bound
  * documents respect scope. Download is a short-lived presigned URL (no public objects).
  */
object Documents {
  private type Out[A] = Either[(StatusCode, ApiError), A]
  private val PRESIGN_TTL = 300 // seconds

  final case class DocumentView(
      id: UUID,
      name: String,
      category: String,
      contentType: Option[String],
      sizeBytes: Option[Long],
      sha256: Option[String],
      visibility: String,
      source: String,
      propertyId: Option[UUID],
      immutable: Boolean
  )
  final case class UploadReq(
      name: String,
      category: String,
      contentType: String,
      contentBase64: String,
      visibility: Option[String],
      source: Option[String],
      propertyId: Option[UUID]
  )
  final case class UploadResult(document: DocumentView, deduped: Boolean)
  final case class LinkReq(targetType: String, targetId: UUID, role: Option[String])
  final case class PresignResult(url: String, expiresInSeconds: Int)
  final case class OkResult(ok: Boolean)
  /** A document attached to a target, with a ready-to-render presigned URL (for galleries/thumbnails). */
  final case class LinkedDoc(
      id: UUID,
      name: String,
      contentType: Option[String],
      sizeBytes: Option[Long],
      url: String,
      expiresInSeconds: Int
  )

  private def view(d: Document): DocumentView =
    DocumentView(
      d.id,
      d.name,
      d.category,
      d.contentType,
      d.sizeBytes,
      d.sha256,
      d.visibility,
      d.source,
      d.propertyId,
      d.immutable
    )

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "not permitted on document"))
  private val notFound: (StatusCode, ApiError) = (StatusCode.NotFound, ApiError(404, "not_found", "No such document."))
  private def badReq(m: String): (StatusCode, ApiError) = (StatusCode.BadRequest, ApiError(400, "bad_request", m))

  /** A document is visible to a principal iff: not principal-private (unless Principal), and (no property, or property
    * in scope).
    */
  private def visibleTo(p: Principal, d: Document, scoped: Set[UUID]): Boolean =
    (d.visibility != "principal_private" || p.role == "principal") &&
      d.propertyId.forall(scoped.contains)

  private def extOf(name: String): String = {
    val i = name.lastIndexOf('.')
    if (i > 0 && i < name.length - 1) name.substring(i + 1).toLowerCase.take(8) else "bin"
  }

  def upload(store: ObjectStore, xa: Transactor[IO], p: Principal, req: UploadReq): IO[Out[UploadResult]] = {
    Try(Base64.getDecoder.decode(req.contentBase64)).toEither match {
      case Left(_) => IO.pure(Left(badReq("contentBase64 is not valid base64")))
      case Right(bytes) =>
        val sha = ObjectStore.sha256Hex(bytes)
        val visibility = req.visibility.getOrElse("household")
        val source = req.source.getOrElse("manual")
        val id = UUID.randomUUID()
        val key = s"documents/${p.userId}/$id/original.${extOf(req.name)}"

        val pre: ConnectionIO[Out[Either[Document, Unit]]] = for {
          authz <- Authz.authorizer(p.role)
          scoped <- PropertyRepo.listForPrincipal(p.userId).map(_.map(_.id).toSet)
          dup <- DocumentRepo.findBySha256(sha)
        } yield {
          if (!authz.can(Level.Write, "document")) Left(forbidden)
          else if (visibility == "principal_private" && p.role != "principal") Left(forbidden)
          else if (req.propertyId.exists(pid => !scoped.contains(pid))) Left(notFound)
          else
            dup.filter(d => visibleTo(p, d, scoped)) match {
              case Some(d) => Right(Left(d)) // dedup hit
              case None => Right(Right(())) // proceed
            }
        }

        pre.transact(xa).flatMap {
          case Left(err) => IO.pure(Left(err))
          case Right(Left(existing)) => IO.pure(Right(UploadResult(view(existing), deduped = true)))
          case Right(Right(())) =>
            store.put(key, req.contentType, bytes) *>
              DocumentRepo
                .insert(
                  id,
                  p.userId,
                  req.name,
                  req.category,
                  Some(req.contentType),
                  Some(bytes.length.toLong),
                  key,
                  sha,
                  visibility,
                  source,
                  req.propertyId
                )
                .transact(xa)
                .map(d => Right(UploadResult(view(d), deduped = false)))
        }
    }
  }

  def list(
      xa: Transactor[IO],
      p: Principal,
      category: Option[String],
      q: Option[String]
  ): IO[Out[List[DocumentView]]] = {
    val tx = for {
      authz <- Authz.authorizer(p.role)
      scoped <- PropertyRepo.listForPrincipal(p.userId).map(_.map(_.id).toSet)
      docs <- if (authz.canRead("document")) DocumentRepo.list(category, q) else List.empty[Document].pure[ConnectionIO]
    } yield
      if (!authz.canRead("document")) Left(forbidden)
      else Right(docs.filter(d => visibleTo(p, d, scoped)).map(view))
    tx.transact(xa)
  }

  /** Load + authorize a single document for a read op; Right(doc) or the right error. */
  private def readable(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[Document]] = {
    val tx = for {
      authz <- Authz.authorizer(p.role)
      scoped <- PropertyRepo.listForPrincipal(p.userId).map(_.map(_.id).toSet)
      doc <- DocumentRepo.find(id)
    } yield
      if (!authz.canRead("document")) Left(forbidden)
      else doc.filter(d => visibleTo(p, d, scoped)).toRight(notFound)
    tx.transact(xa)
  }

  def detail(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[DocumentView]] =
    readable(xa, p, id).map(_.map(view))

  def download(store: ObjectStore, xa: Transactor[IO], p: Principal, id: UUID): IO[Out[PresignResult]] =
    readable(xa, p, id).flatMap {
      case Left(e) => IO.pure(Left(e))
      case Right(doc) =>
        doc.s3Key match {
          case None => IO.pure(Left(notFound))
          case Some(k) => store.presignGet(k, PRESIGN_TTL).map(url => Right(PresignResult(url, PRESIGN_TTL)))
        }
    }

  /** Load + authorize for a write op (link/delete): 404 if not visible, 403 if no write. */
  private def writable(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[Document]] = {
    val tx = for {
      authz <- Authz.authorizer(p.role)
      scoped <- PropertyRepo.listForPrincipal(p.userId).map(_.map(_.id).toSet)
      doc <- DocumentRepo.find(id)
    } yield doc.filter(d => visibleTo(p, d, scoped)) match {
      case None => Left(notFound)
      case Some(d) => if (authz.can(Level.Write, "document")) Right(d) else Left(forbidden)
    }
    tx.transact(xa)
  }

  def addLink(xa: Transactor[IO], p: Principal, id: UUID, req: LinkReq): IO[Out[OkResult]] =
    writable(xa, p, id).flatMap {
      case Left(e) => IO.pure(Left(e))
      case Right(_) =>
        DocumentRepo.link(id, req.targetType, req.targetId, req.role).transact(xa).as(Right(OkResult(true)))
    }

  def unlink(xa: Transactor[IO], p: Principal, id: UUID, targetType: String, targetId: UUID): IO[Out[OkResult]] =
    writable(xa, p, id).flatMap {
      case Left(e) => IO.pure(Left(e))
      case Right(_) => DocumentRepo.unlink(id, targetType, targetId).transact(xa).as(Right(OkResult(true)))
    }

  /** The documents attached to a target — visibility/scope filtered, each with a presigned URL. */
  def forTarget(
      store: ObjectStore,
      xa: Transactor[IO],
      p: Principal,
      targetType: String,
      targetId: UUID
  ): IO[Out[List[LinkedDoc]]] = {
    val tx = for {
      authz <- Authz.authorizer(p.role)
      scoped <- PropertyRepo.listForPrincipal(p.userId).map(_.map(_.id).toSet)
      docs <-
        if (authz.canRead("document")) DocumentRepo.documentsFor(targetType, targetId)
        else List.empty[Document].pure[ConnectionIO]
    } yield
      if (!authz.canRead("document")) Left(forbidden)
      else Right(docs.filter(d => visibleTo(p, d, scoped)))
    tx.transact(xa).flatMap {
      case Left(e) => IO.pure(Left(e))
      case Right(docs) =>
        docs
          .traverse(d =>
            d.s3Key match {
              case Some(k) =>
                store.presignGet(k, PRESIGN_TTL).map(u => Some(LinkedDoc(d.id, d.name, d.contentType, d.sizeBytes, u, PRESIGN_TTL)))
              case None => IO.pure(None)
            }
          )
          .map(xs => Right(xs.flatten))
    }
  }

  def softDelete(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[OkResult]] =
    writable(xa, p, id).flatMap {
      case Left(e) => IO.pure(Left(e))
      case Right(_) => DocumentRepo.softDelete(id).transact(xa).as(Right(OkResult(true)))
    }

  // ---- endpoints ----
  private val err = statusCode.and(jsonBody[ApiError])

  val uploadEndpoint: Endpoint[String, UploadReq, (StatusCode, ApiError), UploadResult, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "documents")
      .in(jsonBody[UploadReq])
      .errorOut(err)
      .out(jsonBody[UploadResult])
      .summary("Upload a document (write-once original + sha256; dedup by checksum)")

  val listEndpoint
      : Endpoint[String, (Option[String], Option[String]), (StatusCode, ApiError), List[DocumentView], Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "documents")
      .in(query[Option[String]]("category"))
      .in(query[Option[String]]("q"))
      .errorOut(err)
      .out(jsonBody[List[DocumentView]])
      .summary("List documents (visibility + scope filtered)")

  val detailEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), DocumentView, Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "documents" / path[UUID]("id"))
      .errorOut(err)
      .out(jsonBody[DocumentView])
      .summary("Document metadata")

  val downloadEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), PresignResult, Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "documents" / path[UUID]("id") / "download")
      .errorOut(err)
      .out(jsonBody[PresignResult])
      .summary("A short-lived presigned download URL")

  val linkEndpoint: Endpoint[String, (UUID, LinkReq), (StatusCode, ApiError), OkResult, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "documents" / path[UUID]("id") / "links")
      .in(jsonBody[LinkReq])
      .errorOut(err)
      .out(jsonBody[OkResult])
      .summary("Attach a document to a target (polymorphic)")

  val deleteEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), OkResult, Any] =
    sttp.tapir.endpoint.delete
      .securityIn(auth.bearer[String]())
      .in("api" / "documents" / path[UUID]("id"))
      .errorOut(err)
      .out(jsonBody[OkResult])
      .summary("Soft-delete (metadata only; the original is retained)")

  val forTargetEndpoint
      : Endpoint[String, (String, UUID), (StatusCode, ApiError), List[LinkedDoc], Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "documents" / "for" / path[String]("targetType") / path[UUID]("targetId"))
      .errorOut(err)
      .out(jsonBody[List[LinkedDoc]])
      .summary("Documents attached to a target, each with a presigned URL (galleries)")

  val unlinkEndpoint
      : Endpoint[String, (UUID, String, UUID), (StatusCode, ApiError), OkResult, Any] =
    sttp.tapir.endpoint.delete
      .securityIn(auth.bearer[String]())
      .in("api" / "documents" / path[UUID]("id") / "links" / path[String]("targetType") / path[UUID]("targetId"))
      .errorOut(err)
      .out(jsonBody[OkResult])
      .summary("Detach a document from a target (the original is retained)")

  def serverEndpoints(a: Auth, xa: Transactor[IO], store: ObjectStore): List[ServerEndpoint[Any, IO]] = List(
    uploadEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: UploadReq) => upload(store, xa, p, r)),
    listEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (c, q) => list(xa, p, c, q) }),
    detailEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => detail(xa, p, id)),
    downloadEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => download(store, xa, p, id)),
    linkEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => addLink(xa, p, id, r) }),
    deleteEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => softDelete(xa, p, id)),
    forTargetEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (t, tid) => forTarget(store, xa, p, t, tid) }),
    unlinkEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (id, t, tid) => unlink(xa, p, id, t, tid) })
  )

  val endpoints: List[AnyEndpoint] =
    List(uploadEndpoint, listEndpoint, detailEndpoint, downloadEndpoint, linkEndpoint, deleteEndpoint, forTargetEndpoint, unlinkEndpoint)
}
