# Feature F08 — Lists (household supplies)

| | |
|---|---|
| **Feature ID** | F08 |
| **Milestone** | M2 |
| **Domain** | Operations |
| **Status** | ✅ spec complete |
| **Depends on** | F03 (property), F02 (authz), F09 (vendor), F06 (order → task) |
| **Spec references** | SPEC §7.15, §3.10; `input/views/lists.jsx`, App. E.11 |

> **Decisions (revisitable):** recurring shopping/supply lists **per property**; **staff propose → Principal approves**; recurring items auto-add next cycle; **budget-trigger** + non-staple items require approval; **roll-forward on order day**; "Place order" creates a native task (F06) + optional calendar event; vendor ordering is **manual/link-out** in v1 (no vendor API).

## 1. Purpose & user value
Recurring household shopping the staff manage and the Principal controls: staff add what's needed, the Principal approves anything above staples or budget, the list closes on order day and rolls forward. Keeps supplies running without the Principal micromanaging, while keeping spend in view.

## 2. Roles & permissions
Resource `list` (+ `list_item`), property-scoped (F02): **Principal** `admin`; **Manager** `write` (manage lists, approve); **Staff** `write` to **propose** items on their property's lists + check off; approval is Principal/Manager only.

## 3. Data model
`V__lists.sql`:
- **`shopping_lists`** — `id, owner_id, property_id → properties, name, type ('grocery'|'supplies'), vendor_id uuid null → vendors, assignee_id uuid → users, cycle text (RRULE/preset), last_order date null, next_order date null, status ('active'|'archived'), created_at, deleted_at`.
- **`list_items`** — `id, list_id → shopping_lists, name, category text, qty int default 1, unit text null, status ('needs_approval'|'added'|'declined'), recurring bool default false, est_price_minor bigint null, currency text null, url text null (product/vendor link, e.g. an Amazon URL), note text null, checked bool default false, attributes jsonb default '{}' (freehand custom fields, F33), added_by uuid, approved_by uuid null, approved_at null, created_at`. Items support polymorphic **tags** + **taxonomies** (F33).

> **"We're out of X" requests:** a staff member proposes an item with a **product/vendor URL** (e.g. an Amazon link to *Dove Shower Gel*) + a **note** ("we're out") → it lands in *needs-approval* → the Principal approves → it joins the next order (and the order becomes a task, F06). This is the canonical ad-hoc "please buy this" flow.

## 4. API
`GET /api/lists` · `GET /:id` · `POST` · `PATCH` · `POST /:id/place-order` (roll forward + create native task) · `POST /:id/archive`.
`POST /api/lists/:id/items` (propose) · `PATCH /api/list-items/:id` (edit/check/toggle recurring) · `POST /api/list-items/:id/approve` · `/decline` · `DELETE`.

## 5. UI / screens & states
Per `lists.jsx` + App. E.11: lists rail (needs-approval badge) · list header (vendor/manager/last-order, **next-order countdown**, "Place order", "Open with vendor") · status chips (confirmed/need-approval/recurring) · **needs-approval strip** (Approve/Decline, requester, est. price, note) · inline add · items grouped by category (checkbox, recurring marker, per-item state). States: empty, needs-approval, ordering, rolled-forward.

## 6. Business rules & validation
- **Approval trigger**: a proposed item is `needs_approval` if non-recurring & new, or above a configurable price/budget trigger; recurring staples auto-`added`. Principal/Manager approve → `added`.
- **Roll-forward**: on `next_order`, "Place order" closes the cycle → recurring items carry into the next cycle (reset `checked`), one-offs drop, `last_order=today`, `next_order` advances per `cycle`, and a **native task** ("Order {vendor} — {property}") is created for the assignee (+ optional calendar event).
- **Scope**: staff see only their property's lists; budget triggers reference property budgets (F17).
- **No vendor API in v1**: ordering is a task + link-out.

