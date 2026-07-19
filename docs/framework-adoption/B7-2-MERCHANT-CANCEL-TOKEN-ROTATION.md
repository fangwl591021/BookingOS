# B7 PR 2 - Merchant Cancel Token Rotation

Status: Draft PR scope
Base: feature/sprint-3-engagement-foundation
Branch: refactor/b7-2-merchant-cancel-token-rotation

## Scope

B7 PR 2 lets an authorized merchant regenerate a one-time guest cancellation link for a booking. The feature is limited to the merchant operations surface and does not change Customer Session cancellation, guest phone fallback, booking creation, point rollback, event notification, LINE, Web Push, or rollout policy.

## Merchant Route

```text
POST /api/merchant/bookings/:bookingId/cancel-token
```

Successful response:

```json
{
  "ok": true,
  "cancelUrl": "/store/anhe/cancel#b=booking-1&t=...",
  "expiresAt": "2026-07-21 10:00:00"
}
```

Failure response uses the existing merchant error envelope:

```json
{
  "ok": false,
  "error": {
    "code": "CANCEL_TOKEN_ROTATION_NOT_ALLOWED",
    "message": "..."
  }
}
```

## Authorization and Tenant Boundary

The route stays inside the existing merchant booking action path:

1. Merchant session is required.
2. The session tenant is revalidated through tenant admin role data.
3. Existing merchant booking action permission and tenant capability checks remain in force.
4. The booking is loaded with `tenant_id + booking_id`.
5. Cross-tenant booking access cannot load or mutate the token rows.

## Eligibility

Rotation is allowed only when all conditions are true:

- `GUEST_CANCEL_TOKEN_ROLLOUT` is `write`, `verify`, or `enforce`.
- Booking status can still be cancelled by the existing rules: `pending`, `confirmed`, or `checked_in`.
- Booking `source` is `web`.
- Booking is not a member/customer-session booking.
- `customers.identity_id` is empty for the booking customer.
- Store slug exists so the fragment URL can be generated.

The route rejects `in_service`, `completed`, `no_show`, and `cancelled` bookings. It also rejects member/customer-linked bookings and walk-in/setup-test style bookings.

## Rotation Flow

The current implementation intentionally does not use D1 batch or transaction for rotation, per product approval.

```text
1. Revoke active token rows for tenant_id + booking_id.
2. Generate a new 256-bit random token in request memory.
3. Store only SHA-256 hash in booking_cancel_tokens.
4. Return a fragment cancel URL once in the merchant response.
```

The cancel URL keeps token transport in the fragment:

```text
/store/{slug}/cancel#b={bookingId}&t={token}
```

The plaintext token is not stored in D1, booking events, logs, list responses, or error envelopes.

## Non-Atomic Risk

Because B7 PR 2 does not use a D1 batch/transaction, this partial failure remains possible:

```text
old active token revoked -> new token insert fails
```

In that case the API returns an error and does not return `cancelUrl`. The booking may temporarily have no active guest cancel token. The minimal operational remediation is for the merchant to retry rotation. This PR does not claim atomicity, persistent idempotency, or automatic compensation.

A second partial failure class also remains outside this PR:

```text
rotation succeeds -> later guest cancellation point/event/notification side effects follow B6 behavior
```

B7 PR 2 does not redesign cancellation transactions.

## Merchant UX

The merchant operations workbench exposes a rotate action only when `canRotateCancelToken` is true. After successful rotation, the page shows the new cancel URL and a copy button. The link is shown only in that rendered response state; refreshing or leaving the page loses the plaintext.

The UI does not store the cancel URL in localStorage, sessionStorage, cookies, booking events, or merchant list API data.

## Explicit Non-Scope

- No schema or migration changes.
- No Remote D1 migration or manual write.
- No production deployment.
- No `wrangler.toml`, secret, or binding changes.
- No LINE API call and no Web Push send.
- No merchant automatic LINE/Email/SMS resend.
- No D1 aggregate observability table.
- No persistent idempotency or replay result.
- No transaction redesign.

## Regression Coverage

The focused guest token test covers:

- Successful merchant rotation.
- Old token rejected after rotation.
- New token can cancel.
- Terminal statuses reject without token mutation.
- Member/customer-linked booking rejects without token mutation.
- Insert failure returns no cancel URL and writes no booking event.
- Sequential rotations leave one active token.
- Existing B6 token cancellation, phone fallback, rollout, anti-enumeration, and logger fail-open behavior remain covered.

Full PR validation should include:

```text
npm run check
npm run test:guest-cancel-token
npm run test:cancellation-current-state
npm run test:booking-command-boundary
npm run test:runtime-boundary
npm run test:domain-boundary
npm run smoke
git diff --check
```
