package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.RbacAdmin._
import com.kanzen.auth.Principal
import com.kanzen.authz.PermissionRepo
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F02 v2 S4 — the builder's management API: admin-gated CRUD + the effective-permissions preview that runs the real
  * `Authz.forUser` resolution. Covers the deny path (non-admin), set→role→user flow, set→team(role) nesting, the
  * inheritance/team cycle guards, and grant validation.
  */
object RbacAdminIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private def sfx = UUID.randomUUID().toString.take(8)
  private def admin = Principal(UUID.randomUUID(), "a", "a@k.local", "principal") // principal holds *·admin
  private def staff = Principal(UUID.randomUUID(), "s", "s@k.local", "staff")

  test("non-admin is denied across the management API (403)") { xa =>
    for {
      sets <- listSets(xa, staff)
      teams <- listTeams(xa, staff)
      created <- createSet(xa, staff, SetReq("nope", None))
      eff <- effective(xa, staff, UUID.randomUUID())
    } yield expect(sets.left.exists(_._1.code == 403)) and
      expect(teams.left.exists(_._1.code == 403)) and
      expect(created.left.exists(_._1.code == 403)) and
      expect(eff.left.exists(_._1.code == 403))
  }

  test("set → role → user: a granted action shows up in the user's effective preview") { xa =>
    val s = sfx; val role = s"rbac_eff_$s"; val user = UUID.randomUUID()
    for {
      set <- createSet(xa, admin, SetReq(s"finance-set-$s", Some("approve bills")))
      setId = set.toOption.get.id
      _ <- upsertGrant(xa, admin, setId, GrantDto("bill", "approve", "", "all", "allow"))
      _ <- PermissionRepo.createRole(role, None).transact(xa)
      attached <- attachSet(xa, admin, role, AttachSetReq(setId))
      assigned <- addUserRole(xa, admin, user, RoleNameReq(role))
      eff <- effective(xa, admin, user)
    } yield {
      val keys = eff.toOption.toList.flatMap(_.allowed.map(_.key)).toSet
      val roles = eff.toOption.toList.flatMap(_.effectiveRoles).toSet
      expect(attached.isRight) and expect(assigned.isRight) and
        expect(keys.contains("bill:approve")) and expect(roles.contains(role))
    }
  }

  test("set → team(role): a child-team member inherits a parent-team role's grants (nested)") { xa =>
    val s = sfx; val role = s"rbac_tm_$s"; val user = UUID.randomUUID()
    for {
      set <- createSet(xa, admin, SetReq(s"vendor-set-$s", None))
      setId = set.toOption.get.id
      _ <- upsertGrant(xa, admin, setId, GrantDto("vendor", "view", "", "all", "allow"))
      _ <- PermissionRepo.createRole(role, None).transact(xa)
      _ <- attachSet(xa, admin, role, AttachSetReq(setId))
      parent <- createTeam(xa, admin, TeamReq(s"parent-$s", None, None))
      parentId = parent.toOption.get.id
      child <- createTeam(xa, admin, TeamReq(s"child-$s", Some(parentId), None))
      childId = child.toOption.get.id
      _ <- addTeamRole(xa, admin, parentId, RoleNameReq(role)) // role on the PARENT
      _ <- addMember(xa, admin, childId, MemberReq(user)) // user in the CHILD
      eff <- effective(xa, admin, user)
    } yield {
      val keys = eff.toOption.toList.flatMap(_.allowed.map(_.key)).toSet
      expect(keys.contains("vendor:view")) // inherited up the team hierarchy
    }
  }

  test("scope flows through to the preview: an own-scoped grant reports scope=own") { xa =>
    val s = sfx; val role = s"rbac_sc_$s"; val user = UUID.randomUUID()
    for {
      set <- createSet(xa, admin, SetReq(s"own-set-$s", None))
      setId = set.toOption.get.id
      _ <- upsertGrant(xa, admin, setId, GrantDto("asset", "view", "", "own", "allow"))
      _ <- PermissionRepo.createRole(role, None).transact(xa)
      _ <- attachSet(xa, admin, role, AttachSetReq(setId))
      _ <- addUserRole(xa, admin, user, RoleNameReq(role))
      eff <- effective(xa, admin, user)
    } yield {
      val a = eff.toOption.toList.flatMap(_.allowed).find(_.key == "asset:view")
      expect(a.exists(_.scope == "own"))
    }
  }

  test("inheritance cycle guard: a role can't parent one of its ancestors (409)") { xa =>
    val s = sfx; val (a, b) = (s"rbac_pa_$s", s"rbac_pb_$s")
    for {
      _ <- PermissionRepo.createRole(a, None).transact(xa)
      _ <- PermissionRepo.createRole(b, None).transact(xa)
      _ <- setParent(xa, admin, b, ParentReq(Some(a))) // b's parent = a
      cyc <- setParent(xa, admin, a, ParentReq(Some(b))) // a's parent = b would cycle
    } yield expect(cyc.left.exists(_._1.code == 409))
  }

  test("grant validation: an unknown action is rejected (400)") { xa =>
    val s = sfx
    for {
      set <- createSet(xa, admin, SetReq(s"bad-set-$s", None))
      setId = set.toOption.get.id
      bad <- upsertGrant(xa, admin, setId, GrantDto("asset", "frobnicate", "", "all", "allow"))
      badScope <- upsertGrant(xa, admin, setId, GrantDto("asset", "view", "", "galaxy", "allow"))
    } yield expect(bad.left.exists(_._1.code == 400)) and expect(badScope.left.exists(_._1.code == 400))
  }
}
