# Feature F31 — Flutter companion (mobile)

| | |
|---|---|
| **Feature ID** | F31 |
| **Milestone** | M9 |
| **Domain** | Mobile |
| **Status** | ✅ spec complete |
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

## 9. Acceptance criteria
- **AC1** Sign in (incl. biometric/passkey); the tab bar reflects the user's role.
- **AC2** Capture a receipt photo → uploads → OCR proposal appears in Triage.
- **AC3** Confirm/reject an agent proposal and approve/reject an expense from mobile.
- **AC4** Offline captures queue and sync on reconnect (no duplicates).
- **AC5** A push reminder deep-links to the right screen; light/dark match web.

## 10. Test plan
Flutter widget/integration tests (capture, Triage confirm, approvals, offline queue); device matrix (iOS/Android); API contract tests shared with backend; push delivery test. (CI: GitLab + mobile runners — open Q.)

## 11. Observability & audit
Backend audit covers actions (same path); mobile: crash/analytics (Sentry), push delivery/open, capture success, offline-sync metrics.

## 12. Open questions
1. **Mobile CI** (GitLab runners vs Codemagic; iOS signing). 2. Offline scope (capture-only vs broader). 3. Android in v1 or iOS-first. 4. Generated-vs-handwritten Dart client (lean: handwritten, per web decision).
