# Secrets Manager — the runtime secrets the backend reads under `kanzen/${env}/…` (the app IAM role in compute.tf
# grants `secretsmanager:GetSecretValue` on exactly that prefix). Nothing secret lives in git: the boot secrets are
# either generated here (blob signing key) or passed via a sensitive var sourced from a sealed tfvars / TF_VAR_… at
# apply time (the RDS password); operator-provided integration credentials are created as empty containers for the
# operator to fill out-of-band (console / API) when they connect each integration.

# A stable per-env signing secret for the blob capability URLs + the verification/feed HMAC tokens (BlobToken /
# VerifyToken / CalendarFeed). Generated once and stored; rotating it invalidates outstanding capability URLs.
resource "random_password" "blob_secret" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "blob_secret" {
  name        = "kanzen/${local.env}/blob-secret"
  description = "HMAC signing secret for blob/verify/feed capability URLs (BlobToken)."
}

resource "aws_secretsmanager_secret_version" "blob_secret" {
  secret_id     = aws_secretsmanager_secret.blob_secret.id
  secret_string = random_password.blob_secret.result
}

# The RDS master password (also set on the instance in data.tf). Supplied by the operator via a sensitive var so it
# never touches git; stored here so the booting backend reads the same value.
resource "aws_secretsmanager_secret" "db_password" {
  name        = "kanzen/${local.env}/db-password"
  description = "RDS Postgres master password for the backend DB config."
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = var.db_password
}

# Operator-provided integration credentials — empty containers the operator fills when connecting each integration.
# The application reads each at runtime behind its seam (StubMailer→SesMailer, the per-tenant WorkspaceAuth ref, the
# BankFeed/GmailSender/… clients). Created empty so the launch wave provisions the slots without committing values.
resource "aws_secretsmanager_secret" "integration" {
  for_each = toset([
    "ses-config",      # SES sending identity / configuration-set for outbound mail (F46 magic-link, F34 notifications)
    "gocardless-token" # GoCardless AIS access token (F12 bank feed) — read-only; Kanzen never moves money
  ])
  name        = "kanzen/${local.env}/${each.key}"
  description = "Operator-provided; fill out-of-band when the integration is connected. Empty until then."
}
