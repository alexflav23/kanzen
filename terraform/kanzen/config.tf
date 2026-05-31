# SSM Parameter Store — the non-secret backend config under `/kanzen/${env}/…`, wired directly from the provisioned
# resources (the app IAM role grants `ssm:GetParameter`/`GetParametersByPath` on this prefix in compute.tf). The NixOS
# unit maps each parameter onto the backend's typesafe-config key at boot, so the application that is sandbox-complete
# runs unchanged against the real estate.
#
# This closes the F01 Cognito wiring end-to-end: the pool created in cognito.tf publishes its issuer + JWKS URI here →
# the backend reads `kanzen.cognito.jwks-uri` → the HttpJwks seam (already built + tested) fetches the live JWKS and
# validates real RS256 tokens. No application change is required — only these values.
resource "aws_ssm_parameter" "config" {
  for_each = {
    "cognito/issuer"   = "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
    "cognito/audience" = aws_cognito_user_pool_client.web.id
    "cognito/jwks-uri" = "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.main.id}/.well-known/jwks.json"
    "public-base-url"  = "https://${var.domain_name}"
    "s3/bucket"        = aws_s3_bucket.documents.id
    "s3/region"        = var.region
    "db/url"           = "jdbc:postgresql://${aws_db_instance.main.endpoint}/kanzen"
    "db/user"          = "kanzen"
  }

  name  = "/kanzen/${local.env}/${each.key}"
  type  = "String"
  value = each.value
}
