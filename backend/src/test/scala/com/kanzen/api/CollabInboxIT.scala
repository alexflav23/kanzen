package com.kanzen.api

import com.kanzen.tenant.Tenant
import cats.effect.IO
import com.kanzen.api.Collab.{AddCommentReq, EditCommentReq}
import com.kanzen.api.Inbox.{AssignReq, CommentReq, CreateTaskFromThreadReq, DraftReq, SendReq, StatusReq}
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import com.kanzen.people.PeopleRepo
import doobie.implicits._
import doobie.postgres.implicits._
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
  private val lorna =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000002"), "l", "lorna@kanzen.local", "manager")

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

  test("W9.4 — mailbox visibility is RBAC-gated: only the right person sees the right mailbox") { xa =>
    for {
      tobyBoxes <- Inbox.inboxes(xa, toby).map(_.toOption.get.map(_.label))
      lornaBoxes <- Inbox.inboxes(xa, lorna).map(_.toOption.get.map(_.label))
      marciaBoxes <- Inbox.inboxes(xa, marcia).map(_.toOption.get.map(_.label))
      // a staff member can't open a thread in a mailbox above their tier, even by id (no API bypass)
      principalThreads <- Inbox.threads(xa, toby, None, Some("inbox"), None).map(_.toOption.get)
      eleanor = principalThreads.find(_.subject.exists(_.contains("dinner"))).get // in the Principal mailbox
      marciaSeesEleanor <- Inbox.detail(xa, marcia, eleanor.id).map(_.isRight)
    } yield expect(tobyBoxes.contains("Principal")) and // principal sees their private mailbox
      expect(!lornaBoxes.contains("Principal")) and // manager does NOT see the principal's mailbox
      expect(lornaBoxes.contains("Accounts")) and // manager sees the manager-tier mailbox
      expect(!marciaBoxes.contains("Accounts")) and // staff does NOT see the manager-tier mailbox
      expect(!marciaBoxes.contains("Principal")) and
      expect(!marciaSeesEleanor) // and can't reach its threads by id
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
      expenses <- com.kanzen.finance.ExpenseRepo.list(Tenant.DefaultId, None).transact(xa)
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
      tasksAfter <- com.kanzen.tasks.TaskRepo.listTasks(Tenant.DefaultId, None, None).transact(xa)
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

  test("W9.4b — thread→task: an email becomes a task, linked back to the thread") { xa =>
    for {
      threads <- Inbox.threads(xa, toby, None, Some("inbox"), None).map(_.toOption.get)
      crystal = threads.find(_.subject.exists(_.contains("Pool service"))).get
      created <- Inbox
        .threadToTask(
          xa,
          toby,
          crystal.id,
          CreateTaskFromThreadReq("Brief Siti before the pool team arrive", None, Some("high"), None)
        )
        .map(_.toOption.get)
      // the task surfaces on the thread's linked records — back-reference closed both ways
      linked <- Inbox.linked(xa, toby, "task", created.taskId).map(_.toOption.get)
      tasks <- com.kanzen.tasks.TaskRepo.listTasks(Tenant.DefaultId, None, None).transact(xa)
    } yield expect(tasks.exists(t => t.id == created.taskId && t.title.contains("Siti"))) and
      expect(linked.exists(_.id == crystal.id)) // the thread is linked from the task
  }

  test("W9.4b — generic /api/comments on a thread: a @mention emits a comment_mentioned F34 event") { xa =>
    val lornaUser = UUID.fromString("10000000-0000-0000-0000-000000000002")
    for {
      threads <- Inbox.threads(xa, toby, None, Some("inbox"), None).map(_.toOption.get)
      eleanor = threads.find(_.subject.exists(_.contains("dinner"))).get
      created <- Collab
        .addComment(
          xa,
          toby,
          AddCommentReq("email_thread", eleanor.id, "@Lorna can you book Marcus?", Some(List(lornaUser)))
        )
        .map(_.toOption.get)
      // filter by THIS comment's id so the assertion is race-proof against other parallel tests
      events <-
        sql"""select count(*) from event_outbox where event_type = 'comment_mentioned'
              and payload->>'commentId' = ${created.id.toString}"""
          .query[Long]
          .unique
          .transact(xa)
      list <- Collab.comments(xa, toby, "email_thread", eleanor.id).map(_.toOption.get)
    } yield expect(events == 1L) and // exactly one event for the one mention
      expect(list.exists(c => c.mentions.contains(lornaUser) && c.body.contains("Marcus")))
  }

  test("W9.4b-ii — edit a comment: author can; non-author 403; new mention notifies, re-mention does not") { xa =>
    val lornaUser = UUID.fromString("10000000-0000-0000-0000-000000000002")
    val siti = UUID.fromString("10000000-0000-0000-0000-000000000004")
    for {
      threads <- Inbox.threads(xa, toby, None, Some("inbox"), None).map(_.toOption.get)
      eleanor = threads.find(_.subject.exists(_.contains("dinner"))).get
      created <- Collab
        .addComment(xa, toby, AddCommentReq("email_thread", eleanor.id, "Lets sort it 😀", Some(List(lornaUser))))
        .map(_.toOption.get)
      // count is filtered to THIS comment so other tests don't perturb the delta
      countQ = sql"""select count(*) from event_outbox where event_type = 'comment_mentioned'
                     and payload->>'commentId' = ${created.id.toString}""".query[Long].unique
      initial <- countQ.transact(xa)
      // marcia (non-author, even though she's staff) cannot edit toby's comment
      marciaTry <- Collab.editComment(xa, marcia, created.id, EditCommentReq("hijack", Some(Nil)))
      // author edits: same body+mentions → no new event; adding Siti emits one more
      _ <- Collab
        .editComment(xa, toby, created.id, EditCommentReq("Lets sort it 😀✨", Some(List(lornaUser))))
        .map(_.toOption.get)
      afterSameMentions <- countQ.transact(xa)
      _ <- Collab
        .editComment(xa, toby, created.id, EditCommentReq("Lets sort it 😀✨", Some(List(lornaUser, siti))))
        .map(_.toOption.get)
      afterAddedMention <- countQ.transact(xa)
      list <- Collab.comments(xa, toby, "email_thread", eleanor.id).map(_.toOption.get)
      edited = list.find(_.id == created.id).get
    } yield expect(marciaTry.isLeft) and // 403 for non-author
      expect(initial == 1L) and // the original mention emitted once on creation
      expect(afterSameMentions == initial) and // re-mention does NOT re-notify
      expect(afterAddedMention == initial + 1) and // a newly-added mention DOES notify (just one)
      expect(edited.body.contains("✨")) and // emoji round-trips
      expect(edited.updatedAt.isDefined) // "edited" badge data
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

  // F34 — the drift bar for the Collab/Comments + Inbox/Links domain. The realtime layer (F48) consumes
  // `comment.created`, `comment.edited`, `comment_mentioned`, `link.created` directly — if any goes silent,
  // chat goes silent, so the canary is the spec.
  test("F34 — comments + links emit the canonical events on every mutation") { xa =>
    val lornaUser = UUID.fromString("10000000-0000-0000-0000-000000000002")
    for {
      threads <- Inbox.threads(xa, toby, None, Some("inbox"), None).map(_.toOption.get)
      eleanor = threads.find(_.subject.exists(_.contains("dinner"))).get
      // 1) add a comment with one mention → comment.created + comment_mentioned
      added <- Collab
        .addComment(
          xa,
          toby,
          AddCommentReq("email_thread", eleanor.id, "Heads up @Lorna", Some(List(lornaUser)))
        )
        .map(_.toOption.get)
      // 2) edit it → comment.edited
      _ <- Collab
        .editComment(xa, toby, added.id, EditCommentReq("Heads up @Lorna ✨", Some(List(lornaUser))))
        .map(_.toOption.get)
      commentEvents <-
        sql"""select event_type from event_outbox
              where (payload->>'commentId' = ${added.id.toString}
                  or payload->'payload'->>'commentId' = ${added.id.toString})
              order by created_at""".query[String].to[List].transact(xa)
      // 3) link the thread directly to a fresh target id — race-proof against other tests' confirms
      freshTarget = UUID.randomUUID()
      _ <- com.kanzen.inbox.CollabInboxRepo
        .link(toby.userId, eleanor.id, "asset", freshTarget, toby.userId)
        .transact(xa)
      linkEvents <-
        sql"select event_type from event_outbox where event_type = 'link.created' and aggregate_id = $freshTarget"
          .query[String]
          .to[List]
          .transact(xa)
    } yield expect(commentEvents.contains("comment.created")) and
      expect(commentEvents.contains("comment_mentioned")) and
      expect(commentEvents.contains("comment.edited")) and
      expect(linkEvents == List("link.created")) // exactly one link.created on the fresh target
  }

  // F34 — the drift bar for the Inbox/thread + proposal domain. The realtime layer (F48) pushes these to a thread's
  // subscribers so the inbox list + open thread update without a refresh; if any goes silent, the thread freezes.
  // Race-proof: operates on the Octopus + Selfridges threads, whose proposals no other test confirms/rejects.
  test("F34 — inbox thread + proposal mutations emit the canonical events") { xa =>
    val octopusThread = UUID.fromString("49100000-0000-0000-0000-000000000004")
    val octopusProposal = UUID.fromString("49300000-0000-0000-0000-000000000004") // reconcile_bill — rejected here
    val selfridgesThread = UUID.fromString("49100000-0000-0000-0000-000000000007")
    val selfridgesProposal = UUID.fromString("49300000-0000-0000-0000-000000000007") // create_receipt — confirmed here
    for {
      marciaPid <- PeopleRepo.assigneeScope(marcia.userId).transact(xa).map(_.get.personId)
      // 1) thread lifecycle on the Octopus thread → assigned + status_changed + replied
      _ <- Inbox.assign(xa, toby, octopusThread, AssignReq(Some(marciaPid))).map(_.toOption.get)
      _ <- Inbox.setStatus(xa, toby, octopusThread, StatusReq("done")).map(_.toOption.get)
      _ <- Inbox.send(xa, toby, octopusThread, SendReq("<p>Looking into the variance.</p>")).map(_.toOption.get)
      threadEvents <-
        sql"select event_type from event_outbox where aggregate_id = $octopusThread"
          .query[String]
          .to[List]
          .transact(xa)
      // 2) confirm a live proposal (Selfridges → expense) + reject another (Octopus) → proposal events
      _ <- Inbox.confirmProposal(xa, toby, selfridgesProposal).map(_.toOption.get)
      _ <- Inbox.rejectProposal(xa, toby, octopusProposal).map(_.toOption.get)
      confirmEvents <-
        sql"""select event_type from event_outbox
              where event_type = 'email_proposal.confirmed' and aggregate_id = $selfridgesThread"""
          .query[String]
          .to[List]
          .transact(xa)
      rejectEvents <-
        sql"""select event_type from event_outbox
              where event_type = 'email_proposal.rejected' and aggregate_id = $octopusThread"""
          .query[String]
          .to[List]
          .transact(xa)
    } yield expect(threadEvents.contains("email_thread.assigned")) and
      expect(threadEvents.contains("email_thread.status_changed")) and
      expect(threadEvents.contains("email_thread.replied")) and
      expect(confirmEvents.nonEmpty) and // exactly-once confirm fires email_proposal.confirmed
      expect(rejectEvents.nonEmpty)
  }
}
