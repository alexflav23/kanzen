package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Groups.{AddReq, CreateReq}
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F04 (W1.5) — asset groups: registry-private CRUD + membership (peer groupings). Staff (no asset read/write) is
  * refused; bad kind → 400; unknown group → 404.
  */
object GroupsApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private def principal(role: String) = Principal(UUID.randomUUID(), s"$role-sub", s"$role@kanzen.local", role)
  private val toby = principal("principal")
  private val asset = UUID.fromString("40000000-0000-0000-0000-000000000003") // seeded 1959 Les Paul

  test("create a group + add an asset; it shows in forAsset + list memberCount") { xa =>
    for {
      g <- Groups.create(xa, toby, CreateReq("Dining order", "order", Some("4 chairs"))).map(_.toOption.get)
      add <- Groups.addToGroup(xa, toby, asset, AddReq(g.id))
      fa <- Groups.forAsset(xa, toby, asset).map(_.toOption.get)
      list <- Groups.list(xa, toby).map(_.toOption.get)
    } yield expect(g.kind == "order") and expect(add.isRight) and
      expect(fa.exists(r => r.id == g.id && r.kind == "order")) and
      expect(list.exists(v => v.id == g.id && v.memberCount >= 1))
  }

  test("remove an asset from a group") { xa =>
    for {
      g <- Groups.create(xa, toby, CreateReq("Rig", "rig", None)).map(_.toOption.get)
      _ <- Groups.addToGroup(xa, toby, asset, AddReq(g.id))
      _ <- Groups.removeFromGroup(xa, toby, asset, g.id)
      fa <- Groups.forAsset(xa, toby, asset).map(_.toOption.get)
    } yield expect(!fa.exists(_.id == g.id))
  }

  test("bad kind → 400; adding to an unknown group → 404") { xa =>
    for {
      badKind <- Groups.create(xa, toby, CreateReq("Nope", "banana", None))
      unknown <- Groups.addToGroup(xa, toby, asset, AddReq(UUID.randomUUID()))
    } yield expect(badKind.left.exists(_._1.code == 400)) and expect(unknown.left.exists(_._1.code == 404))
  }

  test("staff cannot list/create/add (403)") { xa =>
    val staff = principal("staff")
    for {
      g <- Groups.create(xa, toby, CreateReq("Set", "set", None)).map(_.toOption.get)
      l <- Groups.list(xa, staff)
      c <- Groups.create(xa, staff, CreateReq("Sneaky", "set", None))
      a <- Groups.addToGroup(xa, staff, asset, AddReq(g.id))
    } yield expect(l.left.exists(_._1.code == 403)) and
      expect(c.left.exists(_._1.code == 403)) and expect(a.left.exists(_._1.code == 403))
  }
}
