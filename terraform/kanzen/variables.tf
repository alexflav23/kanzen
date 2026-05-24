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
  description = "Apex domain for the env (e.g. staging.kanzen.family)."
  type        = string
}

variable "acm_certificate_arn" {
  description = "ALB cert ARN (regional, eu-west-1) for HTTPS termination."
  type        = string
}

variable "cloudfront_certificate_arn" {
  description = "CloudFront cert ARN (must be in us-east-1) for the web SPA."
  type        = string
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
