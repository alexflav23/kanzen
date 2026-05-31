package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Chat.CreateChatReq
import com.kanzen.api.Collab.AddCommentReq
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F48 RT.4 — DM/group chat over the generic primitives. Membership is the authorization; messages ride the same
  * `/api/comments` + realtime path; everything is tenant-scoped.
  */
object ChatApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val toby =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "flavian@kanzen.local", "principal")
  private val lorna =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000002"), "l", "lorna@kanzen.local", "manager")
  private val marcia =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000003"), "m", "marcia@kanzen.local", "staff")

  test("a chat is private to its members: both see it, a non-member can't read or post") { xa =>
    for {
      chat <- Chat.create(xa, toby, CreateChatReq(List(lorna.userId))).map(_.toOption.get)
      // toby messages the chat through the generic comment path
      _ <- Collab.addComment(xa, toby, AddCommentReq("chat", chat.id, "Hi Lorna", None)).map(_.toOption.get)
      tobyChats <- Chat.list(xa, toby).map(_.toOption.get)
      lornaChats <- Chat.list(xa, lorna).map(_.toOption.get)
      marciaChats <- Chat.list(xa, marcia).map(_.toOption.get)
      // a non-member is denied both read + write on the chat
      marciaReads <- Collab.comments(xa, marcia, "chat", chat.id)
      marciaPosts <- Collab.addComment(xa, marcia, AddCommentReq("chat", chat.id, "sneaky", None))
      // a member reads the message
      lornaReads <- Collab.comments(xa, lorna, "chat", chat.id).map(_.toOption.get)
    } yield expect(tobyChats.exists(_.id == chat.id)) and
      expect(tobyChats.find(_.id == chat.id).exists(_.members.exists(_.contains("Lorna")))) and
      expect(lornaChats.exists(_.id == chat.id)) and // the recipient sees it too
      expect(!marciaChats.exists(_.id == chat.id)) and // a non-member never sees it
      expect(marciaReads.left.exists(_._1.code == 403) || marciaReads.toOption.exists(_.isEmpty)) and
      expect(marciaPosts.left.exists(_._1.code == 403)) and
      expect(lornaReads.exists(_.body == "Hi Lorna")) // the message arrives in the chat
  }

  test("tenant isolation: a chat never surfaces for a principal in another tenant") { xa =>
    for {
      otherTenant <-
        sql"insert into tenants (slug, name) values (${"ct-" + UUID.randomUUID()}, 'Other') returning id"
          .query[UUID]
          .unique
          .transact(xa)
      chat <- Chat.create(xa, toby, CreateChatReq(List(lorna.userId))).map(_.toOption.get)
      outsider = Principal(UUID.randomUUID(), "o", "o@x", "principal", None, otherTenant)
      seen <- Chat.list(xa, outsider).map(_.toOption.get)
    } yield expect(!seen.exists(_.id == chat.id))
  }
}
