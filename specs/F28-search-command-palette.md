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

## 9. Acceptance criteria
- **AC1** ⌘K opens instantly; empty state shows recents + permission-filtered quick actions; typing returns grouped, highlighted results; full keyboard nav works.
- **AC2** A semantic query ("watches serviced this year") returns relevant assets even without exact keyword match.
- **AC3** A typo ("Audemar Pigue") still finds "Audemars Piguet" (fuzzy).
- **AC4** A Manager's results exclude valuations/other-property data; a Staff member's are scope-limited — verified server-side.
- **AC5** A search can be saved and re-run; recents populate.
- **AC6** Quick actions are filtered to the actor's permissions; `>` forces command mode.

## 10. Test plan
Backend (weaver+PG+pgvector): blended ranking (keyword/fuzzy/semantic); **permission-filtered results** (Manager/Staff leak tests — critical); index freshness via outbox; saved searches; performance budget. Web: Vitest palette (recents/quick-actions/grouping/highlight/keyboard); Playwright ⌘K open→navigate→act, semantic + fuzzy queries, scoped-result assertions.

## 11. Observability & audit
Audit: saved-search CRUD; (search queries logged sans sensitive content for tuning). Metrics: palette latency, query volume, semantic-vs-keyword hit mix, zero-result rate, index lag, permission-filter drops.

## 12. Open questions
1. Embeddings scope — which entities get semantic vectors (assets/documents/transactions first?). 2. Index strategy — Postgres-only (FTS+trigram+pgvector) vs adding OpenSearch later at scale. 3. Quick-action catalog breadth. 4. NL → structured query (the F32 advanced layer) builds on this.
