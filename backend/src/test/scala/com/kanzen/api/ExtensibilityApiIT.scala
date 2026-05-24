package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Extensibility._
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import com.kanzen.ext.{Attributes, CustomFieldRepo}
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import weaver.IOSuite

import java.util.UUID

/** F33 — extensibility: deep taxonomies (AC1), custom fields on vendors (AC2), polymorphic
  * tags (AC3), and sensitive-field stripping (AC5). */
object ExtensibilityApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val toby   = Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "toby@kanzen.local", "principal")
  private val lorna  = Principal(UUID.fromString("10000000-0000-0000-0000-000000000002"), "l", "lorna@kanzen.local", "manager")
  private val marcia = Principal(UUID.fromString("10000000-0000-0000-0000-000000000003"), "m", "marcia@kanzen.local", "staff")

  test("AC1 — a new taxonomy is created with four-level nesting and an entity is categorised, no migration") { xa =>
    val item = UUID.randomUUID()
    for {
      tax  <- createTaxonomy(xa, toby, CreateTaxonomyReq("Cleaning products", "list_item")).map(_.toOption.get)
      n1   <- addNode(xa, toby, tax.id, NodeReq(None, "Kitchen")).map(_.toOption.get)
      n2   <- addNode(xa, toby, tax.id, NodeReq(Some(n1.id), "Degreasers")).map(_.toOption.get)
      n3   <- addNode(xa, toby, tax.id, NodeReq(Some(n2.id), "Sprays")).map(_.toOption.get)
      _    <- linkTaxonomy(xa, toby, TaxonomyLinkReq(n3.id, "list_item", item)).map(_.toOption.get)
      tree <- nodes(xa, toby, tax.id).map(_.toOption.get)
    } yield expect(tree.size == 3) and
      expect(tree.find(_.name == "Sprays").exists(_.parentId.contains(n2.id))) and  // four levels deep
      expect(tree.find(_.name == "Degreasers").exists(_.parentId.contains(n1.id)))
  }

  test("AC2 — a url custom field is defined on vendors and listed for entity_type vendor") { xa =>
    for {
      created <- createField(xa, toby, CreateFieldReq("vendor", "support_phone", "Support phone", "text", None, None)).map(_.toOption.get)
      list    <- customFields(xa, lorna, "vendor").map(_.toOption.get) // Manager may read field defs
    } yield expect(created.entityType == "vendor") and
      expect(list.exists(_.key == "support_phone")) and
      expect(list.exists(_.key == "warranty_portal_url")) // seeded
  }

  test("AC3 — a polymorphic tag is applied to three entity types and all are found") { xa =>
    val (vendor, listItem, doc) = (UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID())
    for {
      tag <- createTag(xa, lorna, CreateTagReq("Priority")).map(_.toOption.get)
      _   <- tagEntity(xa, lorna, TagLinkReq(tag.id, "vendor", vendor)).map(_.toOption.get)
      _   <- tagEntity(xa, lorna, TagLinkReq(tag.id, "list_item", listItem)).map(_.toOption.get)
      _   <- tagEntity(xa, lorna, TagLinkReq(tag.id, "document", doc)).map(_.toOption.get)
      ents <- entitiesWithTag(xa, lorna, tag.id).map(_.toOption.get)
    } yield expect(ents.map(_.entityType).toSet == Set("vendor", "list_item", "document")) and
      expect(ents.exists(_.entityId == vendor)) and expect(ents.exists(_.entityId == doc))
  }

  test("AC5 — sensitive custom-field keys are stripped from attributes for non-Principal readers") { xa =>
    // 'insurance_broker_ref' is seeded as sensitive on assets.
    val attrs = Json.obj("model" -> Json.fromString("Daytona"), "insurance_broker_ref" -> Json.fromString("BRK-9"))
    CustomFieldRepo.sensitiveKeys("asset").transact(xa).map { sens =>
      val stripped = Attributes.strip(attrs, sens)
      expect(sens.contains("insurance_broker_ref")) and
        expect(stripped.asObject.exists(_.contains("model"))) and
        expect(stripped.asObject.exists(o => !o.contains("insurance_broker_ref"))) // hidden for Manager/Staff
    }
  }

  test("Staff cannot define a custom field or create a taxonomy (403)") { xa =>
    for {
      field <- createField(xa, marcia, CreateFieldReq("vendor", "x", "X", "text", None, None))
      tax   <- createTaxonomy(xa, marcia, CreateTaxonomyReq("Nope", "any"))
    } yield expect(field.left.exists(_._1.code == 403)) and expect(tax.left.exists(_._1.code == 403))
  }
}
