package com.kanzen.s3

import cats.effect.{IO, Ref}

import java.security.MessageDigest

/** F00/F05 — the blob store behind the evidence store. Originals are **write-once** (immutable): `put` to an existing
  * key is rejected. The in-memory impl backs tests + local dev; the S3 impl (AWS SDK + LocalStack, real presign + SSE)
  * wires in later behind this same interface.
  */
trait ObjectStore {
  def put(key: String, contentType: String, bytes: Array[Byte]): IO[Unit]
  def get(key: String): IO[Option[Array[Byte]]]
  def exists(key: String): IO[Boolean]

  /** A short-lived, per-request download URL (no public objects). */
  def presignGet(key: String, ttlSeconds: Int): IO[String]
}

object ObjectStore {
  def sha256Hex(bytes: Array[Byte]): String =
    MessageDigest.getInstance("SHA-256").digest(bytes).map("%02x".format(_)).mkString

  def inMemory: IO[ObjectStore] =
    Ref.of[IO, Map[String, (String, Array[Byte])]](Map.empty).map { ref =>
      new ObjectStore {
        def put(key: String, contentType: String, bytes: Array[Byte]): IO[Unit] =
          ref.modify { m =>
            if (m.contains(key))
              (m, IO.raiseError[Unit](new IllegalStateException(s"object exists (write-once): $key")))
            else (m.updated(key, (contentType, bytes)), IO.unit)
          }.flatten

        def get(key: String): IO[Option[Array[Byte]]] = ref.get.map(_.get(key).map(_._2))
        def exists(key: String): IO[Boolean] = ref.get.map(_.contains(key))
        def presignGet(key: String, ttlSeconds: Int): IO[String] =
          IO.realTimeInstant.map(now => s"memory://$key?expires=${now.getEpochSecond + ttlSeconds}")
      }
    }
}
