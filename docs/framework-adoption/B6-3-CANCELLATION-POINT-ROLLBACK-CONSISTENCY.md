# B6.3 Cancellation Point Rollback Consistency Boundary

## Status

Draft PR scope. Not deployed.

## Objective

Align Customer Session cancellation and transitional Guest phone fallback cancellation with the Merchant B5 cancellation side-effect order for point rollback consistency.

New Customer/Guest order:

```text
status update -> rollbackBookingCustomerPoints() -> appendBookingEvent() -> notification
```

Merchant B5 remains unchanged.

## In Scope

- Customer Session cancellation through `/api/bookings/cancel`.
- Guest `bookingId + phone` fallback cancellation while the transitional fallback still exists.
- Reuse of the existing `rollbackBookingCustomerPoints()` helper through a compatible adapter.
- Preservation of the Customer/Guest success response contract: `{ ok: true, profile }`.
- Preservation of B6.2 tenant/customer mismatch rejection: a valid mismatched Customer Session must not fall through to Guest fallback.
- Tests that freeze Customer and Guest cancellation order, conflict handling, rollback failure behavior, and Merchant B5 regression.

## Out of Scope

- Guest token implementation.
- Schema or migration changes.
- D1 transaction or batch redesign.
- Persistent idempotency, replay, or stored results.
- Booking create, reschedule, or reassign lifecycle.
- LINE or Web Push implementation rewrite.
- Production deployment, Remote D1 write, wrangler changes, secret changes, or binding changes.

## Runtime Behavior

### Customer Session Cancellation

When the Customer Session is valid and matches the booking tenant/customer:

1. The Booking Command Service performs the customer-scoped conditional cancellation update.
2. On `changes !== 1`, the command fails safely and does not rollback points or append events.
3. On successful status update, the route-injected adapter calls `rollbackBookingCustomerPoints()`.
4. If point rollback succeeds, the route-injected adapter calls `appendBookingEvent()`.
5. `appendBookingEvent()` preserves its existing internal side effects: `booking_events` insert, LINE notification, and Web Push notification.
6. Notification failures keep the existing swallowed-error behavior and do not fail a successful cancellation response.

### Guest Phone Fallback Cancellation

When no valid Customer Session exists and the transitional Guest phone fallback is used:

1. The legacy guest authorization and status update remain in place.
2. On successful status update, the route calls `rollbackBookingCustomerPoints()` when the booking has a customer.
3. The route then calls `appendBookingEvent()`.
4. The success response remains `{ ok: true, profile }`.

## Failure Semantics

If `rollbackBookingCustomerPoints()` fails after the status update:

- `appendBookingEvent()` is not called.
- No LINE or Web Push notification is triggered by this cancellation path.
- The route returns the existing compatible error envelope.
- The booking status may already be `cancelled` because B6.3 does not introduce D1 transactions, batch redesign, or compensation logic.

This is a known non-transaction risk retained for a future transaction/idempotency phase.

## Legacy Behavior Preserved

- Merchant B5 cancellation order remains `status update -> rollbackBookingCustomerPoints() -> appendBookingEvent()`.
- Customer/Guest route and payload shape remain compatible.
- Customer/Guest success response remains `{ ok: true, profile }`.
- Customer/Guest state rules are not expanded.
- Customer Session tenant/customer mismatch remains blocked and does not fall back to Guest phone cancellation.
- Repeated cancellation does not create repeated point rollback, events, or notifications.

## Validation

Primary test coverage:

```text
npm run test:cancellation-current-state
npm run test:booking-command-boundary
npm run test:runtime-boundary
npm run test:domain-boundary
npm run test:weekly-hours
npm run test:operations
npm run test:line-engagement
npm run test:web-push
npm run smoke
```

B6.3-specific assertions include:

- Customer cancellation order: update, rollback, event.
- Guest fallback cancellation order: update, rollback, event.
- Customer and Guest cancellation use the `rollbackBookingCustomerPoints()` helper path instead of inline point SQL after event notification.
- SQL conflict does not rollback or append events.
- Rollback failure does not append events or trigger notifications.
- Merchant B5 cancellation order does not regress.
