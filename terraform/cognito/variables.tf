variable "region" {
  description = "AWS region for the pool."
  type        = string
  default     = "eu-west-1"
}

variable "profile" {
  description = "AWS CLI profile to use (the account that owns the pool)."
  type        = string
  default     = "outworkers"
}

variable "name" {
  description = "Resource name prefix."
  type        = string
  default     = "kanzen-local"
}

variable "test_user_email" {
  description = "Seeded household principal — must match a users.email row so /api/me resolves."
  type        = string
  default     = "flavian@kanzen.local"
}

variable "test_user_password" {
  description = "Permanent password for the test user (dev only)."
  type        = string
  default     = "Kanzen!Local2026"
  sensitive   = true
}
