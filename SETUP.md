# Kanzen — Operator Setup & External Inputs

**The single place that tracks everything *you* must provide** for Kanzen to build, deploy and run — AWS resources, third-party accounts, API credentials, DNS, and manual configuration. This is a **living document**: every feature spec that needs an external input adds its requirement here, so at any moment you can see exactly what's missing to "fully start the app and get it running."

> Nothing here is a secret *value* — this lists **what to obtain and where it goes**. Actual secret values live in **AWS Secrets Manager** / **SSM Parameter Store** / **1Password**, never in git.

## Status legend
- 🔴 **Blocking** — needed to run the app at all (M0–M1); nothing works without it.
- 🟡 **Needed before a feature** — required before the named feature can run; not blocking the initial boot.
- 🟢 **Provided / done.**
- ⚪ **Optional / later.**

## Where each input lives
| Kind | Store | Notes |
|---|---|---|
| App **secrets** (DB creds, API keys, OAuth client secrets) | **AWS Secrets Manager** | `{env}/kanzen/...` (mirrors Hypervolt) |
| App **config** (non-secret: IDs, hosts, flags) | **AWS SSM Parameter Store** | `/{env}/kanzen/*` |
| **CI/CD** values (deploy role, CloudFront IDs) | **GitLab CI/CD variables** | per the monorepo project |
| Household **credentials** (bank logins, vault contents) | **1Password** | referenced by name only; Kanzen never stores them |
| **Local dev** | `.env` via **direnv** + `docker-compose` | `.env.example` generated in F00 |

---

## A. Minimum to get the app running (M0–M1)
The must-haves to boot locally and stand up the first deployed environment. (Local dev needs far less — Docker Compose covers Postgres + LocalStack/S3; auth runs in dev-mode. The general ledger is **Postgres double-entry**, ADR-001 — TigerBeetle was dropped, so no separate ledger infra.)

| # | What | Why | Your action | 🔴/🟡 |
|---|---|---|---|---|
| A1 | **AWS account + dedicated profile**, region **eu-west-1** | All infra | Confirm the Kanzen AWS account ID + profile name (spec says a dedicated Hypervolt eu-west-1 profile exists) | 🔴 |
| A2 | **Terraform remote state** — S3 state bucket + assume-role ARNs | IaC | Confirm Kanzen gets a state bucket (`eu-west-1.tf.hypervolt`) + `global-kanzen-state-operator` / `kanzen-operator` roles (Hypervolt rbac module) | 🔴 |
| A3 | **GitLab project** for the monorepo + CI variables + Nix runners + SSH deploy keys for private `gitlab.com/hypervolt/terraform`+modules | CI/CD, IaC modules | Create the project; grant deploy keys; set CI vars (deploy role, CloudFront dist IDs) | 🔴 |
| A4 | **Shared VPC + ALB** (`aws-vpc-remote`, `infrastructure-lb`) | Networking | Confirm Kanzen may use the shared VPC/ALB or needs its own | 🔴 |
| A5 | **RDS PostgreSQL 16** + **pgvector** enabled | Domain DB + learned categorisation | Provisioned by Terraform; confirm instance sizing; enable `pgvector` | 🔴 |
| A6 | **S3 buckets** — `kanzen.{env}.eu-west-1.hypervolt`, `kanzen-docs.{env}…`, shared `pkgs` | App + documents + deploy artifacts | Created by Terraform | 🔴 |
| A7 | **Domain `kanzen.family`** + `app.kanzen.family`, **Route53** zone, **ACM** certs (incl. us-east-1 for CloudFront) | Web app, auth, email | Confirm domain ownership + DNS control | 🔴 |
| A8 | **AWS Cognito user pool** (TOTP MFA enforced) | Sign-in (F01) | Provisioned by Terraform; for local dev a dev-mode issuer is fine (F00 open Q) | 🔴 |
| A9 | **AWS SES** — verify `kanzen.family` (DKIM/SPF/DMARC), request **production access**, verified from-address (`no-reply@kanzen.family`) | Invites, reminders | Add DNS records; request SES prod access | 🔴 (for invites) |
| A10 | ~~TigerBeetle instance~~ — **dropped (ADR-001)**; the general ledger is Postgres double-entry on RDS (A5) | Ledger (F18) | **None** — no separate ledger infra to provision | 🟢 |
| A11 | **Apache Pulsar** (event backbone) — local via Docker Compose; deployed mirrors Hypervolt (Consul `pulsar.service`) | Event queue / notifications (F34) | Confirm Kanzen gets a Pulsar cluster (Terraform/Consul) | 🟡 (F34; local now) |
| B6+ | **APNs + FCM** keys now needed for **push notifications** (F34), earlier than just mobile | Notifications (F34) + mobile (F31) | Create Firebase (FCM) + Apple APNs auth key | 🟡 F34 |

