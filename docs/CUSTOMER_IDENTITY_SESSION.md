# Customer Identity and Signed Customer Session

Date: 2026-07-11
Status: V1 active path is phone + birthday. Customer LINE / LIFF login is paused.

## Boundary

Identity proves who the person is on BookingOS. Customer is the tenant-owned member profile.

Customer-owned data stays on `customers` and related tenant tables:

- name
- phone
- email
- birthday
- gender
- address
- CRM notes
- tags
- points
- coupons
- booking history
- preferences

The customer session must not contain phone, email, LINE UID, birthday, address, points, CRM notes, tokens, or secrets.

## Active Customer Login: Phone + Birthday

Entry:

```text
/store/{slug}/login?next=/store/{slug}/member
```

Active flow:

```text
Customer enters phone + ROC birthday, for example 591021
-> POST /api/store/{slug}/customer/phone-login
-> identity_auth provider PHONE
-> identities
-> customers WHERE tenant_id + identity_id
-> signed customer session
-> /member, /points, or /history
```

Registration flow:

```text
Customer enters name + phone + ROC birthday, for example 591021
-> POST /api/store/{slug}/customer/phone-register
-> create or reuse PHONE identity
-> create or update tenant customer
-> signed customer session
-> /member
```

Rules:

- Phone is the V1 customer account identifier.
- ROC birthday, for example `591021`, is the V1 login credential.
- The same Identity can join multiple tenants.
- Each tenant owns its own Customer row.
- Customer login must never redirect to `/merchant-login`.
- Customer member pages must never show Merchant Console.

## Paused: Customer LINE / LIFF Login

Customer LINE login is intentionally paused.

Disabled endpoint:

```text
POST /api/customer/liff-login
```

Expected behavior:

```text
503 CUSTOMER_LIFF_LOGIN_DISABLED
```

Do not use in V1:

- Customer LIFF as required login.
- LINE ID Token as customer registration requirement.
- LINE automatic Customer creation.
- Merchant LIFF for customer login.

Future direction:

```text
Customer logs in with phone + birthday
-> opens member center
-> clicks optional bind LINE
-> LINE verifies token
-> add identity_auth row to existing identity
-> future login may support LINE as a second method
```

LINE binding must attach to an already-authenticated customer identity. It must not create duplicate customers or replace phone + birthday login until it is separately accepted.

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

Validation rechecks identities, tenants, and customers from D1 on every protected customer request.

Required production env:

```text
CUSTOMER_SESSION_SECRET=<Cloudflare Secret>
CUSTOMER_SESSION_TTL_SECONDS=604800
CUSTOMER_LIFF_IDENTITY_LOGIN_ENABLED=false
```

No session table is created.

## Member APIs

Session-backed APIs:

- `GET /api/customer/session`
- `POST /api/customer/phone-login`
- `POST /api/customer/phone-register`
- `GET /api/member`
- `POST /api/member`
- `GET /api/customer-history`
- `GET /api/customer-points`
- `POST /api/bookings/cancel` for logged-in customers

Paused API:

- `POST /api/customer/liff-login`

Transitional API:

- `GET /api/customer-profile` requires a valid Customer Session and reads only the session customer_id. Query string phone is ignored and must not be used for profile lookup.

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

They cannot update:

- points
- tenant_id
- identity_id
- CRM notes
- internal tags
- role
- status
- internal member level

## Points and History

Points and history use:

```text
session.tenant_id + session.customer_id
```

They do not rely on phone for formal logged-in customer reads.

## Booking Integration

Public booking is still supported without login. It continues to create/find Customer by tenant + phone.

When a valid Customer Session exists for the same tenant, booking creation uses the session customer_id. A Customer Session from another tenant is ignored for that booking tenant and cannot attach A-store Customer to B-store booking.

## Cancel Booking Transition

Logged-in customers cancel by session customer_id and tenant_id.

Legacy guest cancellation by bookingId + phone remains for compatibility. It is a known risk and should be replaced by a booking cancel token.

## Active Error Codes

- `CUSTOMER_LOGIN_REQUIRED`
- `CUSTOMER_REGISTER_REQUIRED`
- `CUSTOMER_NOT_REGISTERED`
- `CUSTOMER_BIRTHDAY_INVALID`
- `CUSTOMER_PHONE_CONFLICT`
- `CUSTOMER_PROFILE_CONFLICT`
- `CUSTOMER_ACCESS_DENIED`
- `CUSTOMER_SESSION_REQUIRED`
- `CUSTOMER_SESSION_INVALID`
- `CUSTOMER_SESSION_EXPIRED`
- `CUSTOMER_TENANT_SCOPE_MISMATCH`
- `CUSTOMER_UPDATE_FORBIDDEN`

Paused LINE error code:

- `CUSTOMER_LIFF_LOGIN_DISABLED`

## Tests

Required before deploy:

```text
npm run check
npm run smoke
```

Smoke coverage includes:

- health endpoint
- unknown API fail-closed
- wrong API method 405
- public booking page
- member redirect to member login
- merchant login still available
- availability endpoint still public

## Not Complete

- Guest cancel token
- Phone OTP
- Email login
- Platform signed session
- Post-login customer multi-store switch UX
- Optional Customer LINE binding
## Store Slug Routing

Customer-facing tenant query URLs are now legacy compatibility routes. The canonical customer entry is:

```text
/store/{slug}
/store/{slug}/login
/store/{slug}/member
/store/{slug}/points
/store/{slug}/history
```

For `demo-tenant`, the current slug is:

```text
/store/anhe
```

Legacy examples redirect when the tenant has a slug:

```text
/book?tenant=demo-tenant        -> /store/anhe
/member-login?tenant=demo-tenant -> /store/anhe/login
/member?tenant=demo-tenant      -> /store/anhe/member
/points?tenant=demo-tenant      -> /store/anhe/points
/history?tenant=demo-tenant     -> /store/anhe/history
```

Slug-scoped customer APIs resolve tenant from the URL and must not trust a tenant supplied in the request body.
