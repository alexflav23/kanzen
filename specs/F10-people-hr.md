# Feature F10 — People / HR

| | |
|---|---|
| **Feature ID** | F10 |
| **Milestone** | M2 |
| **Domain** | Operations |
| **Status** | ✅ spec complete |
| **Depends on** | F01 (users), F03 (property), F02 (authz); uses F11 (reminders), F07 (leave → calendar) |
| **Spec references** | SPEC §7.10; `input/views/stubs.jsx → PeopleView`, App. E.13 |

> **Decisions (revisitable):** a staff **Person/EmploymentRecord** may link to a login **User** (F01) — Marcia and Siti are both; **work-permit/visa & review dates carry expiry reminders**; **leave** creates calendar events (F07); **payroll is external** (reference only — no payroll engine).

## 1. Purpose & user value
The household team's HR record — roles, jurisdictions, contracts, key dates, leave, reviews, emergency contacts and documents — with proactive reminders so a work permit (Siti's) or review never lapses unnoticed.

## 2. Roles & permissions
Resource `person`/`employment_record`: **Principal** `admin`; **Manager** `write` (HR ops) **except** Principal-private HR documents (§4); **Staff** `read` their **own** record + book own leave.

## 3. Data model
`V__people.sql`:
- **`employment_records`** — `id, owner_id, user_id uuid null → users (if they have app access), name, role, jurisdiction ('uk'|'sg'), property_id → properties, contract_type, start_date, end_date null, work_permit_no text null, permit_expiry date null, review_due date null, emergency_contacts jsonb, payroll_ref text null, notes, created_at, updated_at, deleted_at`.
- **`leave`** — `id, employment_record_id, type ('annual'|'sick'|'other'), start_date, end_date, status ('requested'|'approved'|'rejected'), note, calendar_event_id uuid null (F07), created_at`.
- HR documents via F05 `document_links` (target_type=`person`), Principal-private subset honoured.

## 4. API
`GET /api/people` · `GET /:id` · `POST` · `PATCH` · `DELETE`. Leave: `GET /api/people/:id/leave` · `POST` · `POST /leave/:id/approve|reject`. Expiry reminders registered with F11.

## 5. UI / screens & states
Per `PeopleView`: team rows (avatar, role, **permit-expiry warning** — e.g. "Work permit · 50d"). Person detail: particulars, contract + key dates, leave (calendar), reviews, emergency contacts, documents, payroll reference. States: active, expiring-soon (amber), expired (red), on-leave.

## 6. Business rules & validation
- **Expiry reminders**: `permit_expiry` + `review_due` (+ contract end) → F11 reminders + Inbox + dashboard "expiring within 60 days" (prototype shows Siti's permit).
- **Leave** approval → an all-day calendar event (F07) + visibility to scheduling; overlapping leave flagged.
- **User linkage**: an `employment_record` with a `user_id` ties HR to login/permissions (F01/F02); staff edit only their own record + leave.
- **Payroll external**: store the bureau reference only; no salary/payment processing.

## 7. Integrations
F11 (reminders), F07 (leave events), F05 (HR docs, private subset), F01/F02 (user link + scope). External payroll bureau = reference only.

## 8. Edge cases
Staff who are also app users vs not; permit-expiry escalation (90/60/30/7d); overlapping leave; jurisdiction-specific fields (SG work permit vs UK right-to-work); offboarding (end_date → deactivate user, retain record).

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Work-permit expiry surfaces at configured leads**  ‹maps: `PermitExpiryReminderIT`, web `people.spec` expiry-pills›
- **Given** Siti's `permit_expiry` is set and is within 60 days
- **When** the F11 reminder engine runs
- **Then** the expiry appears in the Inbox, the People list shows Siti's row with an amber "Work permit · Nd" pill, and the dashboard "expiring within 60 days" section lists it
- **And** reminders fire at the 90-, 60-, 30-, and 7-day leads; once elapsed the pill turns red.

**AC2 — Leave approval creates a calendar event**  ‹maps: `LeaveApprovalIT`, web `people.spec` leave›
- **Given** Siti submits a leave request (annual, 3 days)
- **When** Lorna approves it via `POST /api/leave/:id/approve`
- **Then** leave status → `approved` and an all-day calendar event (F07) is created with `calendar_event_id` recorded
- **And** Siti's People row shows the on-leave state for those dates; overlapping leave requests for the same person are flagged.

**AC3 — Staff can view and update their own record only (negative for others)**  ‹maps: `PersonScopeIT`, web `people.spec` own-record›  *(invariant: default-deny)*
- **Given** Marcia (Wardian Staff) authenticated
- **When** she fetches her own employment record and books a leave request
- **Then** both succeed — she sees her own record and the leave is created with status `requested`
- **And** when she attempts to fetch Siti's record (`GET /api/people/:siti-id`) she receives **403** — other staff records are not accessible.

**AC4 — Principal-private HR documents invisible to Manager**  ‹maps: `HRDocVisibilityIT`, web `people.spec` private-docs›  *(invariant: server-side scope; no leak)*
- **Given** Toby uploads an HR document for Marcia with `visibility = principal_private` via F05 (`target_type = person`)
- **When** Lorna (Manager) lists documents for that person or fetches the document directly
- **Then** it is **not listed** in Lorna's results and the direct fetch returns **403/404**
- **And** Toby (Principal) can list and download it normally.

**AC5 — Offboarding deactivates user, retains history**  ‹maps: `OffboardingIT`, web `people.spec` offboard›
- **Given** Marcia has a linked `user_id` (F01) and an active employment record
- **When** Lorna sets `end_date` and triggers offboarding
- **Then** the linked user account is deactivated (login denied) and the employment record retains all history (`deleted_at` is not set — record preserved)
- **And** the offboarding action is audited.

**AC6 — Manager cannot access People for the other property (scope)**  ‹maps: `PeopleScopeIT`›  *(invariant: property scope enforced)*
- **Given** Lorna (Manager, all properties) and Siti's record scoped to Singapore
- **When** Marcia (Wardian Staff) attempts to list all people
- **Then** she sees only her own record (Staff — own-only)
- **And** Lorna sees the full team roster across both properties because her scope is all properties.

## 10. Test plan
Backend: expiry-reminder registration, leave→calendar, own-record scoping, offboarding. Web: Vitest people rows/expiry pills; Playwright leave request→approve.

## 11. Observability & audit
Audit: record CRUD, leave decisions, offboarding, document access. Metrics: expiring permits/reviews, leave balance, headcount by property.

## 12. Open questions
1. Leave entitlement/balance tracking depth for v1. 2. Jurisdiction-specific compliance fields. 3. Whether to integrate the payroll bureau beyond a reference later.
