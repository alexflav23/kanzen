# Feature F__ — <name>

| | |
|---|---|
| **Feature ID** | F__ |
| **Milestone** | M_ |
| **Domain** | <Identity / Properties / Assets / Finance / Agent / …> |
| **Status** | 📋 planned · ❓ questions open · ✍️ drafting · ✅ spec complete |
| **Depends on** | F__, F__ |
| **Spec references** | SPEC §_, Appendix _; `input/views/<file>.jsx` |

---

## 1. Purpose & user value
What this feature is, who it serves, and the value it delivers. 2–4 sentences.

## 2. Roles & permissions
Which roles can do what, expressed as permission-matrix cells (module × none/read/write/admin) and property scope. Note any Principal-private carve-outs.

## 3. Data model
Entities, fields (name · type · null? · default · constraint), relationships, indexes, and the migration(s) to create them. Call out `owner_id`, soft-delete (`deleted_at`), and audit coverage.

## 4. API (Tapir endpoints)
Each endpoint: method · path · auth · request (shape) · response (shape) · error cases. Note idempotency, pagination, and which are mobile-relevant.

## 5. UI / screens & states
Screens and their states (loading / empty / error / populated), key components (from the design system), validation, and copy notes. Reference the prototype file(s) and Appendix E.

## 6. Business rules & validation
The rules that must hold — invariants, computed values, state machines, thresholds, server-side validation.

## 7. Integrations / external systems
Any external system touched (Gmail, Calendar, open-banking, Bedrock, Cognito, SES, S3, TigerBeetle, 1Password, push). Adapter boundary, auth, failure handling. **Flag every operator-provided input (credentials, accounts, DNS, model access, secrets) and add it to `SETUP.md`.**

## 8. Edge cases
The hard cases to implement on purpose (concurrency, partial data, restructures, refunds, lapsed states, multi-currency, etc.).

## 9. Acceptance criteria
Testable statements ("Given… When… Then…") that define done.

## 10. Test plan
Unit / integration / e2e coverage; the specific scenarios that must be tested.

## 11. Observability & audit
What is logged, measured, and written to the append-only audit log.

## 12. Open questions / decisions
Anything still to confirm before or during implementation.
