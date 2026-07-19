# B6.7 Guest Token Dark Launch Observability

## Status

Runtime guardrail update for Guest cancellation token rollout. No schema change, no migration file change, no Remote D1 write, no binding or secret change, and no production deployment.

## Rollout Behavior

`GUEST_CANCEL_TOKEN_ROLLOUT` still accepts `off`, `write`, `verify`, and `enforce`. Missing, empty, or misspelled values fail safe to `off`.

| Mode | Token rows for new guest web bookings | Token cancel API | Tokenized booking phone fallback | Legacy no-token phone fallback |
| --- | --- | --- | --- | --- |
| `off` | No | Disabled | Not applicable | Allowed by existing legacy rules |
| `write` | Yes | Disabled | Allowed by existing legacy rules | Allowed by existing legacy rules |
| `verify` | Yes | Enabled | Blocked when token row exists | Allowed by existing legacy rules |
| `enforce` | Yes | Enabled | Blocked when token row exists | Allowed by existing legacy rules |

B6.7 changes `write` into a true dark launch: it can create hash-only token rows for new unauthenticated web guest bookings without changing customer-facing cancellation authorization. This lets coverage be observed before token links are approved for production use.

`verify` and `enforce` continue to block `bookingId + phone` fallback when a booking already has a cancel-token row. `enforce` still has no fallback sunset behavior beyond `verify`; fallback removal remains a later approval gate.

## Safe Observability

B6.7 adds log-only structured observations through the existing safe logger. No D1 metrics table is introduced.

Allowed fields:

```text
event
level
timestamp
eventType
rolloutMode
result
reasonCode
pathType
credentialRowPresent
```

Observed event types:

```text
guest_cancel_token_issued
guest_cancel_token_cancel_success
guest_cancel_token_cancel_failure
guest_cancel_legacy_fallback_success
guest_cancel_phone_fallback_blocked
```

The observation payload must not include tenant id, booking id, customer id, phone, email, LINE UID, token plaintext, token hash, request body, cookie, authorization header, or token-bearing URL.

## Security Boundaries

B6.7 does not change:

- Customer Session tenant/customer mismatch rejection from B6.2.
- Customer cancellation response contract `{ ok: true, profile }`.
- Merchant cancellation command boundary from B5.
- Guest token cancel success response `{ ok: true }` and generic token failure response.
- Cancellation point rollback, event, LINE, or Web Push implementation.
- Non-transaction and non-persistent-idempotency risks.

## Remaining Production Gates

Production rollout is still not authorized. Before `write`, `verify`, or `enforce` is used in production, Tony still needs to authorize:

1. Remote D1 migration `0023_booking_cancel_tokens.sql`.
2. Guest token link delivery channel.
3. Whether log-only observability is enough or a persistent aggregate metrics table is required.
4. Exact fallback sunset criteria and date.

B6.7 only removes the write-mode lockout risk. It does not complete token rollout.