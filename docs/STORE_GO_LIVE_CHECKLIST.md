# BookingOS Store Go-Live Checklist

Task 017 uses `evaluateTenantSetup(env, tenantId)` as the shared backend calculation for merchant onboarding, platform operations, and booking enablement.

## Checklist Items

1. Store profile: name, phone, address.
2. Business hours: open and close time.
3. Services: at least one enabled service with at least one enabled duration and price.
4. Staff: at least one active bookable staff member.
5. Staff-service binding: at least one staff member explicitly bound to an enabled service.
6. Resources: resource-linked services must point to enabled resources. Services without a resource do not require a resource record.
7. Staff plan selection: no pending downgrade staff-selection requirement.
8. Public store: tenant has a slug and tenant status allows accepting bookings.
9. Test booking: `tenants.setup_test_completed_at` is set, or a legacy `source = 'setup_test'` booking exists.
10. Formal booking switch: `tenants.booking_enabled = 1`.

## Booking Open Rule

New tenants are created with `booking_enabled = 0`.

Opening booking from the onboarding wizard requires setup readiness, setup test completion, no staff plan-selection blocker, and at least one active staff member with service binding.

Existing bookings are never deleted by onboarding.

If setup is incomplete, `/api/bookings` returns `TENANT_SETUP_INCOMPLETE`.

If setup is complete but booking is not opened, `/api/bookings` returns `TENANT_BOOKING_NOT_OPEN`.

If staff plan selection is pending, public and manual booking creation returns `STAFF_PLAN_SELECTION_REQUIRED`.

## Test Booking Rule

The onboarding test booking uses:

- `source = 'setup_test'`
- customer name `系統測試顧客`
- status `cancelled`
- no customer member row
- no point transaction
- no notification

It sets `tenants.setup_test_completed_at` and is only used to verify the store setup path.

## Tenant Safety

All onboarding API writes use the authenticated merchant session tenant. The request body must not be trusted for tenant selection.

Templates are only applied when services, staff, and resources are all empty. They must not overwrite existing store data.

## Platform Visibility

The platform tenant list must show:

- setup completion
- public URL
- missing checklist items
- booking open state
- tenant operational status
- staff over-limit state
- pending staff plan selection
- `plan_limited` staff count
- affected future booking count