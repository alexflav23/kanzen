# Feature F01 — Identity, auth & session

| | |
|---|---|
| **Feature ID** | F01 |
| **Milestone** | M1 |
| **Domain** | Identity |
| **Status** | ✅ spec complete |
| **Depends on** | F00 |
| **Spec references** | SPEC §4, §13, §15; `input/views/stubs.jsx` (Settings → Preferences/Permissions); login UI is new, built to §16 |

> **Decisions (this feature):** login methods = **email+password, Google Workspace SSO, Apple Sign in, passkeys/WebAuthn**; **custom in-app login UI** (not Cognito Hosted UI); **TOTP** MFA, enforced; **admin-invite-only** provisioning (no self-signup). Identity provider = **AWS Cognito** (F00).

---

## 1. Purpose & user value
Every person (Toby, Lorna, Marcia, Siti) signs in securely through a design-matched screen, with strong, phishing-resistant options, and lands in a session scoped to exactly what their role allows. One human = one canonical profile even with several login methods. The Principal can invite, suspend and reset users; everyone can see and revoke their own active sessions. This is the gate in front of the whole platform.

## 2. Roles & permissions
- **Self (any authenticated user):** view/edit own profile + preferences; view/unlink own login identities; list/revoke own sessions; manage own MFA/passkeys.
- **Principal (admin):** invite users, assign role + property scope (scope/role values consumed by F02), suspend/reactivate, resend invite, initiate MFA/passkey reset, list any user's sessions and force sign-out. User-management endpoints require `admin` on the **Settings/People** modules.
- **Manager/Staff:** no user-management. Manager may view People (F10) but not auth controls.
- Authorisation levels themselves live in F02; F01 only needs the `Principal == admin` gate for user management.

## 3. Data model
The platform owns the **canonical** identity; Cognito owns credentials. `V1_1_0__identity.sql`:

