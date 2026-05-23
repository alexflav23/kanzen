# Kanzen — Master Implementation Plan

The bridge between the v6 platform spec (`../Kanzen-Platform-Spec.md`) and the build. The spec says *what* and *why*; this plan and the per-feature specs in this directory say *exactly how*, feature by feature, in dependency order.

## How this works
- **Per-capability slicing.** ~32 features (below). Big modules are split into buildable units.
- **One at a time, question-first.** For each feature we resolve its open questions, then write an **implementation-ready** spec (`F__-<name>.md`) using `_template.md`.
- **Committed as we go**, on the `spec` branch. The status table below is the live tracker.
- **Foundation-first, dependency order.** Start at F00 and walk the graph.

### Status legend
📋 planned · ❓ questions open · ✍️ drafting · ✅ spec complete · 🚧 implementing · ✔️ shipped

## Cross-cutting requirements (every feature inherits these)
Applied in every spec, not repeated as features:
- **AuthZ** — role + property scope + per-module level (none/read/write/admin), enforced in shared server middleware; agent actions take the same path. (SPEC §4, §13)
- **`owner_id` on every domain record**; registry/finance modules Principal-private with the Manager carve-out.
- **Audit** — every meaningful write to the append-only audit log (7-yr retention); corrections are events, never mutations.
- **Soft delete** (`deleted_at`) where practical; immutable originals and ledger postings never mutated.
- **API contract first** — Tapir endpoints + generated OpenAPI; web & Flutter clients generated from it.
- **Tests** — unit + integration; reconciliation and backup/restore get extra rigor.
- **Observability** — structured logs + metrics.
- **Design system** — every screen composes from the StyleX token set + component library (F00, SPEC §16).

## Feature index

| ID | Feature | M | Domain | Depends on | Status | Spec |
|---|---|---|---|---|---|---|
| F00 | Foundation: infra, repo, design system | M0 | Platform | — | ✅ spec complete | [F00](F00-foundation.md) |
| F01 | Identity, auth & session | M1 | Identity | F00 | ✅ spec complete | [F01](F01-identity-auth.md) |
| F02 | Authorization (resource/field RBAC + custom roles + scope) | M1 | Identity | F01 | ✅ spec complete | [F02](F02-authorization.md) |
| F03 | Properties, locations & defects | M1 | Properties | F02 | ✅ spec complete | [F03](F03-properties.md) |
| F04 | Asset registry core | M1 | Assets | F03 | ✅ spec complete | [F04](F04-asset-registry-core.md) |
| F05 | Documents — S3 evidence store | M1 | Documents | F02 | 📋 | — |
| F06 | Tasks — **native** (was Todoist) | M2 | Operations | F03 | 📋 | — |
| F07 | Calendar — Google Calendar | M2 | Operations | F03 | 📋 | — |
| F08 | Lists | M2 | Operations | F03 | 📋 | — |
| F09 | Vendors & contacts | M2 | Operations | F03 | 📋 | — |
| F10 | People / HR | M2 | Operations | F02 | 📋 | — |
| F11 | Maintenance plans & reminder engine | M2 | Operations | F04, F06, F07 | 📋 | — |
| F12 | Bank ingestion & transactions (open banking AIS) | M3 | Finance | F02 | ✅ spec complete | [F12](F12-bank-ingestion.md) |
| F13 | Receipts & OCR/parse pipeline | M3 | Finance | F05 | 📋 | — |
| F14 | Reconciliation engine | M3 | Finance | F12, F13 | 📋 | — |
| F15 | Bills & recurring schedule | M3 | Finance | F03, F09 | 📋 | — |
| F16 | Payment methods & Pay queue | M3 | Finance | F15 | 📋 | — |
| F17 | Budgets & approvals | M3 | Finance | F15 | 📋 | — |
| F18 | TigerBeetle ledger | M4 | Finance | F14 | 📋 | — |
| F19 | Lifecycle events & timeline | M5 | Assets | F04 | 📋 | — |
| F20 | Valuation snapshots | M5 | Assets | F04 | 📋 | — |
| F21 | Warranty / provenance / authenticity / insurance | M5 | Assets | F04 | 📋 | — |
| F22 | Verticals & category templates (incl. Art) | M5 | Assets | F04 | 📋 | — |
| F23 | Completeness scoring & data quality | M5 | Assets | F04, F19–F22 | 📋 | — |
| F24 | Legacy onboarding & restructure | M5 | Assets | F04, F19, F20 | 📋 | — |
| F25 | Email agent pipeline | M6 | Agent | F05, F13, F15 | 📋 | — |
| F26 | Unified Inbox + Triage | M6 | Agent | F25, F14, F23 | 📋 | — |
| F27 | Trust model & rules engine | M6 | Agent | F25 | 📋 | — |
| F28 | Search + ⌘K command palette | M7 | Platform | F04, F12 | 📋 | — |
| F29 | Insights & aggregate reporting | M7 | Platform | F18, F23 | 📋 | — |
| F30 | Backup / export / restore | M8 | Platform | all domains | 📋 | — |
| F31 | Flutter companion | M9 | Mobile | F00, key reads | 📋 | — |
| F32 | Advanced: bulk onboarding, NL query, Drive export | M10 | Platform | F28, F30 | 📋 | — |

## Dependency graph

```mermaid
graph TD
    F00 --> F01 --> F02
    F02 --> F03 & F05 & F10 & F12
    F03 --> F04 & F06 & F07 & F08 & F09 & F15
    F04 --> F19 & F20 & F21 & F22 & F11
    F05 --> F13
    F12 --> F14
    F13 --> F14 --> F18
    F15 --> F16 & F17
    F19 & F20 & F21 & F22 --> F23 --> F26
    F04 & F19 & F20 --> F24
    F05 & F13 & F15 --> F25 --> F26 & F27
    F18 & F23 --> F29
    F04 & F12 --> F28 --> F32
    F30
    F31
```

## Milestone roll-up
- **M0** F00 · **M1** F01–F05 · **M2** F06–F11 · **M3** F12–F17 · **M4** F18 · **M5** F19–F24 · **M6** F25–F27 · **M7** F28–F29 · **M8** F30 · **M9** F31 · **M10** F32.

## Global open decisions (SPEC §19 — still open)
Open-banking provider · backup-binary packaging · ~~repo layout~~ (resolved F00: monorepo) · canonical category tree (resolving in F22) · wear/use counts · inference aggressiveness · payment-execution boundary (assumed: Kanzen never moves money) · cross-currency rollups. Each is pinned to the feature that resolves it.

**Stack (locked in F00, mirrors Hypervolt):** Scala 2.13 · cats-effect 3 · http4s ember · Tapir + OpenAPI · Circe · Doobie · Flyway · PostgreSQL 16 · TigerBeetle · S3 · **AWS Cognito** (not Keycloak) · React 19 + Vite + StyleX (hand-written services + Zod, TanStack Query, dinero.js) · Flutter · GitLab CI on Nix · Terraform (EC2 autoscaling + NixOS) · eu-west-1 · Secrets Manager + SSM.
