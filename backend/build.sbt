ThisBuild / scalaVersion := "2.13.16"
ThisBuild / organization := "com.kanzen"
ThisBuild / version := "0.1.0-SNAPSHOT"

lazy val V = new {
  val catsEffect = "3.5.4"
  val http4s     = "0.23.26"
  val circe      = "0.14.6"
  val tapir      = "1.10.4"
  val log4cats   = "2.6.0"
  val logback    = "1.4.14"
  val config     = "1.4.3"
  val weaver     = "0.8.4"
  val scalatest  = "3.2.18"
}

lazy val root = (project in file("."))
  .settings(
    name := "kanzen-backend",
    libraryDependencies ++= Seq(
      "org.typelevel"                 %% "cats-effect"               % V.catsEffect,
      "org.http4s"                    %% "http4s-ember-server"       % V.http4s,
      "org.http4s"                    %% "http4s-dsl"                % V.http4s,
      "org.http4s"                    %% "http4s-circe"              % V.http4s,
      "io.circe"                      %% "circe-generic"             % V.circe,
      "com.softwaremill.sttp.tapir"   %% "tapir-core"                % V.tapir,
      "com.softwaremill.sttp.tapir"   %% "tapir-http4s-server"       % V.tapir,
      "com.softwaremill.sttp.tapir"   %% "tapir-json-circe"          % V.tapir,
      "com.softwaremill.sttp.tapir"   %% "tapir-swagger-ui-bundle"   % V.tapir,
      "org.typelevel"                 %% "log4cats-slf4j"            % V.log4cats,
      "ch.qos.logback"                %  "logback-classic"           % V.logback % Runtime,
      "com.typesafe"                  %  "config"                    % V.config,
      // tests: weaver (effectful/server) + ScalaTest FreeSpec (pure units)
      "com.disneystreaming"           %% "weaver-cats"               % V.weaver    % Test,
      "org.scalatest"                 %% "scalatest"                 % V.scalatest % Test
    ),
    testFrameworks += new TestFramework("weaver.framework.CatsEffect"),
    Compile / mainClass := Some("com.kanzen.Main")
  )
