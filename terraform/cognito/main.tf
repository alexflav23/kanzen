provider "aws" {
  region  = var.region
  profile = var.profile
}

# Mirrors terraform/kanzen/cognito.tf (the canonical prod pool), minus the hosted-UI OAuth/callback
# config — the web client signs in via SRP (amazon-cognito-identity-js), not the redirect flow.
resource "aws_cognito_user_pool" "main" {
  name = "${var.name}-users"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # custom:role — a hint in the ID token for synchronous UI role-gating; the backend treats the DB
  # role (users.role) as authoritative.
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
    allow_admin_create_user_only = true # invite-only household
  }
}

resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.name}-web"
  user_pool_id = aws_cognito_user_pool.main.id

  # SRP for the browser + refresh; ADMIN_USER_PASSWORD_AUTH so a token can be minted via the CLI for
  # end-to-end verification. Public SPA client (no secret / PKCE).
  explicit_auth_flows = ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH", "ALLOW_ADMIN_USER_PASSWORD_AUTH"]
  generate_secret     = false

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 30
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}

# The test principal. Its email must match a seeded users.email so the backend's Principal resolver
# maps the token to a real household member.
resource "aws_cognito_user" "test" {
  user_pool_id   = aws_cognito_user_pool.main.id
  username       = var.test_user_email
  message_action = "SUPPRESS"

  attributes = {
    email          = var.test_user_email
    email_verified = "true"
    "custom:role"  = "principal"
  }
}

# Cognito has no Terraform argument for a *permanent* password, so set it via the CLI after create
# (re-runs only if the user or password changes).
resource "null_resource" "set_password" {
  triggers = {
    user = aws_cognito_user.test.id
    pw   = var.test_user_password
  }
  provisioner "local-exec" {
    command = <<-EOT
      aws cognito-idp admin-set-user-password \
        --profile ${var.profile} --region ${var.region} \
        --user-pool-id ${aws_cognito_user_pool.main.id} \
        --username ${var.test_user_email} \
        --password '${var.test_user_password}' --permanent
    EOT
  }
}
