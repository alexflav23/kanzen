package com.kanzen.authz

import cats.effect.IO
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

/** F02 integration test: rules persist + load from the DB and enforce correctly. */
object AuthzIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("seeded manager rules: deny valuation reads, allow asset writes") { xa =>
    PermissionRepo.rulesFor("manager").transact(xa).map { rules =>
      val az = Authorizer(rules)
      expect(rules.nonEmpty) and
        expect(az.can(Level.Write, "asset")) and
        expect(!az.canRead("asset", Some("market_value"))) and
        expect(az.canRead("asset", Some("title")))
    }
  }

  test("seeded maintenance rules: service events yes, price no") { xa =>
    PermissionRepo.rulesFor("maintenance").transact(xa).map { rules =>
      val az = Authorizer(rules)
      expect(az.can(Level.Write, "asset_event")) and
        expect(!az.canRead("asset", Some("acquisition_cost")))
    }
  }
}
