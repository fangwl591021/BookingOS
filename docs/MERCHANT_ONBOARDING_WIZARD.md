# Merchant Onboarding Wizard

Task 017 adds a self-service setup path for merchants.

## Entry

Merchant users log in once, then open:

```text
/merchant/onboarding
```

This route uses the existing signed merchant session. It does not create a second merchant login and does not trust front-end `tenant_id` values for writes.

## Wizard Steps

1. Store profile: name, phone, address, business type, timezone. Slug is display-only.
2. Business hours: open, close, break, closed days.
3. Template: therapy, massage, hair, nail, beauty, or blank.
4. Services: service, category, durations, prices, point redemption limit, resource binding.
5. Staff: staff profile and explicit service bindings.
6. Resources: bed, chair, room, or other capacity unit.
7. Setup test booking.
8. Open formal booking.

## Template Rule

Templates only create services, durations, and resource suggestions. They do not create staff, customers, bookings, points, or LINE settings.

If the tenant already has services, staff, or resources, template apply is rejected to avoid silent mixing.

## Booking Open Rule

New tenants are created with `booking_enabled = 0`.

Formal customer booking requires:

- tenant business status can accept bookings
- store profile complete
- business hours complete
- at least one enabled service with valid duration
- at least one active staff member
- at least one explicit staff-service binding
- resource requirements satisfied
- staff plan selection not required
- setup test completed
- `booking_enabled = 1`

## Setup Test

The setup test creates a `source = 'setup_test'` cancelled booking and sets `tenants.setup_test_completed_at`.

It does not create a customer, point transaction, notification, or official customer booking statistic.

## Plan-Limited Staff

`plan_limited` staff are retained for history and existing bookings. They do not appear as bookable staff and are not used by system assignment or setup test booking.

If staff selection is required, the wizard blocks setup test and formal go-live.
## Read And Write Permissions

Onboarding read routes are intentionally separate from write routes.

- `GET /merchant/onboarding` requires an active merchant session with tenant read permission.
- `GET /api/merchant/onboarding` requires tenant read permission and returns setup progress, missing actions, public URL, services, staff, resources, and store status.
- All write APIs still require merchant write permission plus tenant capability checks and tenant business-status checks.

Write APIs include template apply, store profile, hours, services, staff, resources, setup test booking, enable booking, and disable booking.

`trial` and `active` tenants can view and write when their role and capabilities allow it.

`grace` and `expired` tenants can view setup status and existing configuration, but the wizard is read-only. The page shows: `目前方案已到期，設定資料僅供查看；續約後可繼續修改。` Direct write API calls return HTTP 403 with `TENANT_READ_ONLY`.

`suspended` and `cancelled` tenants follow the existing merchant access policy. When a valid merchant session is still allowed to reach the wizard, the page is read-only and write APIs remain blocked.

## Sprint 1 Clean Foundation

Sprint 1 replaces the old single daily-hours editor with the weekly onboarding model documented in docs/STORE_ONBOARDING_FOUNDATION.md. weekly_hours_json is now the only runtime business-hours source. The onboarding entry redirects draft tenants to the wizard; completed tenants continue to the normal merchant dashboard. Service, Staff, LINE, and Promotion remain placeholders in this sprint.
