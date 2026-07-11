# BookingOS Task 016B - First Batch Store Smoke Test

Date: 2026-07-11
Environment: Production Worker
Base URL: https://bookingos.fangwl591021.workers.dev

## Scope

This report verifies the first batch of store URLs and onboarding readiness after Task 016 and Task 016 staff plan selection changes.

No schema changes, migrations, tenant data edits, booking engine changes, or deployment were performed in this task.

## Production D1 Snapshot

| Tenant | Store | Slug | Status | Plan | Staff Limit | Enabled Staff | Active Booking Staff | Plan Limited Staff | Services | Customers | Bookings | Booking Enabled |
|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| demo-tenant | 安和整復調理 | anhe | active | small | 2 | 1 | 1 | 0 | 4 | 9 | 8 | yes |
| sunny-hair | 晴美髮藝 | sunny-hair | trial | small | 2 | 2 | 2 | 0 | 3 | 2 | 2 | yes |
| trial-mrd14uce | 米樂按摩 | mile-massage | trial | solo | 1 | 1 | 1 | 0 | 0 | 0 | 0 | yes |
| trial-mrdj8djy | 王師傅整人大師 | wang-master | trial | solo | 1 | 1 | 1 | 0 | 0 | 1 | 0 | yes |

Notes:

- No owner/customer personal data was exported for this report.
- 米樂按摩 and 王師傅整人大師 currently have no service items, so public booking should remain blocked by setup incompletion.

## Public Store URL Smoke

| URL | HTTP | Expected Store Name Found | Fallback To Anhe | Setup Incomplete Message | Result |
|---|---:|---|---|---|---|
| /store/anhe | 200 | yes | no | no | PASS |
| /store/sunny-hair | 200 | yes | no | no | PASS |
| /store/mile-massage | 200 | yes | no | yes | PASS |
| /store/wang-master | 200 | yes | no | yes | PASS |

## Availability Smoke

| Tenant | Expected | Result |
|---|---|---|
| demo-tenant | Availability endpoint remains public and returns available slots | 200 PASS |
| sunny-hair | Availability endpoint remains public and returns available slots | 200 PASS |
| trial-mrd14uce | No services yet, must not fallback to demo | 409 STORE_SETUP_INCOMPLETE PASS |
| trial-mrdj8djy | No services yet, must not fallback to demo | 409 STORE_SETUP_INCOMPLETE PASS |

## Regression Smoke

`npm run smoke`: 12/12 passed.

Verified:

- Health endpoint works.
- Unknown API fails closed.
- Wrong API method returns 405.
- Store booking page loads.
- Store `/book` alias loads.
- Legacy tenant booking redirects to store slug.
- Store member page redirects to store login.
- Legacy member routes redirect to store slug.
- Unknown store slug returns `STORE_NOT_FOUND`.
- Merchant login ignores customer intent parameters.
- Availability endpoint remains public.
- Customer profile requires customer session.

## D1 Migration Status

Remote D1 migrations: No migrations to apply.

## Onboarding Checklist For Each Store

Before declaring a store ready for customers:

1. Store profile complete: name, phone, address, logo.
2. Store slug exists and public URL opens the correct tenant.
3. Business hours configured.
4. At least one enabled service with duration and price.
5. At least one active staff member.
6. Each active staff member has at least one service binding.
7. Resource/room/chair capacity exists for service types.
8. Staff plan selection is not required.
9. Plan-limited staff, if any, are treated as retained records and not as errors.
10. A setup test booking can be created only after plan selection is complete.
11. Formal booking can be enabled only after setup is complete.
12. Customer `/member`, `/points`, and `/history` routes use customer session, not merchant login.
13. Public booking works without customer login.
14. Store data must not fallback to `demo-tenant`.

## Current Store Actions

| Store | Action |
|---|---|
| 安和整復調理 | Ready for continued live testing. |
| 晴美髮藝 | Ready for continued trial testing. |
| 米樂按摩 | Needs service items and staff service binding before booking can open. |
| 王師傅整人大師 | Needs service items and staff service binding before booking can open. |

## Recommendation

Proceed with one store at a time:

1. Complete 米樂按摩 service setup.
2. Create one test booking.
3. Confirm public booking flow.
4. Repeat for 王師傅整人大師.

Do not enable formal booking for stores with zero services.
