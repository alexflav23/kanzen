package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, DevAuth}
import com.kanzen.s3.ObjectStore
import doobie.util.transactor.Transactor
import org.http4s.HttpRoutes
import sttp.tapir.server.http4s.Http4sServerInterpreter
import sttp.tapir.swagger.bundle.SwaggerInterpreter

/** Phase 0/1 — assembles the `/api` surface: public health, the secured endpoints,
  * Swagger/OpenAPI at `/docs`, and (local only) the dev token mint. Every later
  * feature adds its routes here. */
object Api {
  def routes(auth: Auth, xa: Transactor[IO], store: ObjectStore, dev: Option[DevAuth]): HttpRoutes[IO] = {
    val interp   = Http4sServerInterpreter[IO]()
    val devEps   = dev.map(Dev.serverEndpoint).toList
    val secured  = interp.toRoutes(
      List(Me.serverEndpoint(auth)) ++ Properties.serverEndpoints(auth, xa)
        ++ Locations.serverEndpoints(auth, xa) ++ Defects.serverEndpoints(auth, xa)
        ++ Assets.serverEndpoints(auth, xa) ++ Valuations.serverEndpoints(auth, xa)
        ++ AssetEvents.serverEndpoints(auth, xa) ++ Provenance.serverEndpoints(auth, xa)
        ++ Templates.serverEndpoints(auth, xa) ++ Documents.serverEndpoints(auth, xa, store)
        ++ People.serverEndpoints(auth, xa) ++ Vendors.serverEndpoints(auth, xa)
        ++ Bank.serverEndpoints(auth, xa) ++ Receipts.serverEndpoints(auth, xa)
        ++ Reconciliation.serverEndpoints(auth, xa) ++ Ledger.serverEndpoints(auth, xa)
        ++ Expenses.serverEndpoints(auth, xa) ++ Tax.serverEndpoints(auth, xa)
        ++ Finance.serverEndpoints(auth, xa) ++ Dashboard.serverEndpoints(auth, xa)
        ++ Tasks.serverEndpoints(auth, xa) ++ Lists.serverEndpoints(auth, xa)
        ++ Maintenance.serverEndpoints(auth, xa) ++ Products.serverEndpoints(auth, xa)
        ++ Notifications.serverEndpoints(auth, xa) ++ devEps)
    val swagger  = List(Health.endpoint, Me.endpoint) ++ Properties.endpoints ++
      Locations.endpoints ++ Defects.endpoints ++ Assets.endpoints ++ Valuations.endpoints ++
      AssetEvents.endpoints ++ Provenance.endpoints ++ Templates.endpoints ++ Documents.endpoints ++
      People.endpoints ++ Vendors.endpoints ++ Bank.endpoints ++ Receipts.endpoints ++ Reconciliation.endpoints ++
      Ledger.endpoints ++ Expenses.endpoints ++ Tax.endpoints ++ Finance.endpoints ++ Dashboard.endpoints ++ Tasks.endpoints ++ Lists.endpoints ++ Maintenance.endpoints ++ Products.endpoints ++ Notifications.endpoints ++ dev.map(_ => Dev.endpoint).toList
    val docs     = interp.toRoutes(SwaggerInterpreter().fromEndpoints[IO](swagger, "Kanzen API", "0.1.0"))
    Health.routes <+> secured <+> docs
  }
}
