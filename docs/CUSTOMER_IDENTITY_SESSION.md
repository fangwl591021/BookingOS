# Customer Identity and Signed Customer Session

Date: 2026-07-10
Status: Task 011 implementation in progress.

## Boundary

Identity proves who the person is on BookingOS. Customer is the tenant-owned member profile. Customer CRM, points, tags, booking history, birthday, address, service notes and consumption data stay on `customers` and related tenant tables.

The customer session does not contain phone, email, LINE UID, birthday, address, points, CRM note, token or secret.

## Customer LIFF Login

Entry:

```text
/member-login?tenant=<tenant_id>&next=/member
```

Flow:

```text
LINE LIFF -> liff.getIDToken() -> POST /api/customer/liff-login
-> LINE verify endpoint -> scoped identity_auth -> identities
-> customers WHERE tenant_id + identity_id -> signed customer session
```

The server never trusts a front-end supplied `line_user_id`. If the IdentityAuth row is missing, first login creates a new Identity and a scoped LINE IdentityAuth. It does not merge by phone, email or display name.

## Customer Resolution

The read path is:

```sql
SELECT * FROM customers
WHERE tenant_id = ?
  AND identity_id = ?
```

If no Customer exists, the Worker creates one for that tenant only. The initial display name can come from LINE profile snapshot, but it remains editable Customer data.

If the same tenant has multiple Customers for one identity, login fails with `CUSTOMER_PROFILE_CONFLICT`.

## Signed Customer Session

Cookie name:

```text
bookingos_customer_session
```

Payload:

```json
{
  "v": 1,
  "sub": "identity_id",
  "tenant_id": "tenant_id",
  "customer_id": "customer_id",
  "role": "Customer",
  "iat": 1783650000,
  "exp": 1784254800
}
```

Cookie flags:

```text
HttpOnly; Secure; SameSite=Lax; Path=/
```

Validation rechecks identities, tenants and customers from D1 on every protected customer request.

Required production env:

```text
CUSTOMER_SESSION_SECRET=<Cloudflare Secret>
CUSTOMER_SESSION_TTL_SECONDS=604800
CUSTOMER_LIFF_IDENTITY_LOGIN_ENABLED=true
```

No session table is created.

## Member APIs

Session-backed APIs:

- `GET /api/customer/session`
- `POST /api/customer/liff-login`
- `GET /api/member`
- `POST /api/member`
- `GET /api/customer-history`
- `GET /api/customer-points`
- `POST /api/bookings/cancel` for logged-in customers

`GET /api/customer-profile` remains transitional: it prefers Customer Session when present, otherwise keeps the old tenant + phone lookup for compatibility.

## Member Data Permissions

Customers can update only their own basic profile:

- name
- phone
- email
- birthday
- gender
- address
- preferred service
- allergy/reminder field
- contact preference
- marketing opt-in

They cannot update points, tenant_id, identity_id, CRM note, internal tags, role, status or internal member level.

## Points and History

Points and history use:

```text
session.tenant_id + session.customer_id
```

They no longer rely on phone for formal logged-in customer reads.

## Booking Integration

Public booking is still supported without login. It continues to create/find Customer by tenant + phone.

When a valid Customer Session exists for the same tenant, booking creation uses the session customer_id. A Customer Session from another tenant is ignored for that booking tenant and cannot attach A-store Customer to B-store booking.

## Cancel Booking Transition

Logged-in customers cancel by session customer_id and tenant_id.

Legacy guest cancellation by bookingId + phone remains for compatibility. It is a known risk and should be replaced by a booking cancel token.

## Feature Flag

When `CUSTOMER_LIFF_IDENTITY_LOGIN_ENABLED=false`, customer LIFF login returns maintenance/disabled and does not fall back to trusting front-end LINE UID or phone login.

## Error Codes

- `CUSTOMER_LIFF_TOKEN_REQUIRED`
- `CUSTOMER_LIFF_TOKEN_INVALID`
- `CUSTOMER_LIFF_TOKEN_EXPIRED`
- `CUSTOMER_LIFF_AUDIENCE_INVALID`
- `CUSTOMER_IDENTITY_CONFLICT`
- `CUSTOMER_IDENTITY_INVALID`
- `CUSTOMER_PROFILE_CONFLICT`
- `CUSTOMER_ACCESS_DENIED`
- `CUSTOMER_SESSION_REQUIRED`
- `CUSTOMER_SESSION_INVALID`
- `CUSTOMER_SESSION_EXPIRED`
- `CUSTOMER_TENANT_SCOPE_MISMATCH`
- `CUSTOMER_NOT_FOUND`
- `CUSTOMER_UPDATE_FORBIDDEN`

## Migration

Task 011 adds:

```text
migrations/0013_customer_identity_unique.sql
```

It creates a partial unique index:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_tenant_identity_unique
ON customers(tenant_id, identity_id)
WHERE identity_id IS NOT NULL;
```

Before creating it, local and remote duplicate audits returned no rows.

## Tests

Implemented local checks:

- syntax check with `node --check src/index.js`
- local duplicate audit for `customers(tenant_id, identity_id)`
- remote duplicate audit for `customers(tenant_id, identity_id)`
- local migration apply for `0013_customer_identity_unique.sql`

Live LINE App Customer LIFF test is required after deploy and LIFF endpoint setup.

## Rollback

If Customer LIFF login must be paused, set:

```text
CUSTOMER_LIFF_IDENTITY_LOGIN_ENABLED=false
```

If session validation fails in production, clear the customer cookie or use `/customer-logout`. Merchant session is separate and is not affected.

## Not Complete

- Guest booking cancel token
- Phone OTP
- Email login
- Platform signed session
- Post-login customer multi-store switch UX
- Customer LIFF live acceptance
## Deployment Result - 2026-07-10

- Production URL: https://bookingos.fangwl591021.workers.dev
- Worker Version ID: $version
- Customer LIFF entry: /member-login?tenant=demo-tenant&next=/member
- D1 backup: .local-backups/bookingos-db-pre-customer-session-20260710.sql
- Remote migration: 013_customer_identity_unique.sql applied.
- Remote migrations after deploy: No migrations to apply.
- CUSTOMER_SESSION_SECRET: configured as Cloudflare Secret.
- CUSTOMER_SESSION_TTL_SECONDS=604800 deployed as Worker var.
- CUSTOMER_LIFF_IDENTITY_LOGIN_ENABLED=true deployed as Worker var.

## Smoke Test Result - 2026-07-10

Passed:

- GET /api/health -> 200.
- GET /member?tenant=demo-tenant without session -> 302 to /member-login.
- GET /member-login?tenant=demo-tenant&next=/member renders Customer LIFF login page.
- GET /api/customer/session?tenant=demo-tenant without cookie -> 401.
- POST /api/customer/liff-login without ID token -> 401.
- POST /api/customer/liff-login with invalid ID token -> 401.
- POST /api/customer/liff-login with only front-end line_user_id -> 401.
- GET /book?tenant=demo-tenant -> 200.
- Platform login regression -> 200.
- Merchant password login regression -> 200.
- Invalid platform LINE webhook signature -> 401.
- Remote duplicate audit for customers(tenant_id, identity_id) -> no rows.

Pending:

- Real LINE App Customer LIFF success-path acceptance.
- Signed Customer Cookie tamper test with a real Customer Session.
- Logout after real Customer Session.