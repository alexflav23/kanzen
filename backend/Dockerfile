# Kanzen backend — multi-stage: sbt-assembly fat JAR → slim JRE runtime.
# Built + run by the root docker-compose.yml ("backend" service).

# --- build stage: compile + assemble the fat JAR ---------------------------
FROM sbtscala/scala-sbt:eclipse-temurin-jammy-17.0.8.1_1_1.9.7_2.13.12 AS builder
WORKDIR /app

# Dependency layer first (cached unless the build definition changes).
COPY build.sbt .
COPY project/ project/
RUN sbt update

# Then sources → assemble.
COPY src/ src/
RUN sbt assembly

# --- runtime stage: just a JRE + the JAR -----------------------------------
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/scala-2.13/kanzen-backend.jar app.jar

RUN useradd -m -u 1000 kanzen
USER kanzen

# api · admin/health · metrics (local Docker uses the +20000 host ports via docker-compose env)
EXPOSE 28080 29990 29464
CMD ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
