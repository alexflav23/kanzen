package com.kanzen.backup

import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

/** F30 unit test (FreeSpec): manifest, checksum, restore compatibility. */
class BackupServiceSpec extends AnyFreeSpec with Matchers {
  "BackupService" - {
    "produces a deterministic checksum" in {
      BackupService.checksum("a=1,b=2") shouldBe BackupService.checksum("a=1,b=2")
      BackupService.checksum("a=1") should not be BackupService.checksum("a=2")
    }
    "builds a manifest with version + counts + checksum" in {
      val m = BackupService.manifest(Map("assets" -> 1240L, "documents" -> 842L))
      m.hcursor.get[String]("export_version").toOption shouldBe Some("1.0.0")
      m.hcursor.downField("object_counts").get[Long]("assets").toOption shouldBe Some(1240L)
      m.hcursor.get[String]("counts_checksum").toOption.exists(_.nonEmpty) shouldBe true
    }
    "restore is compatible only into same-or-newer schema" in {
      BackupService.restoreCompatible("2026-05", "2026-05") shouldBe true
      BackupService.restoreCompatible("2026-04", "2026-05") shouldBe true
      BackupService.restoreCompatible("2026-05", "2026-04") shouldBe false
    }
  }
}
