package com.kanzen.asset

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.postgres.circe.jsonb.implicits._
import io.circe.Json

import java.util.UUID

/** F24 — cost allocation for split/convert (sums exactly to the original; remainder spread). */
object RestructureService {
  def splitCost(totalMinor: Long, n: Int): List[Long] = {
    require(n > 0, "n must be > 0")
    val base = totalMinor / n
    val rem = (totalMinor % n).toInt
    (0 until n).map(i => base + (if (i < rem) 1L else 0L)).toList
  }
}

/** F24 — auditable restructure operations (no silent destructive mutation). */
object RestructureRepo {
  def record(kind: String, inputs: Json, outputs: Json): ConnectionIO[UUID] =
    sql"insert into restructure_operations (kind, inputs, outputs) values ($kind, $inputs, $outputs) returning id".query[UUID].unique

  def get(id: UUID): ConnectionIO[Option[(String, Json, Json)]] =
    sql"select kind, inputs, outputs from restructure_operations where id = $id".query[(String, Json, Json)].option
}
