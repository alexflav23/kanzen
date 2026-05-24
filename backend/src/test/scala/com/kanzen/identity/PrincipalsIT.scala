package com.kanzen.identity

import cats.effect.IO
import com.kanzen.auth.Claims
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F01 — JWT claims → canonical principal, against the seeded household. */
object PrincipalsIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("resolves a seeded user by email; the DB role is authoritative") { xa =>
    // The claim says "staff", but Toby is "principal" in the DB — DB wins.
    Principals.resolve(Claims("some-sub", "flavian@kanzen.local", "staff")).transact(xa).map {
      case Some(p) =>
        expect(p.role == "principal") and
          expect(p.userId == UUID.fromString("10000000-0000-0000-0000-000000000001")) and
          expect(p.email == "flavian@kanzen.local")
      case None => failure("expected to resolve Toby")
    }
  }

  test("resolves by Cognito sub once an identity is linked") { xa =>
    val prog = for {
      u <- UserRepo.findByEmail("lorna@kanzen.local").map(_.get)
      _ <- UserRepo.linkIdentity(u.id, "cognito_native", "lorna-sub-123", "lorna@kanzen.local")
      r <- Principals.resolve(Claims("lorna-sub-123", "stale-email@elsewhere.test", "staff"))
    } yield (u, r)
    prog.transact(xa).map { case (u, r) =>
      expect(r.exists(_.userId == u.id)) and expect(r.exists(_.role == "manager"))
    }
  }

  test("an unknown identity does not resolve") { xa =>
    Principals.resolve(Claims("nope", "stranger@nowhere.test", "principal")).transact(xa).map(r => expect(r.isEmpty))
  }

  test("a suspended user does not resolve") { xa =>
    val prog = for {
      u <- UserRepo.create("Temp", "suspended@kanzen.local", "staff")
      _ <- sql"update users set status='suspended' where id = ${u.id}".update.run
      r <- Principals.resolve(Claims("sub", "suspended@kanzen.local", "staff"))
    } yield r
    prog.transact(xa).map(r => expect(r.isEmpty))
  }
}
