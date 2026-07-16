# B4 Non-Cancel Booking Status Command Boundary

## Scope

Sprint B4 moves only the approved non-cancel booking status transitions behind the Booking Command Service.

Adopted transitions:

- `pending -> confirmed`
- `confirmed -> checked_in`
- `checked_in -> in_service`
- `in_service -> completed`
- `confirmed -> no_show`

Explicitly retained in legacy:

- all transitions to `cancelled`
- cancellation point rollback through `rollbackBookingCustomerPoints()`
- `checked_in -> completed`
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

The route still resolves tenant from the signed Merchant Session and never trusts a client-supplied tenant id for booking mutation.

## Command Flow

Approved B4 transitions now follow:

```text
Route
-> Booking Command Service
-> Booking Repository conditional status update
-> Legacy event/notification adapter
-> Existing D1 write/read
```

The route keeps the existing safety order:

1. Merchant session tenant resolution
2. Tenant-scoped booking lookup
3. `expected_updated_at` precheck
4. Tenant commercial access check
5. Existing action permission check
6. B4 transition detection
7. Command status update
8. Legacy-compatible event/notification adapter
9. Reload booking and return existing response shape

## Notification Compatibility

B4 intentionally does not replace `appendBookingEvent()` with the pure B3 `bookingEventRepository.append()` for status changes.

Reason: existing `pending -> confirmed` behavior is:

1. conditional status update succeeds
2. `booking_events` receives `status_changed`
3. LINE confirmed notification path runs
4. Web Push confirmed notification path runs

The command service receives an injected `appendStatusEvent` adapter from the route. The adapter calls the existing `appendBookingEvent()` helper, preserving event insert and notification order. Notification failure remains swallowed and does not change the successful status response.

## Repository Boundary

`bookingRepository.updateStatus()` owns the conditional SQL update for B4 transitions:

- `tenant_id = ?`
- `id = ?`
- original `status = ?`
- optional `updated_at = ?`

If the update changes zero rows, the command returns `BOOKING_CONFLICT`.

## Legacy Boundaries

Cancellation remains fully legacy because it is coupled to customer point rollback. B4 does not move or duplicate `rollbackBookingCustomerPoints()`.

Reschedule and reassign remain legacy and continue to use their existing availability, resource, and notification behavior.

`checked_in -> completed` remains legacy even though it is currently allowed by the legacy transition map, because it was explicitly excluded from the B4 scope.

## Tests

`npm run test:booking-command-boundary` covers:

- B4 status command service success
- `pending -> confirmed` response shape
- `status_changed` event insert
- confirmed notification adapter path remains active
- notification failure does not fail the status response
- `checked_in_at`, `service_started_at`, and `completed_at` preservation
- `no_show` terminal behavior
- terminal states reject further transitions
- `checked_in -> completed` remains legacy
- cancelled transitions remain legacy and still hit point rollback queries
- stale `expected_updated_at`
- conditional update conflict
- cross-tenant not found
- tenant commercial access behavior
- B3 note, customer, and event read regressions

## No-schema Statement

B4 introduces no table, column, index, migration, binding, secret, remote D1 write, LINE API design change, Web Push design change, or production deployment.