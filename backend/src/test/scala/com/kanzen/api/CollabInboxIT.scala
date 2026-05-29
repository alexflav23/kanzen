package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Inbox.{AssignReq, CommentReq, DraftReq, SendReq, StatusReq}
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
      deliveries = inboxes.find(_.address.startsWith("deliveries")).get
      threads <- Inbox.threads(xa, toby, Some(deliveries.id), Some("inbox"), None).map(_.toOption.get)
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
      deliveries = inboxes.find(_.address.startsWith("deliveries")).get
      threads <- Inbox.threads(xa, toby, Some(deliveries.id), Some("inbox"), None).map(_.toOption.get)
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

  test("W9.4 — the review popup gets the itemised receipt; the event gets date/time + its linked car") { xa =>
    for {
      threads <- Inbox.threads(xa, toby, None, Some("open"), None).map(_.toOption.get)
      ocado = threads.find(_.subject.exists(_.contains("Ocado"))).get
      ocadoDetail <- Inbox.detail(xa, toby, ocado.id).map(_.toOption.get)
      receipt <- Inbox.proposalDetail(xa, toby, ocadoDetail.proposals.head.id).map(_.toOption.get)
      service = threads.find(_.subject.exists(_.contains("Range Rover"))).get
      serviceDetail <- Inbox.detail(xa, toby, service.id).map(_.toOption.get)
      event <- Inbox.proposalDetail(xa, toby, serviceDetail.proposals.head.id).map(_.toOption.get)
    } yield expect(receipt.kind == "receipt") and
      expect(receipt.lineItems.sizeIs == 18) and // the itemised receipt
      expect(receipt.lineItems.flatMap(_.amountMinor).sum == 14250L) and // items reconcile to the total
      expect(receipt.totalMinor.contains(14250L)) and
      expect(receipt.willCreate.contains("never moves money")) and // F27 surfaced in the popup
      expect(event.kind == "event") and
      expect(event.time.contains("09:00")) and
      expect(event.links.exists(_.label.contains("Range Rover"))) // the event shows what it links to
  }

  test("W9.4 — the model picks the primitive: a personal email → a task, a note → grocery-list items") { xa =>
    for {
      threads <- Inbox.threads(xa, toby, None, Some("open"), None).map(_.toOption.get)
      // a personal email the agent turned into a task
      eleanor = threads.find(_.subject.exists(_.contains("dinner"))).get
      eDetail <- Inbox.detail(xa, toby, eleanor.id).map(_.toOption.get)
      taskProp = eDetail.proposals.find(_.actionType == "create_task").get
      taskReview <- Inbox.proposalDetail(xa, toby, taskProp.id).map(_.toOption.get)
      taskRes <- Inbox.confirmProposal(xa, toby, taskProp.id).map(_.toOption.get)
      tasksAfter <- com.kanzen.tasks.TaskRepo.listTasks(None, None).transact(xa)
      // a housekeeper note the agent routed to the grocery list
      groceries = threads.find(_.subject.exists(_.contains("next order"))).get
      gDetail <- Inbox.detail(xa, toby, groceries.id).map(_.toOption.get)
      listProp = gDetail.proposals.find(_.actionType == "add_to_list").get
      listReview <- Inbox.proposalDetail(xa, toby, listProp.id).map(_.toOption.get)
      listRes <- Inbox.confirmProposal(xa, toby, listProp.id).map(_.toOption.get)
      gItems <- com.kanzen.lists.ListRepo
        .items(UUID.fromString("c0000000-0000-0000-0000-000000000001"))
        .transact(xa)
    } yield expect(taskReview.kind == "task") and
      expect(taskReview.assignee.contains("Lorna")) and // resolved the assignee for the popup
      expect(taskRes.created == "task") and
      expect(tasksAfter.exists(_.title.contains("Book Marcus"))) and // a real task was created
      expect(listReview.kind == "list") and
      expect(listReview.lineItems.sizeIs == 4) and
      expect(listRes.created == "list") and
      expect(gItems.exists(_.name.contains("Coffee"))) // items landed on the grocery list
  }

  test("W9.2 — confirming a delivery proposal creates a calendar event") { xa =>
    for {
      threads <- Inbox.threads(xa, toby, None, Some("open"), None).map(_.toOption.get)
      amazon = threads.find(_.subject.exists(_.contains("Amazon"))).get
      detail <- Inbox.detail(xa, toby, amazon.id).map(_.toOption.get)
      result <- Inbox.confirmProposal(xa, toby, detail.proposals.head.id).map(_.toOption.get)
    } yield expect(result.created == "event") and expect(result.recordType.contains("calendar"))
  }

  test("W9.2 — confirming the service links the thread to the car; its page back-references the email") { xa =>
    val rangeRover = UUID.fromString("40000000-0000-0000-0000-000000000006")
    for {
      threads <- Inbox.threads(xa, toby, None, Some("open"), None).map(_.toOption.get)
      service = threads.find(_.subject.exists(_.contains("Range Rover"))).get
      detail <- Inbox.detail(xa, toby, service.id).map(_.toOption.get)
      // before: the car has no linked mail
      before <- Inbox.linked(xa, toby, "asset", rangeRover).map(_.toOption.get)
      result <- Inbox.confirmProposal(xa, toby, detail.proposals.head.id).map(_.toOption.get)
      // after: the back-reference loop is closed — the car's page now shows the booking email
      linked <- Inbox.linked(xa, toby, "asset", rangeRover).map(_.toOption.get)
    } yield expect(result.created == "event") and
      expect(before.isEmpty) and
      expect(linked.exists(_.id == service.id)) and
      expect(linked.forall(_.subject.exists(_.contains("Range Rover"))))
  }

  test("W9.4 — shared draft round-trips, then sends as an outbound reply from the inbox") { xa =>
    for {
      threads <- Inbox.threads(xa, toby, None, Some("open"), None).map(_.toOption.get)
      eleanor = threads.find(_.subject.exists(_.contains("dinner"))).get // a personal thread, no proposal
      _ <- Inbox.saveDraft(xa, toby, eleanor.id, DraftReq("<p>Lovely — Saturday works.</p>")).map(_.toOption.get)
      withDraft <- Inbox.detail(xa, toby, eleanor.id).map(_.toOption.get)
      _ <- Inbox
        .send(xa, toby, eleanor.id, SendReq("<p>Lovely — <strong>Saturday</strong> works.</p>"))
        .map(_.toOption.get)
      after <- Inbox.detail(xa, toby, eleanor.id).map(_.toOption.get)
      out = after.messages.filter(_.direction == "outbound")
    } yield expect(withDraft.draft.exists(_.bodyHtml.contains("Saturday"))) and // the shared draft persisted
      expect(out.sizeIs == 1) and
      expect(out.head.bodyHtml.exists(_.contains("<strong>"))) and // rich HTML retained
      expect(out.head.fromAddr.exists(_.contains("@kanzen.family"))) and // sent from the inbox
      expect(after.draft.isEmpty) // draft consumed on send
  }

  test("W9.4 — send sanitizes injected markup (defence in depth)") { xa =>
    for {
      threads <- Inbox.threads(xa, toby, None, Some("open"), None).map(_.toOption.get)
      crystal = threads.find(_.subject.exists(_.contains("Pool service"))).get
      _ <- Inbox.send(xa, toby, crystal.id, SendReq("<p>Thanks</p><script>steal()</script>")).map(_.toOption.get)
      after <- Inbox.detail(xa, toby, crystal.id).map(_.toOption.get)
      out = after.messages.filter(_.direction == "outbound").last // the reply we just sent (a prior one is seeded)
    } yield expect(out.bodyHtml.exists(!_.contains("<script"))) and expect(out.bodyHtml.exists(_.contains("Thanks")))
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
