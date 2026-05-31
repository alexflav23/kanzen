package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, DevAuth}
import com.kanzen.realtime.{Realtime, RealtimeHub}
import com.kanzen.s3.ObjectStore
import doobie.util.transactor.Transactor
import org.http4s.HttpRoutes
import org.http4s.server.websocket.WebSocketBuilder2
import sttp.tapir.server.http4s.Http4sServerInterpreter
import sttp.tapir.swagger.bundle.SwaggerInterpreter

/** Phase 0/1 — assembles the `/api` surface: public health, the secured endpoints, Swagger/OpenAPI at `/docs`, and
  * (local only) the dev token mint. Every later feature adds its routes here.
  */
object Api {
  def routes(
      auth: Auth,
      xa: Transactor[IO],
      store: ObjectStore,
      blobSecret: String,
      dev: Option[DevAuth],
      hub: RealtimeHub,
      wsb: WebSocketBuilder2[IO]
  ): HttpRoutes[IO] = {
    val interp = Http4sServerInterpreter[IO]()
    val devEps = dev.map(Dev.serverEndpoint).toList
    val public = interp.toRoutes(
      Blobs.serverEndpoints(store, blobSecret) ++ Tenants.publicServerEndpoints(xa)
        ++ Calendar.publicServerEndpoints(xa, blobSecret)
    )
    val secured = interp.toRoutes(
      List(Me.serverEndpoint(auth, xa), Me.colourServerEndpoint(auth, xa)) ++ Properties.serverEndpoints(auth, xa)
        ++ Locations.serverEndpoints(auth, xa) ++ Defects.serverEndpoints(auth, xa)
        ++ Assets.serverEndpoints(auth, xa, store) ++ Valuations.serverEndpoints(auth, xa)
        ++ AssetEvents.serverEndpoints(auth, xa) ++ Provenance.serverEndpoints(auth, xa)
        ++ Templates.serverEndpoints(auth, xa) ++ Documents.serverEndpoints(auth, xa, store)
        ++ People.serverEndpoints(auth, xa) ++ Vendors.serverEndpoints(auth, xa)
        ++ Bank.serverEndpoints(auth, xa) ++ Receipts.serverEndpoints(auth, xa)
        ++ Reconciliation.serverEndpoints(auth, xa) ++ Ledger.serverEndpoints(auth, xa)
        ++ Expenses.serverEndpoints(auth, xa) ++ Tax.serverEndpoints(auth, xa)
        ++ Finance.serverEndpoints(auth, xa) ++ Dashboard.serverEndpoints(auth, xa)
        ++ Tasks.serverEndpoints(auth, xa) ++ Lists.serverEndpoints(auth, xa)
        ++ Maintenance.serverEndpoints(auth, xa) ++ Products.serverEndpoints(auth, xa)
        ++ Notifications.serverEndpoints(auth, xa) ++ Extensibility.serverEndpoints(auth, xa)
        ++ DataQuality.serverEndpoints(auth, xa) ++ Fx.serverEndpoints(auth, xa)
        ++ Restructure.serverEndpoints(auth, xa) ++ Calendar.serverEndpoints(auth, xa, blobSecret)
        ++ Agent.serverEndpoints(auth, xa) ++ Inbox.serverEndpoints(auth, xa)
        ++ Collab.serverEndpoints(auth, xa) ++ Search.serverEndpoints(
          auth,
          xa
        ) ++ NlQuery.serverEndpoints(auth, xa)
        ++ Backup.serverEndpoints(auth, xa)
        ++ Wealth.serverEndpoints(auth, xa) ++ Investments.serverEndpoints(auth, xa)
        ++ Insights.serverEndpoints(auth, xa) ++ Impersonate.serverEndpoints(auth, xa, dev)
        ++ Roles.serverEndpoints(auth, xa) ++ RbacAdmin.serverEndpoints(auth, xa) ++ Audit.serverEndpoints(auth, xa)
        ++ Collections.serverEndpoints(auth, xa)
        ++ Groups.serverEndpoints(auth, xa) ++ Brands.serverEndpoints(auth, xa)
        ++ Tenants.securedServerEndpoints(auth, xa) ++ Chat.serverEndpoints(auth, xa)
        ++ Workspace.serverEndpoints(auth, xa, new com.kanzen.workspace.StubWorkspaceAuth(xa)) ++ devEps
    )
    val swagger = List(
      Health.endpoint,
      Me.endpoint,
      Me.colourEndpoint
    ) ++ Tenants.endpoints ++ Chat.endpoints ++ Blobs.endpoints ++ Properties.endpoints ++
      Locations.endpoints ++ Defects.endpoints ++ Assets.endpoints ++ Valuations.endpoints ++
      AssetEvents.endpoints ++ Provenance.endpoints ++ Templates.endpoints ++ Documents.endpoints ++
      People.endpoints ++ Vendors.endpoints ++ Bank.endpoints ++ Receipts.endpoints ++ Reconciliation.endpoints ++
      Ledger.endpoints ++ Expenses.endpoints ++ Tax.endpoints ++ Finance.endpoints ++ Dashboard.endpoints ++ Tasks.endpoints ++ Lists.endpoints ++ Maintenance.endpoints ++ Products.endpoints ++ Notifications.endpoints ++ Extensibility.endpoints ++ DataQuality.endpoints ++ Fx.endpoints ++ Restructure.endpoints ++ Calendar.endpoints ++ Agent.endpoints ++ Inbox.endpoints ++ Collab.endpoints ++ Search.endpoints ++ NlQuery.endpoints ++ Backup.endpoints ++ Wealth.endpoints ++ Investments.endpoints ++ Insights.endpoints ++ Impersonate.endpoints ++ Roles.endpoints ++ RbacAdmin.endpoints ++ Audit.endpoints ++ Collections.endpoints ++ Groups.endpoints ++ Brands.endpoints ++ dev
        .map(_ => Dev.endpoint)
        .toList
    val docs = interp.toRoutes(SwaggerInterpreter().fromEndpoints[IO](swagger, "Kanzen API", "0.1.0"))
    // F48 — the realtime websocket (GET /api/ws); a raw http4s route (not Tapir) so it can own the WS upgrade.
    val ws = Realtime.routes(auth, xa, hub, wsb)
    Health.routes <+> public <+> secured <+> ws <+> docs
  }
}
