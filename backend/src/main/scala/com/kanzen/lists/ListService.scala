package com.kanzen.lists

/** F08 — list-item approval routing: a staff-proposed, non-recurring item needs the
  * Principal's approval; recurring staples (or items added by manager/principal) go straight in.
  */
object ListService {
  def initialStatus(recurring: Boolean, proposedByStaff: Boolean): String =
    if (proposedByStaff && !recurring) "needs_approval" else "added"
}
