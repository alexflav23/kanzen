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
  def label(l: Level): String = l match {
    case Deny => "none"
    case Read => "read"
    case Write => "write"
    case Admin => "admin"
  }
}

final case class Rule(resource: String, field: Option[String], level: Level)

/** F02 v2 — which records a grant covers. `Property` reuses `user_property_scopes`/`team_property_scopes`; `Team` =
  * records owned by a teammate; `Own` = records I created (`owner_id == me`). Enforced in queries (S3).
  */
sealed abstract class Scope(val name: String) extends Product with Serializable
object Scope {
  case object All extends Scope("all")
  case object Property extends Scope("property")
  case object Team extends Scope("team")
  case object Own extends Scope("own")
  def parse(s: String): Scope = s match {
    case "property" => Property
    case "team" => Team
    case "own" => Own
    case _ => All
  }
}

/** F02 v2 — an explicit per-action grant from a permission set (`allow`/deny + scope). Refines the legacy level model:
  * a matching grant decides `can(action)` (deny wins), else `can(action)` falls back to the level bridge.
  */
final case class Grant(resource: String, action: String, allow: Boolean, scope: Scope = Scope.All)

/** F02 — resource/field-level RBAC policy engine. Default-deny; **most-specific wins** (field rule > resource rule >
  * '*' wildcard). Field-level read filtering strips attributes a principal can't read — e.g. a "maintenance" role
  * services an item (write `asset_event`) without ever seeing its price (read `asset.acquisition_cost` denied).
  */
final case class Authorizer(rules: List[Rule], grants: List[Grant] = Nil) {
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

  /** F02 v2 — per-action authorization. An explicit per-action grant (from a permission set) decides it — **deny
    * wins**, else an allow permits; with no matching grant it falls back to the legacy level bridge (the role holds the
    * action's `minLevel` on the resource), so unmigrated/un-granted paths are unchanged.
    */
  def can(action: Action): Boolean = {
    val matching = grants.filter(g =>
      (g.resource == action.resource || g.resource == "*") && (g.action == action.verb || g.action == "*")
    )
    if (matching.exists(!_.allow)) false
    else if (matching.exists(_.allow)) true
    else can(action.minLevel, action.resource)
  }

  /** The scope an allowed action is constrained to (for query-time enforcement in S3): the narrowest matching
    * allow-grant's scope, else `All` (the legacy level bridge imposes no record-level scope here).
    */
  def scopeFor(action: Action): Scope =
    grants
      .filter(g =>
        g.allow && (g.resource == action.resource || g.resource == "*") && (g.action == action.verb || g.action == "*")
      )
      .map(_.scope)
      .sortBy { case Scope.Own => 0; case Scope.Team => 1; case Scope.Property => 2; case Scope.All => 3 }
      .headOption
      .getOrElse(Scope.All)

  def canRead(resource: String, field: Option[String] = scala.None): Boolean =
    can(Level.Read, resource, field)

  /** Strip attributes the principal cannot read (the field-level response filter). */
  def filterReadable[A](resource: String, fields: Map[String, A]): Map[String, A] =
    fields.filter { case (k, _) => canRead(resource, Some(k)) }
}

object Authorizer {

  /** F02 v2 — merge several roles' rules into one Authorizer. Roles are **additive**: for each `(resource, field)` the
    * effective level is the **max across roles** (each role evaluated with its own most-specific-wins). A single role
    * composes to its own effective rules (so this is non-breaking).
    *
    * Every per-key level is kept — **including `Deny`** — so an explicit field/resource-level deny that overrides a
    * broader allow within a role (e.g. `asset.market_value = none` over `asset = read`) survives the merge: query-time
    * most-specific-wins then re-applies it. (Dropping `Deny` would let the broader allow leak through.)
    */
  def compose(roleRuleSets: List[List[Rule]], grants: List[Grant]): Authorizer = {
    val keys = roleRuleSets.flatten.map(r => (r.resource, r.field)).distinct
    val merged = keys.map { case (res, fld) =>
      val lvl = roleRuleSets.map(rs => Authorizer(rs).level(res, fld)).maxByOption(_.rank).getOrElse(Level.Deny)
      Rule(res, fld, lvl)
    }
    Authorizer(merged, grants)
  }
}
