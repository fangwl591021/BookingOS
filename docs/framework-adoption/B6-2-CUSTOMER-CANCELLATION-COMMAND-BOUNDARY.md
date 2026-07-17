# B6.2 Customer Cancellation Command Boundary

## Scope

B6.2 moves only the authenticated Customer Session cancellation path for `POST /api/bookings/cancel` into the Booking Command Service boundary.

The guest `bookingId + phone` fallback remains legacy for this phase. Merchant cancellation remains the B5 command boundary.

## Security Fix

When a valid Customer Session is present, the route now treats that session as authoritative:

1. If the session tenant does not match the request tenant, the request is rejected.
2. If the session customer does not match `bookings.customer_id`, the request is rejected.
3. Either rejection stops before any status update, `booking_events` insert, point transaction, LINE notification, or Web Push notification.
4. A valid but mismatched Customer Session is never allowed to fall through to the Guest phone fallback.

This closes the B6.1 frozen issue where a valid session could still use a matching payload phone as Guest fallback.

## Command Boundary

A matching Customer Session cancellation uses `bookingCommandService.cancelCustomerBooking()`.

The repository update is tenant-scoped and customer-scoped:

```text
tenant_id + booking id + customer_id + original status
```

No `expected_updated_at` requirement is introduced in B6.2.

If the conditional update returns `changes !== 1`, the command returns `BOOKING_CONFLICT` and no event, points, LINE notification, or Web Push notification is executed.

## Preserved Contracts

Customer Session success response remains:

```json
{ "ok": true, "profile": {} }
```

Guest phone fallback remains available only when there is no valid Customer Session.

Customer and Guest side-effect order remains the current legacy order:

```text
status update -> appendBookingEvent() -> booking_events / LINE / Web Push -> points
```

Merchant B5 cancellation remains:

```text
status update -> rollbackBookingCustomerPoints() -> appendBookingEvent()
```

## Explicit Non-Scope

B6.2 does not implement:

- B6.3 point rollback order unification.
- Guest token cancellation.
- Schema changes or migrations.
- Transactions or D1 batch redesign.
- Persistent idempotency, replay, or stored results.
- LINE or Web Push implementation changes.
- Production deployment.
- Remote D1 writes.
- Wrangler, secret, or binding changes.

## Tests

Focused coverage is in:

```text
npm run test:cancellation-current-state
```

The test suite covers:

- Matching Customer Session cancellation with unchanged profile response.
- Tenant mismatch rejection without Guest fallback or side effects.
- Customer mismatch rejection without Guest fallback or side effects.
- Guest phone fallback compatibility.
- Customer conditional-update conflict with zero side effects.
- Repeated cancellation compatibility.
- Customer/Guest side-effect order preservation.
- Merchant B5 cancellation order regression.