- **`users`** — `id uuid pk`, `owner_id uuid`, `display_name text`, `email citext unique not null`, `role text` (`principal`/`manager`/`staff`/`property_scoped_manager`), `status text` (`invited`/`active`/`suspended`), `primary_property_id uuid null`, `created_at timestamptz`, `updated_at timestamptz`, `deleted_at timestamptz null`.
- **`login_identities`** — `id uuid pk`, `user_id uuid → users`, `provider text` (`cognito_native`/`google`/`apple`/`passkey`), `cognito_sub text` (the Cognito user's `sub`), `provider_subject text null` (IdP subject), `email_at_link citext`, `created_at`, `last_used_at timestamptz null`. Unique `(provider, cognito_sub)`. A user has 1..n.
- **`user_preferences`** — `id uuid pk`, `user_id uuid unique → users`, `theme text` (`light`/`dark`/`system`, default `light`), `display_currency_mode text` (`native`/`gbp`, default `native`), `locale text` (default `en-GB`), `notifications jsonb`, `updated_at`.
- **`sessions`** — `id uuid pk`, `user_id uuid → users`, `login_identity_id uuid → login_identities`, `refresh_jti text unique`, `issued_at timestamptz`, `last_seen_at timestamptz`, `expires_at timestamptz`, `device text`, `user_agent text`, `ip inet`, `revoked_at timestamptz null`. Used for the "active sessions" list + revocation; keyed off the refresh-token `jti`.

Audit: invite/suspend/role-change/login/logout/MFA-reset all write `audit_log_entries`.

## 4. API (Tapir endpoints)
**The React/Flutter app authenticates with Cognito directly** (SRP / `USER_AUTH` / WebAuthn / federated OAuth) and obtains JWTs; the backend never proxies passwords. Backend endpoints validate the JWT (F00 middleware) and own profile/session/admin operations.

- `GET /api/me` — resolve `cognito_sub` → canonical user (+ role, scope, preferences, identities). **Lazy provisioning**: if the `sub` is unknown but a verified `email` matches an `invited` user, link a `login_identity` and flip to `active`.
- `PATCH /api/me/preferences` — theme, currency mode, locale, notifications.
- `GET /api/me/identities` · `DELETE /api/me/identities/:id` — list / unlink (cannot unlink the last identity).
- `GET /api/me/sessions` · `DELETE /api/me/sessions/:id` — list active / revoke one (revokes the Cognito refresh token + marks `revoked_at`).
- `POST /api/auth/logout` — global sign-out (Cognito `GlobalSignOut` + revoke all this user's sessions).
- **Admin (Principal):** `POST /api/users` (invite: email, display_name, role, scope → Cognito `AdminCreateUser`, suppress Cognito mail, send SES invite); `GET /api/users`; `PATCH /api/users/:id` (role/scope/status/display_name); `POST /api/users/:id/suspend` · `/reactivate`; `POST /api/users/:id/resend-invite`; `POST /api/users/:id/reset-mfa`.
- **Cognito triggers** (Lambda, IaC): `PreTokenGeneration` injects `role` + `user_id` claims (from the platform user) so the JWT carries identity; `PostConfirmation` is a no-op (provisioning is admin-driven + lazy-link).

## 5. UI / screens & states
Custom, built to §16 (the prototype has no login screen — this is new but in-language).

- **Sign-in screen**: 完 mark, email field → password (SRP) **or** a "Use a passkey" button (WebAuthn `USER_AUTH`), plus **"Continue with Google"** and **"Continue with Apple"** (federated OAuth redirect). States: idle / submitting / error (bad creds, locked, network) / MFA-challenge.
- **MFA screen**: TOTP 6-digit entry (on enrolment: QR + secret + verify). Enforced on first native sign-in.
- **First-run (post-invite)**: set password and/or register a passkey, then enrol TOTP.
- **Forgot password**: Cognito flow, design-matched.
- **Settings → Account** (extends `SettingsView`): profile, **theme** (⌘D mirror), display-currency mode; **Security**: MFA status + reset, registered **passkeys** (add/remove), **active sessions** list (device, last seen, IP) with revoke + "Sign out everywhere". (Prototype Preferences already shows "MFA required · all users", "Session · 4 hours".)
- **Settings → People/Users** (admin): invite (email, role, property scope), pending invites, suspend/reactivate, resend, reset-MFA.

## 6. Business rules & validation
- **Session cap 4 hours** (prototype): configure Cognito access-token validity short (≤1h) with refresh rotation; effective session expires at **4h** idle → auto sign-out. `sessions.expires_at` enforced server-side as a backstop.
- **MFA enforcement nuance** — enforced **TOTP** for `cognito_native` and `passkey`? Passkeys are phishing-resistant and **satisfy MFA on their own** (no separate TOTP prompt). **Federated** users (Google/Apple) rely on the **IdP's** MFA (Google Workspace 2SV / Apple 2FA) — Cognito does not apply its own MFA to federated identities; this is documented and acceptable, given kanzen.family enforces Workspace 2SV.
- **One canonical user**: federated/native identities sharing a verified email link to the same `users` row (never duplicate a person). Email is the linking key; links are auditable.
- **Invite-only**: no public sign-up; `AdminCreateUser` only. Unknown emails cannot self-register.
- **Suspended** users: token rejected at `/api/me` resolution (status check) even if the JWT is still valid; sessions revoked on suspend.
- **Last-identity guard**: a user must always retain ≥1 login identity.
- **Role assignment** is admin-only and audited; a user cannot change their own role.

## 7. Integrations / external systems
- **AWS Cognito** — user pool (F00) with: native email/password (SRP), **Google** + **Apple** OIDC identity providers, **WebAuthn/passkey** (USER_AUTH), **TOTP** MFA, `AdminCreateUser`, `AdminLinkProviderForUser` (or platform-level link), `GlobalSignOut`, refresh-token revocation, `PreTokenGeneration` Lambda. App ↔ Cognito via `amazon-cognito-identity-js`/AWS SDK (web) and the Flutter Cognito SDK.
- **AWS SES** — invite, password-reset, and security emails (Cognito mail suppressed in favour of design-matched SES templates).
- **Google Workspace / Apple** — OIDC providers configured in Cognito; consent + redirect URIs per env.

## 8. Edge cases
- Email/password user later signs in with Google (same verified email) → link, don't duplicate.
- Federated email unverified → do not auto-link; require admin confirmation.
- Lost authenticator (TOTP) → admin `reset-mfa`; user re-enrols.
- Lost passkey device → fall back to password+TOTP or admin reset.
- Invite accepted on two devices / double-activation → idempotent linking.
- Refresh-token revoked mid-session → next API call 401; app routes to sign-in.
- Clock skew on `exp` → small leeway in JWKS validation.
- Suspended mid-session → immediate effective logout.
- Concurrent role change while user active → next token (or `/me`) reflects new role; no stale-permission writes (F02 enforces server-side per request).

## 9. Acceptance criteria
- **AC1** A new user invited by the Principal receives an SES invite, sets a credential (password or passkey), enrols TOTP, signs in, and `GET /api/me` returns their canonical profile with role + scope.
- **AC2** Each of the four methods signs in successfully through the **custom** UI; Google/Apple via federated redirect; passkey via WebAuthn; email/password via SRP with a TOTP challenge.
- **AC3** Signing in with Google using an email that already exists as a native user links to the **same** `users` row (no duplicate).
- **AC4** A passkey sign-in does **not** additionally prompt for TOTP; an email/password sign-in **does**.
- **AC5** Session list shows active sessions; revoking one invalidates that refresh token; "Sign out everywhere" ends all; sessions auto-expire at 4h idle.
- **AC6** A suspended user is rejected even with an unexpired JWT.
- **AC7** Non-Principal cannot call any `/api/users*` admin endpoint (403).

## 10. Test plan
- **Backend** (weaver + testcontainers-PG, Cognito mocked/local): JWT validation (valid/expired/wrong-aud/wrong-iss) reusing F00 middleware; lazy-provision link-by-email; last-identity guard; suspended-user rejection; admin-only guard on `/api/users`; session revoke marks `revoked_at` and calls Cognito; preference update.
- **Web**: Vitest for the auth service (Zod boundary parsing of Cognito responses) + Theme+preference wiring; Playwright e2e for the sign-in screen states (password+TOTP happy path, bad creds, passkey button presence, federated buttons) against a Cognito local/dev pool.
- **Security**: enforced-MFA assertion for native users; passkey-satisfies-MFA assertion; token-from-suspended-user rejection.

## 11. Observability & audit
- Audit every: invite, activation, role/scope change, suspend/reactivate, login (method + identity), logout, session revoke, MFA enrol/reset, passkey add/remove. Actor + target + detail.
- Metrics: sign-in success/failure by method, MFA challenge rate, active-session count, invite→activation funnel.
- Logs: auth decisions (without secrets), JWKS cache refreshes.

## 12. Open questions / decisions
1. **Cognito local-dev** (inherited from F00) — confirm the local strategy for exercising SRP/WebAuthn/federation (dev pool vs LocalStack vs dev-mode issuer). WebAuthn + federation effectively need a real `dev` user pool.
2. **Passkey-as-sole-factor** — confirm passkeys satisfy MFA with no TOTP (recommended); or still require TOTP enrolment as a recovery factor even for passkey users.
3. **Apple Sign in** scope — web + Flutter both, or iOS-app only initially (Apple review nuances).
4. **Session length per role** — 4h for all (prototype), or shorter for Staff / longer for Principal on trusted devices.
