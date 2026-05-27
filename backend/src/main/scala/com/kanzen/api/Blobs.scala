package com.kanzen.api

import cats.effect.IO
import com.kanzen.s3.{BlobToken, ObjectStore}
import sttp.model.{HeaderNames, StatusCode}
import sttp.tapir._
import sttp.tapir.server.ServerEndpoint

/** Public **capability-URL** download for object-store blobs — the dev/local presigned-URL equivalent. The signed,
  * short-lived token (minted by `ObjectStore.localServed`) is the capability, so there is no bearer: an `<img src>` or
  * a fetch can load it directly. Honours "no public objects" because tokens are unguessable and expire.
  */
object Blobs {
  val serveEndpoint: Endpoint[Unit, String, StatusCode, (String, Array[Byte]), Any] =
    sttp.tapir.endpoint.get
      .in("api" / "blobs" / path[String]("token"))
      .out(header[String](HeaderNames.ContentType))
      .out(byteArrayBody)
      .errorOut(statusCode)
      .summary("Download a blob via a short-lived signed capability URL (presigned-URL equivalent)")

  def serve(store: ObjectStore, secret: String, token: String): IO[Either[StatusCode, (String, Array[Byte])]] =
    IO.realTimeInstant.flatMap { now =>
      BlobToken.verify(token, secret, now.getEpochSecond) match {
        case None => IO.pure(Left(StatusCode.NotFound))
        case Some(key) =>
          store.getObject(key).map {
            case Some((ct, bytes)) => Right((ct, bytes))
            case None => Left(StatusCode.NotFound)
          }
      }
    }

  def serverEndpoints(store: ObjectStore, secret: String): List[ServerEndpoint[Any, IO]] =
    List(serveEndpoint.serverLogic(token => serve(store, secret, token)))

  val endpoints: List[AnyEndpoint] = List(serveEndpoint)
}
