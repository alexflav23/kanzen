package com.kanzen.api

import cats.effect.IO
import com.kanzen.audit.AuditRepo
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import weaver.IOSuite

import java.util.UUID

/** F19/W2 — the platform audited action log read API: admin oversight of every write, filterable, with the actor's name
  * resolved; non-admins are denied (it's admin-grade oversight).
  */
object AuditApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private def sfx = UUID.randomUUID().toString.take(8)
  private def admin = Principal(UUID.randomUUID(), "a", "a@k.local", "principal")
  private def staff = Principal(UUID.randomUUID(), "s", "s@k.local", "staff")
  private val seededUser = UUID.fromString("10000000-0000-0000-0000-000000000001") // a real users row → name resolves

  test("admin lists the action log; action filter narrows; actor name resolves; non-admin denied") { xa =>
    val s = sfx; val tgt = UUID.randomUUID()
    val created = s"test.created_$s"; val deleted = s"test.deleted_$s"
    for {
      _ <- AuditRepo
        .write(
          "user",
          Some(seededUser),
          created,
          Some("asset"),
          Some(tgt),
          Json.obj("x" -> Json.fromInt(1)),
          Some(seededUser)
        )
        .transact(xa)
      _ <- AuditRepo
        .write("user", Some(seededUser), deleted, Some("asset"), Some(tgt), Json.obj(), Some(seededUser))
        .transact(xa)
      all <- Audit.list(xa, admin, Some(100), None, None, None, None)
      onlyCreated <- Audit.list(xa, admin, Some(100), None, None, Some(created), None)
      staffRes <- Audit.list(xa, staff, Some(100), None, None, None, None)
      acts <- Audit.actions(xa, admin)
    } yield {
      val allKeys = all.toOption.toList.flatten.map(_.action).toSet
      val mine = all.toOption.toList.flatten.find(_.action == created)
      val filteredKeys = onlyCreated.toOption.toList.flatten.map(_.action).toSet
      expect(allKeys.contains(created) && allKeys.contains(deleted)) and
        expect(mine.exists(_.actorName.isDefined)) and // actor name resolved from users
        expect(mine.exists(_.targetType.contains("asset"))) and
        expect(filteredKeys == Set(created)) and // action filter
        expect(acts.toOption.exists(_.contains(created))) and
        expect(staffRes.left.exists(_._1.code == 403)) // admin-only
    }
  }

  test("forTarget returns only that entity's audit trail, newest first") { xa =>
    val s = sfx; val tgt = UUID.randomUUID(); val other = UUID.randomUUID()
    (for {
      _ <- AuditRepo.write("user", Some(seededUser), s"t.a_$s", Some("property"), Some(tgt), Json.obj(), None)
      _ <- AuditRepo.write("user", Some(seededUser), s"t.b_$s", Some("property"), Some(tgt), Json.obj(), None)
      _ <- AuditRepo.write("user", Some(seededUser), s"t.c_$s", Some("property"), Some(other), Json.obj(), None)
      rows <- AuditRepo.forTarget("property", tgt, 50)
    } yield rows).transact(xa).map { rows =>
      expect(rows.size == 2) and expect(rows.forall(_.targetId.contains(tgt)))
    }
  }
}
