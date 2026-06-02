# Feature F31 — Flutter companion (mobile)

| | |
|---|---|
| **Feature ID** | F31 |
| **Milestone** | M9 |
| **Domain** | Mobile |
| **Status** | ✔️ Done (sandbox) — real backend client: dev/Cognito auth + persona login, all 6 screens wired to the live `/api` (mock deleted) with all states, role-trimmed tabs (AC1/AC7), Money approve/reject + Triage confirm/reject writes (F27-safe); 17 widget/unit tests (MockClient) + `flutter analyze` clean in CI. Operator/device-gated remainder: real Cognito hosted-UI, camera/OCR capture (behind the `CaptureSource` seam), offline queue, APNs/FCM push deep-links |
| **Depends on** | F00 (shell/design), F01 (auth), and the read/confirm APIs of the domains it surfaces |
| **Spec references** | SPEC §14 (one API, two clients), §16.8; `input/views/mobile.jsx`, App. E.18 |

> **Decisions (revisitable):** a **capture-and-on-the-go** Flutter app (not the full management surface) sharing the one backend API; **hand-written service layer** (no generated client, per the Hyperstore-aligned decision); design-language parity (tokens mirrored, light/dark); bottom tab bar **Home · Triage · Bibles · Money · Search**; **push** via FCM/APNs.

## 1. Purpose & user value
The household on the move: snap a receipt or asset photo, log a quick event, check a Bible, confirm an agent proposal, approve an expense, search — all in seconds, in the same calm design language as the web.

## 2. Roles & permissions
Same F02 model (the API enforces); the app reflects the user's role/scope (Principal/Manager/Staff see different tabs/actions). Auth via Cognito (F01) incl. passkeys/biometrics where available.

## 3. Data model
None new — consumes the backend. Local: secure token storage (Cognito), an **offline capture queue** (photos/quick events buffered when offline, synced when back), push registration token (→ F06 notifications).

## 4. API
Consumes existing endpoints: auth (F01), capture (F05 upload, F13 receipt, F19 event), reads (F03/F04 Bibles + assets), Inbox confirm/approve (F26/F17), search (F28). Registers device push tokens.

## 5. UI / screens & states
Per `mobile.jsx` + App. E.18:
- **Bottom tab bar**: Home · Triage · Bibles · Money · Search (blurred, design-matched).
- **Home**: status + stacked attention cards (Triage, approvals, with agent ribbon) + Upcoming.
- **Triage detail**: category + variance pills, agent-extracted KV, proposed actions, sticky **Reject / Confirm** bar.
- **Capture**: camera → receipt/asset photo → upload (F05) → parse/propose (F13); quick event entry (F19).
- **Money**: approvals (approve/reject), pay-queue glance.
- **Search**: ⌘K-equivalent (F28) full-text/semantic.
- States: offline (queued), syncing, light/dark, biometric unlock, push deep-links.

## 6. Business rules & validation
- **Capture-first**: optimised for photo capture + quick confirmations, not full editing.
- **Offline queue**: captures buffer offline, sync on reconnect (idempotent uploads).
- **Parity**: same design tokens/components as web (§16); same permission model (API-enforced).
- **Push**: reminders/approvals/agent-proposals deep-link into the app (F06/F11).

## 7. Integrations / external systems
Backend API; **Cognito** (auth, passkeys/biometrics); **FCM + APNs** (push — SETUP B6); device camera/storage. Apple Developer / Play for distribution (SETUP B8).

## 8. Edge cases
Offline capture + later sync conflicts; large photo upload on cellular; push token rotation; biometric fallback; role-trimmed tabs; deep-link to a since-resolved item; iOS vs Android parity; app-store review (Sign in with Apple requirement).

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Sign in with biometric/passkey; tab bar reflects the user's role**  ‹maps: mobile `AuthBiometricTest`, `TabBarRoleTest`›
- **Given** Toby and Marcia each open the app on their respective devices
- **When** each authenticates (Cognito + biometric/passkey where available)
- **Then** Toby sees all five tabs (Home · Triage · Bibles · Money · Search); Marcia sees only the tabs relevant to her Staff role
- **And** the design tokens and light/dark theme match the web application.

**AC2 — Receipt photo capture triggers OCR proposal in Triage**  ‹maps: mobile `ReceiptCaptureTest`, `TriageProposeTest`›  *(invariant: asset/financial proposals are never auto-committed)*
- **Given** Lorna is on the Capture screen
- **When** she photographs a receipt and submits it
- **Then** the image uploads to S3 (F05); OCR runs (F13); the extracted line items and proposed actions appear in the Triage stream
- **And** nothing is committed to the registry until she explicitly confirms in Triage; the source image in S3 is immutable.

**AC3 — Confirm agent proposal from mobile executes and shows result**  ‹maps: mobile `TriageConfirmMobileTest`›
- **Given** a proposed Triage item is visible on Lorna's Home screen attention cards
- **When** she taps into Triage detail and taps **Confirm**
- **Then** the action executes; the item moves to History with `status = confirmed`; a success state is shown
- **And** financial/asset proposals require explicit individual confirm; bulk-auto is blocked on mobile as on web.

**AC4 — Expense approved/rejected from the Money tab**  ‹maps: mobile `ExpenseApprovalMobileTest`›
- **Given** a submitted expense is pending Toby's approval
- **When** Toby opens the **Money** tab and approves or rejects it
- **Then** the expense state updates accordingly (F17); the result is audited; the pay-queue glance reflects the change
- **And** Lorna receives an in-app (and push, if subscribed) notification of the outcome (F34).

**AC5 — Offline capture queues and syncs on reconnect without duplicates**  ‹maps: mobile `OfflineCaptureTest`›
- **Given** Lorna's device goes offline while she captures a quick event (F19)
- **When** connectivity is restored
- **Then** the queued capture uploads idempotently; exactly one record is created server-side
- **And** no duplicate is created if the upload retries; the sync state indicator clears.

**AC6 — Push notification deep-links to the correct screen**  ‹maps: mobile `PushDeepLinkTest`, `PushReminderTest`›
- **Given** Marcia is registered for push (APNs/FCM) and a task is assigned to her
- **When** the push notification arrives on her device
- **Then** tapping it deep-links directly to that task screen (correct property scope)
- **And** a reminder push similarly deep-links to the relevant reminder (F11); a since-resolved item shows a graceful "already actioned" state.

**AC7 — Role-scoped user cannot access out-of-scope data on mobile (negative)**  ‹maps: mobile `ScopedAccessTest`›
- **Given** Siti (Singapore-Staff) is using the app
- **When** she navigates to Bibles or Search
- **Then** she sees only Singapore data; no Wardian property, assets, or financial data appear in any screen, list, or search result
- **And** direct API calls for Wardian resources return 403/404 with no data leakage.

## 10. Test plan
Flutter widget/integration tests (capture, Triage confirm, approvals, offline queue); device matrix (iOS/Android); API contract tests shared with backend; push delivery test. (CI: GitLab + mobile runners — open Q.)

## 11. Observability & audit
Backend audit covers actions (same path); mobile: crash/analytics (Sentry), push delivery/open, capture success, offline-sync metrics.

## 12. Open questions
1. **Mobile CI** (GitLab runners vs Codemagic; iOS signing). 2. Offline scope (capture-only vs broader). 3. Android in v1 or iOS-first. 4. Generated-vs-handwritten Dart client (lean: handwritten, per web decision).
