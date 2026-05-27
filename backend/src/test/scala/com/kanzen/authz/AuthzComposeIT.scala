package com.kanzen.authz

import cats.effect.IO
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F02 v2 S2 — Authz.forUser composition: multi-role union, role inheritance, nested teams, permission-set grants
  * (allow adds / deny wins), and non-breaking equivalence to the single-role authorizer.
  */
object AuthzComposeIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private def sfx = UUID.randomUUID().toString.take(8)
  private def edit = Actions.byKey("asset:edit") // write-level
  private def view = Actions.byKey("asset:view") // read-level
  private def value = Actions.byKey("asset:value") // admin-level
  private def approve = Actions.byKey("bill:approve") // write-level

  test("multi-role: roles are additive — read ∪ write = write") { xa =>
    val u = UUID.randomUUID(); val s = sfx
    val (a, b) = (s"rbac_a_$s", s"rbac_b_$s")
    (for {
      _ <- PermissionRepo.createRole(a, None)
      _ <- PermissionRepo.createRole(b, None)
      _ <- PermissionRepo.upsert(a, "asset", None, "read")
      _ <- PermissionRepo.upsert(b, "asset", None, "write")
      _ <- sql"insert into user_roles (user_id, role_name) values ($u, $b)".update.run
      az <- Authz.forUser(u, a) // primary a + extra role b
    } yield az).transact(xa).map(az => expect(az.can(edit)) and expect(az.can(view)))
  }

  test("inheritance: a child role inherits its parent's rules") { xa =>
    val u = UUID.randomUUID(); val s = sfx
    val (parent, child) = (s"rbac_p_$s", s"rbac_c_$s")
    (for {
      _ <- PermissionRepo.createRole(parent, None)
      _ <- PermissionRepo.upsert(parent, "asset", None, "read")
      _ <- PermissionRepo.createRole(child, None)
      _ <- sql"update roles set parent_role = $parent where name = $child".update.run
      az <- Authz.forUser(u, child)
    } yield az).transact(xa).map(az => expect(az.can(view)) and expect(!az.can(edit)))
  }

  test("teams: a member inherits the team's roles, including ancestor teams (nesting)") { xa =>
    val u = UUID.randomUUID(); val s = sfx
    val (base, teamRole) = (s"rbac_base_$s", s"rbac_tw_$s")
    (for {
      _ <- PermissionRepo.createRole(base, None) // empty primary — no asset access
      _ <- PermissionRepo.createRole(teamRole, None)
      _ <- PermissionRepo.upsert(teamRole, "asset", None, "write")
      pid <- sql"insert into teams (name) values (${"parent-" + s}) returning id".query[UUID].unique
      cid <- sql"insert into teams (name, parent_team_id) values (${"child-" + s}, $pid) returning id"
        .query[UUID]
        .unique
      _ <-
        sql"insert into team_roles (team_id, role_name) values ($pid, $teamRole)".update.run // role on the PARENT team
      _ <- sql"insert into team_members (team_id, user_id) values ($cid, $u)".update.run // user in the CHILD team
      az <- Authz.forUser(u, base)
    } yield az).transact(xa).map(az => expect(az.can(edit))) // inherited up the team hierarchy
  }

  test("permission-set grants: allow adds an action; deny wins") { xa =>
    val u = UUID.randomUUID(); val s = sfx
    val (r, rDeny) = (s"rbac_set_$s", s"rbac_deny_$s")
    (for {
      _ <- PermissionRepo.createRole(r, None) // no bill rule at all
      _ <- PermissionRepo.createRole(rDeny, None)
      setId <- sql"insert into permission_sets (name) values (${"finance-" + s}) returning id".query[UUID].unique
      _ <-
        sql"insert into permission_set_grants (set_id, resource, action, effect) values ($setId, 'bill', 'approve', 'allow')".update.run
      _ <- sql"insert into role_sets (role_name, set_id) values ($r, $setId)".update.run
      withAllow <- Authz.forUser(u, r)
      denySet <- sql"insert into permission_sets (name) values (${"nodeny-" + s}) returning id".query[UUID].unique
      _ <-
        sql"insert into permission_set_grants (set_id, resource, action, effect) values ($denySet, 'bill', 'approve', 'deny')".update.run
      _ <- sql"insert into role_sets (role_name, set_id) values ($rDeny, $denySet)".update.run
      _ <- sql"insert into user_roles (user_id, role_name) values ($u, $rDeny)".update.run
      withDeny <- Authz.forUser(u, r)
    } yield (withAllow, withDeny)).transact(xa).map { case (allow, deny) =>
      expect(allow.can(approve)) and expect(!deny.can(approve)) // deny grant overrides the allow
    }
  }

  test("field-deny survives composition: an explicit field-level deny overrides the broader resource allow") { xa =>
    val u = UUID.randomUUID(); val s = sfx
    val r = s"rbac_fd_$s"
    (for {
      _ <- PermissionRepo.createRole(r, None)
      _ <- PermissionRepo.upsert(r, "asset", None, "read") // broad: read the asset
      _ <- PermissionRepo.upsert(r, "asset", Some("market_value"), "none") // but NOT its valuation
      az <- Authz.forUser(u, r)
    } yield az).transact(xa).map { az =>
      expect(az.canRead("asset")) and // resource still readable
        expect(!az.canRead("asset", Some("market_value"))) and // field deny preserved through compose
        expect(az.filterReadable("asset", Map("title" -> 1, "market_value" -> 2)) == Map("title" -> 1))
    }
  }

  test("non-breaking: with no v2 config, forUser equals the single-role authorizer for the primary") { xa =>
    val u = UUID.randomUUID(); val s = sfx
    val r = s"rbac_eq_$s"
    (for {
      _ <- PermissionRepo.createRole(r, None)
      _ <- PermissionRepo.upsert(r, "asset", None, "write")
      composed <- Authz.forUser(u, r)
      single <- Authz.authorizer(r)
    } yield (composed, single)).transact(xa).map { case (c, sgl) =>
      expect(c.can(edit) == sgl.can(edit)) and expect(c.can(edit)) and expect(!c.can(value))
    }
  }
}
