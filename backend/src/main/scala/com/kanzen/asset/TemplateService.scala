package com.kanzen.asset

import io.circe.Json

final case class FieldDef(key: String, fieldType: String, required: Boolean)

/** F22 — validate an asset's JSONB `attributes` against its category template (trunk + freehand).
  * Unknown keys are allowed (freehand); required/typed keys are checked.
  */
object TemplateService {
  def parseSchema(schema: Json): List[FieldDef] =
    schema.asArray.toList.flatten.flatMap { j =>
      for {
        k <- j.hcursor.get[String]("key").toOption
        t <- j.hcursor.get[String]("type").toOption
      } yield FieldDef(k, t, j.hcursor.get[Boolean]("required").toOption.getOrElse(false))
    }

  def validate(attrs: Json, fields: List[FieldDef]): List[String] = {
    val obj = attrs.asObject.map(_.toMap).getOrElse(Map.empty[String, Json])
    fields.flatMap { f =>
      obj.get(f.key) match {
        case None        => if (f.required) List(s"missing required: ${f.key}") else Nil
        case Some(value) => if (typeOk(f.fieldType, value)) Nil else List(s"wrong type for ${f.key}: expected ${f.fieldType}")
      }
    }
  }

  private def typeOk(t: String, v: Json): Boolean = t match {
    case "string" => v.isString
    case "number" => v.isNumber
    case "bool"   => v.isBoolean
    case _        => true
  }
}
