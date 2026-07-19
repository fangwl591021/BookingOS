# B7 Guest Cancel Link Delivery

B7 PR 1 makes guest cancellation tokens usable by returning a one-time cancellation link immediately after a qualifying guest web booking succeeds.

## Scope

Implemented in this phase:

- Return `cancelUrl` only on successful unauthenticated web guest booking creation.
- Render the cancel link once on the public store booking success panel.
- Provide a copy button and selectable fallback text.
- Keep the public cancel URL format as a browser fragment: `/store/{slug}/cancel#b={bookingId}&t={token}`.
- Clear the fragment on the cancel page with `history.replaceState()` before the token API call.
- Add `Referrer-Policy: no-referrer` to the cancel page HTML response.

Not implemented in this phase:

- Merchant resend or token rotation.
- D1 aggregate observability.
- Remote D1 migration.
- Production rollout or deployment.
- LINE, email, SMS, or Web Push delivery of the link.
- Cancellation transaction redesign or persistent idempotency.

## Delivery Rules

`createBooking()` may include `cancelUrl` in the existing success response only when all conditions are true:

1. The request has no valid Customer Session.
2. The booking source is `web`.
3. `GUEST_CANCEL_TOKEN_ROLLOUT` is `write`, `verify`, or `enforce`.
4. The booking row and `booking_cancel_tokens` row are created successfully.
5. The tenant store has a slug for the public store URL.

Existing response fields remain unchanged:

```json
{
  "ok": true,
  "bookingId": "...",
  "customerId": "...",
  "booking": {}
}
```

When eligible, the response also includes:

```json
{
  "cancelUrl": "/store/anhe/cancel#b=booking-id&t=plaintext-token"
}
```

The plaintext token is never stored in D1. It exists only in request memory and the one successful response.

## Exclusions

`cancelUrl` is not returned for:

- authenticated Customer Session bookings;
- walk-in bookings;
- setup test bookings;
- rollout `off` or unknown rollout values;
- failed token row creation.

## Frontend Behavior

The public `/store/{slug}` booking page shows the cancel link only after a successful response containing `cancelUrl`.

The panel tells the visitor:

```text
請立即複製保存；離開此頁後無法再次顯示。
```

The page does not write the cancel URL or token to `localStorage`, `sessionStorage`, cookies, analytics, or debug console output.

If Clipboard API copy fails, the input remains selectable so the visitor can copy manually.

## Cancel Page Protection

The cancel page reads `bookingId` and token from `location.hash`, then immediately calls:

```js
history.replaceState(null, document.title, location.pathname + location.search)
```

The token API remains POST-body only:

```text
POST /store/{slug}/api/bookings/cancel-token
```

Token failures keep the generic anti-enumeration response from B6.5.

The cancel page response is `Cache-Control: no-store` and includes a no-referrer policy for this page only.

## Security Notes

Plaintext token and `cancelUrl` must not be written to:

- D1 rows;
- `booking_events`;
- safe observation logs;
- error envelopes;
- merchant/customer list API responses;
- browser storage;
- URL query strings.

B7 PR 1 does not solve the known non-transaction risks from B6.3/B6.5. In particular:

- cancellation status, point rollback, event append, notification, and token `used` marking are not made atomic;
- persistent idempotency is still deferred;
- token link resend and rotation are still deferred.

## Tests

Focused coverage is in:

```bash
npm run test:guest-cancel-token
```

B7 additions verify:

- eligible guest create response includes a fragment `cancelUrl`;
- D1 stores only token hash;
- Customer Session and walk-in bookings do not receive `cancelUrl`;
- rollout `off` and unknown values do not create token rows or return `cancelUrl`;
- token row creation failure does not return a successful `cancelUrl` response;
- the booking page renders the one-time link panel and does not use browser storage;
- the cancel page clears fragment data and uses no-referrer protection.
