# BookingOS Plan and Trial Enforcement

Task 015 defines the first production-grade rule set for tenant plan, trial, contract, grace and suspended states.

## Single Source of Truth

Runtime access is evaluated by `evaluateTenantAccess(tenant, now)`. UI and APIs should not infer business access directly from `tenants.status` only.

The evaluator returns:

- `operationalStatus`: `active`, `trial`, `grace`, `expired`, `suspended`, or `cancelled`
- `accessLevel`: `full`, `readonly`, or `blocked`
- `daysRemaining`
- `graceDaysRemaining`
- `staffLimit`
- `activeStaffCount`
- `overLimit`
- `canMerchantLogin`
- `canManage`
- `canAcceptBookings`
- `canCreateStaff`
- `capabilities`

All date math uses the Asia/Taipei calendar day. Contract end dates are valid through the whole end date.

## Plans

| Plan | Staff Limit | Annual Price |
| --- | ---: | ---: |
| solo | 1 | NT$3,000 |
| small | 2 | NT$5,000 |
| growth | 4 | NT$8,000 |
| team | 8 | NT$12,000 |

`staff_limit` is derived from the billing plan and enforced on the backend. Enabled staff are counted. Downgrades never delete or disable existing staff automatically; if a tenant is over the new limit, staff creation/reactivation is blocked until the tenant disables staff or upgrades.

Downgrade handling is conservative:

- Existing staff records remain enabled so historical bookings, payroll review and CRM context are not destroyed.
- Only the first `staff_limit` enabled staff, ordered by `sort_order, name`, are eligible for new customer bookings and system auto-assignment.
- Staff beyond the limit become plan-limited: they remain visible in backend data, but are excluded from public availability and booking creation.
- Existing future bookings assigned to plan-limited staff are not cancelled or moved automatically.
- Plan change APIs return `planImpact.limitedStaff` and `planImpact.affectedFutureBookings` so platform/admin operators can review and manually reassign, upgrade, or contact customers.

## Trial Rules

New trial tenants are created as:

- `status = trial`
- `contract_start = today in Asia/Taipei`
- `contract_end = today + 60 days`
- selected plan values copied to tenant billing fields

Trial tenants have full access until the end date. Expired trials have no grace period.


## Legacy Tenant Closeout

New trial tenants use a 60-day trial period. Existing tenants are not automatically extended by a rule change; any legacy date correction must be explicit, backed up, and recorded.

Task 015C manually closed out the Task 015B audit items:

- `demo-tenant` is the platform demo store and is active from 2026-07-11 through 2027-07-10.
- `sunny-hair` keeps `contract_start = 2026-07-11`; its trial end was corrected to 2026-09-09 using the 60-day date rule.
- `trial-mrd14uce` and `trial-mrdj8djy` still require Tony-approved slugs before public `/store/{slug}` URLs are written.
## Contract and Renewal Rules

Active tenants have full access until `contract_end`.

If an active tenant is past `contract_end`, the tenant enters a 7-day grace period. In grace, merchant login remains available, but management and new booking creation are disabled. After grace, the tenant is expired and remains readonly.

Marking a billing order paid is idempotent. If the order is already paid, the tenant contract is not extended again. If payment is new, the tenant plan and staff limit are updated from the order and a one-year contract period is written.

## Capability Matrix

| Status | Merchant Login | Manage Settings/Services/Staff | Public Availability | New Booking | Customer Member/History |
| --- | --- | --- | --- | --- | --- |
| active | yes | yes | yes | yes | yes |
| trial | yes | yes | yes | yes | yes |
| grace | yes | no | no | no | yes |
| expired | yes | no | no | no | yes |
| suspended/cancelled | no | no | no | no | existing session only |

Public booking pages can still show basic store information when booking is disabled, but availability and booking submit APIs return `TENANT_BOOKING_DISABLED`.

## API Enforcement

- `/api/availability` returns 403 with `TENANT_BOOKING_DISABLED` when `canAcceptBookings` is false.
- `/api/bookings` returns 403 with `TENANT_BOOKING_DISABLED` when `canAcceptBookings` is false.
- Merchant write routes require the relevant capability before saving settings, resources, services or staff.
- `saveStaffMembers` rejects requests above the effective staff limit with `STAFF_LIMIT_REACHED`.

## Platform Operations

The platform dashboard now displays evaluated tenant status, plan, staff usage, expiring/expired counts and over-limit tenants. Trial conversion creates a pending billing order; it does not activate a tenant until payment is marked paid.

## Merchant Operations

The merchant dashboard displays the current plan, operational state, staff usage and whether booking or management is restricted.

## Non-goals

Task 015 does not change:

- customer phone login/session design
- merchant login/session design
- identity schema
- booking slot engine internals
- `/store/{slug}` routing design
