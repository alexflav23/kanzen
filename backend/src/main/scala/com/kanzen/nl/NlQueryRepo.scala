package com.kanzen.nl

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.time.LocalDate

/** F32 — READ-ONLY execution of a translated NL intent. Every query is a plain `select` (no mutation path exists here);
  * results are permission-filtered by the API.
  */
object NlQueryRepo {
  private def kwFilter(kw: Option[String]): Fragment =
    kw.map(k =>
      fr"and (title ilike ${"%" + k + "%"} or maker ilike ${"%" + k + "%"} or vertical ilike ${"%" + k + "%"})"
    ).getOrElse(Fragment.empty)

  def countAssets(kw: Option[String]): ConnectionIO[Long] =
    (fr"select count(*) from assets where deleted_at is null" ++ kwFilter(kw)).query[Long].unique

  def lastPurchase(kw: Option[String]): ConnectionIO[Option[(String, Option[LocalDate])]] =
    (fr"select title, acquisition_date from assets where deleted_at is null" ++ kwFilter(Some(kw.getOrElse(""))) ++
      fr"and acquisition_date is not null order by acquisition_date desc limit 1")
      .query[(String, Option[LocalDate])]
      .option

  /** Where is the best-matching asset? title, property, location. */
  def whereIs(kw: String): ConnectionIO[Option[(String, Option[String], Option[String])]] =
    sql"""select a.title, p.name, l.name
          from assets a
          left join locations l on l.id = a.location_id
          left join properties p on p.id = l.property_id
          where a.deleted_at is null and (a.title ilike ${"%" + kw + "%"} or a.maker ilike ${"%" + kw + "%"})
          order by a.created_at desc limit 1""".query[(String, Option[String], Option[String])].option

  /** Acquisition value of assets in/matching one category — "how much are my watches worth": (sumMinor, count). */
  def categoryValue(kw: String): ConnectionIO[(Long, Long)] =
    sql"""select coalesce(sum(a.acquisition_cost_minor), 0), count(*)
          from assets a left join categories c on c.id = a.category_id
          where a.deleted_at is null and a.acquisition_cost_minor is not null
            and (c.name ilike ${"%" + kw + "%"} or a.title ilike ${"%" + kw + "%"} or a.maker ilike ${"%" + kw + "%"})"""
      .query[(Long, Long)]
      .unique

  /** Acquisition value by category (top 5) — the basis for "what's my registry worth". */
  def valueByCategory: ConnectionIO[List[(String, Long)]] =
    sql"""select c.name, coalesce(sum(a.acquisition_cost_minor), 0)
          from assets a join categories c on c.id = a.category_id
          where a.deleted_at is null and a.acquisition_cost_minor is not null
          group by c.name having coalesce(sum(a.acquisition_cost_minor), 0) > 0
          order by 2 desc limit 5""".query[(String, Long)].to[List]

  /** Approved-expense spend (GBP, native — no FX) over the last N months, optionally for a category: (sumMinor, count).
    */
  def spendTotal(category: Option[String], monthsBack: Int): ConnectionIO[(Long, Long)] = {
    val catCond = category
      .map(c =>
        fr"and exists (select 1 from categories c where c.id = e.category_id and c.name ilike ${"%" + c + "%"})"
      )
      .getOrElse(Fragment.empty)
    (fr"""select coalesce(sum(e.amount_minor), 0), count(*) from expenses e
          where e.deleted_at is null and e.status = 'approved' and e.currency = 'GBP'
            and coalesce(e.incurred_on, e.created_at::date) >= current_date - make_interval(months => $monthsBack)""" ++ catCond)
      .query[(Long, Long)]
      .unique
  }

  /** Tasks + maintenance plans due within N days: (tasksDue, maintenanceDue). */
  def dueSoonCount(daysAhead: Int): ConnectionIO[(Long, Long)] =
    sql"""select
            (select count(*) from tasks where due_on is not null and due_on between current_date and current_date + $daysAhead and status <> 'done'),
            (select count(*) from maintenance_plans where next_due is not null and next_due between current_date and current_date + $daysAhead and active)
       """.query[(Long, Long)].unique

  // NL-2b — "car"/"auto" colloquially means the vehicle vertical; everything else matches the keyword as-is.
  private def carSyn(kw: String): String =
    if (Set("car", "cars", "auto", "automobile", "motor").contains(kw.trim.toLowerCase)) "vehicle" else kw.trim

  /** Next service for the asset best matching the keyword: (title, nextDue, vendor). NL-2b ServiceDue. */
  def serviceDueForAsset(kw: String): ConnectionIO[Option[(String, Option[LocalDate], Option[String])]] = {
    val k = "%" + carSyn(kw) + "%"
    sql"""select a.title, mp.next_due, mp.vendor
          from maintenance_plans mp join assets a on a.id = mp.asset_id
          where mp.active and a.deleted_at is null
            and (a.title ilike $k or a.maker ilike $k or a.vertical ilike $k)
          order by mp.next_due asc nulls last limit 1"""
      .query[(String, Option[LocalDate], Option[String])]
      .option
  }

  /** Insurance cover on the asset best matching the keyword: (title, insured, insuredValueMinor, insurer, renewalOn).
    * Note: this is the *sum insured* (registry-native), not a premium — Kanzen does not store premiums. NL-2b.
    */
  def insuranceForAsset(
      kw: String
  ): ConnectionIO[Option[(String, Boolean, Option[Long], Option[String], Option[LocalDate])]] = {
    val k = "%" + carSyn(kw) + "%"
    sql"""select a.title, ins.insured, ins.insured_value_minor, ins.insurer, ins.renewal_on
          from asset_insurance ins join assets a on a.id = ins.asset_id
          where a.deleted_at is null and (a.title ilike $k or a.maker ilike $k or a.vertical ilike $k)
          order by ins.created_at desc limit 1"""
      .query[(String, Boolean, Option[Long], Option[String], Option[LocalDate])]
      .option
  }

  /** Most recent (or, failing that, soonest upcoming) calendar activity whose title matches the stem: (title, date,
    * isPast). The keyword is already stemmed so a role-noun matches its activity title. NL-2b LastActivity.
    */
  def lastActivityForPerson(stem: String): ConnectionIO[Option[(String, LocalDate, Boolean)]] = {
    val k = "%" + stem + "%"
    sql"""select title, start_on, (start_on <= current_date) as is_past
          from calendar_event_refs
          where start_on is not null and title ilike $k
          order by (start_on <= current_date) desc,
                   case when start_on <= current_date then current_date - start_on else start_on - current_date end asc
          limit 1"""
      .query[(String, LocalDate, Boolean)]
      .option
  }
}
