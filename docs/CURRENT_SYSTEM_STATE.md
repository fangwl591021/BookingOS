# BookingOS Current System State

Date: 2026-07-11
Status: working-state freeze for repair planning.

This document records the current intended behavior of BookingOS. It is the source of truth before more feature work. If code, docs, or UI disagree with this document, treat the disagreement as a bug or stale documentation.

## Current Product Boundary

BookingOS V1 is a SaaS booking system for stores such as massage, nail, eyelash, and similar appointment businesses.

The current production direction is:

- Store owners and staff use the merchant backend.
- Customers use the public booking page and member center.
- Platform owner uses the platform console to manage tenants, trials, plans, billing orders, LINE OA, and platform CRM.
- Customer LINE login is paused.
- Merchant LINE login remains active.

## Active Login Flows

### Platform Admin

Purpose:

- Manage all tenants.
- Review applications.
- Manage trial stores.
- Manage billing and plan state.
- Manage platform LINE OA and platform LINE friend CRM.

Current login:

- Platform username and password.
- Uses platform session cookie.

Current risk:

- Platform session is still a simple admin session model, not a full multi-admin identity model.
- It is acceptable for V1 internal use, but not final production-grade platform auth.

### Merchant Backend

Purpose:

- Store settings.
- Services.
- Staff.
- Resources.
- Scheduling settings.
- CRM.
- Booking dashboard.
- Customer export.
- Store booking URL copy.

Current login methods:

- Merchant password login.
- Merchant LINE login.

Merchant LINE status:

- Active and should be preserved.
- Must use merchant LIFF only.
- Must not be affected by customer member changes.

Merchant session:

- Signed merchant session cookie.
- Contains identity, tenant, role, permissions, and expiry.
- Revalidates tenant admin permission from D1.

Important rule:

- Merchant login is for store admins and staff only.
- Customer member pages must never redirect to merchant login.

### Customer Member

Purpose:

- Member profile.
- Points.
- Booking history.
- Customer-owned profile editing.

Current login method:

- Phone number.
- Birthday uses Taiwan ROC date format, for example `591021`.

Current session:

- Signed customer session cookie.
- Tenant-scoped.
- Customer-scoped.
- Should allow repeat visits without logging in again until session expiry.

Current customer rule:

- One platform identity can join many stores.
- Each store owns a separate customer profile and CRM record.
- `customers(tenant_id, identity_id)` is the intended unique customer identity relation when identity exists.

Customer LINE status:

- Paused.
- Not part of V1 customer registration or login.
- May return later only as an optional binding after phone plus birthday login is stable.

Important rule:

- Customer registration and login must not use merchant LIFF.
- Customer registration and login must not show Merchant Console.
- Customer member tabs must not redirect to `/merchant-login`.

### Guest Booking

Purpose:

- Let customers book without logging in.

Current behavior:

- Public booking page is available by store slug URL; tenant query URLs are legacy redirects.
- Guest booking can create or find a tenant customer by phone.
- If a valid customer session exists for the same tenant, booking should attach to that session customer.

Important rule:

- Guest booking must continue working even if member login has issues.

## Current Public Entry Points

### Store Booking Page

Canonical pattern:

```text
/store/{slug}
```

Example:

```text
/store/anhe
```

Expected behavior:

- Show customer-facing booking UI.
- Bottom tabs: booking, member, points, history.
- Member, points, and history require customer member session.
- If no customer session exists, redirect to customer member login, not merchant login.

### Customer Member Login

Canonical pattern:

```text
/store/{slug}/login?next=<customer_page>
```

Expected behavior:

- Show customer member login/register page.
- Use phone plus birthday.
- No Merchant Console.
- No admin account fields.
- No mandatory LINE login.

### Merchant Backend Login

Canonical pattern:

```text
/merchant-login?tenant=<tenant_id>&next=/merchant
```

Expected behavior:

- Show Merchant Console login.
- Allow merchant LINE login.
- Allow merchant admin account login.

### Merchant Backend

Canonical pattern:

```text
/merchant?tenant=<tenant_id>
```

Expected behavior:

- Require merchant session.
- Use session tenant as authority.
- Show store backend.

### Platform Console

Canonical pattern:

```text
/platform
```

Expected behavior:

- Require platform admin session.
- Manage all tenants and platform-level data.

## Data Model State

### Identity

Purpose:

- Platform-level proof of person.

Current direction:

- Identity should not store business data.
- Phone and LINE are authentication methods or evidence, not CRM profile.

Current active customer use:

