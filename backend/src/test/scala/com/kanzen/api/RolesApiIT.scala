package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Roles.SetRuleReq
import com.kanzen.auth.Principal
import com.kanzen.authz.{Level, PermissionRepo}
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F02 — admin role-management: the admin reads + edits the permission matrix; non-admins are refused; the root grant
  * is protected; bad input is rejected; edits are audited. These mutate the shared `permission_rules`, so run serially.
  */
object RolesApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor
  override def maxParallelism = 1

  private val admin =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "f", "flavian@kanzen.local", "principal")
  private val manager = Principal(UUID.randomUUID(), "l", "lorna@kanzen.local", "manager")

  test("admin lists roles and the full matrix") { xa =>
    for {
      roles <- Roles.listRoles(xa, admin).map(_.toOption.get)
      rules <- Roles.listRules(xa, admin).map(_.toOption.get)
    } yield expect(roles.exists(_.name == "principal")) and expect(roles.exists(_.name == "staff")) and
      expect(rules.exists(r => r.role == "principal" && r.resource == "*" && r.level == "admin"))
  }

  test("admin sets a fresh rule → it takes effect for the role and is audited") { xa =>
    for {
      res <- Roles.setRule(xa, admin, SetRuleReq("staff", "report", None, "read")).map(_.toOption.get)
      rules <- PermissionRepo.rulesFor("staff").transact(xa)
      audits <-
        sql"select count(*) from audit_log_entries where action = 'permission.set' and actor_id = ${admin.userId}"
          .query[Long]
          .unique
          .transact(xa)
      _ <- Roles.deleteRule(xa, admin, "staff", "report", None) // clean up
      after <- PermissionRepo.rulesFor("staff").transact(xa)
    } yield expect(res.level == "read") and
      expect(rules.exists(r => r.resource == "report" && r.level == Level.Read)) and
      expect(audits >= 1L) and
      expect(!after.exists(_.resource == "report"))
  }

  test("upsert is idempotent — setting the same rule twice leaves one row") { xa =>
    for {
      _ <- Roles.setRule(xa, admin, SetRuleReq("staff", "memo", None, "read"))
      _ <- Roles.setRule(xa, admin, SetRuleReq("staff", "memo", None, "write"))
      n <-
        sql"select count(*) from permission_rules where role_name = 'staff' and resource = 'memo' and field is null"
          .query[Long]
          .unique
          .transact(xa)
      level <- PermissionRepo.rulesFor("staff").transact(xa).map(_.find(_.resource == "memo").map(_.level))
      _ <- Roles.deleteRule(xa, admin, "staff", "memo", None)
    } yield expect(n == 1L) and expect(level.contains(Level.Write))
  }

  test("a non-admin cannot read or edit the matrix (403)") { xa =>
    for {
      list <- Roles.listRules(xa, manager)
      set <- Roles.setRule(xa, manager, SetRuleReq("staff", "asset", None, "admin"))
    } yield expect(list.left.exists(_._1.code == 403)) and expect(set.left.exists(_._1.code == 403))
  }

  test("the principal's root admin grant is protected (409 on downgrade or delete)") { xa =>
    for {
      downgrade <- Roles.setRule(xa, admin, SetRuleReq("principal", "*", None, "read"))
      del <- Roles.deleteRule(xa, admin, "principal", "*", None)
      stillAdmin <- PermissionRepo.rulesFor("principal").transact(xa)
    } yield expect(downgrade.left.exists(_._1.code == 409)) and
      expect(del.left.exists(_._1.code == 409)) and
      expect(stillAdmin.exists(r => r.resource == "*" && r.level == Level.Admin))
  }

  test("bad level and unknown role are rejected (400)") { xa =>
    for {
      badLevel <- Roles.setRule(xa, admin, SetRuleReq("staff", "asset", None, "superuser"))
      badRole <- Roles.setRule(xa, admin, SetRuleReq("ghost", "asset", None, "read"))
    } yield expect(badLevel.left.exists(_._1.code == 400)) and expect(badRole.left.exists(_._1.code == 400))
  }

  // --- role CRUD (fully DB-driven roles) ---

  test("the default household + estate staff roles are seeded as editable (non-system) rows") { xa =>
    Roles.listRoles(xa, admin).map(_.toOption.get).map { roles =>
      val defaults = List(
        "Personal Assistant",
        "Executive Assistant",
        "Housekeeper",
        "Gardener", // V2_57
        "Estate Manager",
        "Chef",
        "Butler",
        "Nanny",
        "Chauffeur",
        "Head of Security" // V2_58
      )
      forEach(defaults)(n => expect(roles.exists(r => r.name == n && !r.isSystem)))
    }
  }

  test("admin creates a custom role → it appears (default-deny), is audited; duplicate is 409") { xa =>
    import com.kanzen.api.Roles.CreateRoleReq
    for {
      created <- Roles.createRole(xa, admin, CreateRoleReq("Night Concierge", Some("evenings"))).map(_.toOption.get)
      roles <- Roles.listRoles(xa, admin).map(_.toOption.get)
      rules <- PermissionRepo.rulesFor("Night Concierge").transact(xa) // new role starts with no rules
      dup <- Roles.createRole(xa, admin, CreateRoleReq("Night Concierge", None))
      audits <-
        sql"select count(*) from audit_log_entries where action = 'role.create' and actor_id = ${admin.userId}"
          .query[Long]
          .unique
          .transact(xa)
      _ <- Roles.deleteRole(xa, admin, "Night Concierge") // clean up
    } yield expect(created.name == "Night Concierge") and expect(!created.isSystem) and
      expect(roles.exists(_.name == "Night Concierge")) and expect(rules.isEmpty) and
      expect(dup.left.exists(_._1.code == 409)) and expect(audits >= 1L)
  }

  test("admin deletes a custom role + its rules (audited)") { xa =>
    import com.kanzen.api.Roles.{CreateRoleReq, SetRuleReq}
    for {
      _ <- Roles.createRole(xa, admin, CreateRoleReq("Pool Tech", None))
      _ <- Roles.setRule(xa, admin, SetRuleReq("Pool Tech", "maintenance", None, "write"))
      del <- Roles.deleteRole(xa, admin, "Pool Tech")
      gone <- PermissionRepo.roleExists("Pool Tech").transact(xa)
      rulesGone <- PermissionRepo.rulesFor("Pool Tech").transact(xa)
    } yield expect(del.isRight) and expect(!gone) and expect(rulesGone.isEmpty)
  }

  test("system roles and in-use roles are protected from deletion (409); unknown is 404") { xa =>
    import com.kanzen.api.Roles.CreateRoleReq
    val tempUser = UUID.randomUUID()
    for {
      system <- Roles.deleteRole(xa, admin, "principal")
      unknown <- Roles.deleteRole(xa, admin, "no-such-role")
      // a custom role with a user assigned can't be deleted (would lock them out)
      _ <- Roles.createRole(xa, admin, CreateRoleReq("Temp Valet", None))
      _ <-
        sql"insert into users (id, display_name, email, role, status) values ($tempUser, 'Valet', 'valet@kanzen.local', 'Temp Valet', 'active')".update.run
          .transact(xa)
      inUse <- Roles.deleteRole(xa, admin, "Temp Valet")
      _ <- sql"delete from users where id = $tempUser".update.run.transact(xa) // cleanup
      _ <- Roles.deleteRole(xa, admin, "Temp Valet")
    } yield expect(system.left.exists(_._1.code == 409)) and
      expect(unknown.left.exists(_._1.code == 404)) and
      expect(inUse.left.exists(_._1.code == 409))
  }

  test("a non-admin cannot create or delete roles (403)") { xa =>
    import com.kanzen.api.Roles.CreateRoleReq
    for {
      create <- Roles.createRole(xa, manager, CreateRoleReq("Sneaky", None))
      del <- Roles.deleteRole(xa, manager, "Gardener")
    } yield expect(create.left.exists(_._1.code == 403)) and expect(del.left.exists(_._1.code == 403))
  }
}
