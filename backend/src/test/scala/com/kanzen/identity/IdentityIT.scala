package com.kanzen.identity

import cats.effect.IO
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F01 integration test: canonical user + identity linking + lazy resolution. */
object IdentityIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("create user, link a Google identity, resolve by cognito_sub and email") { xa =>
    val email = s"toby+${UUID.randomUUID()}@kanzen.family"
    val sub = s"google-${UUID.randomUUID()}"
    val prog = for {
      u <- UserRepo.create("Toby", email, "principal")
      _ <- UserRepo.linkIdentity(u.id, "google", sub, email)
      bySub <- UserRepo.findByCognitoSub(sub)
      byEmail <- UserRepo.findByEmail(email)
    } yield (u, bySub, byEmail)

    prog.transact(xa).map { case (u, bySub, byEmail) =>
      expect(bySub.exists(_.id == u.id)) and
        expect(bySub.exists(_.role == "principal")) and
        expect(byEmail.exists(_.email == email))
    }
  }
}
