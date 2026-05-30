package com.kanzen.identity

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

final case class User(id: UUID, displayName: String, email: String, role: String, status: String, tenantId: UUID)

/** F01 — canonical user + login-identity persistence (Doobie). Supports lazy provisioning: resolve a Cognito `sub` to a
  * user, or link by email.
  */
object UserRepo {
  def create(displayName: String, email: String, role: String): ConnectionIO[User] =
    sql"""insert into users (display_name, email, role, status)
          values ($displayName, $email, $role, 'active')
          returning id, display_name, email, role, status, tenant_id""".query[User].unique

  def linkIdentity(userId: UUID, provider: String, cognitoSub: String, emailAtLink: String): ConnectionIO[Int] =
    sql"""insert into login_identities (user_id, provider, cognito_sub, email_at_link)
          values ($userId, $provider, $cognitoSub, $emailAtLink)""".update.run

  def findByCognitoSub(sub: String): ConnectionIO[Option[User]] =
    sql"""select u.id, u.display_name, u.email, u.role, u.status, u.tenant_id
          from users u join login_identities li on li.user_id = u.id
          where li.cognito_sub = $sub""".query[User].option

  def findByEmail(email: String): ConnectionIO[Option[User]] =
    sql"select id, display_name, email, role, status, tenant_id from users where email = $email".query[User].option
}