---

## B. Per-integration inputs (by feature)

### B1. Auth — Cognito + identity providers (F01)
- **Cognito user pool** (A8) with **TOTP MFA** enforced. → SSM: `COGNITO_USER_POOL_ID`, `COGNITO_REGION`, `COGNITO_JWKS_HOST`, app client IDs.
- **Google Workspace sign-in** — a **Google OAuth 2.0 client** (Google Cloud Console, for `kanzen.family`): **client ID + secret** + authorised redirect URIs → configured as a Cognito IdP. *(Your action.)* 🟡 F01
- **Sign in with Apple** — Apple Developer: **Services ID, Team ID, Key ID + `.p8` private key**. *(Your action.)* 🟡 F01
- **Passkeys / WebAuthn** — RP ID = `app.kanzen.family`; Cognito WebAuthn config. 🟡 F01
- **Local-dev auth strategy** — dev pool vs dev-mode issuer (F00 open Q). 🟡

### B2. Email — SES (F01, F11)
- Domain verification + DKIM/SPF/DMARC, production access, from-addresses (A9). 🔴/🟡

### B3. Google Workspace service account — Gmail agent + Calendar (F07, F25)
- A **Google Cloud project** + **service account** with **domain-wide delegation** for `kanzen.family`; enable **Gmail API** + **Calendar API**; authorise scopes (Gmail read on the operational mailboxes, Calendar) in the Workspace Admin console; provide the **SA key** (or Workload Identity). *(Workspace super-admin action.)* 🟡 F07/F25
- **Five operational mailboxes** must exist as real Gmail mailboxes/groups: `deliveries@`, `accounts@`, `house@`, `vendors@`, `concierge@` `@kanzen.family`. *(Your action.)* 🟡 F25
- **Calendars**: a shared household calendar + per-property calendars; provide/identify calendar IDs. 🟡 F07

### B4. LLM — Amazon Bedrock (F13, F25, F27)
- Enable **Bedrock model access** in **eu-west-1** for **Claude** (agent + multimodal OCR) **and** an **embeddings model** (Titan Embeddings or Cohere) for learned categorisation; IAM role for the app. *(Account action — some models need an access request.)* 🟡 F13

### B5. Open banking — GoCardless Bank Account Data, AIS (F12)
- Sign up for **GoCardless Bank Account Data**; create **Secret ID + Secret Key** (sandbox **and** live); set redirect URI `https://app.kanzen.family/banking/callback`; confirm commercial tier/limits for a private household. *(Your action.)* → Secrets Manager. 🟡 F12
- Connects: **Amex**, **Revolut**, **Coutts**, other UK banks (read-only).
- **Singapore** open-banking provider — **still to decide** (SGFinDex / Finverse / Brankas), separate connector. 🟡 later

### B6. Push notifications — FCM + APNs (F06 reminders, F31 mobile)
- **Firebase project** (FCM service account/key) + **Apple APNs auth key** (`.p8`, Key ID, Team ID). *(Your action.)* ⚪/🟡 F31 (reminders work via email until mobile lands)

