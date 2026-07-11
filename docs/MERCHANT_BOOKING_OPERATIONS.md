# Merchant Booking Operations

Task 018 adds the merchant daily booking operations workspace at `/merchant/operations`.

## Current Booking Audit

Current `bookings` core columns before this task were:

- `id`, `tenant_id`, `customer_id`
- `staff_id`, `service_id`, `service_name`
- `duration_minutes`, `price`
- `booking_date`, `start_time`, `end_time`
- `customer_name`, `customer_phone`
- `status`, `source`, `note`
- `created_at`, `updated_at`

Task 018 adds only additive fields:

- `checked_in_at`
- `service_started_at`
- `completed_at`
- `cancelled_at`
- `cancelled_by`
- `cancel_reason`
- `merchant_note`

It also adds tenant-scoped `booking_events`.

## Status Model

The normalized booking statuses are:

- `pending`: 待確認
- `confirmed`: 已確認
- `checked_in`: 已到店
- `in_service`: 服務中
- `completed`: 已完成
- `no_show`: 未到店
- `cancelled`: 已取消

Legacy Chinese labels are normalized in code. Customer-facing history can display these statuses, but internal `merchant_note`, actor IDs, and event metadata must not be exposed to customer APIs.

## Status Transitions

Allowed first-version transitions:

- `pending` -> `confirmed`
- `pending` -> `cancelled`
- `confirmed` -> `checked_in`
- `confirmed` -> `no_show`
- `confirmed` -> `cancelled`
- `checked_in` -> `in_service`
- `checked_in` -> `completed`
- `checked_in` -> `cancelled`
- `in_service` -> `completed`

Completed, no-show, and cancelled bookings are terminal in V1.

## APIs

Merchant APIs are tenant-scoped through the signed merchant session. They do not accept front-end supplied `tenant_id`.

- `GET /api/merchant/bookings`
- `POST /api/merchant/bookings/{bookingId}/status`
- `POST /api/merchant/bookings/{bookingId}/reschedule`
- `POST /api/merchant/bookings/{bookingId}/reassign`
- `POST /api/merchant/bookings/{bookingId}/note`
- `POST /api/merchant/bookings/{bookingId}/customer`
- `POST /api/merchant/bookings/{bookingId}/events`

All booking lookup and mutation queries include `tenant_id`.

## Booking Events

Important operations write `booking_events`:

- `created`
- `status_changed`
- `rescheduled`
- `staff_reassigned`
- `customer_updated`
- `merchant_note_updated`
- `cancelled`

Metadata is operational only and must not include secrets or tokens.

## Merchant Note

`merchant_note` is for internal store use. It is shown in the merchant workspace and excluded from customer APIs.

## Points

Current BookingOS V1 points are processed at booking creation:

- redeem points are deducted when the booking is created
- reward points are added when the booking is created
- cancellation revokes earned points and refunds redeemed points once because repeated cancellation skips the update path after status becomes `cancelled`

Task 018 does not move reward issuance to completion; completion only records status and `completed_at`.

## Plan-Limited Staff

Staff with `plan_booking_status = plan_limited` remain visible for history and existing bookings. They are not used for public availability, system assignment, reschedule targets, or reassignment targets.

The operations workspace displays future non-terminal bookings assigned to plan-limited staff as `方案調整待處理預約`.

## Tenant Isolation

The operations workspace and APIs use the merchant session tenant. Cross-tenant booking IDs return `BOOKING_NOT_FOUND` and must not reveal whether the booking exists in another tenant.

## Acceptance Notes

Primary test tenant: `onboarding-test`.

Required checks:

- guest booking creates a `pending` booking
- merchant can confirm, check in, start service, complete, mark no-show, cancel, reschedule, reassign, edit note, edit booking contact fields
- invalid transitions return `INVALID_BOOKING_STATUS_TRANSITION`
- merchant note does not appear in customer API
- plan-limited staff cannot receive new reassignment
- smoke test remains green
## Task 018A Acceptance Record

Acceptance run: 2026-07-11 on production Worker with the isolated `onboarding-test` tenant. All temporary bookings, customers, point transactions, events, staff, and tenant-state changes were removed after verification.

- Status workflow verified: `pending -> confirmed -> checked_in -> in_service -> completed`; each merchant transition wrote an event and the corresponding timestamp.
- `no_show` is terminal, keeps the booking/customer, and does not revoke earned points. Cancelled bookings are terminal; repeated cancellation did not create duplicate events, revokes, or refunds.
- Invalid transitions return `409 INVALID_BOOKING_STATUS_TRANSITION`. `in_service -> cancelled` remains intentionally rejected in V1.
- Reschedule validates past time, break time, closed day, staff availability, resource capacity, and ignores the booking being edited when detecting conflicts. Closed dates return no public slots and merchant reschedule returns `409 BOOKING_SLOT_CONFLICT`.
- Reassignment verifies tenant-scoped active staff and service capability. Plan-limited staff reject new reassignment, while existing plan-limited bookings remain visible in the `方案調整待處理預約` worklist and can be moved manually to active staff.
- All mutation endpoints use `expected_updated_at` in the SQL update predicate. Status, reschedule, reassign, note, and booking-contact stale writes return `409 BOOKING_CONFLICT`.
- Merchant notes and booking-event metadata are visible only to merchant APIs. Real customer member/history responses did not include merchant notes, event metadata, actor information, or booking-only contact edits.
- Grace and expired tenants can view and process existing bookings within the permitted transition rules but cannot reschedule. Suspended and cancelled tenants can view the operations workspace only; writes remain blocked.
- Cross-tenant booking reads, notes, status updates, and events return the same `404 Not found` response.
- Point verification covered booking reward, redemption, cancellation revoke, and refund. A redeemed booking produced exactly one `earn`, `redeem`, `revoke`, and `refund` transaction; repeat cancellation was idempotent.

Final deployment: Worker version `1467d438-2651-44b6-a1e1-cfd8a1f475ee`.
Remote D1 backup: `.local-backups/bookingos-db-task018a-pre-20260711-215700.sql`.
Final acceptance data was removed from `onboarding-test`; the tenant was restored to `trial`, `solo`, one active staff member, and its original business-hours configuration.
