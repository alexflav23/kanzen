# Feature F28 — Search & ⌘K command palette (advanced)

| | |
|---|---|
| **Feature ID** | F28 |
| **Milestone** | M7 |
| **Domain** | Platform |
| **Status** | ✅ spec complete |
| **Depends on** | F04 (assets) + every domain (searchable), F02 (permission-filtered), F13 (embeddings infra/pgvector) |
| **Spec references** | SPEC §13; `input/views/search.jsx`, App. E.16 |

> **Decisions (revisitable):** a **beautiful, keyboard-first ⌘K command palette** (navigate + act) over the *whole* corpus, **plus an Advanced Search** experience — blended **full-text (Postgres tsvector) + fuzzy (trigram) + semantic (pgvector)** so natural-language-ish queries work ("watches serviced this year", "insurance documents"); **permission-filtered** results (never leak); **saved searches** + **recents**. Reuses the F13 Bedrock-embeddings + pgvector infra.

## 1. Purpose & user value
Find anything and do anything in two keystrokes. ⌘K is the spine of the product's "quiet, fast, predictable" feel — jump to an asset, log an expense, open Triage, toggle theme — while Advanced Search answers real questions across assets, finance, documents, people and tasks, respecting exactly what each person may see.

## 2. Roles & permissions
Every result is **filtered by F02** (resource/field level + property scope) at query time — a Manager's search never returns valuations or other-property data; Staff search only their scope. Quick actions are filtered to what the actor may do.

## 3. Data model
`V__search.sql` (+ pgvector):
- **`search_index`** — a denormalised, permission-aware projection: `entity_type, entity_id, owner_id, property_id null, title, subtitle, keywords text, fts tsvector, embedding vector(N) null, sensitivity ('household'|'principal'|field-tags), updated_at`. One row per searchable entity (asset, property, person, vendor, bill, expense, document, collection, task, inbox item, …). GIN on `fts`, trigram on `title/keywords`, HNSW on `embedding`.
- Refreshed via an **outbox/trigger** on entity writes (eventually-consistent, with last-sync surfaced).
- **`saved_searches`** — `id, owner_id, name, query text, filters jsonb, created_at`. **`recent_items`** — per-user MRU (entity refs + actions).

## 4. API
- `GET /api/search/suggest?q=` — palette: blended ranked top-N grouped by type + matched **quick actions** + **recents** (fast, permission-filtered).
- `GET /api/search?q=&type=&property=&filters=&mode=keyword|semantic|blended&page=` — Advanced Search (facets, ranking, highlight offsets).
- `GET /api/search/quick-actions` — the action catalog (permission-filtered). `GET/POST/DELETE /api/saved-searches`. `GET /api/recents`.

## 5. UI / screens & states
- **⌘K palette** (`search.jsx`, App. E.16) — the beautiful core: centered overlay (`modalIn`, scrim, `--shadow-pop`), large search input + `esc` chip; **empty state** = **Recents** + **Quick actions** (Add property, Add maintenance plan, Log expense, Open Triage, Toggle theme — each with a key hint `⌘D` etc.); **typing** = results **grouped by type** (Property/Person/Vendor/Bill/Expense/Asset/Document/Collection/Inbox/Task) with type icons, **highlighted matches**, subtitle context; **full keyboard** (↑/↓ move, ↵ open, ⌘↵ secondary action, ⌘1–9 jump groups); footer "Index includes tasks & email · last sync N min ago". Command-vs-search disambiguation (a leading `>` forces command mode). StyleX-driven, light/dark, buttery motion.
- **Advanced Search view**: query bar + **facets** (type, property, category, tag, date, status), **semantic toggle**, highlighted results, **save this search**, saved-searches rail. 
- States: idle/recents, typing/loading (debounced), results, no-matches ("No matches for …"), scoped-empty.

