package com.kanzen.s3

import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import scala.util.Try

/** A short-lived **signed capability URL** token for object downloads — the dev/local equivalent of an S3 presigned
  * URL. Encodes the object key + an absolute expiry, HMAC-SHA256 signed with a per-boot secret. No session/bearer is
  * needed: possession of a valid, unexpired token *is* the capability (exactly like a presigned URL), so this still
  * honours "no public objects" — tokens expire and are unguessable.
  */
object BlobToken {
  private val enc = Base64.getUrlEncoder.withoutPadding
  private val dec = Base64.getUrlDecoder

  private def hmac(payload: Array[Byte], secret: String): Array[Byte] = {
    val mac = Mac.getInstance("HmacSHA256")
    mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"))
    mac.doFinal(payload)
  }

  /** token = base64url(`key|expiresEpochSec`) + "." + base64url(hmac). */
  def sign(key: String, expiresEpochSec: Long, secret: String): String = {
    val payload = s"$key|$expiresEpochSec".getBytes(StandardCharsets.UTF_8)
    s"${enc.encodeToString(payload)}.${enc.encodeToString(hmac(payload, secret))}"
  }

  /** The object key iff the signature is valid (constant-time) and the token has not expired. */
  def verify(token: String, secret: String, nowEpochSec: Long): Option[String] =
    token.split('.') match {
      case Array(p, sig) =>
        Try {
          val payload = dec.decode(p)
          val expected = enc.encodeToString(hmac(payload, secret))
          if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), sig.getBytes(StandardCharsets.UTF_8)))
            None
          else
            new String(payload, StandardCharsets.UTF_8).split("\\|", 2) match {
              case Array(key, exp) if exp.toLong >= nowEpochSec => Some(key)
              case _ => None
            }
        }.toOption.flatten
      case _ => None
    }
}
