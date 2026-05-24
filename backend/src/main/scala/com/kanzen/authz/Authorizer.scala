package com.kanzen.authz

sealed abstract class Level(val rank: Int) extends Product with Serializable
object Level {
  case object Deny extends Level(0) // stored as 'none'
  case object Read extends Level(1)
  case object Write extends Level(2)
  case object Admin extends Level(3)
  def parse(s: String): Level = s.toLowerCase match {
    case "read" => Read
    case "write" => Write
    case "admin" => Admin
    case _ => Deny
  }
}

final case class Rule(resource: String, field: Option[String], level: Level)

/** F02 — resource/field-level RBAC policy engine. Default-deny; **most-specific wins** (field rule > resource rule >
  * '*' wildcard). Field-level read filtering strips attributes a principal can't read — e.g. a "maintenance" role
  * services an item (write `asset_event`) without ever seeing its price (read `asset.acquisition_cost` denied).
  */
final case class Authorizer(rules: List[Rule]) {
  def level(resource: String, field: Option[String]): Level = {
    def find(r: String, f: Option[String]): Option[Level] =
      rules.find(x => x.resource == r && x.field == f).map(_.level)
    field
      .flatMap(fl => find(resource, Some(fl)))
      .orElse(find(resource, scala.None))
      .orElse(find("*", scala.None))
      .getOrElse(Level.Deny)
  }

  def can(required: Level, resource: String, field: Option[String] = scala.None): Boolean =
    level(resource, field).rank >= required.rank

  def canRead(resource: String, field: Option[String] = scala.None): Boolean =
    can(Level.Read, resource, field)

  /** Strip attributes the principal cannot read (the field-level response filter). */
  def filterReadable[A](resource: String, fields: Map[String, A]): Map[String, A] =
    fields.filter { case (k, _) => canRead(resource, Some(k)) }
}
