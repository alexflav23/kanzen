package com.kanzen.product

import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

/** F35 unit test (FreeSpec): reorder trigger. */
class ProductServiceSpec extends AnyFreeSpec with Matchers {
  "ProductService.needsReorder" - {
    "out -> reorder" in { ProductService.needsReorder("out") shouldBe true }
    "low -> reorder" in { ProductService.needsReorder("low") shouldBe true }
    "in_stock -> no reorder" in { ProductService.needsReorder("in_stock") shouldBe false }
  }
}
