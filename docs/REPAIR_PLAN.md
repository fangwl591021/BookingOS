# BookingOS Repair Plan

Date: 2026-07-11
Status: executable repair roadmap.

This plan is intentionally conservative. The goal is to stop regressions, separate the product boundaries, and make the system usable before adding more features.

## Guiding Principle

Do not add new business features until these three foundations are stable:

1. Identity and session boundaries.
2. Tenant isolation.
3. Booking and scheduling correctness.

The system should be repaired in small, verifiable steps. Every step must preserve:

- Merchant LINE login.
- Customer phone plus ROC birthday login.
- Guest booking.
- Tenant-scoped store backend.

## Phase 0: Freeze and Clarify

Goal:

- Stop the system from changing direction every time a login bug appears.

Tasks:

1. Treat `docs/CURRENT_SYSTEM_STATE.md` as the current source of truth.
2. Update stale docs that still imply Customer LINE is active.
3. Mark Customer LINE as parked, not in-progress.
4. Document the exact store booking URL and member login URL format.
5. Add a visible internal note in docs: customer member pages must never use merchant login.

Acceptance:

- A developer can read one document and know which login paths are active.
- No task checklist claims Customer LIFF is accepted.
- Customer phone plus ROC birthday is clearly the V1 member login.

Suggested commit:

```text
docs: freeze current BookingOS system state
```

## Phase 1: Route and Session Boundary Repair

Goal:

- Make it impossible for customer pages to fall into merchant login again.

Tasks:

1. Separate route intent clearly:
   - Public customer routes.
   - Customer member routes.
   - Merchant routes.
   - Platform routes.
   - Webhook routes.
2. Remove or isolate compatibility logic that makes `/merchant-login` render customer login.
3. Ensure `/member`, `/points`, `/history`, and customer tab URLs always require customer session only.
4. Ensure unauthenticated customer member access redirects only to `/member-login`.
5. Ensure unauthenticated merchant access redirects only to `/merchant-login`.
6. Use `/store/{slug}` as the public customer URL; keep `/book?tenant=...` only as a redirect when a slug exists.
7. Keep `/merchant-login` and merchant LINE login unchanged unless tests require a small fix.

Acceptance:

- `/book?tenant=demo-tenant` redirects to `/store/anhe`.
- Member tab without customer session goes to `/member-login`, not `/merchant-login`.
- Points tab without customer session goes to `/member-login`, not `/merchant-login`.
- History tab without customer session goes to `/member-login`, not `/merchant-login`.
- `/merchant?tenant=demo-tenant` without merchant session goes to `/merchant-login`.
- Customer login page never contains Merchant Console text or admin account fields.
- Merchant login page still works with account login and LINE login.

Suggested commit:

```text
fix: separate customer and merchant login routes
```

## Phase 2: Default-Deny API Guard

Goal:

- Prevent new API routes from accidentally becoming public or cross-tenant.

Tasks:

1. Classify every route:
   - Public.
   - Customer session required.
   - Merchant session required.
   - Platform session required.
   - Webhook signature required.
2. Build a single API guard map.
3. Make unknown `/api/*` routes fail closed.
4. Require tenant source to come from the correct authority:
   - Public booking: query tenant.
   - Customer APIs: customer session tenant.
   - Merchant APIs: merchant session tenant.
   - Platform APIs: explicit platform-only logic.
5. Add clear error codes for wrong session type.

Acceptance:

- Unknown `/api/foo` is not public.
- Customer session cannot call merchant settings APIs.
- Merchant session cannot read customer member APIs as a customer.
- Query string tenant cannot override a signed merchant session tenant.
- Query string tenant cannot override a signed customer session tenant.

Suggested commit:

```text
fix: enforce explicit API access boundaries
```

## Phase 3: Minimal E2E Smoke Tests

Goal:

- Catch the exact regressions that have been happening.

Tasks:

1. Add a smoke test script or manual checklist that covers:
   - Platform login.
   - Merchant account login.
   - Merchant LINE login smoke path.
   - Customer phone plus ROC birthday login.
   - Guest booking.
   - Logged-in customer booking.
   - Member profile.
   - Points page.
   - Booking history.
   - Cancel booking.
   - Tenant isolation A/B.
2. Run it before every deploy.
3. Record pass/fail in `PROJECT_STATUS.md` or a dated test log.

Acceptance:

- A failed customer member redirect is caught before deploy.
- A failed merchant login is caught before deploy.
- A tenant leak is caught before deploy.

Suggested commit:

```text
test: add BookingOS smoke test checklist
```

## Phase 4: Tenant Isolation Re-Audit

Goal:

- Confirm BookingOS can safely serve more than one real store.

Tasks:

1. Rebuild `docs/TENANT_AUDIT.md` with correct encoding.
2. List all SQL touching tenant-owned tables.
3. List all APIs and their tenant source.
4. Check every `SELECT`, `UPDATE`, and `DELETE` on tenant-owned tables.
5. Add an A/B tenant test dataset.
6. Verify:
   - A admin cannot see B CRM.
   - A admin cannot export B customer list.
   - A customer cannot see B history.
   - A booking cannot attach to B customer.
   - A merchant session cannot be overridden by `?tenant=B`.

Acceptance:

- Tenant audit document is readable.
- All tenant-owned data access has a tenant rule.
- Known exceptions are explicitly marked platform-global.

Suggested commit:

