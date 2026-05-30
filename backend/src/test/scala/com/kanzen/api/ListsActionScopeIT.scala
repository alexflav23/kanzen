package com.kanzen.api

import cats.effect.IO
import com.kanzen.tenant.Tenant
import com.kanzen.auth.Principal
import com.kanzen.authz.PermissionRepo
import com.kanzen.lists.ListRepo
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F02 v2 S3 — verb-level granularity through the migrated Lists endpoints: a permission set can deny one operational
  * verb (`list:order`) while the role still holds the rest of the resource (`list:edit`), and vice-versa. This is the
  * capability the whole `can(action)` migration unlocks — grants bite per action, not per resource.
  */
object ListsActionScopeIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private def sfx = UUID.randomUUID().toString.take(8)

  test("deny list:order: a list-writer with a deny grant on order can edit but not place the order") { xa =>
    val u = UUID.randomUUID(); val s = sfx
    val role = s"rbac_lo_$s"
    val prog = for {
      _ <- PermissionRepo.createRole(role, None).transact(xa)
      _ <- PermissionRepo.upsert(role, "list", None, "write").transact(xa) // full write on lists
      setId <-
        sql"insert into permission_sets (name) values (${"noorder-" + s}) returning id".query[UUID].unique.transact(xa)
      _ <-
        sql"insert into permission_set_grants (set_id, resource, action, effect) values ($setId, 'list', 'order', 'deny')".update.run
          .transact(xa)
      _ <- sql"insert into role_sets (role_name, set_id) values ($role, $setId)".update.run.transact(xa)
      listId <- ListRepo.createList(Tenant.DefaultId, None, s"RBAC list $s", None).transact(xa)
      p = Principal(u, "u", "u@k.local", role)
      edited <- Lists.update(
        xa,
        p,
        listId,
        Lists.EditListReq(s"Renamed $s", None, None, None, None, "grocery")
      )
      ordered <- Lists.placeOrder(xa, p, listId)
    } yield (edited, ordered)
    prog.map { case (edited, ordered) =>
      expect(edited.isRight) and // list:edit still allowed (held via the legacy write level)
        expect(ordered.left.exists(_._1.code == 403)) // list:order denied by the grant
    }
  }

  test("grant list:order only: a role with no list rule, granted just order, can place orders but not edit") { xa =>
    val u = UUID.randomUUID(); val s = sfx
    val role = s"rbac_oo_$s"
    val prog = for {
      _ <- PermissionRepo.createRole(role, None).transact(xa) // no list rule at all
      setId <-
        sql"insert into permission_sets (name) values (${"orderonly-" + s}) returning id"
          .query[UUID]
          .unique
          .transact(xa)
      _ <-
        sql"insert into permission_set_grants (set_id, resource, action, effect) values ($setId, 'list', 'order', 'allow')".update.run
          .transact(xa)
      _ <- sql"insert into role_sets (role_name, set_id) values ($role, $setId)".update.run.transact(xa)
      listId <- ListRepo.createList(Tenant.DefaultId, None, s"RBAC list2 $s", None).transact(xa)
      p = Principal(u, "u", "u@k.local", role)
      ordered <- Lists.placeOrder(xa, p, listId)
      edited <- Lists.update(
        xa,
        p,
        listId,
        Lists.EditListReq(s"Nope $s", None, None, None, None, "grocery")
      )
    } yield (ordered, edited)
    prog.map { case (ordered, edited) =>
      expect(ordered.isRight) and // list:order granted explicitly
        expect(edited.left.exists(_._1.code == 403)) // but no list:edit ⇒ denied
    }
  }
}
