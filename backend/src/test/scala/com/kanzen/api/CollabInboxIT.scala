package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Inbox.{AssignReq, CommentReq, StatusReq}
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import com.kanzen.people.PeopleRepo
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** W9 — the collaborative inbox: inboxes + threads + the agent's auto-suggested proposals, Staff scope, and
  * assign/comment/done collaboration over the seeded threads.
  */
object CollabInboxIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val toby =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "flavian@kanzen.local", "principal")
  private val marcia =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000003"), "m", "marcia@kanzen.local", "staff")

  test("inboxes + threads + detail surface the agent's proposal (financial stays proposed)") { xa =>
    for {
      inboxes <- Inbox.inboxes(xa, toby).map(_.toOption.get)
      groceries = inboxes.find(_.address.startsWith("groceries")).get
      threads <- Inbox.threads(xa, toby, Some(groceries.id), Some("open"), None).map(_.toOption.get)
      ocado = threads.find(_.subject.exists(_.contains("Ocado"))).get
      detail <- Inbox.detail(xa, toby, ocado.id).map(_.toOption.get)
    } yield expect(inboxes.sizeIs >= 4) and expect(ocado.proposalCount >= 1L) and
      expect(detail.messages.nonEmpty) and
      expect(detail.proposals.exists(_.title.exists(_.contains("Ocado")))) and
      expect(detail.proposals.forall(_.status == "proposed")) and // F27: never auto-executed
      expect(detail.proposals.exists(_.confidence.exists(_ > 0.5)))
  }

  test("Staff are scope-filtered: Marcia sees Wardian threads, not Singapore") { xa =>
    for {
      tobyT <- Inbox.threads(xa, toby, None, Some("open"), None).map(_.toOption.get)
      marciaT <- Inbox.threads(xa, marcia, None, Some("open"), None).map(_.toOption.get)
      marciaInboxes <- Inbox.inboxes(xa, marcia).map(_.toOption.get)
    } yield expect(tobyT.exists(_.subject.exists(_.contains("Pool service")))) and // principal sees Singapore
      expect(!marciaT.exists(_.subject.exists(_.contains("Pool service")))) and // hidden from Wardian staff
      expect(marciaT.exists(_.subject.exists(_.contains("Ocado")))) and // Wardian threads visible
      expect(!marciaInboxes.exists(_.address.startsWith("singapore")))
  }

  test("W9.2 — confirming a proposal creates the real record + links it back; attachments surface") { xa =>
    for {
      inboxes <- Inbox.inboxes(xa, toby).map(_.toOption.get)
      groceries = inboxes.find(_.address.startsWith("groceries")).get
      threads <- Inbox.threads(xa, toby, Some(groceries.id), Some("open"), None).map(_.toOption.get)
      ocado = threads.find(_.subject.exists(_.contains("Ocado"))).get
      detail <- Inbox.detail(xa, toby, ocado.id).map(_.toOption.get)
      proposal = detail.proposals.head
      // the forwarded receipt is attached + the agent extracted a proposal from it
      result <- Inbox.confirmProposal(xa, toby, proposal.id).map(_.toOption.get)
      // re-fetch: the proposal is no longer 'proposed', and a link to the created expense exists
      after <- Inbox.detail(xa, toby, ocado.id).map(_.toOption.get)
      expenses <- com.kanzen.finance.ExpenseRepo.list(None).transact(xa)
    } yield expect(detail.attachments.exists(_.filename.endsWith(".pdf"))) and
      expect(result.created == "expense") and
      expect(after.proposals.forall(_.status != "proposed")) and // executed, not still pending
      expect(expenses.exists(_.payee.contains("Ocado"))) // a real expense (for approval) was created
  }

  test("W9.2 — confirming a delivery proposal creates a calendar event") { xa =>
    for {
      threads <- Inbox.threads(xa, toby, None, Some("open"), None).map(_.toOption.get)
      amazon = threads.find(_.subject.exists(_.contains("Amazon"))).get
      detail <- Inbox.detail(xa, toby, amazon.id).map(_.toOption.get)
      result <- Inbox.confirmProposal(xa, toby, detail.proposals.head.id).map(_.toOption.get)
    } yield expect(result.created == "event") and expect(result.recordType.contains("calendar"))
  }

  test("assign · comment · done round-trip") { xa =>
    for {
      marciaPid <- PeopleRepo.assigneeScope(marcia.userId).transact(xa).map(_.get.personId)
      inboxes <- Inbox.inboxes(xa, toby).map(_.toOption.get)
      deliveries = inboxes.find(_.address.startsWith("deliveries")).get
      open <- Inbox.threads(xa, toby, Some(deliveries.id), Some("open"), None).map(_.toOption.get)
      amazon = open.find(_.subject.exists(_.contains("Amazon"))).get
      _ <- Inbox.assign(xa, toby, amazon.id, AssignReq(Some(marciaPid))).map(_.toOption.get)
      _ <- Inbox
        .comment(xa, toby, amazon.id, CommentReq("Leave it with the concierge if no answer.", None))
        .map(_.toOption.get)
      _ <- Inbox.setStatus(xa, toby, amazon.id, StatusReq("done")).map(_.toOption.get)
      detail <- Inbox.detail(xa, toby, amazon.id).map(_.toOption.get)
      stillOpen <- Inbox.threads(xa, toby, Some(deliveries.id), Some("open"), None).map(_.toOption.get)
    } yield expect(detail.thread.assigneeId.contains(marciaPid)) and
      expect(detail.comments.exists(_.body.contains("concierge"))) and
      expect(detail.thread.status == "done") and
      expect(!stillOpen.exists(_.id == amazon.id)) // done → left the open queue ("goes away")
  }
}
