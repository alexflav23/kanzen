package com.kanzen.nl

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.time.LocalDate

/** F32 — READ-ONLY execution of a translated NL intent. Every query is a plain `select`
  * (no mutation path exists here); results are permission-filtered by the API. */
object NlQueryRepo {
  private def kwFilter(kw: Option[String]): Fragment =
    kw.map(k => fr"and (title ilike ${"%" + k + "%"} or maker ilike ${"%" + k + "%"} or vertical ilike ${"%" + k + "%"})")
      .getOrElse(Fragment.empty)

  def countAssets(kw: Option[String]): ConnectionIO[Long] =
    (fr"select count(*) from assets where deleted_at is null" ++ kwFilter(kw)).query[Long].unique

  def lastPurchase(kw: Option[String]): ConnectionIO[Option[(String, Option[LocalDate])]] =
    (fr"select title, acquisition_date from assets where deleted_at is null" ++ kwFilter(Some(kw.getOrElse(""))) ++
      fr"and acquisition_date is not null order by acquisition_date desc limit 1")
      .query[(String, Option[LocalDate])].option
}
