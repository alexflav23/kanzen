package com.kanzen.s3

import cats.effect.{IO, Resource}
import software.amazon.awssdk.auth.credentials.{AwsBasicCredentials, StaticCredentialsProvider}
import software.amazon.awssdk.core.sync.RequestBody
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model._

import java.net.URI

/** F05 — the **persistent** blob store: S3 in production, LocalStack S3 in dev. Bytes survive backend restarts (the
  * in-memory store didn't). Originals are write-once. Browser access still goes through the signed `/api/blobs`
  * capability URL ([[ObjectStore.servedUrl]]) — the backend reads from S3 and streams, so we avoid S3 presigned-URL
  * host problems across the docker network.
  */
object S3ObjectStore {

  /** Build the store as a Resource (manages the S3 client) and ensure the bucket exists on startup. `endpoint` set ⇒
    * LocalStack/custom (path-style); empty ⇒ real AWS (virtual-hosted).
    */
  def resource(
      baseUrl: String,
      secret: String,
      region: String,
      endpoint: Option[String],
      bucket: String,
      accessKey: String,
      secretKey: String
  ): Resource[IO, ObjectStore] =
    Resource
      .make(IO.blocking {
        val b = S3Client
          .builder()
          .httpClient(UrlConnectionHttpClient.create())
          .region(Region.of(region))
          .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey)))
        endpoint.filter(_.nonEmpty).foreach { e =>
          b.endpointOverride(URI.create(e))
          b.forcePathStyle(true) // LocalStack + custom endpoints need path-style addressing
        }
        b.build()
      })(c => IO.blocking(c.close()))
      .evalTap(client => ensureBucket(client, bucket))
      .map(client => store(client, bucket, baseUrl, secret))

  private def ensureBucket(client: S3Client, bucket: String): IO[Unit] =
    IO.blocking {
      try { client.headBucket(HeadBucketRequest.builder().bucket(bucket).build()); () }
      catch {
        case _: NoSuchBucketException => client.createBucket(CreateBucketRequest.builder().bucket(bucket).build()); ()
        case e: S3Exception if e.statusCode() == 404 =>
          client.createBucket(CreateBucketRequest.builder().bucket(bucket).build()); ()
      }
    }

  private def store(client: S3Client, bucket: String, baseUrl: String, secret: String): ObjectStore =
    new ObjectStore {
      private def headExists(key: String): Boolean =
        try { client.headObject(HeadObjectRequest.builder().bucket(bucket).key(key).build()); true }
        catch { case e: S3Exception if e.statusCode() == 404 => false }

      def put(key: String, contentType: String, bytes: Array[Byte]): IO[Unit] =
        IO.blocking {
          if (headExists(key)) throw new IllegalStateException(s"object exists (write-once): $key")
          client.putObject(
            PutObjectRequest.builder().bucket(bucket).key(key).contentType(contentType).build(),
            RequestBody.fromBytes(bytes)
          )
          ()
        }

      def getObject(key: String): IO[Option[(String, Array[Byte])]] =
        IO.blocking {
          try {
            val resp = client.getObjectAsBytes(GetObjectRequest.builder().bucket(bucket).key(key).build())
            Some((Option(resp.response().contentType()).getOrElse("application/octet-stream"), resp.asByteArray()))
          } catch {
            case _: NoSuchKeyException => None
            case e: S3Exception if e.statusCode() == 404 => None
          }
        }

      def get(key: String): IO[Option[Array[Byte]]] = getObject(key).map(_.map(_._2))
      def exists(key: String): IO[Boolean] = IO.blocking(headExists(key))
      def presignGet(key: String, ttlSeconds: Int): IO[String] = ObjectStore.servedUrl(baseUrl, secret, key, ttlSeconds)
    }
}
