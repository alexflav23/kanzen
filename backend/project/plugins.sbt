addSbtPlugin("org.scalameta" % "sbt-scalafmt" % "2.5.2")
// Fat JAR for the Docker runner (single `java -jar` artifact; see backend/Dockerfile).
addSbtPlugin("com.eed3si9n" % "sbt-assembly" % "2.3.1")
// Universal/packageXzTarball — the release artifact the NixOS hosts pull from S3 pkgs (CLAUDE.md deploy convention).
addSbtPlugin("com.github.sbt" % "sbt-native-packager" % "1.10.0")
