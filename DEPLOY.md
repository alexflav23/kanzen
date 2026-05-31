# Kanzen — Staging Deploy Runbook

Copy-paste, ordered. Everything is wired (Terraform · Universal tarball · NixOS · CI); this is **gather credentials → apply**. Region is **eu-west-1** throughout. Replace `kanzen.family` with your domain.

> Secrets never go in git. `db_password` rides `TF_VAR_db_password`; integration creds go straight to Secrets Manager / the in-app Settings cards.

---

## 0. Prerequisites (gather once)
- An **AWS account** + operator credentials with admin-ish rights (`aws sts get-caller-identity` works, region `eu-west-1`).
- A **domain** you control DNS for (e.g. `kanzen.family`).
- A machine with **`terraform` ≥ 1.6**, **`aws` CLI v2**, and (for step 3) **Nix** with flakes.

---

## 1. Bootstrap the Terraform state bucket (one-time, per org)
The backend in `terraform/kanzen/versions.tf` expects `s3://kanzen-tfstate` with native locking:
```sh
aws s3api create-bucket --bucket kanzen-tfstate --region eu-west-1 \
  --create-bucket-configuration LocationConstraint=eu-west-1
aws s3api put-bucket-versioning --bucket kanzen-tfstate \
  --versioning-configuration Status=Enabled
```

## 2. DNS + TLS certificates — automatic ✅
Nothing to do here. The Route 53 zone `kanzen.family` is already created (delegated from GoDaddy), and Terraform now
**requests + DNS-validates both ACM certs and creates all the app records** (web → CloudFront, `api.` → ALB, plus the
cert-validation CNAMEs) inside that zone on `apply`. Just make sure GoDaddy's nameservers point at the Route 53 ones
(so validation can resolve) — see step 0.

## 3. Build the NixOS EC2 AMI
On a Nix builder (Linux, flakes enabled):
```sh
nix build .#amazon-image           # produces a VHD/raw image under ./result
# Upload + register it as an AMI (vmimport role required — AWS one-time setup):
aws s3 cp result/nixos-amazon-image-*.vhd s3://kanzen-tfstate/images/kanzen.vhd
aws ec2 import-snapshot --description kanzen --disk-container \
  Format=VHD,UserBucket="{S3Bucket=kanzen-tfstate,S3Key=images/kanzen.vhd}"
# …then `aws ec2 register-image` with the imported snapshot → note the AMI id (ami-…).
```
> No Nix builder handy? Use any NixOS AMI to bootstrap first and refine later — the host pulls the app from S3 pkgs regardless; the custom AMI just bakes the `kanzen-backend` service.

## 4. Fill `staging.tfvars`
```sh
cd terraform/kanzen
cp staging.tfvars.example staging.tfvars
# edit just: domain_name (e.g. staging.kanzen.family) + nixos_ami_id. Certs/DNS are auto; no ARNs needed.
export AWS_PROFILE=outworkers
export TF_VAR_db_password="$(openssl rand -base64 24)"   # strong; lands in Secrets Manager, not git
```

## 5. Apply
```sh
terraform init                                   # configures the S3 backend
terraform workspace new staging                  # (or: terraform workspace select staging)
terraform plan  -var-file=staging.tfvars         # review
terraform apply -var-file=staging.tfvars         # creates VPC/ALB/ASG/RDS/Cognito/CloudFront/Secrets/SSM
terraform output                                 # grab api_alb_dns, web_cloudfront_domain, cognito_*, etc.
```
Terraform auto-writes the SSM config (cognito issuer/jwks-uri from the new pool, db/url, s3/bucket, public-base-url) + the Secrets Manager entries (generated blob-secret, your db-password). **No app config to touch.**

## 6. DNS records — automatic ✅
Terraform already created the `web`/`www`/`api` A-ALIAS records in the zone during `apply`. Run `terraform output web_url`
+ `api_url` to see the live hostnames.

## 7. Ship the app (the CI `deploy` job, or manually)
The web build must point at the API subdomain:
```sh
# backend release → S3 pkgs (NixOS pulls it on the next ASG instance refresh)
cd backend && sbt Universal/packageXzTarball
aws s3 cp target/universal/kanzen-backend-*.txz s3://kanzen-staging-pkgs/
# web SPA → web bucket → invalidate CloudFront
cd ../web && VITE_API_URL="https://api.kanzen.family" npm ci && npm run build
aws s3 sync dist "s3://$(terraform -chdir=../terraform/kanzen output -raw web_bucket)" --delete
aws cloudfront create-invalidation \
  --distribution-id "$(terraform -chdir=../terraform/kanzen output -raw cloudfront_distribution_id)" --paths '/*'
```
> For the GitLab `deploy` job instead: set protected CI vars `ENV=staging`, `VITE_API_URL=https://api.kanzen.family`, `CLOUDFRONT_DISTRIBUTION_ID=<output>`, and the AWS creds — then click ▶ on `deploy` (it's `when: manual`, main only).

## 8. First sign-in (Cognito is invite-only — no self-signup)
```sh
POOL=$(terraform -chdir=terraform/kanzen output -raw cognito_user_pool_id)
aws cognito-idp admin-create-user --user-pool-id "$POOL" \
  --username flavian@kanzen.family --user-attributes Name=email,Value=flavian@kanzen.family Name=email_verified,Value=true
# you'll be prompted to set a password + TOTP MFA on first login
```
The matching **Kanzen user row** (role=principal, the household) is seeded by the migrations / created on first resolve — confirm it exists for your email so the principal carve-outs apply.

## 9. Smoke test
- `https://api.kanzen.family/api/health` → `{"status":"ok"}` (via the ALB → backend; `HttpJwks` is now validating real Cognito tokens).
- `https://kanzen.family` → the SPA loads; sign in with the Cognito user.

## 10. Turn on integrations (any time, per `SETUP.md`)
Each is a value into Secrets Manager (`kanzen/staging/<name>`) or the in-app **Settings → Integrations** card — then the matching `Stub*` is swapped for the real client behind its trait:
- **Google Workspace** — paste the service-account key in Settings → Integrations → Workspace (then map a calendar for Path-B sync).
- **SES** (`ses-config`) — verify the sending domain → `StubMailer`→`SesMailer`.
- **GoCardless** (`gocardless-token`) — AIS consent → `StubBankFeed`→ the real feed.
- **Bedrock / market-data / FCM+APNs** — credentials → the respective seam.

---

### Teardown (staging)
```sh
cd terraform/kanzen && terraform destroy -var-file=staging.tfvars
```
(prod has `deletion_protection` + a final snapshot; staging does not.)
