# Merchant Tenant Picker

Date: 2026-07-10
Status: Task 009 implemented. No migration and no session table.

## Use Case

When one merchant identity can manage more than one tenant, BookingOS must not silently choose the first store. Password login now returns a short-lived selection token and the login page renders a tenant picker.

## Login Flow

```text
POST /merchant-login
-> password verified
-> tenant_admins matched
-> multiple tenants found
-> verify all rows share one active identity_id
-> create signed tenant selection token
-> return TENANT_SELECTION_REQUIRED
-> browser renders tenant picker
-> POST /merchant-select-tenant
-> DB revalidates identity + tenant_admin + tenant
-> issue signed merchant session
```

Single-tenant login still issues the normal signed merchant session directly.

## Selection Token Payload

```json
{
  "v": 1,
  "purpose": "merchant_tenant_selection",
  "sub": "identity_id",
  "tenant_ids": ["tenant-a", "tenant-b"],
  "iat": 1234567890,
  "exp": 1234568190,
  "nonce": "random"
}
```

The token uses HMAC-SHA256 with `MERCHANT_SESSION_SECRET`. The `purpose` field prevents the token from being accepted as a merchant session. If the selection token is used as `bookingos_merchant_session`, the session validator rejects it because required session fields are missing.

## TTL

Default TTL is 300 seconds.

```text
MERCHANT_TENANT_SELECTION_TTL_SECONDS=300
```

Accepted range: 60 to 900 seconds.

## API

### `POST /merchant-login`

Multi-tenant response:

```json
{
  "success": false,
  "error": {
    "code": "TENANT_SELECTION_REQUIRED",
    "message": "Please choose a store to manage."
  },
  "data": {
    "selection_token": "signed-token",
    "expires_in": 300,
    "tenants": [
      { "tenant_id": "tenant-a", "tenant_name": "A Store", "role": "TenantOwner" }
    ]
  }
}
```

No merchant session cookie is issued in this response.

### `POST /merchant-select-tenant`

Request:

```json
{
  "selection_token": "signed-token",
  "tenant_id": "tenant-a",
  "next": "/merchant"
}
```

Success response issues a signed merchant session cookie and returns a redirect path.

## UI Behavior

The merchant login page intercepts password login with `fetch`. If the response is `TENANT_SELECTION_REQUIRED`, it renders the tenant picker in the same page.

- The token stays only in page memory.
- The token is not written to Local Storage.
- The token is not placed in the URL.
- The user does not re-enter password.
- Buttons are disabled while selecting a tenant.
- Expired token asks the user to login again.

## DB Revalidation

`POST /merchant-select-tenant` does not trust front-end `tenant_id` alone. It verifies:

1. Token signature.
2. Token purpose.
3. Token version.
4. Token issued and expiry time.
5. Requested tenant is in token `tenant_ids`.
6. `identities` row is active.
7. `tenant_admins` row is active.
8. `tenants` row is active or trial.
9. Final role comes from DB, not from the token.

## Security Limits

V1 does not store nonces server-side, so a selection token can theoretically be reused during its short TTL. Reuse still revalidates DB permission and only overwrites the merchant session for one of the allowed tenants.

This task intentionally does not implement post-login tenant switching.

## Error Codes

- `TENANT_SELECTION_REQUIRED`
- `TENANT_SELECTION_TOKEN_INVALID`
- `TENANT_SELECTION_TOKEN_EXPIRED`
- `TENANT_SELECTION_NOT_ALLOWED`
- `TENANT_SELECTION_PRINCIPAL_INVALID`

## Rollback

1. Roll back the Worker version.
2. Keep `MERCHANT_SESSION_SECRET`; it is also required by Task 008.
3. No DB rollback is needed because this task adds no migration.

## Not Changed

- LIFF Login.
- Customer Login.
- Platform Login.
- Booking flow.
- Session table or database schema.

## Test Results

Local D1 test data used only `test-task009-*` rows and was deleted after testing.

- Multi-tenant login returns `TENANT_SELECTION_REQUIRED` with a selection token.
- Multi-tenant login does not set `bookingos_merchant_session`.
- Tenant list contains 2 allowed local test tenants.
- `POST /merchant-select-tenant` creates a signed merchant session.
- Selected tenant dashboard returns 200.
- Cross-tenant dashboard returns 403.
- Tampered selection token returns 401.
- Expired selection token returns 401.
- Wrong purpose token returns 401.
- Tenant outside token `tenant_ids` returns 403.
- Selection token used as merchant session cookie returns 401.

## Deployment Result

- Date: 2026-07-10
- Worker Version ID: `99804da2-7c0f-432c-83e3-5f36e84dbd3c`
- Production URL: `https://bookingos.fangwl591021.workers.dev`
- D1 backup: `.local-backups/bookingos-db-pre-tenant-picker-20260710.sql`
- Remote D1 migrations: No migrations to apply.
- Secret gate: `MERCHANT_SESSION_SECRET` exists.
- TTL var: `MERCHANT_TENANT_SELECTION_TTL_SECONDS=300`.

## Live Smoke Results

- `/api/health`: 200.
- `/merchant-login`: 200 and includes tenant picker script.
- Single-tenant merchant login: 302 with signed merchant session cookie.
- Selected tenant dashboard: 200.
- Mismatched tenant: redirected to merchant login with `TENANT_SCOPE_MISMATCH`.
- Bad selection token: 401.
- Bad merchant session cookie: rejected.
- Remote Task 009 test rows: 0.

## Task 010 LIFF Reuse

Merchant LIFF multi-tenant login reuses this picker. Selection tokens created from LIFF include auth_provider LINE metadata, but final tenant access is still revalidated from DB before issuing the signed merchant session.
