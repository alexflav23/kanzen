package com.kanzen.wealth

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.time.LocalDate
import java.util.UUID

final case class Entity(
    id: UUID,
    name: String,
    kind: String,
    jurisdiction: Option[String],
    baseCurrency: String,
    parentEntityId: Option[UUID]
)
final case class WealthAccount(
    id: UUID,
    code: String,
    name: String,
    accountType: String,
    currency: String,
    balanceMinor: Long,
    subkind: Option[String]
)

/** Wave G (F42/F39/F41/F43) — entity-scoped chart of accounts, statements and net worth, all derived from the F18
  * general ledger (`gl_splits` are the ledger). Principal-private.
  */
object WealthRepo {
  // gl_splits signed convention: +debit / −credit. Assets/expenses are debit-normal (balance ≥ 0
  // when positive); liabilities/equity/income are credit-normal (balance ≤ 0).
  def createEntity(
      ownerId: UUID,
      name: String,
      kind: String,
      jurisdiction: Option[String],
      baseCurrency: String,
      parent: Option[UUID]
  ): ConnectionIO[UUID] =
    sql"""insert into wealth_entities (owner_id, name, kind, jurisdiction, base_currency, parent_entity_id)
          values ($ownerId, $name, $kind, $jurisdiction, $baseCurrency, $parent) returning id""".query[UUID].unique

  def entities(ownerId: UUID): ConnectionIO[List[Entity]] =
    sql"""select id, name, kind, jurisdiction, base_currency, parent_entity_id from wealth_entities
          where owner_id = $ownerId order by name""".query[Entity].to[List]

  /** F42 — edit an entity's particulars + ownership parent (base currency is immutable; it anchors the entity's books).
    * Owner-scoped so a Principal can only touch their own entities.
    */
  def updateEntity(
      id: UUID,
      ownerId: UUID,
      name: String,
      kind: String,
      jurisdiction: Option[String],
      parent: Option[UUID]
  ): ConnectionIO[Int] =
    sql"""update wealth_entities set name = $name, kind = $kind, jurisdiction = $jurisdiction,
          parent_entity_id = $parent where id = $id and owner_id = $ownerId""".update.run

  def entityExists(id: UUID): ConnectionIO[Boolean] =
    sql"select exists(select 1 from wealth_entities where id = $id)".query[Boolean].unique

  def entityOwnedBy(id: UUID, ownerId: UUID): ConnectionIO[Boolean] =
    sql"select exists(select 1 from wealth_entities where id = $id and owner_id = $ownerId)".query[Boolean].unique

  def createAccount(
      ownerId: UUID,
      entityId: UUID,
      code: String,
      name: String,
      accountType: String,
      currency: String,
      subkind: Option[String]
  ): ConnectionIO[UUID] =
    sql"""insert into gl_accounts (owner_id, entity_id, code, name, type, currency, subkind)
          values ($ownerId, $entityId, $code, $name, $accountType, $currency, $subkind) returning id"""
      .query[UUID]
      .unique

  private def entityCond(entity: Option[UUID]): Fragment =
    entity.map(e => fr"and a.entity_id = $e").getOrElse(Fragment.empty)

  def accounts(ownerId: UUID, entity: Option[UUID]): ConnectionIO[List[WealthAccount]] =
    (fr"""select a.id, a.code, a.name, a.type, a.currency,
            coalesce((select sum(s.amount_minor) from gl_splits s where s.account_id = a.id), 0), a.subkind
          from gl_accounts a where a.owner_id = $ownerId""" ++ entityCond(entity) ++ fr"order by a.code")
      .query[WealthAccount]
      .to[List]

  /** Signed balance per account type (the basis for balance sheet + net worth). */
  def balanceByType(ownerId: UUID, entity: Option[UUID]): ConnectionIO[Map[String, Long]] =
    (fr"""select a.type, coalesce(sum(s.amount_minor), 0)
          from gl_accounts a left join gl_splits s on s.account_id = a.id
          where a.owner_id = $ownerId""" ++ entityCond(entity) ++ fr"group by a.type")
      .query[(String, Long)]
      .to[List]
      .map(_.toMap)

  /** Income/expense totals over a period (income statement). */
  def flowByType(ownerId: UUID, entity: Option[UUID], from: LocalDate, to: LocalDate): ConnectionIO[Map[String, Long]] =
    (fr"""select a.type, coalesce(sum(s.amount_minor), 0)
          from gl_accounts a join gl_splits s on s.account_id = a.id
          join gl_transactions t on t.id = s.transaction_id
          where a.owner_id = $ownerId and a.type in ('income','expense')""" ++ entityCond(entity) ++
      fr"and t.occurred_on between $from and $to group by a.type")
      .query[(String, Long)]
      .to[List]
      .map(_.toMap)

  def saveSnapshot(
      ownerId: UUID,
      entity: Option[UUID],
      assets: Long,
      liabilities: Long,
      net: Long,
      currency: String
  ): ConnectionIO[UUID] =
    sql"""insert into net_worth_snapshots (owner_id, entity_id, assets_minor, liabilities_minor, net_minor, currency)
          values ($ownerId, $entity, $assets, $liabilities, $net, $currency) returning id""".query[UUID].unique
}
