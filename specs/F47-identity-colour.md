# F47 — Identity colour (a person *is* their colour)

**Status**: 🟡 Spec — 2026-05-30. Small, visible, and immediate. Independent of multi-tenancy (works under both single and multi-tenant; the colour column lives on the user row regardless).

**Reads as**: each person picks a colour on their profile; that colour becomes a **rounded glow ring** around their avatar everywhere they appear; by looking at the glow you know who it is.

---

## 1. The "why"

Today every `<Avatar>` is a soft accent-on-paper circle with initials — Lorna and Marcia look identical at a glance in a busy inbox row. The user wants identity to be visually instantaneous: *a person is their colour*. The same colour shows up on a comment, an assignee chip, a calendar event chip, a mention chip — so the eye tracks "who" without reading text.

## 2. Design

### 2.1 The mechanic
- **User-picked**, stored on their user/profile.
- Rendered as a **rounded glow ring** around their `<Avatar>` (a soft box-shadow at the avatar's hue, slight blur, ~6-10px reach). NOT a solid fill — initials stay the same on warm-paper bg so contrast is unchanged.
- Used **everywhere a person appears**: `<PersonAvatar>` (already droppable everywhere), `<CollabPanel>` comment author tint, thread-list assignee dot, calendar event "assigned by" left-border, future DMs.

### 2.2 The palette
Twelve curated colours, perceptually-spaced (OKLCH-derived), each pre-checked for **AA contrast of `ink` on the bg** so the glow doesn't bleed into text legibility, light + dark theme. The picker shows them as swatches; a custom hex input is allowed but validated for AA contrast before save.

The twelve hues:
- `coral`, `amber`, `gold`, `lime`, `mint`, `teal`, `azure`, `indigo`, `violet`, `magenta`, `rose`, `slate`.

Each hue: `{ lightBg, lightGlow, darkBg, darkGlow }` precomputed hex. Glow values are at ~0.55 opacity so they sit gently over the bg.

### 2.3 Defaults
On user creation: auto-pick by hashing `userId` into the palette (`hash % 12`). So *day-one*, every user already has a visually distinct colour without anyone having opened settings.

## 3. Data model

```sql
-- V3_9_0: a personal colour token per user.
alter table users add column if not exists colour text not null default '';
-- Format: either a palette key ("indigo") or a custom hex ("#A45B6E"). Validated server-side.
```

Why on `users` and not `employment_records` (Person/HR)? Because the colour is identity of the *login user*, not of the HR record (Toby's principal-self and Toby's impersonated-Lorna are both "Toby" actions in the eyes of the audit log, but the rendered colour follows the **active user** — that's the login).

## 4. Backend

- **`PATCH /api/me/colour`** `{ colour: string }` (palette key OR hex). Validates: palette key in the canonical list OR a hex that clears AA contrast against the ink colour of the current theme. 422 otherwise.
- **`GET /api/me`** already returns the user row; extend `Me` with `colour`.
- **Listings**: `GET /api/people` (and any "users" listing) returns the colour per row so the UI can render without an extra lookup. Cached client-side via a small `usersById` map alongside `peopleById`.

## 5. Frontend

### 5.1 The picker
A "Profile → Colour" section on the People-detail page (the existing `/people/:id` route), available to the user editing themselves and to the principal editing anyone. Twelve swatches + a "Custom" input with a live preview against a sample comment row.

### 5.2 The renderer
- `<Avatar glow={hex}>`: extends the existing `<Avatar>`. When `glow` is set, adds a `box-shadow: 0 0 0 2px <hex_alpha_0.7>, 0 0 12px 2px <hex_alpha_0.45>` ring (precise values tuned for both themes — see palette tokens below).
- `<PersonAvatar>` consumes `glow` from a lookup map (`usersById[id].colour → palette.resolve(theme)`).
- A small `palette.ts` resolves both palette keys and custom hexes to the right theme variant.

### 5.3 Where it shows up (day-one wiring)
- `<PersonAvatar>` — all current usages: Inbox thread row (assignee), thread detail header (assignee), Tasks (assignee), Calendar event chip (when assigned).
- `<CollabPanel>` — the avatar next to each comment.
- `<MentionChip>` — a thin border in the mention's owner colour (in addition to the existing accent-soft bg). Subtle, so accent doesn't fight.

### 5.4 A11y
- Glow alone is **not** information. Names are always present. The colour is a fast hint, not the only signal. Axe/a11y is unaffected.
- `prefers-reduced-motion` doesn't apply (no animation). For users with custom hexes failing AA, the picker prevents the save. Edge case: a third party's custom hex still renders, but its contrast was validated at save time.

## 6. Tests

- **`UserColourIT`**: PATCH colour with a palette key → persisted. PATCH with a sub-AA hex → 422. Listing returns it. Default population on user create: a hash-derived key.
- **`Avatar.test`** (vitest): `<Avatar glow="#AB1234"/>` renders the box-shadow rule.
- **Vitest for picker**: clicking a swatch calls the mutation; custom hex with bad contrast disables Save.

## 7. Out of scope

- Per-tenant *theme* customisation (different from per-user colour). Tenants get the warm-paper theme; identity colours overlay it.
- Animated identity (pulse on @mention etc.). Could be added later if useful; not now.
- Custom colour migration across themes — the same hex is reused with theme-specific alpha; OKLCH-based theme adaptation is overkill for ~12 users per tenant.
