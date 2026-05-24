ThisBuild / scalaVersion := "2.13.16"
ThisBuild / organization := "com.kanzen"
ThisBuild / version := "0.1.0-SNAPSHOT"

lazy val V = new {
  val catsEffect = "3.5.4"
  val http4s = "0.23.26"
  val circe = "0.14.6"
  val tapir = "1.10.4"
  val log4cats = "2.6.0"
  val logback = "1.4.14"
  val config = "1.4.3"
  val doobie = "1.0.0-RC5"
  val flyway = "9.22.3"
  val postgres = "42.7.4"
  val tc = "0.41.4"
  val weaver = "0.8.4"
  val scalatest = "3.2.18"
  val jwt = "9.4.5"
}

lazy val root = (project in file("."))
  .settings(
    name := "kanzen-backend",
    libraryDependencies ++= Seq(
      "org.typelevel" %% "cats-effect" % V.catsEffect,
      "org.http4s" %% "http4s-ember-server" % V.http4s,
      "org.http4s" %% "http4s-dsl" % V.http4s,
      "org.http4s" %% "http4s-circe" % V.http4s,
      "io.circe" %% "circe-generic" % V.circe,
      "com.softwaremill.sttp.tapir" %% "tapir-core" % V.tapir,
      "com.softwaremill.sttp.tapir" %% "tapir-http4s-server" % V.tapir,
      "com.softwaremill.sttp.tapir" %% "tapir-json-circe" % V.tapir,
      "com.softwaremill.sttp.tapir" %% "tapir-swagger-ui-bundle" % V.tapir,
      "org.typelevel" %% "log4cats-slf4j" % V.log4cats,
      "ch.qos.logback" % "logback-classic" % V.logback % Runtime,
      "com.typesafe" % "config" % V.config,
      "org.tpolecat" %% "doobie-core" % V.doobie,
      "org.tpolecat" %% "doobie-hikari" % V.doobie,
      "org.tpolecat" %% "doobie-postgres" % V.doobie,
      "org.tpolecat" %% "doobie-postgres-circe" % V.doobie,
      "org.flywaydb" % "flyway-core" % V.flyway,
      "org.postgresql" % "postgresql" % V.postgres,
      "com.github.jwt-scala" %% "jwt-circe" % V.jwt,
      // tests: weaver (effectful/server/integration) + ScalaTest FreeSpec (pure units)
      "com.disneystreaming" %% "weaver-cats" % V.weaver % Test,
      "org.scalatest" %% "scalatest" % V.scalatest % Test,
      "com.dimafeng" %% "testcontainers-scala-postgresql" % V.tc % Test
    ),
    testFrameworks += new TestFramework("weaver.framework.CatsEffect"),
    Compile / mainClass := Some("com.kanzen.Main"),
    // Fat JAR for the Docker runner: a single, predictably-named artifact.
    assembly / mainClass := Some("com.kanzen.Main"),
    assembly / assemblyJarName := "kanzen-backend.jar",
    assembly / assemblyMergeStrategy := {
      case PathList("META-INF", "services", _*)                              => MergeStrategy.concat
      case "reference.conf" | "application.conf"                             => MergeStrategy.concat
      case PathList("META-INF", "MANIFEST.MF")                               => MergeStrategy.discard
      case x if x.endsWith("module-info.class")                              => MergeStrategy.discard
      case x if x.endsWith(".SF") || x.endsWith(".DSA") || x.endsWith(".RSA") => MergeStrategy.discard
      case _                                                                 => MergeStrategy.first
    }
  )