## 7. Integrations
- **F06 tasks** (order task), **F07 calendar** (optional), **F09 vendors** (delivery vendor), **F17 budgets** (trigger thresholds). No external grocery API (manual/link).

## 8. Edge cases
- Recurring item declined → stops recurring. Order placed early/late → cycle recalculated. Vendor unset → order task without vendor link. Item edited after approval → re-approval if it crosses the trigger. Multi-currency est. prices.

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Staff propose; Principal/Manager approve**  ‹maps: `ListApprovalIT`, web `lists.spec` approval, mobile `lists_test.dart`›
- **Given** Marcia is on the Wardian grocery list
- **When** she proposes a new above-staple item ("Truffle oil, 250ml") with a product/vendor URL and note ("we're out")
- **Then** the item lands in `needs_approval` and the needs-approval strip is visible with requester/est. price/note
- **And** when Toby (or Lorna) approves, its status becomes `added` with `approved_by` and `approved_at` set, audited.

**AC2 — Recurring staples auto-populate the next cycle**  ‹maps: `ListRollForwardIT`, web `lists.spec` roll-forward›
- **Given** a grocery list with recurring items (e.g. milk, coffee) already checked off
- **When** "Place order" is executed
- **Then** recurring items carry forward into the new cycle with `checked = false`; one-off items drop
- **And** `last_order` is set to today, `next_order` advances per the cycle RRULE.

**AC3 — "Place order" creates a native order task (not an integration)**  ‹maps: `ListOrderTaskIT`, web `lists.spec` order-task›
- **Given** a Wardian grocery list assigned to Marcia
- **When** Lorna clicks **Place order**
- **Then** a native task ("Order Ocado — Wardian") is created for the assignee (F06, `source_type = 'list'`) — no external API is called
- **And** an optional calendar event is created alongside it; the task appears in the Tasks view with the list source flag.

**AC4 — Propose→approve→roll-forward full cycle**  ‹maps: `ListFullCycleIT`, web `lists.spec` e2e, mobile `lists_test.dart`›
- **Given** a list with both recurring staples and a pending approval item
- **When** the approval item is approved and then "Place order" is executed
- **Then** the cycle closes: the approved item is included in the order, recurring items carry over, next-order advances, and the order task is created
- **And** every state transition (propose/approve/order) is audited.

**AC5 — Declining a recurring item stops it recurring**  ‹maps: `ListDeclineRecurringIT`›
- **Given** a recurring item on the list (e.g. a specific brand that is being discontinued)
- **When** Toby declines it
- **Then** the item's `recurring` flag is cleared and it does not appear in the next cycle
- **And** the decline is audited with `declined_by`.

**AC6 — Singapore-scoped user sees only Singapore lists (negative)**  ‹maps: `ListScopeIT`, web `lists.spec` scope›
- **Given** Siti is Singapore-Staff
- **When** she lists household shopping lists
- **Then** she sees only Singapore lists
- **And** a direct request for a Wardian list ID returns **403/404** — existence not leaked; Wardian data is never exposed.

**AC7 — Agent list proposal is proposed, not auto-committed**  ‹maps: `ListAgentProposalIT`›  *(invariant: agent never auto-commits)*
- **Given** The Agent detects a low-stock condition and proposes a list item
- **When** the proposal arrives
- **Then** the item lands in `needs_approval` with `source_type = 'agent'`; it is **not** auto-approved or auto-ordered
- **And** the needs-approval strip is shown to the Manager/Principal for explicit approval before it joins an order.

## 10. Test plan
Backend (weaver+PG): approval triggers, roll-forward + cycle math, recurring carry-over, scope, order-task creation. Web: Vitest list/needs-approval rendering; Playwright propose→approve→order.

## 11. Observability & audit
Audit: item propose/approve/decline, order placed, list archive. Metrics: pending approvals, items/cycle, on-time orders.

## 12. Open questions
1. Budget-trigger config (per-list vs per-property). 2. `cycle` as RRULE vs presets. 3. Future vendor-ordering API integration. 4. Whether Manager can approve or only the Principal.
