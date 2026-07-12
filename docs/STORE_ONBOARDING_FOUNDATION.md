# Store Onboarding Foundation

Sprint 1 uses a clean onboarding contract for new tenants.

## Schema

Migration 0019_store_onboarding_foundation.sql adds:

- tenants.brand_name
- tenants.brand_primary_color
- tenants.email
- tenants.onboarding_status (draft or completed)
- tenants.onboarding_completed_at
- business_settings.weekly_hours_json

New tenants start as draft. A tenant can complete onboarding only after Store, Brand, contact, address, and all seven weekly day records pass validation.

## Weekly Hours Source Of Truth

business_settings.weekly_hours_json is the only runtime source for:

- availability
- open and close times
- breaks
- booking and rescheduling validation
- closed-day and no-slot decisions

The parser and validator are shared in src/weekly-hours.js. The original columns from migration 0001_initial.sql remain only as historical schema and are no longer read or written by the Worker. No dual-write is performed.

## Wizard

/merchant/onboarding provides:

1. Store
2. Brand
3. Business
4. Service (Coming Soon)
5. Staff (Coming Soon)
6. LINE (Coming Soon)
7. Promotion (Coming Soon)
8. Finish

The route derives the tenant from the verified Merchant Session. Store and settings writes are tenant-scoped server-side.

## Booking Gate

A tenant whose onboarding_status is not completed cannot:

- expose availability slots
- create customer bookings
- enable formal booking

The public store page remains reachable and explains that setup is incomplete.