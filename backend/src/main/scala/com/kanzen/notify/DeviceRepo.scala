package com.kanzen.notify

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

final case class Device(id: UUID, platform: String, token: String, lastSeenAt: String)

/** F34 — push device registry. Re-registering the same token refreshes `last_seen_at` (token rotation/expiry handling,
  * §8).
  */
object DeviceRepo {
  def register(userId: UUID, platform: String, token: String): ConnectionIO[UUID] =
    sql"""insert into device_tokens (user_id, platform, token) values ($userId, $platform, $token)
          on conflict (user_id, token) do update set last_seen_at = now()
          returning id""".query[UUID].unique

  def forUser(userId: UUID): ConnectionIO[List[Device]] =
    sql"""select id, platform, token, last_seen_at::text from device_tokens
          where user_id = $userId order by last_seen_at desc""".query[Device].to[List]
}
