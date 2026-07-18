# B6.5 Guest Cancellation Token

## Status

Draft implementation PR. Not deployed. Remote D1 migration not applied.

## Scope

B6.5 implements the first Guest cancellation token path:

- Adds `booking_cancel_tokens` migration proposal as executable migration `0023_booking_cancel_tokens.sql`.
- Creates cancel token rows for new unauthenticated web guest bookings when `GUEST_CANCEL_TOKEN_ROLLOUT` is `write`, `verify`, or `enforce`.
- Adds public cancel page route: `/store/{slug}/cancel#b={bookingId}&t={token}`.
- Adds token cancel API: `POST /store/{slug}/api/bookings/cancel-token`.
- Blocks `bookingId + phone` fallback for tokenized bookings as soon as a cancel token row exists.

## Rollout Flag

`GUEST_CANCEL_TOKEN_ROLLOUT` supports:

```text
off
write
verify
enforce
```

No `wrangler.toml` value is added in this PR. Missing configuration defaults to `off`.

## Token Transport

The public cancel link uses URL fragment only:

```text
/store/{slug}/cancel#b={bookingId}&t={token}
```

The server never receives the fragment. The browser page reads the fragment and sends:

```text
POST /store/{slug}/api/bookings/cancel-token
```

with JSON body fields `bookingId` and `token`.

The token is not accepted in query string and is not logged by the implementation.

## Token Storage

Token plaintext is generated with 32 random bytes encoded as base64url. The database stores only:

```text
SHA-256(tenant_id + ":" + booking_id + ":" + token)
```

The booking creation response does not return token plaintext.

## Cancellation Flow

Valid token cancellation reuses the B6.3 guest cancellation boundary:

```text
status update
-> rollbackBookingCustomerPoints()
-> appendBookingEvent()
-> notification side effects inside appendBookingEvent()
```

Success response is intentionally minimal:

```json
{ "ok": true }
```

All token verification failures return:

```text
CANCELLATION_NOT_AVAILABLE
```

The response does not reveal booking existence, tenant existence, expiry, revocation, used state, or token validity.

## Used Marking

The token is marked `used` only after cancellation succeeds. This mark is best effort. If marking `used` fails, the booking is already cancelled, so repeated token use fails generically because the booking is no longer cancellable.

## Non-Transaction Risk

B6.5 does not redesign cancellation as a D1 transaction. The known B6.3 risk remains:

- booking status may already be changed before point rollback failure;
- token `used` marking can fail after cancellation succeeds;
- notification delivery remains best effort through existing `appendBookingEvent()` behavior;
- persistent idempotency is not implemented.

These are intentionally deferred from B6.5.

## Explicit Non-Scope

B6.5 does not implement:

- remote D1 migration;
- production deployment;
- `wrangler.toml` or binding changes;
- LINE or Web Push implementation changes;
- automatic backfill resend;
- phone fallback sunset;
- persistent idempotency;
- D1 transaction/batch redesign for cancellation.
