# BookingOS Store Go-Live Checklist

Task 016 defines the minimum requirements before a tenant can be considered ready for first public booking.

## Backend Source of Truth

Use `evaluateTenantSetup(env, tenantId)` as the shared backend calculation for merchant onboarding, platform operations, and booking enablement.

The checklist has 8 items:

1. Store profile: name, phone, address.
2. Business hours: open and close time.
3. Services: at least one enabled service with at least one enabled duration and price.
4. Staff: at least one enabled staff member.
5. Staff-service binding: at least one staff member explicitly bound to an enabled service.
6. Resources: at least one enabled resource, and resource-linked services must point to enabled resources.
7. Public store: tenant has a slug and tenant status allows accepting bookings.
8. Test booking: at least one `source = 'setup_test'` booking exists.

## Booking Open Rule

Formal booking requires both:

- operational setup complete: items 1 to 7
- tenant `booking_enabled = 1`

Opening booking from the onboarding button requires the full 8/8 checklist, including a setup test booking. Existing stores that are already open are not blocked by the historical absence of a setup-test record.

If operational setup is incomplete, `/api/bookings` returns `TENANT_SETUP_INCOMPLETE`.

If operational setup is complete but booking is not opened, `/api/bookings` returns `TENANT_BOOKING_NOT_OPEN`.

## Test Booking Rule

The onboarding test booking uses:

- `source = 'setup_test'`
- customer name `系統測試顧客`
- status `cancelled`
- no customer member row
- no point transaction
- no notification

It is only used to verify the store setup path.

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