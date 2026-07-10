# Merchant LIFF Identity Login

Status: Task 010 implemented.

## Goal

Merchant LIFF login now resolves through verified LINE authentication and BookingOS IdentityAuth. It no longer trusts a front-end supplied `line_user_id`, no longer uses `platform_line_contacts` for merchant authorization, and no longer creates a legacy tenant-only cookie.

## Flow

1. Merchant login page initializes LIFF.
2. Browser calls `liff.getIDToken()`.
3. Browser posts `id_token`, optional `tenant`, and `next` to `POST /api/merchant/liff-login`.
4. Worker verifies the token with LINE using the configured LINE Login Channel ID.
5. Worker resolves `identity_auth` using scoped provider `LINE:<channel_id>` and verified LINE subject.
6. If no IdentityAuth exists, Worker can safely bootstrap from active `tenant_admins.line_user_id` rows that match the verified LINE subject.
7. Worker loads active merchant roles from `tenant_admins.identity_id`.
8. One tenant creates a signed merchant session.
9. Multiple tenants return `TENANT_SELECTION_REQUIRED` and reuse the Task 009 tenant picker.

## Token Verification

Primary method: LINE ID Token verify endpoint.

The Worker verifies:

- token exists
- LINE verification endpoint accepts it
- `aud` matches the configured LINE Login Channel ID
- issuer is `https://access.line.me` when provided
- token is not expired
- `sub` exists

The endpoint also supports access token verification as a fallback, but the page sends ID Token by default.

## Provider Scope

The IdentityAuth provider is scoped by LINE Login Channel:

```text
provider = LINE:<channel_id>
provider_uid = <verified LINE subject>
```

Provider metadata stores only a hashed LINE subject plus display snapshot. Raw LINE tokens are never stored.

## IdentityAuth Resolution

Existing row:

```text
identity_auth(provider, provider_uid) -> identity_id -> identities.active
```

Missing row:

- Search active `tenant_admins.line_user_id` by the verified LINE subject.
- If none: return `LIFF_IDENTITY_LINK_REQUIRED`.
- If existing linked identity conflicts: return `LIFF_IDENTITY_INVALID`.
- Otherwise create IdentityAuth and link unlinked tenant_admin rows to the identity.

`platform_line_contacts` is not used for merchant authorization.

## Tenant Resolution

Merchant roles come from:

```sql
tenant_admins
WHERE identity_id = ?
```

If the LIFF URL provides `tenant`, it must match an active tenant_admin row for that identity. A wrong tenant returns `TENANT_SELECTION_NOT_ALLOWED`.

## Session

Single tenant:

- Creates Task 008 signed merchant session.
- Redirects to `/merchant?...tenant=<tenant_id>`.

Multiple tenants:

- Does not create a session yet.
- Returns Task 009 `TENANT_SELECTION_REQUIRED` with a short-lived selection token.
- Selection token includes `auth_provider: LINE`.

## Error Codes

- `LIFF_TOKEN_REQUIRED`
- `LIFF_TOKEN_INVALID`
- `LIFF_TOKEN_EXPIRED`
- `LIFF_AUDIENCE_INVALID`
- `LIFF_PROVIDER_SCOPE_INVALID`
- `LIFF_IDENTITY_LINK_REQUIRED`
- `LIFF_IDENTITY_INVALID`
- `LIFF_MERCHANT_ACCESS_DENIED`
- `TENANT_SELECTION_REQUIRED`
- `TENANT_SELECTION_NOT_ALLOWED`

## Feature Flag

```env
MERCHANT_LIFF_IDENTITY_LOGIN_ENABLED=true
```

When false, `POST /api/merchant/liff-login` returns disabled and does not fall back to the legacy UID login path.

## Security Notes

- The endpoint does not accept raw `line_user_id` as proof of login.
- The endpoint does not use `platform_line_contacts` for merchant auth.
- The endpoint does not create tenant-only cookies.
- The endpoint does not store ID tokens or access tokens.
- Logs hash sensitive LINE identifiers.

## Verification

Local and live tests should include:

- missing token rejected
- invalid token rejected
- wrong tenant rejected
- merchant login page still renders
- password merchant login still works
- tenant picker still works
- no pending D1 migrations

A real LIFF smoke test requires a live LINE ID Token from the configured LIFF app.

## Deployment Result

- Date: 2026-07-10
- Worker Version ID: `d8551d2a-6811-45da-8324-ce5686bde9b4`
- Production URL: `https://bookingos.fangwl591021.workers.dev`
- D1 backup: `.local-backups/bookingos-db-pre-merchant-liff-identity-20260710.sql`
- Remote D1 migrations: No migrations to apply.
- Secret gate: `MERCHANT_SESSION_SECRET` exists.
- LINE config gate: Platform LINE Login Channel ID and Login LIFF ID are configured.
- Feature flag: `MERCHANT_LIFF_IDENTITY_LOGIN_ENABLED=true`.

## Live Smoke Results

- `/api/health`: 200.
- `/merchant-login`: 200.
- Login page contains `getIDToken` and posts `id_token`.
- Missing token rejected.
- Invalid ID Token rejected with `401 LIFF_TOKEN_INVALID`.
- Password merchant login still returns signed cookie.
- Merchant dashboard with signed cookie returns 200.

Real LIFF success-path smoke requires a live LINE ID Token from the configured LIFF app.
