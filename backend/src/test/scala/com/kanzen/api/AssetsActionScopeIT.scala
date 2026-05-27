package com.kanzen.api

import cats.effect.IO
import com.kanzen.auth.Principal
import com.kanzen.authz.PermissionRepo
import com.kanzen.asset.AssetRepo
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import weaver.IOSuite

import java.util.UUID

/** F02 v2 S3 — permission-set grants + scope reaching the *real* asset endpoints through `Authz.forUser`:
  *   - an `allow` grant on `asset:view` opens an endpoint a role with no asset rule would otherwise be denied;
  *   - a `deny` grant on `asset:create` overrides a role that holds the legacy write level (deny wins);
  *   - an `asset:view` grant scoped to `own` filters the list to the actor's assets and 404s another's detail.
  *
  * These exercise the migrated `can(action)` checks (Assets.scala) end-to-end, not just the Authorizer in isolation.
  */
object AssetsActionScopeIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private def sfx = UUID.randomUUID().toString.take(8)

  /** Any seeded category (assets need a valid category) + a seeded asset owned by someone other than `notUser`. */
  private def fixtures(notUser: UUID) =
    for {
      cat <- sql"select id from categories limit 1".query[UUID].unique
      other <-
        sql"select id from assets where deleted_at is null and (owner_id is null or owner_id <> $notUser) limit 1"
          .query[UUID]
          .unique
    } yield (cat, other)

  test("allow grant: a role with no asset rule can list assets once granted asset:view") { xa =>
    val u = UUID.randomUUID(); val s = sfx
    val (plain, granted) = (s"rbac_none_$s", s"rbac_view_$s")
    val prog = for {
      _ <- PermissionRepo.createRole(plain, None).transact(xa) // no rules at all
      _ <- PermissionRepo.createRole(granted, None).transact(xa)
      setId <-
        sql"insert into permission_sets (name) values (${"viewset-" + s}) returning id".query[UUID].unique.transact(xa)
      _ <-
        sql"insert into permission_set_grants (set_id, resource, action, effect) values ($setId, 'asset', 'view', 'allow')".update.run
          .transact(xa)
      _ <- sql"insert into role_sets (role_name, set_id) values ($granted, $setId)".update.run.transact(xa)
      denied <- Assets.list(xa, Principal(u, "u", "u@k.local", plain), None, None)
      allowed <- Assets.list(xa, Principal(u, "u", "u@k.local", granted), None, None)
    } yield (denied, allowed)
    prog.map { case (denied, allowed) =>
      expect(denied.left.exists(_._1.code == 403)) and expect(allowed.isRight)
    }
  }

  test("deny grant: an asset-write role is blocked from create by a deny grant on asset:create") { xa =>
    val u = UUID.randomUUID(); val s = sfx
    val (writer, writerDeny) = (s"rbac_w_$s", s"rbac_wd_$s")
    val prog = for {
      cat <- fixtures(u).transact(xa).map(_._1)
      _ <- PermissionRepo.createRole(writer, None).transact(xa)
      _ <- PermissionRepo.upsert(writer, "asset", None, "write").transact(xa)
      _ <- PermissionRepo.createRole(writerDeny, None).transact(xa)
      _ <- PermissionRepo.upsert(writerDeny, "asset", None, "write").transact(xa)
      setId <-
        sql"insert into permission_sets (name) values (${"nocreate-" + s}) returning id".query[UUID].unique.transact(xa)
      _ <-
        sql"insert into permission_set_grants (set_id, resource, action, effect) values ($setId, 'asset', 'create', 'deny')".update.run
          .transact(xa)
      _ <- sql"insert into role_sets (role_name, set_id) values ($writerDeny, $setId)".update.run.transact(xa)
      req = Assets.CreateReq("RBAC create probe", None, cat, None, "unique", 1, None, None, None, None, None, None)
      ok <- Assets.create(xa, Principal(u, "u", "u@k.local", writer), req)
      blocked <- Assets.create(xa, Principal(u, "u", "u@k.local", writerDeny), req)
    } yield (ok, blocked)
    prog.map { case (ok, blocked) =>
      expect(ok.isRight) and expect(blocked.left.exists(_._1.code == 403))
    }
  }

  test("own scope: an asset:view grant scoped to own filters the list and 404s another's detail") { xa =>
    val u = UUID.randomUUID(); val s = sfx
    val role = s"rbac_own_$s"
    val prog = for {
      cf <- fixtures(u).transact(xa)
      (cat, otherAsset) = cf
      mine <- AssetRepo
        .insert(u, s"RBAC own asset $s", None, cat, None, "unique", 1, None, None, None, None, None, Json.obj())
        .transact(xa)
      _ <- PermissionRepo.createRole(role, None).transact(xa)
      setId <-
        sql"insert into permission_sets (name) values (${"ownset-" + s}) returning id".query[UUID].unique.transact(xa)
      _ <-
        sql"insert into permission_set_grants (set_id, resource, action, effect, scope) values ($setId, 'asset', 'view', 'allow', 'own')".update.run
          .transact(xa)
      _ <- sql"insert into role_sets (role_name, set_id) values ($role, $setId)".update.run.transact(xa)
      p = Principal(u, "u", "u@k.local", role)
      listed <- Assets.list(xa, p, None, None)
      mineDetail <- Assets.detail(xa, p, mine.id)
      otherDetail <- Assets.detail(xa, p, otherAsset)
    } yield (mine.id, otherAsset, listed, mineDetail, otherDetail)
    prog.map { case (mineId, otherAsset, listed, mineDetail, otherDetail) =>
      val ids = listed.toOption.toList.flatten.map(_.id).toSet
      expect(ids.contains(mineId)) and // my own asset is visible
        expect(!ids.contains(otherAsset)) and // another owner's asset is filtered out
        expect(mineDetail.isRight) and // I can open my own
        expect(otherDetail.left.exists(_._1.code == 404)) // another's is a 404 (no leak)
    }
  }
}
