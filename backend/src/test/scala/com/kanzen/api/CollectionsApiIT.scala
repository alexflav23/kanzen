package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Collections.{AddMemberReq, CreateReq}
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F04 — asset collections: registry-private list/members/create/add-member; staff (no asset read) is refused. */
object CollectionsApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val principal =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "f", "flavian@kanzen.local", "principal")
  private val staff =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000004"), "s", "siti@kanzen.local", "staff")
  private val watches = UUID.fromString("43000000-0000-0000-0000-000000000001")

  test("principal lists the seeded Watches collection with its 2 members") { xa =>
    for {
      cols <- Collections.list(xa, principal).map(_.toOption.get)
      members <- Collections.members(xa, principal, watches).map(_.toOption.get)
    } yield expect(cols.exists(c => c.name == "Watches" && c.memberCount == 2)) and
      expect(members.size == 2) and expect(members.exists(_.title == "Royal Oak 15500ST"))
  }

  test("principal creates a collection + adds a member (audited); member shows up") { xa =>
    for {
      created <- Collections.create(xa, principal, CreateReq("Timepieces", Some("test"))).map(_.toOption.get)
      add <- Collections.addMember(
        xa,
        principal,
        created.id,
        AddMemberReq(UUID.fromString("40000000-0000-0000-0000-000000000003"))
      )
      members <- Collections.members(xa, principal, created.id).map(_.toOption.get)
    } yield expect(created.name == "Timepieces") and expect(created.memberCount == 0) and
      expect(add.isRight) and expect(members.exists(_.title == "1959 Les Paul Standard"))
  }

  test("forAsset returns the collections an asset belongs to; staff is forbidden (403)") { xa =>
    val asset = UUID.fromString("40000000-0000-0000-0000-000000000003") // seeded 1959 Les Paul
    for {
      c <- Collections.create(xa, principal, CreateReq("ForAsset-test", None)).map(_.toOption.get)
      _ <- Collections.addMember(xa, principal, c.id, AddMemberReq(asset)).map(_.toOption.get)
      refs <- Collections.forAsset(xa, principal, asset).map(_.toOption.get)
      staffR <- Collections.forAsset(xa, staff, asset)
    } yield expect(refs.exists(r => r.id == c.id && r.name == "ForAsset-test")) and
      expect(staffR.left.exists(_._1.code == 403))
  }

  test("members of an unknown collection is 404") { xa =>
    Collections.members(xa, principal, UUID.randomUUID()).map(r => expect(r.left.exists(_._1.code == 404)))
  }

  test("staff (no asset read) is forbidden from collections (403)") { xa =>
    for {
      list <- Collections.list(xa, staff)
      create <- Collections.create(xa, staff, CreateReq("Sneaky", None))
    } yield expect(list.left.exists(_._1.code == 403)) and expect(create.left.exists(_._1.code == 403))
  }
}
