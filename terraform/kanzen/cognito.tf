# Cognito user pool — the auth source of truth (F01). The backend validates its RS256 JWTs
# against this pool's JWKS; the dev-JWKS fallback is local-only. Real-pool creation here closes
# the F01 "real Cognito pool" deferral at the launch wave.
resource "aws_cognito_user_pool" "main" {
  name = local.name

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # custom:role — a hint carried in the ID token so the web UI can gate roles synchronously with the bearer. The
  # backend treats it as a hint only: the DB role (users.role) is authoritative (Principals.resolver).
  schema {
    name                = "role"
    attribute_data_type = "String"
    mutable             = true
    string_attribute_constraints {
      min_length = 0
      max_length = 32
    }
  }

  password_policy {
    minimum_length    = 12
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  admin_create_user_config {
    allow_admin_create_user_only = true # household is invite-only; no self sign-up
  }
}

resource "aws_cognito_user_pool_client" "web" {
  name         = "${local.name}-web"
  user_pool_id = aws_cognito_user_pool.main.id

  explicit_auth_flows = ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
  generate_secret     = false # public SPA client (PKCE)

  callback_urls = ["https://${var.domain_name}/auth/callback"]
  logout_urls   = ["https://${var.domain_name}/"]

  supported_identity_providers         = ["COGNITO"]
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  allowed_oauth_flows_user_pool_client = true

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 30
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}
