# B3 Booking Command Boundary Foundation

## Scope

Sprint B3 establishes the first Booking command boundary without changing schema, migrations, Cloudflare bindings, secrets, LINE behavior, Web Push behavior, booking lifecycle transitions, or production deployment.

Adopted low-risk commands:

- Merchant note update
- Booking customer info update
- Booking event read
- Booking event append for note/customer updates
- Optimistic conflict result
- Command error result mapping
- Idempotency envelope skeleton

Deferred lifecycle commands remain legacy-compatible:

- status transition
- cancel
- reschedule
- reassign
- no-show, checked-in, in-service, completed
- point reversal
- notification send

## Command Flow

Adopted routes now follow this boundary for the scoped commands:

```text
Route
-> Booking Command Service
-> Booking Repository / Booking Event Repository
-> Existing D1 write/read
```

The Worker router remains authoritative. Route URLs, HTTP methods, permission checks, and response contracts are preserved.

## Merchant Note Boundary

Route:

- `POST /api/merchant/bookings/:bookingId/note`

Boundary behavior:

- Loads the booking through a tenant-scoped command service lookup.
- Preserves existing 404 for missing booking.
- Preserves optimistic conflict behavior for `expected_updated_at`.
- Applies existing tenant access rules before the command write.
- Updates `bookings.merchant_note` through `bookingRepository.updateMerchantNote`.
- Preserves legacy note length behavior: notes longer than 1000 characters are truncated and still return the existing success shape.
- Appends `merchant_note_updated` through `bookingEventRepository.append`.
- Returns the existing `{ ok, booking }` shape.
- Does not trigger LINE or Web Push notification.
- Does not change booking status.

## Customer Update Boundary

Route:

- `POST /api/merchant/bookings/:bookingId/customer`

Boundary behavior:

- Loads the booking through a tenant-scoped command service lookup.
- Preserves `CUSTOMER_NAME_REQUIRED` for missing customer name.
- Preserves optimistic conflict behavior for `expected_updated_at`.
- Updates `bookings.customer_name` and `bookings.customer_phone` through `bookingRepository.updateCustomerInfo`.
- Appends `customer_updated` through `bookingEventRepository.append`.
- Metadata is reduced to safe fields and does not include token, cookie, LINE UID, session, or full request payload.
- Returns the existing `{ ok, booking }` shape.
- Does not create or modify Customer CRM profile.
- Does not trigger LINE or Web Push notification.
- Does not change booking status.

## Event Read And Append Boundary

Event read route:

- `POST /api/merchant/bookings/:bookingId/events`

The route method remains POST because that is the existing BookingOS contract used by the current operations UI. B3 does not introduce a new GET route.

Boundary behavior:

- Validates the booking through tenant-scoped command service lookup before event read.
- Reads events through `bookingEventRepository.listByBookingId`.
- Preserves ordering by `created_at ASC`.
- Preserves `{ ok, events }` response shape.

Event append boundary:

- `bookingEventRepository.append` owns INSERT SQL for B3 note/customer events.
- Allowed B3 event types are limited to `merchant_note_updated` and `customer_updated`.
- Status, cancel, reschedule, and reassign event appends remain legacy for this sprint.

## Conflict Model

B3 keeps optimistic conflict semantics:

- If `expected_updated_at` is present and does not match current `booking.updated_at`, the route returns HTTP 409 with `BOOKING_CONFLICT`.
- If the conditional UPDATE changes zero rows, the command returns `BOOKING_CONFLICT`.
- Conflict paths do not append events.
- Last-write-wins is not introduced.

## Idempotency Envelope Status

`src/runtime/idempotency-envelope.js` creates a non-persistent envelope from request headers.

Fields:

- key
- fingerprint
- source
- requestId
- receivedAt

Status:

- Idempotency Persistence: Not Implemented
- Replay Protection: Not Implemented
- Stored Result: Not Implemented

The envelope is command context metadata only. B3 does not create an idempotency table, in-memory replay map, or exactly-once guarantee.

## Transaction Limitation

Current BookingOS behavior updates a booking and then appends a booking event as separate D1 operations. B3 preserves that behavior and does not claim atomicity.

Known limitation:

- Booking update can succeed even if event append fails.
- This matches the previous legacy helper, which swallowed event append failures.
- A future lifecycle command sprint may define a transaction or durable audit strategy.

## Routes Adopted

Adopted into command boundary:

- `POST /api/merchant/bookings/:bookingId/note`
- `POST /api/merchant/bookings/:bookingId/customer`
- `POST /api/merchant/bookings/:bookingId/events`

Legacy-compatible and intentionally not adopted:

- `POST /api/merchant/bookings/:bookingId/status`
- `POST /api/merchant/bookings/:bookingId/reschedule`
- `POST /api/merchant/bookings/:bookingId/reassign`
- customer cancel route
- booking create route

## Tests

Added `npm run test:booking-command-boundary`, covering:

- note update success
- note validation error
- customer update success
- customer name required
- booking not found
- optimistic conflict
- conditional update conflict
- cross-tenant scoped not found
- event read response shape
- event read safe DB error
- note update safe DB error
- metadata sanitization
- idempotency envelope skeleton
- legacy status mutation path remains outside command boundary

## No-schema Statement

B3 introduces no migration, table, column, index, binding, secret, or D1 production write. It only moves selected existing D1 reads/writes behind repository methods.

## Deployment Status

Production deployment is not authorized and was not performed in B3.
