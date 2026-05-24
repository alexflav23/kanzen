# Acceptance conventions — personas & UAT scenario format

Shared by every `specs/F__-*.md`. The **§9 Acceptance scenarios (UAT)** section of each
feature is written against these actors, in Given/When/Then, with each scenario
**traceable to an automated test** (the §10 test plan). A feature is **Done** only when
every one of its acceptance scenarios is automated and green (see
`00-product-completion-plan.md` Definition of Done).

## Personas (the real household — seeded data)

| Actor | Role (F02) | Scope | Sees money/valuations? | Notes |
|---|---|---|---|---|
| **Toby** | Principal | all properties (`admin`) | **Yes** — Principal-private finance & valuations | the owner |
| **Lorna** | Chief of Staff → **Manager** | all properties (`write`, operational) | **Operational carve-out** — pay queue, bills, expenses; **not** asset valuations / Principal-private fields | runs the household |
| **Marcia** | Housekeeper → **Staff** | **Wardian only** (`read` basics, `write` = raise defect) | **No** — prices/valuations stripped server-side | |
| **Siti** | Housekeeper → **Staff** | **Singapore only** | **No** | work permit expiring (F10) |
| **The Agent** | non-human (email agent) | acts via the **same Authorizer** path | n/a | **proposes, never auto-commits** financial/asset creation (F27) |

Default-deny: anything not granted is denied. Property scope is enforced on every read/write; a Singapore-scoped user must never see (or learn of the existence of) Wardian data.

## Scenario format

```
**AC<n> — <short title>**  ‹maps: backend Test, web spec, mobile test›
- **Given** <starting state / who>
- **When** <persona> <does action>
- **Then** <observable, checkable outcome>
- **And** <further assertions: audit entry, field-filtering, status, money-not-moved, …>
```

Rules:
1. Use the **named personas** above, not "a user".
2. Every feature includes at least one **negative / permission** scenario (forbidden, scoped-out, field-filtered) — a leak is a failed acceptance.
3. Every scenario names the **automated test(s)** that prove it (`maps:`). No scenario is "manual only".
4. Money scenarios must assert the relevant **invariant** (never moves money; proposed-not-committed; ledger hidden; source docs immutable; no leak via totals).
5. States covered: success **and** loading/empty/error/forbidden where user-visible.