### B7. 1Password (reference only)
- Vault **names** for Wardian / Singapore (and payment-method display metadata). Kanzen stores names only — never credentials. *(Your action.)* ⚪

### B8. Mobile app store (F31)
- **Apple Developer** account (app signing, APNs, Sign in with Apple); **Google Play** if Android. ⚪ later

---

## C. Master checklist (consolidated)
| ID | Item | For | Where it goes | Status |
|---|---|---|---|---|
| A1 | AWS account + eu-west-1 profile | all | — | 🔴 ☐ |
| A2 | Terraform state bucket + roles | IaC | — | 🔴 ☐ |
| A3 | GitLab project + CI vars + module deploy keys | CI/CD | GitLab | 🔴 ☐ |
| A4 | Shared VPC + ALB access | network | Terraform | 🔴 ☐ |
| A5 | RDS PG16 + pgvector | DB | Terraform | 🔴 ☐ |
| A6 | S3 buckets (app/docs/pkgs) | storage | Terraform | 🔴 ☐ |
| A7 | Domain + Route53 + ACM | web/auth/email | DNS | 🔴 ☐ |
| A8 | Cognito user pool (MFA) | F01 | Terraform/SSM | 🔴 ☐ |
| A9 | SES domain verify + prod access | F01/F11 | DNS/SES | 🔴 ☐ |
| A10 | ~~TigerBeetle host~~ — dropped (ADR-001); GL on RDS Postgres | F18 | — | 🟢 n/a |
| B1a | Google OAuth client (sign-in) | F01 | Secrets Manager | 🟡 ☐ |
| B1b | Apple Sign in (Services ID + key) | F01 | Secrets Manager | 🟡 ☐ |
| B3a | Google service account + DWD + APIs | F07/F25 | Secrets Manager | 🟡 ☐ |
| B3b | 5 operational mailboxes | F25 | Workspace | 🟡 ☐ |
| B3c | Calendars (household + per-property) | F07 | SSM | 🟡 ☐ |
| B4 | Bedrock model access (Claude + embeddings) | F13/F25 | AWS console/IAM | 🟡 ☐ |
| B5a | GoCardless BAD credentials | F12 | Secrets Manager | 🟡 ☐ |
| B5b | Singapore OB provider (decision) | F12 | — | 🟡 ☐ |
| B5c | **FX rate provider** (decision: ECB reference [free] vs commercial) + daily fetch | F37 currencies | Secrets Manager (if keyed) | 🟡 ☐ |
| B6 | FCM + APNs keys | F06/F31 | Secrets Manager | ⚪ ☐ |
| B7 | 1Password vault names | finance/property | SSM/config | ⚪ ☐ |
| B8 | Apple Developer / Google Play | F31 | — | ⚪ ☐ |

---

## D. Decisions still pending from you (from the specs)
These don't block the build but I'll need them before the named feature ships:
- **Singapore open-banking provider** (F12) — SGFinDex vs Finverse vs Brankas.
- **Apple Sign in scope** (F01) — web + mobile, or iOS-only initially.
- **Cognito local-dev strategy** (F00) — dev pool vs dev-mode issuer.
- **Canonical category tree** (F22) — the seed taxonomy.
- **Document hard-immutability** (F05) — app-level vs S3 Object Lock.
- Others are tracked in each spec's "§12 Open questions."

---

*Maintained by Claude Code alongside the feature specs. When a spec's §7 (integrations) introduces a new external input, it is added here. **Last updated: all 44 features (F00–F43) built in sandbox; integrations captured. Nothing operator-provided has been wired yet — the whole platform currently runs locally (Docker stack, dev-auth JWTs, in-memory blob store, seeded data, in-process event relay).** No net-new external inputs from the Wealth module (F39–F43): it sits on the existing RDS Postgres + FX (B5c). The remaining operator work is the §C checklist — flipping sandbox → real AWS for the Final "Hardening & launch" milestone.*
