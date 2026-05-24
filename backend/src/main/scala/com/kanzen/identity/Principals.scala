package com.kanzen.identity

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Claims, Principal}
import doobie._
import doobie.implicits._
import doobie.util.transactor.Transactor

/** F01 — resolve validated JWT claims to the canonical Kanzen principal: match the Cognito sub (`login_identities`),
  * else fall back to email (`users`); reject anyone who isn't an **active** user. The DB role is authoritative; the JWT
  * role claim is only a hint. Real Cognito provisioning (auto-create + link on first login) lands with the dev pool —
  * for now the seeded household resolves by email.
  */
object Principals {
  def resolve(claims: Claims): ConnectionIO[Option[Principal]] =
    for {
      bySub <- UserRepo.findByCognitoSub(claims.subject)
      user <- bySub match {
        case found @ Some(_) => (found: Option[User]).pure[ConnectionIO]
        case None => UserRepo.findByEmail(claims.email)
      }
    } yield user.filter(_.status == "active").map(u => Principal(u.id, claims.subject, u.email, u.role))

  def resolver(xa: Transactor[IO]): Claims => IO[Option[Principal]] =
    claims => resolve(claims).transact(xa)
}
