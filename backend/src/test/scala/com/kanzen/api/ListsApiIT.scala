package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Lists.{AddItemReq, CreateListReq}
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F08 — shopping lists: Staff propose (non-recurring → needs_approval), Manager/Principal
  * approve; Staff cannot approve. */
object ListsApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val toby   = Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "toby@kanzen.local", "principal")
  private val marcia = Principal(UUID.fromString("10000000-0000-0000-0000-000000000003"), "m", "marcia@kanzen.local", "staff")

  test("a Staff-proposed non-recurring item needs approval; a recurring staple goes straight in") { xa =>
    for {
      list  <- Lists.createList(xa, toby, CreateListReq("Groceries", Some("Waitrose"), None)).map(_.toOption.get)
      prop  <- Lists.addItem(xa, marcia, list.id, AddItemReq("Truffle oil", Some(1), Some(false), None)).map(_.toOption.get)
      staple <- Lists.addItem(xa, marcia, list.id, AddItemReq("Milk", Some(2), Some(true), None)).map(_.toOption.get)
    } yield expect(prop.status == "needs_approval") and expect(staple.status == "added")
  }

  test("Manager/Principal approve; Staff cannot approve (403)") { xa =>
    for {
      list  <- Lists.createList(xa, toby, CreateListReq("Groceries 2", None, None)).map(_.toOption.get)
      item  <- Lists.addItem(xa, marcia, list.id, AddItemReq("Coffee", Some(1), Some(false), None)).map(_.toOption.get)
      staff <- Lists.approve(xa, marcia, item.id)
      ok    <- Lists.approve(xa, toby, item.id)
      after <- Lists.items(xa, toby, list.id).map(_.toOption.get)
    } yield expect(staff.left.exists(_._1.code == 403)) and expect(ok.isRight) and
      expect(after.exists(i => i.name == "Coffee" && i.status == "added"))
  }

  test("the seeded grocery list is listable with its items") { xa =>
    for {
      lists <- Lists.lists(xa, toby).map(_.toOption.get)
      gl     = lists.find(_.name == "Weekly groceries")
      items <- gl.fold(IO.pure(List.empty[Lists.ItemView]))(l => Lists.items(xa, toby, l.id).map(_.toOption.get))
    } yield expect(gl.isDefined) and expect(items.exists(_.name == "Whole milk"))
  }
}
