# Kanzen — local-dev Cognito (F01). A small, self-contained config that provisions ONLY the auth
# pool, on LOCAL state, so a developer can run the real Cognito sign-in against the running stack.
#
# This is deliberately separate from the full estate in `terraform/kanzen` (which keeps its own
# cognito.tf for prod, on the shared S3 backend). The outputs here feed the local docker stack
# (root .env → backend COGNITO_* + web VITE_COGNITO_*).
terraform {
  required_version = ">= 1.6"
  required_providers {
    aws  = { source = "hashicorp/aws", version = "~> 5.0" }
    null = { source = "hashicorp/null", version = "~> 3.2" }
  }
  # No backend block → local state (terraform/cognito/terraform.tfstate). Intentional.
}