- Phone plus birthday resolves or creates identity/customer relation.

### IdentityAuth

Purpose:

- Store provider-based login evidence.

Current state:

- Exists in schema.
- Merchant LINE login uses scoped identity auth.
- Customer LINE login is paused.

### Tenant

Purpose:

- Store account.
- Plan.
- Trial.
- Contract.
- Billing status.

Tenant isolation rule:

- Store data must always be tenant-scoped.
- A tenant admin session must not access another tenant's CRM, booking, settings, services, staff, or export.

### Customer

Purpose:

- Tenant-owned member profile.
- CRM.
- Points.
- Booking history.
- Notes.
- Tags.
- Preferences.

Current rule:

- Customer is not the same as Identity.
- Customer data belongs to one tenant.
- Platform should not own customer CRM details.

### Tenant Admin

Purpose:

- Store backend permission.

Current rule:

- `tenant_admins` remains the role table.
- Do not create a separate `admins` table in V1.

### Staff

Purpose:

- Service provider in store.

Current state:

- Staff can be enabled or disabled.
- Staff can have service capability selections.
- Staff count is plan-limited.

Current gap:

- Staff does not yet have a complete real-world schedule model.

## Scheduling State

Current availability calculation considers:

- Store business hours.
- Store breaks.
- Existing bookings.
- Service duration.
- Service enabled status.
- Staff enabled status.
- Staff service capability.
- Resource type capacity.

Current gaps:

- No full staff shift table.
- No staff day-off / leave model.
- No recurring personal schedule per staff.
- No dedicated walk-in booking flow.
- No explicit resource instance assignment.
- Resource count is capacity, not exact bed or room allocation.

Practical implication:

- The current system can demo appointment availability.
- It is not yet a reliable full operational scheduler for multiple staff with real shifts.

## Points and Booking State

Current behavior:

- Booking can redeem points according to service redemption rules.
- Booking can earn points according to store settings.
- Cancellation should revoke earned points and refund redeemed points.

Current risk:

- Booking, point transaction, and customer balance updates should be treated as one financial operation.
- Any future refactor should make this path transaction-like and fully testable.

## LINE State

### Merchant LINE

Status:

- Active.
- Must remain active.
- Uses merchant LIFF and merchant login channel settings.

### Platform LINE OA

Status:

- Active for platform official account.
- Used for platform friend CRM and owner registration / referral flow.

### Customer LINE

Status:

- Paused.
- Not accepted as the normal customer registration or login path.

Do not do:

- Do not route customer member buttons to customer LIFF.
- Do not require LINE before customer profile access.
- Do not use merchant LIFF for customer login.
- Do not show Merchant Console in customer login.

Future possible direction:

- After phone plus birthday member login is stable, add optional "bind LINE" from inside the already-authenticated member center.

## Known Documentation Drift

The following areas need cleanup because older tasks described Customer LINE as active:

- `docs/CUSTOMER_IDENTITY_SESSION.md`
- `docs/MIGRATION_CHECKLIST.md`
- `docs/TENANT_AUDIT.md`

Current truth:

- Merchant LINE is active.
- Customer LINE is paused.
- Customer phone plus birthday is the V1 member login.

## Current Quality Risks

### P0 Risks

- Customer pages can accidentally redirect to merchant login.
- New API routes can accidentally skip session or tenant checks.
- Tenant isolation docs are stale and need re-audit after recent login work.
- Customer LINE paused state is not cleanly reflected across docs and code.

### P1 Risks

- Scheduling model is insufficient for real multi-staff operations.
- Booking and point writes need stronger consistency guarantees.
- E2E smoke tests are missing.
- Documentation and implementation can drift quickly.

### P2 Risks

- Platform session model is basic.
- Customer LINE binding is not designed yet.
- Staff identity is not modeled.
- Resource assignment is capacity-based only.

## Do Not Change Without Explicit Decision

- Do not replace customer phone plus birthday login with LINE.
- Do not remove merchant LINE login.
- Do not create `identity_profiles`.
- Do not create a new `admins` table.
- Do not create a `sessions` table unless a later architecture decision requires it.
- Do not merge Customer CRM data into Identity.

## Immediate Source of Truth

Until the repair plan is completed, the intended V1 flow is:

```text
Customer:
/book?tenant=store
-> optional phone+birthday member login
-> member / points / history
-> no customer LINE requirement

Merchant:
/merchant-login?tenant=store
-> merchant LINE or merchant account login
-> signed merchant session
-> backend

Platform:
/platform
-> platform admin login
-> platform console
```
