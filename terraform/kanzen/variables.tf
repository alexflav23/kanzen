# Every environment-specific / secret input is a variable (nothing secret in git). The operator
# supplies these via <env>.tfvars + TF_VAR_… env vars / Secrets Manager at the launch wave.

variable "region" {
  description = "AWS region (CLAUDE.md: eu-west-1)."
  type        = string
  default     = "eu-west-1"
}

variable "vpc_cidr" {
  description = "CIDR for the Kanzen VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "domain_name" {
  description = "The web host for this env — the apex `kanzen.family` for prod, or e.g. `staging.kanzen.family`. The API is served at `api.<this>`, and both certs + records are auto-created in route53_zone_name."
  type        = string
}

# TLS certs are now requested + DNS-validated by Terraform in the Route 53 zone (see dns.tf) — no manual ARNs.
variable "route53_zone_name" {
  description = "The Route 53 hosted zone the domain lives in (delegated from GoDaddy). Always the apex."
  type        = string
  default     = "kanzen.family"
}

variable "nixos_ami_id" {
  description = "NixOS AMI built + published by CI (the packaged backend pulls its release from S3)."
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type for the backend ASG."
  type        = string
  default     = "t3.small"
}

variable "asg_min_size" {
  type    = number
  default = 1
}

variable "asg_max_size" {
  type    = number
  default = 3
}

variable "db_instance_class" {
  type    = string
  default = "db.t3.small"
}

variable "db_allocated_storage" {
  type    = number
  default = 20
}

variable "db_password" {
  description = "RDS master password (from Secrets Manager; never in git)."
  type        = string
  sensitive   = true
}

variable "ssh_cidr_blocks" {
  description = "CIDRs allowed SSH to instances (ops bastion / VPN)."
  type        = list(string)
  default     = []
}
