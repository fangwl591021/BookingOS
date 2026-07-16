# B5 Merchant Cancellation Command Boundary

## Scope

Sprint B5 moves only merchant-protected cancellation through the Booking Command Service boundary.

Adopted route and transition family:

- `POST /api/merchant/bookings/:bookingId/status`
- payload `status=cancelled`
- `pending -> cancelled`
- `confirmed -> cancelled`
- `checked_in -> cancelled`

Explicitly retained in legacy:

- customer and guest `/api/bookings/cancel`
- guest booking id plus phone fallback
- customer-session cancellation behavior
- `in_service`, `completed`, `no_show`, and already `cancelled` terminal handling
- booking create
- reschedule
- reassign
- idempotency persistence, replay, or stored results
- LINE and Web Push implementation details

## Route Contract

Route remains unchanged:

- `POST /api/merchant/bookings/:bookingId/status`

Success response remains:

```json
{ "ok": true, "booking": {} }
```

Error response remains:

```json
{ "ok": false, "error": { "code": "...", "message": "..." } }
```

The route still resolves tenant from the signed Merchant Session and never trusts a client-supplied tenant id for booking cancellation.

## Command Flow

Approved B5 merchant cancellations now follow:

```text
Route
-> Booking Command Service
-> Booking Repository conditional cancellation update
-> Legacy point rollback adapter
-> Legacy event/notification adapter
-> Existing D1 write/read
```

The route keeps the existing safety order:

1. Merchant session tenant resolution
2. Tenant-scoped booking lookup
3. `expected_updated_at` precheck
4. Tenant commercial access check
5. Existing action permission check
6. B5 merchant cancellation transition detection
7. Conditional cancellation status update
8. Legacy customer point rollback adapter
9. Legacy-compatible event/notification adapter
10. Reload booking and return existing response shape

## Point Rollback Compatibility

B5 does not duplicate point or customer-balance logic. The command service receives an injected `rollbackCustomerPoints` adapter from the route. The adapter calls the existing `rollbackBookingCustomerPoints()` helper after the cancellation update succeeds and before the cancellation event is appended.

This preserves the required order:

1. status update succeeds
2. `rollbackBookingCustomerPoints()` runs
3. cancellation event is appended through `appendBookingEvent()`

## Notification Compatibility

B5 intentionally does not replace `appendBookingEvent()` with the pure B3 `bookingEventRepository.append()` for cancellation status changes.

Reason: existing cancellation behavior is coupled to `appendBookingEvent()` side effects:

1. `booking_events` receives the cancellation event
2. LINE cancelled notification path runs
3. Web Push cancelled notification path runs

The command service receives an injected `appendCancellationEvent` adapter from the route. The adapter calls the existing `appendBookingEvent()` helper, preserving event insert and notification order. Event/notification adapter failure remains swallowed and does not change the successful cancellation response.

## Repository Boundary

`bookingRepository.cancelMerchantStatus()` owns the conditional SQL update for B5 merchant cancellations:

- `tenant_id = ?`
- `id = ?`
- original `status = ?`
- optional `updated_at = ?`

If the update changes zero rows, the command returns `BOOKING_CONFLICT`.

## Legacy Boundaries

Customer and guest cancellation routes remain legacy. The public `/api/bookings/cancel` route, guest phone fallback, and customer-session cancellation behavior are not modified by B5.

B4 non-cancel status transitions remain unchanged. `checked_in -> completed` remains legacy. Booking create, reschedule, and reassign remain legacy.

## Tests

`npm run test:booking-command-boundary` covers:

- merchant `pending -> cancelled`
- merchant `confirmed -> cancelled`
- merchant `checked_in -> cancelled`
- terminal cancellation rejection or existing repeated-cancel no-op behavior
- stale `expected_updated_at`
- conditional update conflict
- point rollback order after update and before event
- event append through `appendBookingEvent()` adapter
- LINE/Web Push notification adapter failure swallowed after event insert
- customer and guest `/api/bookings/cancel` legacy path
- cross-tenant not found
- B3 note, customer, and event read regressions
- B4 non-cancel status command regressions

## No-schema Statement

B5 introduces no table, column, index, migration, binding, secret, remote D1 write, LINE API design change, Web Push design change, or production deployment.