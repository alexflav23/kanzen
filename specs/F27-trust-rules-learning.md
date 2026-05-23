# Feature F27 — Trust model, rules engine & learned categorisation

| | |
|---|---|
| **Feature ID** | F27 |
| **Milestone** | M6 |
| **Domain** | Agent |
| **Status** | ✅ spec complete |
| **Depends on** | F25 (agent), F13 (learned engine + pgvector), F14/F23 (suggestions) |
| **Spec references** | SPEC §10.3, §10.4, §0 (v6.3); `input/views/triage.jsx → Trust settings`, App. E.3/E.14 |

> **Decisions (made):** per-category **trust** (review/auto; **financial & asset categories locked to review**, cannot be auto); a **deterministic rules engine** (merchant→category, line-item→asset-category, match suggestions, service-vs-acquisition inference, reminder suggestions, duplicate heuristics); and the **learned categorisation engine** (rules → **pgvector** history retrieval → **Claude**, v6.3) — configured and tuned here, learning from confirmations. Everything **auditable and overridable**.

## 1. Purpose & user value
The dial between automation and control. Decide what the agent may do without asking, codify deterministic shortcuts, and let the system learn the household's categorisation from every confirmation — while keeping money and asset creation firmly human-gated.

## 2. Roles & permissions
Resource `settings.trust`/`settings.rules` — **Principal** `admin`; **Manager** `read` (and can override individual suggestions in-flow). Financial-category auto-routing is **hard-disabled** for everyone.

## 3. Data model
`V__trust_rules.sql` (+ reuses F13 `line_item_memory`):
- **`trust_settings`** — `id, owner_id, category text, routing ('review'|'auto'), locked bool, note`. Financial/asset categories seeded `locked=true, routing='review'`.
- **`rules`** — `id, owner_id, kind ('merchant_category'|'line_item_asset_category'|'match_suggestion'|'cost_inference'|'reminder_suggestion'|'duplicate_heuristic'), condition jsonb, action jsonb, priority int, active bool, created_by, created_at`.
- **`sender_rules`** — deterministic email routing (sender/subject → category/handling).
- **Learned store** = `line_item_memory` (F13) + tunable **confidence thresholds** per category (auto-apply cutoffs).

## 4. API
`GET/PUT /api/trust-settings` (financial locked server-side) · `GET/POST/PATCH/DELETE /api/rules` · `POST /api/rules/test` (dry-run a rule against history) · `GET/PUT /api/categorisation/config` (confidence thresholds) · the `POST /api/categorisation/suggest` engine (F13) reads rules + memory + Claude.

## 5. UI / screens & states
- **Triage → Trust settings** (App. E.3): per-category **Review/Auto** segmented control; **financial/asset rows disabled** with a note ("Financial categories cannot be auto-executed").
- **Settings → Rules engine** (App. E.14, to build): list/create/edit rules by kind, priority, active toggle, **test-a-rule**; confidence-threshold sliders for auto-apply.
- States: clean/unsaved, rule-conflict warning, test results.

## 6. Business rules & validation
- **Trust**: `auto` only for non-financial, non-asset categories; financial/asset **locked** (enforced server-side regardless of UI).
- **Rules**: deterministic, **most-specific/priority wins**, inspectable, overridable; applied as Layer 1 of the suggestion engine (F13).
- **Learned layer**: confirmations write `line_item_memory`; suggestions = rules → history retrieval → Claude, each with confidence + source; **auto-apply only above the per-category threshold** and never for financial/asset creation.
- **Auditable**: rule changes, trust changes, and auto-applied suggestions are all logged; suggestions remain overridable in-flow.

## 7. Integrations
F25 (agent routing), F13 (categorisation engine + memory), F14 (match suggestions), F23 (duplicate/anomaly heuristics), F02 (who can edit).

## 8. Edge cases
Attempt to set a financial category to auto (rejected). Conflicting rules (priority resolution). Rule that would mis-route money (guarded). Learned suggestion conflicting with a rule (rule wins as Layer 1, but low-confidence rule vs high-confidence history → surface both). Threshold too aggressive → more auto-applies (tune). Cold start.

## 9. Acceptance criteria
- **AC1** A non-financial category can be set to `auto`; **Bill/Invoice and asset categories cannot** (UI disabled + server-enforced).
- **AC2** A merchant→category rule auto-suggests correctly and is overridable; testing the rule against history previews matches.
- **AC3** Raising a category's confidence threshold changes how often suggestions auto-apply (non-financial only).
- **AC4** Every trust/rule change and auto-applied suggestion is audited.
- **AC5** Learned suggestions (F13) respect rules as Layer 1 and never auto-create financial/asset records.

## 10. Test plan
Backend (weaver+PG): financial-lock enforcement; rule precedence/conflict; rule dry-run; threshold→auto-apply behaviour; rule-vs-learned precedence; audit. Web: Vitest trust settings (locked rows) + rules editor; Playwright set-auto (allowed/blocked) + test-a-rule.

## 11. Observability & audit
Audit: trust + rule + threshold changes, auto-applied suggestions. Metrics: auto vs review ratio, rule hit rates, suggestion source mix + acceptance (the learning signal), threshold effectiveness.

## 12. Open questions
1. Default per-category confidence thresholds (§19 #6 inference aggressiveness). 2. Rule expressiveness (simple conditions vs a small DSL). 3. Whether Managers can edit rules or only the Principal.
