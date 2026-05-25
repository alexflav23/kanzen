package com.kanzen.auth

import weaver.SimpleIOSuite

/** A dev-minted token verifies against the dev JWKS and yields the expected claims. */
object DevAuthSpec extends SimpleIOSuite {
  test("mint → verify round-trips with email + role") {
    DevAuth.generate("", "").flatMap { dev =>
      val token = dev.mint("flavian@kanzen.local", "principal")
      JwtVerifier.verify(token, dev.jwks, "", "").map {
        case Right(c) => expect(c.email == "flavian@kanzen.local") and expect(c.role == "principal")
        case Left(e) => failure(s"expected valid claims, got: $e")
      }
    }
  }

  test("the dev signing key is stable across restarts — a token still verifies under a fresh DevAuth") {
    // `b` simulates a backend restart/rebuild. With a deterministic dev key the token minted by `a`
    // must still validate, so browser sessions survive a restart instead of 'Invalid signature'.
    for {
      a <- DevAuth.generate("", "")
      b <- DevAuth.generate("", "")
      res <- JwtVerifier.verify(a.mint("x@kanzen.local", "staff"), b.jwks, "", "")
    } yield expect(res.isRight)
  }

  test("a tampered token is rejected") {
    for {
      a <- DevAuth.generate("", "")
      res <- JwtVerifier.verify(a.mint("x@kanzen.local", "staff") + "tampered", a.jwks, "", "")
    } yield expect(res.isLeft)
  }
}
