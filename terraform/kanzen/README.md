# Kanzen infrastructure (`terraform/kanzen`)

The launch substrate for the **Hardening & launch** milestone. The application (backend + web)
is sandbox-complete and tested; this module provisions the real AWS estate it deploys onto.
Per `CLAUDE.md`: AWS **eu-west-1**, EC2 autoscaling + **NixOS**, shared **ALB**, **RDS Postgres 16**,
**S3**, **Cognito**, **CloudFront**; state in S3; **workspaces = env**.

## What it creates
- **network.tf** — VPC, public/private subnets ×2 AZ, NAT, and the ALB→app→db security-group chain.
- **data.tf** — RDS Postgres 16 (multi-AZ + deletion-protection in prod) + S3 buckets: `documents`
  (immutable, versioned, encrypted source originals — F05) and `pkgs` (release tarballs the hosts pull).
- **cognito.tf** — the user pool + public SPA client (PKCE); closes the F01 "real Cognito pool" deferral.
- **compute.tf** — IAM role/instance-profile (S3 + SSM + Secrets read), launch template (NixOS AMI),
  ASG, and the ALB target group/listener (HTTPS; health check on the admin `:9990 /health`).
- **cloudfront.tf** — S3 + CloudFront for the Vite/React SPA (SPA-routing error responses).
- **outputs.tf** — ALB DNS, CloudFront domain, RDS endpoint, **Cognito issuer/pool/client**, bucket names.

## Operator runbook (launch wave — needs real AWS credentials)
1. Create the state bucket `kanzen-tfstate` once (S3 native locking via `use_lockfile`).
2. Put secrets in Secrets Manager + config in SSM under `/kanzen/<env>/…` (see `SETUP.md`).
3. `terraform init && terraform workspace new staging`
4. `terraform plan -var-file=staging.tfvars` → review → `apply`.
5. Feed the outputs back: `cognito_issuer`/`cognito_web_client_id` into SSM (backend) + the web build;
   `rds_endpoint` + the DB secret into the backend config; sync the SPA build to `web_bucket` and
   invalidate CloudFront; publish the backend tarball to `pkgs_bucket`.

> Nothing secret lives here — every credential/endpoint is a variable supplied at apply time.
> `terraform validate` confirms the module is well-formed; `apply` is operator-gated.
