# B6.1 Cancellation Current-State Tests & Contract Freeze

Status: Draft PR scope

B6.1 does not change runtime cancellation behavior. It freezes the current Customer and Guest cancellation contracts with tests before any B6.2 command-boundary work starts.

## Scope

Covered by B6.1:

- Customer Session cancellation through `POST /api/bookings/cancel`
- Guest transitional fallback through `bookingId + phone`
- Customer Session tenant mismatch fallback behavior
- Repeated cancellation behavior
- Current Customer/Guest concurrency surface
- Current Customer/Guest points/event order
- Merchant B5 cancellation regression

Out of scope:

- Runtime behavior changes
- Schema or migration
- Guest cancel token implementation
- Persistent idempotency
- D1 transaction or batch redesign
- LINE or Web Push implementation changes
- Production deployment

## Frozen Customer / Guest Contract

Current Customer/Guest route:

```text
POST /api/bookings/cancel
```

Current success response shape:

```json
{
  "ok": true,
  "profile": {}
}
```

Current Customer Session authorization:

```text
Customer signed session
-> tenant must match request tenant
-> booking.customer_id must match session customer_id
```

Current Guest fallback authorization:

```text
bookingId + phone
```

The phone fallback is transitional only. Product decision: future Guest cancellation will be token-only. `bookingId + phone` may only remain for legacy bookings that do not have a cancel token.

## Frozen Legacy Behavior

B6.1 explicitly freezes these current behaviors so later work can change them intentionally:

- Customer/Guest cancellation does not currently require `expected_updated_at`.
- Customer/Guest cancellation does not currently use an original-status SQL predicate.
- Customer/Guest cancellation currently keeps response shape `{ ok: true, profile }`.
- Repeated cancellation skips the update/event/points path once the booking is already `cancelled`.
- Current Customer/Guest side-effect order is:

```text
status update
-> appendBookingEvent()
-> booking_events insert
-> LINE/Web Push notification paths
-> inline point rollback/refund
```

This differs from the B5 Merchant cancellation order:

```text
status update
-> rollbackBookingCustomerPoints()
-> appendBookingEvent()
-> booking_events insert
-> LINE/Web Push notification paths
```

## B6.2 Guardrails

B6.2 may start only after B6.1 is merged and should remain scoped to Customer Session cancellation.

B6.2 must preserve:

- `POST /api/bookings/cancel`
- Customer success response `{ ok: true, profile }`
- no Guest token migration
- no Guest phone fallback removal
- no LINE/Web Push implementation rewrite

B6.2 should address:

- Customer Session cancellation command boundary
- tenant + booking + customer + original status conditional update
- no `expected_updated_at` requirement yet
- no Customer/Guest point-order unification yet

## Deferred Decisions

The following decisions are deferred to later B6.x phases:

- B6.3: unify Customer/Guest point rollback order with Merchant B5.
- B6.4: design Guest cancel token schema and migration.
- B6.5: implement token-based Guest cancellation.
- B6.6: retire `bookingId + phone` fallback after a transition window.

## Test Coverage

Added script:

```bash
npm run test:cancellation-current-state
```

The test covers:

- Customer Session cancel success
- Guest phone fallback success
- Guest wrong phone denied
- Customer Session tenant mismatch currently falls through to Guest phone fallback when a matching phone is supplied; this is a B6.2 blocker
- repeated cancel does not append another event or points mutation
- current absence of `expected_updated_at` and original-status predicates
- current legacy order: update -> event/notification -> points
- Merchant B5 regression: update -> points -> event


## B6.2 Blocker

B6.1 found that `POST /api/bookings/cancel` currently calls `readCustomerSession()` instead of `requireCustomerSession()` and therefore a mismatched Customer Session can still fall through to Guest `bookingId + phone` authorization. B6.2 must close this before moving Customer Session cancellation into a command boundary.
