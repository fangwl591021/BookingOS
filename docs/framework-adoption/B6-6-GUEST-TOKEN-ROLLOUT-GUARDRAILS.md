# B6.6 Guest Token Rollout Guardrails

## Status

Documentation-only rollout guardrails. No runtime change, no schema change, no migration execution, no Remote D1 write, and no production deployment.

Current production rollout is **NO-GO**.

## Production NO-GO

Do not set production `GUEST_CANCEL_TOKEN_ROLLOUT` to `write` yet.

`write` creates `booking_cancel_tokens` rows for new unauthenticated web guest bookings and blocks legacy `bookingId + phone` fallback as soon as a token row exists. Because the token delivery path is not approved for production yet, switching directly to `write` can leave new guests without a working self-service cancellation path.

Do not set production to `verify` or `enforce` yet. They also require approved cancel-link delivery, observability, Remote D1 migration execution, and formal rollout authorization.

`enforce` currently has no practical runtime difference from `verify`. It must not be represented as completed fallback sunset.

## Rollout Modes: Actual Current Behavior

Missing, empty, or misspelled `GUEST_CANCEL_TOKEN_ROLLOUT` values fail safe to `off`.

| Mode | Token rows for new guest web bookings | Token cancel API | Tokenized booking phone fallback | Legacy no-token phone fallback | Production status |
| --- | --- | --- | --- | --- | --- |
| `off` | No | Disabled | Not applicable | Allowed by existing legacy rules | Safe default |
| `write` | Yes | Disabled | Blocked when token row exists | Allowed only when no token row exists | NO-GO for production |
| `verify` | Yes | Enabled | Blocked when token row exists | Allowed only when no token row exists | NO-GO until gates pass |
| `enforce` | Yes | Enabled | Blocked when token row exists | Allowed only when no token row exists | NO-GO; no sunset difference from `verify` yet |

## P1 Risk: Write Mode Fallback Lockout

`write` is not a pure dark launch today. It writes token rows and immediately changes cancellation authorization for those bookings by blocking `bookingId + phone` fallback.

Risk:

```text
new guest booking
-> token row exists
-> legacy phone fallback blocked
-> token API disabled in write mode
-> guest cannot self-cancel
```

This is a P1 rollout risk and blocks production `write` until Tony explicitly decides whether `write` should become a true dark launch.

## Remote D1 Migration SOP for 0023

These commands are examples only and require separate Tony authorization. Do not run them as part of B6.6.

### 1. Backup

Requires Tony separate authorization:

```powershell
npx.cmd wrangler d1 backup create BOOKINGOS_DB --remote
```

Record the backup id and timestamp before any migration attempt.

### 2. Pending Migration Check

Requires Tony separate authorization:

```powershell
npx.cmd wrangler d1 migrations list BOOKINGOS_DB --remote
```

Expected precondition:

- `0023_booking_cancel_tokens.sql` is pending.
- No unexpected older migrations are pending.
- Production Worker rollout flag remains `off`.

### 3. Schema and Index Review

Review `migrations/0023_booking_cancel_tokens.sql` before remote apply.

Required objects:

- Table: `booking_cancel_tokens`
- Unique index: `idx_booking_cancel_tokens_hash`
- Unique active-token index: `idx_booking_cancel_tokens_one_active`
- Lookup index: `idx_booking_cancel_tokens_booking_active`
- Expiry index: `idx_booking_cancel_tokens_expiry`
- Replacement index: `idx_booking_cancel_tokens_replaced_by`

### 4. Apply

Requires Tony separate authorization:

```powershell
npx.cmd wrangler d1 migrations apply BOOKINGOS_DB --remote
```

Do not combine migration apply with rollout flag changes. Migration must complete and be verified while rollout remains `off`.

### 5. Post-Check

Requires Tony separate authorization:

```powershell
npx.cmd wrangler d1 execute BOOKINGOS_DB --remote --command "SELECT name, type FROM sqlite_master WHERE name LIKE 'booking_cancel_tokens%' OR name LIKE 'idx_booking_cancel_tokens%';"
```

Expected:

- `booking_cancel_tokens` exists.
- All five indexes exist.
- Existing booking, customer, merchant cancellation tests remain green on the deployed version before any rollout change.

### 6. Rollback Limitation

Rollback is not a simple runtime toggle once token rows are written.

If only the migration was applied and no production traffic wrote token rows, rollback can be considered by dropping indexes and table after backup and approval.

If token rows exist, rollback requires a separate incident plan because deleting token rows can change cancellation authorization and audit evidence.

## Observability Gaps

Minimum observability is not complete yet. Before production `write`, `verify`, or `enforce`, add safe metrics or reports that do not expose token plaintext, phone numbers, LINE UID, or customer personal data.

Required measurements:

- Token row coverage: future guest bookings with token row / eligible future guest bookings.
- Token cancel success and failure counts using safe categories only.
- Legacy phone fallback success usage count.
- Tokenized booking phone fallback rejection count.
- Sunset gate: legacy fallback success usage remains zero for 30 consecutive days.

Failure classification must avoid enumeration signals. Public responses stay generic.

## Backfill Policy

Backfill is limited to dry-run and coverage reporting until separately approved.

Allowed:

- Count eligible future guest bookings without token rows.
- Report coverage by tenant and date bucket without personal data.
- Estimate impact before enabling rollout.

Not allowed:

- Automatically generate token rows for existing bookings.
- Re-send plaintext cancellation links.
- Store plaintext tokens.
- Change existing legacy phone fallback eligibility.

## Rollout and Sunset Gates

### Gate 1: Migration Readiness

Required before any production rollout flag change:

- Remote D1 backup completed.
- `0023_booking_cancel_tokens.sql` applied and verified.
- Rollout flag remains `off` during migration.
- No unexpected pending migrations.
- Smoke and cancellation regression checks pass after migration.

### Gate 2: Token Delivery and Verify Readiness

Required before `verify`:

- Approved guest token link delivery channel.
- Link uses `/store/{slug}/cancel#b={bookingId}&t={token}`.
- Token is sent only in JSON body to `POST /store/{slug}/api/bookings/cancel-token`.
- Token is not placed in query string, server logs, analytics, or error logs.
- Observability for token success/failure and legacy fallback usage is available.

### Gate 3: Fallback Sunset

Required before claiming `enforce` or removing fallback:

- Token coverage is 100% for future cancellable guest bookings.
- No future cancellable booking lacks a token row.
- Legacy phone fallback success usage is zero for 30 consecutive days.
- Sunset date is approved by Tony.
- `enforce` runtime behavior has been implemented to differ from `verify`, or documentation continues to state that sunset is not complete.

## Tony Decisions Needed

1. Should `write` become a true dark launch that writes tokens but does not block fallback yet?
2. What is the approved guest token link delivery channel?
3. Can production skip `write` and move directly to `verify` after migration and delivery are ready?
4. What exact observability thresholds, fallback usage gate, and sunset date should authorize fallback removal?

## Safety Boundary

B6.6 does not solve:

- Cancellation transactionality.
- Point rollback atomicity.
- Event or notification persistence.
- Persistent idempotency or replay.
- Remote migration authorization.
- Production rollout authorization.

These remain separate decisions and implementation phases.