package com.kanzen.api

/** problem+json-style API error. `status` mirrors the HTTP status for transparency; `code` is a stable machine code;
  * `detail` is human-readable.
  */
final case class ApiError(status: Int, code: String, detail: String)
