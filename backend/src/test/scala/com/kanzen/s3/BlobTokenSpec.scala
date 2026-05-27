package com.kanzen.s3

import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

/** Unit test for the signed blob capability token (the dev presigned-URL equivalent). */
class BlobTokenSpec extends AnyFreeSpec with Matchers {
  private val secret = "test-secret-abc123"
  private val objKey = "documents/10000000-0000-0000-0000-000000000001/abc/original.png"

  "BlobToken" - {
    "round-trips a key for an unexpired, correctly-signed token" in {
      val tok = BlobToken.sign(objKey, expiresEpochSec = 2000, secret)
      BlobToken.verify(tok, secret, nowEpochSec = 1000) shouldBe Some(objKey)
    }

    "rejects an expired token" in {
      val tok = BlobToken.sign(objKey, expiresEpochSec = 1000, secret)
      BlobToken.verify(tok, secret, nowEpochSec = 1001) shouldBe None
    }

    "rejects a token signed with a different secret (forgery)" in {
      val tok = BlobToken.sign(objKey, expiresEpochSec = 2000, secret)
      BlobToken.verify(tok, "other-secret", nowEpochSec = 1000) shouldBe None
    }

    "rejects a tampered payload" in {
      val tok = BlobToken.sign(objKey, expiresEpochSec = 2000, secret)
      val tampered = "QQ" + tok.drop(2) // mangle the payload segment
      BlobToken.verify(tampered, secret, nowEpochSec = 1000) shouldBe None
    }

    "rejects a malformed token" in {
      BlobToken.verify("not-a-token", secret, nowEpochSec = 1000) shouldBe None
    }
  }
}