```text
docs: refresh tenant isolation audit
```

## Phase 5: Customer Member Stabilization

Goal:

- Make customer membership feel normal and not like a repeated login trap.

Tasks:

1. Confirm customer session TTL.
2. Confirm customer cookie flags.
3. Confirm profile, points, and history share the same customer session.
4. Keep member profile collapsed by default.
5. Keep gender as select input.
6. Add clear states:
   - Logged in.
   - Session expired.
   - Not registered.
   - Wrong birthday.
7. Remove customer LINE buttons from normal member login until a later binding task.

Acceptance:

- After customer login, member / points / history do not require repeated login.
- Customer can return to member center while session is valid.
- Logout clears only customer session.
- Merchant session is unaffected.

Suggested commit:

```text
fix: stabilize phone roc-birthday member session
```

## Phase 6: Booking and Points Consistency

Goal:

- Avoid booking and point records drifting apart.

Tasks:

1. Treat booking creation, point redemption, point earning, and customer balance update as one operation.
2. Treat cancellation, redeemed point refund, earned point revoke, and booking status update as one operation.
3. Add checks for:
   - Redeem amount cannot exceed customer balance.
   - Redeem amount cannot exceed service limit.
   - Cancel twice does not double refund.
   - Points never go negative unless explicitly allowed.
4. Add booking result summary for final payment amount.

Acceptance:

- Booking with points produces correct final amount.
- Cancellation reverses the correct point entries exactly once.
- Failure in points logic does not leave a half-written booking state.

Suggested commit:

```text
fix: harden booking point consistency
```

## Phase 7: Scheduling Redesign

Goal:

- Move from demo availability to real store operations.

Current gap:

- The system assumes enabled staff are generally available during store hours.

Required model:

1. Store business hours.
2. Staff shifts.
3. Staff breaks.
4. Staff leave / unavailable blocks.
5. Walk-in booking.
6. Service capability by staff.
7. Resource capacity or specific resource assignment.
8. System-assigned staff when customer selects no preference.

Recommended tables or concepts:

- `staff_shifts`
- `staff_unavailable_blocks`
- `resource_instances` or keep `resource_types` if capacity-only is enough.
- `bookings.source` with values such as `online`, `walk_in`, `backend`.
- `bookings.assignment_type` with values such as `specified_staff`, `system_assigned`.

Acceptance:

- Staff A can work morning while Staff B works afternoon.
- Staff can be unavailable for a specific period.
- Walk-in customer blocks staff and resource.
- Customer no-preference booking chooses a valid staff member.
- Bed/resource count prevents overbooking.

Suggested commit:

```text
feat: add staff shift based availability
```

## Phase 8: Customer LINE Binding Later

Goal:

- Add LINE only after the customer phone session is stable.

Do not start until:

- Phase 1 to Phase 5 are accepted.
- Customer member session is stable.
- Merchant LINE is protected by regression tests.

Future flow:

```text
Customer logs in with phone + ROC birthday
-> opens member center
-> clicks bind LINE
-> LINE verifies token
-> identity_auth row is added to the existing identity
-> future login can use LINE or phone + ROC birthday
```

Important rule:

- LINE binding must attach to an already-authenticated customer identity.
- It must not create duplicate customers.
- It must not use merchant LIFF.
- It must not replace phone plus ROC birthday until proven stable.

Acceptance:

- Existing phone member remains usable.
- Binding LINE is optional.
- Unbinding or failed LINE does not lock out customer.

Suggested commit:

```text
feat: add optional customer line binding
```

## Priority Board

### P0

- Customer route must not enter merchant login.
- API access must fail closed.
- Tenant isolation must be re-audited.
- Customer LINE must remain parked until explicitly restarted.

### P1

- Customer session must stop repeated login.
- E2E smoke tests must exist.
- Booking and points must be consistency-safe.

### P2

- Full scheduling model.
- Walk-in booking.
- Platform auth hardening.
- Optional customer LINE binding.

## Recommended Next Three Tasks

### Task A: Route Boundary Repair

Scope:

- Customer vs merchant route split.
- No new features.
- No database migration.
- No LINE customer revival.

Deliverable:

- Member tabs route only to customer login/session.

### Task B: API Guard and Smoke Tests

Scope:

- Route classification.
- Unknown API fail closed.
- Smoke checklist or script.

Deliverable:

- Regressions become visible before deploy.

### Task C: Tenant Audit Refresh

Scope:

- Recreate readable tenant audit.
- Confirm API and SQL tenant filters.
- Add A/B tenant test plan.

Deliverable:

- Confidence to onboard a second real store.

## Stop Conditions

Stop and review before continuing if any of these happen:

- Customer page shows Merchant Console.
- Merchant LINE login breaks.
- A customer session is accepted for the wrong tenant.
- A merchant session is accepted for the wrong tenant.
- Points or booking cancellation produce inconsistent balances.
- A task requires re-enabling Customer LINE.

## Definition of Stable V1

BookingOS V1 is stable when:

- Store owner can copy a booking URL and send it to a customer.
- Customer can book as guest.
- Customer can register/login by phone plus ROC birthday.
- Customer can view profile, points, and history without repeated login.
- Store backend can manage services, staff, resources, CRM, and bookings.
- Merchant LINE login still works.
- Platform can manage stores, trials, billing, applications, and LINE OA.
- A second tenant cannot see the first tenant's data.

