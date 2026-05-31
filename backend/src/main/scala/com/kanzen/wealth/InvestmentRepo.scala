package com.kanzen.wealth

import cats.syntax.all._
import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.time.LocalDate
import java.util.UUID

final case class Security(id: UUID, symbol: String, name: String, currency: String, assetClass: String)
final case class Holding(
    securityId: UUID,
    symbol: String,
    quantity: Double,
    costBasisMinor: Long,
    marketValueMinor: Long,
    unrealizedGainMinor: Long
)
final case class OpenLot(id: UUID, quantity: Double, costBasisMinor: Long, acquiredOn: LocalDate)

/** F40 — cost-basis lot accounting + unrealised/realised gains (FIFO). Records investments; never executes trades.
  * Quantities are fractional; money is integer minor units.
  */
object InvestmentService {

  /** Allocate `sellQty` across FIFO-ordered open lots → (lotId, qtyClosed, costOfClosed) per touched lot. Cost of the
    * closed portion is the lot's cost basis pro-rated by the fraction sold.
    */
  def fifoClose(lots: List[OpenLot], sellQty: Double): List[(UUID, Double, Long)] = {
    def go(remaining: Double, ls: List[OpenLot], acc: List[(UUID, Double, Long)]): List[(UUID, Double, Long)] =
      if (remaining <= 1e-9 || ls.isEmpty) acc.reverse
      else {
        val lot = ls.head
        val take = math.min(remaining, lot.quantity)
        val cost = math.round(lot.costBasisMinor * (take / lot.quantity))
        go(remaining - take, ls.tail, (lot.id, take, cost) :: acc)
      }
    go(sellQty, lots.sortBy(_.acquiredOn.toEpochDay), Nil)
  }
}

object InvestmentRepo {
  def createSecurity(symbol: String, name: String, currency: String, assetClass: String): ConnectionIO[UUID] =
    sql"insert into securities (symbol, name, currency, asset_class) values ($symbol, $name, $currency, $assetClass) returning id"
      .query[UUID]
      .unique

  def securities: ConnectionIO[List[Security]] =
    sql"select id, symbol, name, currency, asset_class from securities order by symbol".query[Security].to[List]

  def securityExists(id: UUID): ConnectionIO[Boolean] =
    sql"select exists(select 1 from securities where id = $id)".query[Boolean].unique

  def setPrice(securityId: UUID, priceMinor: Long, asOf: LocalDate): ConnectionIO[Int] =
    sql"""insert into security_prices (security_id, price_minor, as_of, source) values ($securityId, $priceMinor, $asOf, 'manual')
          on conflict (security_id, as_of) do update set price_minor = excluded.price_minor""".update.run

  def latestPrice(securityId: UUID): ConnectionIO[Option[Long]] =
    sql"select price_minor from security_prices where security_id = $securityId order by as_of desc limit 1"
      .query[Long]
      .option

  def buy(
      ownerId: UUID,
      entityId: UUID,
      securityId: UUID,
      quantity: Double,
      costBasisMinor: Long,
      acquiredOn: LocalDate,
      tenantId: UUID = com.kanzen.tenant.Tenant.DefaultId
  ): ConnectionIO[UUID] =
    sql"""insert into investment_lots (tenant_id, owner_id, entity_id, security_id, quantity, cost_basis_minor, acquired_on)
          values ($tenantId, $ownerId, $entityId, $securityId, $quantity, $costBasisMinor, $acquiredOn) returning id"""
      .query[UUID]
      .unique

  def openLots(entityId: UUID, securityId: UUID): ConnectionIO[List[OpenLot]] =
    sql"""select id, quantity, cost_basis_minor, acquired_on from investment_lots
          where entity_id = $entityId and security_id = $securityId and status = 'open' order by acquired_on"""
      .query[OpenLot]
      .to[List]

  def closeLot(
      lotId: UUID,
      qtyClosed: Double,
      proceedsMinor: Long,
      realizedGainMinor: Long,
      on: LocalDate
  ): ConnectionIO[Int] =
    sql"""update investment_lots set status = 'closed', closed_on = $on, quantity = quantity - $qtyClosed,
            proceeds_minor = coalesce(proceeds_minor,0) + $proceedsMinor,
            realized_gain_minor = coalesce(realized_gain_minor,0) + $realizedGainMinor
          where id = $lotId""".update.run

  /** Open holdings per security for an entity, valued at latest price (unrealised gain). */
  def holdings(ownerId: UUID, entityId: Option[UUID]): ConnectionIO[List[Holding]] = {
    val ent = entityId.map(e => fr"and l.entity_id = $e").getOrElse(Fragment.empty)
    (fr"""select l.security_id, sec.symbol, sum(l.quantity)::double precision, sum(l.cost_basis_minor)::bigint,
            coalesce(round(sum(l.quantity) * (select price_minor from security_prices p where p.security_id = l.security_id order by as_of desc limit 1)), 0)::bigint
          from investment_lots l join securities sec on sec.id = l.security_id
          where l.status = 'open' and l.owner_id = $ownerId""" ++ ent ++
      fr"group by l.security_id, sec.symbol")
      .query[(UUID, String, Double, Long, Long)]
      .to[List]
      .map(_.map { case (sid, sym, qty, cost, mkt) => Holding(sid, sym, qty, cost, mkt, mkt - cost) })
  }

  /** Total market value of open holdings (feeds net worth). */
  def holdingsValue(ownerId: UUID, entityId: Option[UUID]): ConnectionIO[Long] =
    holdings(ownerId, entityId).map(_.map(_.marketValueMinor).sum)
}
