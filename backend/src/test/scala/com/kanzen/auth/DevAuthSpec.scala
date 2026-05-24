package com.kanzen.auth

import weaver.SimpleIOSuite

/** A dev-minted token verifies against the dev JWKS and yields the expected claims. */
object DevAuthSpec extends SimpleIOSuite {
  test("mint → verify round-trips with email + role") {
    DevAuth.generate("", "").flatMap { dev =>
      val token = dev.mint("toby@kanzen.local", "principal")
      JwtVerifier.verify(token, dev.jwks, "", "").map {
        case Right(c) => expect(c.email == "toby@kanzen.local") and expect(c.role == "principal")
        case Left(e)  => failure(s"expected valid claims, got: $e")
      }
    }
  }

  test("a token from a different dev keypair is rejected") {
    for {
      a <- DevAuth.generate("", "")
      b <- DevAuth.generate("", "")
      res <- JwtVerifier.verify(a.mint("x@kanzen.local", "staff"), b.jwks, "", "")
    } yield expect(res.isLeft)
  }
}