## 6. Business rules & validation
- **Blended ranking**: keyword (tsvector rank) + fuzzy (trigram similarity, typo-tolerant) + **semantic** (pgvector cosine over Bedrock embeddings) → a combined score; semantic helps NL queries, keyword/fuzzy helps exact/typo. Mode selectable; default blended.
- **Permission filtering at query time** (not just UI): `search_index.sensitivity` + F02 + property scope ensure no leak (e.g. valuations excluded for Manager); aggregates never reveal hidden data.
- **Freshness**: index updated on write (outbox); surface "last sync"; tolerate slight lag.
- **Quick actions** respect permissions (a Staff member won't see "Log expense").
- **Performance**: sub-150ms palette suggest target; debounce; cap result groups.

## 7. Integrations
Indexes every domain (F03–F27); **pgvector + Bedrock embeddings** (F13 infra) for semantic; F02 for filtering; the palette is mounted in the F00 app shell (top bar ⌘K).

## 8. Edge cases
Permission-aware ranking (don't rank by hidden fields); semantic false-positives (blend + threshold); stale index after bulk import; huge corpus pagination; multi-word/typo; scoped user; command vs search ambiguity; entity deleted but indexed (tombstone); embeddings model change (re-embed).

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — ⌘K opens with recents and permission-filtered quick actions; keyboard nav works**  ‹maps: `PaletteOpenIT`, web `search.spec` palette-open`›
- **Given** Toby is on any page
- **When** he presses ⌘K
- **Then** the palette overlay opens instantly (< 150 ms); the empty state shows his recent items and quick actions (Add property, Log expense, Open Triage, Toggle theme)
- **And** ↑/↓ moves selection, ↵ opens the item, ⌘1–9 jumps groups, ⌘↵ triggers the secondary action, Esc closes.

**AC2 — Semantic query returns relevant results without exact keyword match**  ‹maps: `SemanticSearchIT`, web `search.spec` semantic›
- **Given** Toby has assets with service events logged under "Rolex Datejust — polished bezel"
- **When** he types "watches serviced this year" in the palette
- **Then** the Rolex asset appears in the results despite no literal keyword match
- **And** the blended ranker's semantic score drives placement; the result is permission-filtered (no results Toby cannot see).

**AC3 — Fuzzy matching recovers from typos**  ‹maps: `FuzzySearchIT`, web `search.spec` fuzzy›
- **Given** an asset named "Audemars Piguet Royal Oak" in the registry
- **When** Toby types "Audemar Pigue"
- **Then** the asset surfaces in results (trigram similarity)
- **And** the matched segment is highlighted in the result row.

**AC4 — Search and aggregates are permission- and scope-filtered server-side (negative)**  ‹maps: `SearchPermissionIT`, web `search.spec` scope-leak›  *(invariant: search, aggregates and NL queries are permission/scope-filtered server-side — no leak via totals)*
- **Given** Lorna (Manager) and Marcia (Wardian-Staff) each issue a search
- **When** Lorna queries for assets with valuations and Marcia queries for any Singapore data
- **Then** Lorna's results exclude valuation fields (stripped server-side); Marcia's results contain no Singapore entities and no count/aggregate hints their existence
- **And** the `search_index.sensitivity` + F02 filtering is verified at the query layer, not only in the UI.

**AC5 — Saved searches persist and re-run; recents populate**  ‹maps: `SavedSearchIT`, web `search.spec` saved-search›
- **Given** Toby runs an Advanced Search for "insurance documents, property=Singapore"
- **When** he clicks **Save this search**
- **Then** it appears in the saved-searches rail and can be re-run
- **And** recently visited assets appear in the palette empty state on next open.

**AC6 — Quick actions are permission-filtered; `>` forces command mode**  ‹maps: `QuickActionAuthzIT`, web `search.spec` quick-actions›
- **Given** Marcia (Staff) opens ⌘K
- **When** the empty state renders
- **Then** "Log expense" and "Add property" are absent from her quick actions (she has no permission)
- **And** typing `>` switches to command mode (filtered command catalog); typing a plain string returns search results.

**AC7 — Stale-index is surfaced; deleted entities do not appear**  ‹maps: `IndexFreshnessIT`, web `search.spec` stale-index›
- **Given** an asset is soft-deleted and the index has not yet been refreshed
- **When** Toby searches for it
- **Then** the index refresh (outbox trigger) removes the tombstoned entity; the footer "last sync N min ago" is accurate
- **And** once refreshed, the entity does not appear in any results.

## 10. Test plan
Backend (weaver+PG+pgvector): blended ranking (keyword/fuzzy/semantic); **permission-filtered results** (Manager/Staff leak tests — critical); index freshness via outbox; saved searches; performance budget. Web: Vitest palette (recents/quick-actions/grouping/highlight/keyboard); Playwright ⌘K open→navigate→act, semantic + fuzzy queries, scoped-result assertions.

## 11. Observability & audit
Audit: saved-search CRUD; (search queries logged sans sensitive content for tuning). Metrics: palette latency, query volume, semantic-vs-keyword hit mix, zero-result rate, index lag, permission-filter drops.

## 12. Open questions
1. Embeddings scope — which entities get semantic vectors (assets/documents/transactions first?). 2. Index strategy — Postgres-only (FTS+trigram+pgvector) vs adding OpenSearch later at scale. 3. Quick-action catalog breadth. 4. NL → structured query (the F32 advanced layer) builds on this.
