# These feed the local docker stack. Wire them into the root .env:
#   COGNITO_ISSUER / COGNITO_JWKS_URI / COGNITO_AUDIENCE  → backend (validate real ID tokens)
#   VITE_COGNITO_USER_POOL_ID / VITE_COGNITO_CLIENT_ID    → web build (render CognitoLogin)
output "user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "web_client_id" {
  value = aws_cognito_user_pool_client.web.id
}

output "issuer" {
  value = "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
}

output "jwks_uri" {
  value = "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.main.id}/.well-known/jwks.json"
}

output "audience" {
  description = "The ID token's aud claim = the web client id."
  value       = aws_cognito_user_pool_client.web.id
}
