# B7.3 Guest Cancel Aggregate Observability

B7.3 adds an aggregate-only daily counter for guest cancellation rollout observability. It is intended to support future fallback sunset decisions without storing raw events or identifying data.

## Scope

Included:

- New local migration proposal file: `0024_guest_cancel_observation_daily.sql`.
- Best-effort daily aggregate writes for existing B6.7 guest cancellation observations.
- Controlled SQL report examples for sunset readiness.

Excluded:

- Production deployment.
- Remote D1 migration or write.
- Admin, merchant, or public API/UI.
- Raw event storage.
- Tenant, booking, customer, phone, token, token hash, LINE UID, name, email, request body, cookie, or authorization storage.
- Persistent idempotency, transaction redesign, point rollback redesign, or notification persistence.

## Runtime Flag

`GUEST_CANCEL_AGGREGATE_ENABLED` controls aggregate writes.

| Value | Behavior |
| --- | --- |
| `on` | Enabled. Writes best-effort daily aggregate counters. |
| `enabled` | Enabled. Writes best-effort daily aggregate counters. |
| missing | Disabled. No aggregate writes. |
| `off` | Disabled. No aggregate writes. |
| any typo | Disabled. No aggregate writes. |

The flag is fail-safe. Only explicit `on` or `enabled` can write aggregate counters.

## Aggregate Table

Table: `guest_cancel_observation_daily`

Allowed columns only:

- `day`
- `rollout_mode`
- `event_type`
- `result`
- `reason_code`
- `path_type`
- `count`
- `created_at`
- `updated_at`

The primary key is the daily dimension tuple:

`day, rollout_mode, event_type, result, reason_code, path_type`

Counter updates use SQLite upsert:

`count = count + 1`

No identifying fields are present. Tenant-level analytics are intentionally excluded from B7.3.

## Observation Mapping

Existing B6.7 observation names map directly into aggregate rows:

| Observation | path_type | Typical result | Typical reason_code |
| --- | --- | --- | --- |
| `guest_cancel_token_issued` | `guest_create` | `success` | `token_row_created` |
| `guest_cancel_token_cancel_success` | `token` | `success` | `cancelled` |
| `guest_cancel_token_cancel_failure` | `token` | `failure` | `token_api_disabled`, `malformed`, `not_available`, `not_cancellable`, `exception` |
| `guest_cancel_legacy_fallback_success` | `phone_fallback` | `success` | `cancelled` |
| `guest_cancel_phone_fallback_blocked` | `phone_fallback` | `blocked` | `token_policy` |

## Fail-Open Behavior

Aggregate writes are best-effort. They are executed after the primary route behavior is determined and must not affect:

- guest booking creation
- token cancellation
- legacy phone fallback cancellation
- merchant token rotation

If the aggregate table is missing, the flag is disabled, D1 fails, `ctx.waitUntil` fails, or the logger fails, user-facing behavior must remain unchanged.

## Non-Idempotency Caveat

This aggregate is not persistent idempotency.

Counts can be inaccurate when:

- the Worker retries a request after a partial failure
- the runtime terminates before a best-effort aggregate write completes
- the request succeeds but the aggregate write fails
- the aggregate write succeeds but later user-visible work fails elsewhere

Sunset decisions must combine aggregate counters with live SQL cross-checks against current booking and token state.

## Retention

Retention target: 400 days.

B7.3 does not add an automatic purge job. Future cleanup can delete rows older than the retained window after production rollout policy is finalized.

## Controlled SQL Reports

These SQL snippets are for controlled operator use only. They must not be exposed through merchant, public, or customer APIs.

### 30-Day Legacy Phone Fallback Success

```sql
SELECT
  day,
  SUM(count) AS legacy_fallback_success_count
FROM guest_cancel_observation_daily
WHERE day >= date('now', '-29 days')
  AND event_type = 'guest_cancel_legacy_fallback_success'
  AND result = 'success'
  AND path_type = 'phone_fallback'
GROUP BY day
ORDER BY day;
```

Sunset requires this count to be zero for 30 consecutive days.

### Future Cancellable Guest Booking Token Coverage

This report uses live state. It must be run against the current schema and status rules before any fallback sunset decision.

```sql
WITH future_guest_bookings AS (
  SELECT b.id, b.tenant_id
  FROM bookings b
  LEFT JOIN customers c
    ON c.id = b.customer_id
   AND c.tenant_id = b.tenant_id
  WHERE b.status IN ('pending', 'confirmed', 'checked_in')
    AND datetime(b.booking_date || ' ' || b.start_time) >= datetime('now')
    AND (b.customer_type IS NULL OR b.customer_type = '' OR b.customer_type = 'guest')
    AND (c.identity_id IS NULL OR c.identity_id = '')
), active_tokens AS (
  SELECT DISTINCT tenant_id, booking_id
  FROM booking_cancel_tokens
  WHERE status = 'active'
    AND datetime(expires_at) > datetime('now')
)
SELECT
  COUNT(*) AS future_guest_booking_count,
  SUM(CASE WHEN at.booking_id IS NOT NULL THEN 1 ELSE 0 END) AS tokenized_booking_count,
  SUM(CASE WHEN at.booking_id IS NULL THEN 1 ELSE 0 END) AS no_token_booking_count,
  CASE
    WHEN COUNT(*) = 0 THEN 100.0
    ELSE ROUND(100.0 * SUM(CASE WHEN at.booking_id IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*), 2)
  END AS token_coverage_percent
FROM future_guest_bookings fgb
LEFT JOIN active_tokens at
  ON at.tenant_id = fgb.tenant_id
 AND at.booking_id = fgb.id;
```

Sunset requires token coverage to be 100% for future cancellable guest bookings.

### Tokenized vs No-Token Snapshot

```sql
WITH future_guest_bookings AS (
  SELECT b.id, b.tenant_id
  FROM bookings b
  LEFT JOIN customers c
    ON c.id = b.customer_id
   AND c.tenant_id = b.tenant_id
  WHERE b.status IN ('pending', 'confirmed', 'checked_in')
    AND datetime(b.booking_date || ' ' || b.start_time) >= datetime('now')
    AND (b.customer_type IS NULL OR b.customer_type = '' OR b.customer_type = 'guest')
    AND (c.identity_id IS NULL OR c.identity_id = '')
), active_tokens AS (
  SELECT DISTINCT tenant_id, booking_id
  FROM booking_cancel_tokens
  WHERE status = 'active'
    AND datetime(expires_at) > datetime('now')
)
SELECT
  CASE WHEN at.booking_id IS NULL THEN 'no_token' ELSE 'tokenized' END AS token_state,
  COUNT(*) AS booking_count
FROM future_guest_bookings fgb
LEFT JOIN active_tokens at
  ON at.tenant_id = fgb.tenant_id
 AND at.booking_id = fgb.id
GROUP BY token_state
ORDER BY token_state;
```

## Sunset Gate

Fallback sunset is not authorized by this PR.

Minimum gate:

1. Aggregate shows `guest_cancel_legacy_fallback_success` is zero for 30 consecutive days.
2. Live SQL shows future cancellable guest booking token coverage is 100%.
3. Tony explicitly approves the sunset date.

## Operational Notes

- B7.3 does not expose aggregate data through an API.
- B7.3 does not modify rollout modes or token policy.
- B7.3 does not solve non-transaction point rollback, event notification, or idempotency risks.
- Remote D1 migration requires separate Tony authorization.
