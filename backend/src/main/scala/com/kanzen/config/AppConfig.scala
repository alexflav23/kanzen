package com.kanzen.config

import cats.data.ValidatedNel
import cats.syntax.all._
import com.typesafe.config.{Config, ConfigFactory}

final case class DbConfig(url: String, user: String, password: String)
final case class AppConfig(env: String, port: Int, adminPort: Int, metricsPort: Int, db: DbConfig)

/** F00 config — typesafe-config + ValidatedNel accumulation (Hypervolt athena pattern):
  * report **all** missing keys at once, then fail fast.
  */
object AppConfig {
  private type V[A] = ValidatedNel[String, A]

  def load(cfg: Config = ConfigFactory.load()): Either[List[String], AppConfig] = {
    def str(path: String): V[String] =
      if (cfg.hasPath(path)) cfg.getString(path).validNel else s"missing config: $path".invalidNel
    def int(path: String): V[Int] =
      if (cfg.hasPath(path)) cfg.getInt(path).validNel else s"missing config: $path".invalidNel

    (
      str("kanzen.env"),
      int("kanzen.port"),
      int("kanzen.admin-port"),
      int("kanzen.metrics-port"),
      str("kanzen.db.url"),
      str("kanzen.db.user"),
      str("kanzen.db.password"),
    ).mapN { (env, port, admin, metrics, url, user, pass) =>
      AppConfig(env, port, admin, metrics, DbConfig(url, user, pass))
    }.toEither.leftMap(_.toList)
  }
}
