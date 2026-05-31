package com.kanzen.chat

import cats.syntax.all._
import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

/** F48 RT.4 — direct/group chat, modelled on the existing primitives (no new tables): membership is `entity_links`
  * (`source_type='chat'`, `target_type='user'`), messages are `entity_comments` (`entity_type='chat'`). So chat rides
  * the F34 `comment.created` event + the F48 realtime layer for free, and is tenant-scoped like everything else.
  */
final case class ChatRow(id: UUID, lastMessage: Option[String], lastAt: Option[String], memberNames: List[String])

object ChatRepo {

  /** Create a chat with the given member set (the creator is always included). Idempotent membership inserts. */
  def create(tenantId: UUID, ownerId: UUID, chatId: UUID, memberIds: List[UUID]): ConnectionIO[Unit] =
    (ownerId :: memberIds).distinct.traverse_ { uid =>
      sql"""insert into entity_links (owner_id, tenant_id, source_type, source_id, target_type, target_id, role, created_by)
            values ($ownerId, $tenantId, 'chat', $chatId, 'user', $uid, 'member', $ownerId)
            on conflict do nothing""".update.run
    }

  def isMember(tenantId: UUID, chatId: UUID, userId: UUID): ConnectionIO[Boolean] =
    sql"""select exists(select 1 from entity_links
          where source_type='chat' and source_id=$chatId and target_type='user' and target_id=$userId
            and tenant_id=$tenantId)""".query[Boolean].unique

  /** Member (user) ids of a chat. */
  def memberIds(tenantId: UUID, chatId: UUID): ConnectionIO[List[UUID]] =
    sql"""select target_id from entity_links
          where source_type='chat' and source_id=$chatId and target_type='user' and tenant_id=$tenantId"""
      .query[UUID]
      .to[List]

  /** The chats a user belongs to, newest-activity first, with the last message preview + the *other* members' names. */
  def listFor(tenantId: UUID, userId: UUID): ConnectionIO[List[ChatRow]] =
    sql"""
      with mine as (
        select distinct l.source_id as chat_id
        from entity_links l
        where l.source_type='chat' and l.target_type='user' and l.target_id=$userId and l.tenant_id=$tenantId
      )
      select m.chat_id,
             (select c.body from entity_comments c
               where c.entity_type='chat' and c.entity_id=m.chat_id order by c.created_at desc limit 1),
             (select c.created_at::text from entity_comments c
               where c.entity_type='chat' and c.entity_id=m.chat_id order by c.created_at desc limit 1),
             coalesce(
               (select string_agg(u.display_name, '||' order by u.display_name)
                from entity_links l2 join users u on u.id = l2.target_id
                where l2.source_type='chat' and l2.source_id=m.chat_id and l2.target_type='user'
                  and l2.target_id <> $userId and l2.tenant_id=$tenantId),
               '')
      from mine m
      order by 3 desc nulls last
    """
      .query[(UUID, Option[String], Option[String], String)]
      .to[List]
      .map(_.map { case (id, body, at, names) =>
        ChatRow(id, body, at, if (names.isEmpty) Nil else names.split("\\|\\|").toList)
      })
}
