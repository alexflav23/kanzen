package com.kanzen.events

/** F34 — the canonical event-type catalogue. Every emit references a constant here so the wire format is grep-able and
  * the spec ([[specs/F34-event-instrumentation.md]]) stays in sync with code. Adding a new event = one constant here +
  * one `DomainWriter.write(...)` call site.
  *
  * Naming rule: `<aggregate>.<verb>` — lowercase, dot-separated, past-tense verbs.
  */
object Events {
  // ── Operations ─────────────────────────────────────────────────────────────
  object Calendar {
    val Created = "calendar_event.created"
    val Updated = "calendar_event.updated"
    val Deleted = "calendar_event.deleted"
  }
  object Task {
    val Created = "task.created"
    val Assigned = "task.assigned"
    val Updated = "task.updated"
    val Completed = "task.completed"
    val Cancelled = "task.cancelled"
  }
  object ListItem {
    val Proposed = "list.item_proposed"
    val Approved = "list.item_approved"
    val Ordered = "list.ordered"
  }
  object Maintenance {
    val Scheduled = "maintenance.scheduled"
    val Completed = "maintenance.completed"
  }

  // ── Comms (W9) ─────────────────────────────────────────────────────────────
  object Comment {
    val Created = "comment.created"
    val Edited = "comment.edited"
    val Mentioned = "comment_mentioned" // existing — kept name for back-compat with W9.4b consumer
  }
  object Link {
    val Created = "link.created"
    val Deleted = "link.deleted"
  }
  object Thread {
    val Received = "email_thread.received"
    val Assigned = "email_thread.assigned"
    val StatusSet = "email_thread.status_changed"
    val Replied = "email_thread.replied"
  }
  object EmailProposal {
    val Proposed = "email_proposal.proposed"
    val Confirmed = "email_proposal.confirmed"
    val Rejected = "email_proposal.rejected"
  }

  // ── Registry / Property ────────────────────────────────────────────────────
  object Asset {
    val Created = "asset.created"
    val Updated = "asset.updated"
    val Moved = "asset.moved"
    val CustodyChanged = "asset.custody_changed"
    val SetHero = "asset.set_hero"
    val Archived = "asset.archived"
    val Restructured = "asset.restructured"
    val EventLogged = "asset_event.logged"
  }
  object Property {
    val Created = "property.created"
    val Updated = "property.updated"
    val Archived = "property.archived"
  }
  object Defect {
    val Raised = "defect.raised"
    val Assigned = "defect.assigned"
    val Transitioned = "defect.transitioned"
    val Resolved = "defect.resolved"
  }

  // ── Finance ────────────────────────────────────────────────────────────────
  object Bill {
    val Created = "bill.created"
    val Approved = "bill.approved"
    val PaidMarked = "bill.paid_marked"
    val Scheduled = "bill.scheduled"
  }
  object Expense {
    val Submitted = "expense.submitted"
    val Approved = "expense.approved"
    val Rejected = "expense.rejected"
  }

  // ── System ─────────────────────────────────────────────────────────────────
  object Document {
    val Uploaded = "document.uploaded"
    val Deleted = "document.deleted"
  }
}
