# Kanzen infrastructure (Terraform). Per CLAUDE.md: AWS eu-west-1, EC2 autoscaling + NixOS,
# shared ALB, RDS Postgres 16, S3, Cognito, CloudFront. State in S3; workspaces = env.
#
# Usage (operator, at the launch wave — needs real AWS credentials + the SETUP.md inputs):
#   cd terraform/kanzen
#   terraform init                              # configures the S3 backend below
#   terraform workspace select staging || terraform workspace new staging
#   terraform plan -var-file=staging.tfvars
#   terraform apply -var-file=staging.tfvars
#
# This module is the launch substrate for the "Hardening & launch" milestone; the application
# (backend + web) is sandbox-complete and deploys onto it once the operator provisions the estate.

terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state in S3 (bucket + lock table created out-of-band, once per org). Per-env state
  # is keyed by the Terraform workspace, so staging/prod never collide.
  backend "s3" {
    bucket       = "kanzen-tfstate"
    key          = "kanzen/terraform.tfstate"
    region       = "eu-west-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = "kanzen"
      Env       = terraform.workspace
      ManagedBy = "terraform"
    }
  }
}

# A second provider in us-east-1 — CloudFront's ACM certificate must live there.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

locals {
  env     = terraform.workspace
  name    = "kanzen-${terraform.workspace}"
  azs     = ["${var.region}a", "${var.region}b"]
  is_prod = terraform.workspace == "prod"
}
