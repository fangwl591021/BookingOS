# BookingOS Task 016C - First Batch Store Acceptance

Date: 2026-07-11
Environment: Production Worker
Base URL: https://bookingos.fangwl591021.workers.dev

## Scope

This task completed minimum production setup and live acceptance for two trial stores:

| Tenant | Slug | Store |
|---|---|---|
| trial-mrd14uce | mile-massage | 米樂按摩 |
| trial-mrdj8djy | wang-master | 王師傅整人大師 |

No Worker deploy, D1 migration, identity schema change, login change, plan/trial rule change, staff downgrade rule change, LINE change, or booking engine rewrite was performed.

## Production D1 Backup

Backup path: `.local-backups/bookingos-db-task016c-20260711-162803.sql`

A dry-run SQL file was prepared before applying the two-store setup. The applied SQL was tenant-scoped and did not use demo fallback.

## Pre-Change Snapshot

| Tenant | Status | Plan | Staff Limit | Booking Enabled | Services | Resources | Active Staff | Active Admin | Customers | Bookings |
|---|---|---|---:|---|---:|---:|---:|---:|---:|---:|
| trial-mrd14uce | trial | solo | 1 | yes | 0 | 0 | 1 | 1 | 0 | 0 |
| trial-mrdj8djy | trial | solo | 1 | yes | 0 | 0 | 1 | 1 | 1 | 0 |

No owner or customer personal data is included in this report.

## Store Setup Applied

### 米樂按摩

- Business hours: Monday to Saturday 10:00-20:00.
- Break: 13:00-14:00.
- Closed: Sunday.
- Resource: 按摩床, quantity 1.
- Staff: 米樂師傅, 按摩調理師, enabled, plan_booking_status active.
- Services:
  - 肩頸放鬆, 30 minutes, NT$600.
  - 全身舒壓, 60 minutes, NT$1,000.
  - 深層調理, 90 minutes, NT$1,500.

### 王師傅整人大師

- Business hours: Monday to Saturday 09:00-19:00.
- Break: 12:00-13:00.
- Closed: Sunday.
- Resource: 整復床, quantity 1.
- Staff: 王師傅, 整復調理師, enabled, plan_booking_status active.
- Services:
  - 基礎調理, 30 minutes, NT$800.
  - 肩頸腰背調理, 60 minutes, NT$1,200.
  - 全身深層調理, 90 minutes, NT$1,800.

## Public Store Verification

| URL | HTTP | Store Data | Setup Incomplete Message | Other Tenant Data |
|---|---:|---|---|---|
| /store/mile-massage | 200 | correct | not shown | not shown |
| /store/wang-master | 200 | correct | not shown | not shown |

## Availability Verification

| Tenant | Service | Staff | Result |
|---|---|---|---|
| trial-mrd14uce | 肩頸放鬆 | 米樂師傅 / system assignment | 200, slots returned |
| trial-mrdj8djy | 基礎調理 | 王師傅 / system assignment | 200, slots returned |

No `STAFF_PLAN_SELECTION_REQUIRED` or `STAFF_LIMIT_REACHED` was observed.

## Booking Acceptance

Four real acceptance bookings were created and verified:

| Store | Type | Service | Staff | Result |
|---|---|---|---|---|
| 米樂按摩 | Guest | 肩頸放鬆 | 米樂師傅 | PASS |
| 米樂按摩 | Member | 全身舒壓 | 米樂師傅 | PASS |
| 王師傅整人大師 | Guest | 基礎調理 | 王師傅 | PASS |
| 王師傅整人大師 | Member | 肩頸腰背調理 | 王師傅 | PASS |

The bookings were marked with Task 016C notes during acceptance, then removed after verification to avoid production statistics and points pollution.

## Customer Isolation

- A phone registered in 米樂按摩 returned `CUSTOMER_NOT_REGISTERED` when used against 王師傅整人大師 before registration there.
- A phone registered in 王師傅整人大師 returned `CUSTOMER_NOT_REGISTERED` when used against 米樂按摩 before registration there.
- 米樂 member history showed only the 米樂 member booking.
- 王師傅 member history showed only the 王師傅 member booking.

## Staff And Plan Verification

| Tenant | Staff Limit | Enabled Staff | Active Staff | Plan Limited Staff | Result |
|---|---:|---:|---:|---:|---|
| trial-mrd14uce | 1 | 1 | 1 | 0 | PASS |
| trial-mrdj8djy | 1 | 1 | 1 | 0 | PASS |

The disabled copied staff record in 王師傅整人大師 remains disabled and does not count toward plan booking capacity.

## Cleanup

Acceptance bookings, related point transactions, Task016C customers, and the two test PHONE auth records were removed after verification. Store setup data was retained.

Post-cleanup checks:

- Task 016C bookings: 0.
- 米樂 services: 3, resources: 1.
- 王師傅 services: 3, resources: 1.
- Staff plan status still valid.

## Regression

| Check | Result |
|---|---|
| /store/anhe | 200 |
| /store/sunny-hair | 200 |
| /store/mile-massage | 200 |
| /store/wang-master | 200 |
| Unknown slug | 404 |
| Legacy `/book?tenant=trial-mrd14uce` | 302 to store slug |
| Four-store Availability | PASS |
| Merchant login page | 200 |
| Store member login pages | 200 |
| Remote D1 migrations | No migrations to apply |
| npm run smoke | 12/12 PASS |

## Deployment

No Worker deployment was needed for this task.
