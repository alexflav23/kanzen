package com.kanzen.asset

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.postgres.circe.jsonb.implicits._
import io.circe.Json

import java.util.UUID

/** F22 — category template persistence (latest version per vertical). */
object TemplateRepo {
  def create(verticalKey: String, name: Option[String], schema: Json): ConnectionIO[UUID] =
    sql"insert into category_templates (vertical_key, name, schema) values ($verticalKey, $name, $schema) returning id"
      .query[UUID].unique

  def schemaFor(verticalKey: String): ConnectionIO[Option[Json]] =
    sql"select schema from category_templates where vertical_key = $verticalKey order by version desc limit 1"
      .query[Json].option
}
