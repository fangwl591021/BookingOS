# Tenant Audit

Date: 2026-07-11
Status: readable audit baseline after route/session repair.

## Rule

Any tenant-owned SQL without a tenant rule is P0.

Tenant-owned data includes:

- business_settings
- services
- service_durations
- staff_members
- resource_types
- customers
- bookings
- point_transactions
- referrals that belong to store customers

Platform-global data includes:

- tenants
- tenant_applications
- billing_orders
- platform_line_oa_settings
- platform_line_contacts
- platform_referrals
- platform_line_webhook_logs

Platform-global data must be protected by platform session or LINE webhook signature, not by tenant session.

## Route Classification

| Surface | Tenant Source | Auth Boundary | Status |
| --- | --- | --- | --- |
| `/book` | query tenant | public | OK |
| `/member`, `/points`, `/history` | customer session tenant | customer session | OK |
| `/member-login` | query tenant | public customer login | OK |
| `/merchant`, `/settings`, `/schedule`, `/customers` | merchant session tenant | merchant session | OK |
| `/merchant-login` | explicit tenant or account resolution | merchant login | OK |
| `/platform` | platform session | platform session | OK |
| `/platform-line-webhook` | platform LINE OA | signature | OK |
| `/line-webhook` | tenant query/path | signature | OK |

## API Classification

| API | Tenant Source | Auth Boundary | Status |
| --- | --- | --- | --- |
| `/api/health` | none | public | OK |
| `/api/availability` | query tenant | public | OK |
| `/api/bookings` | query tenant or matching customer session | public/customer compatible | OK |
| `/api/bookings/cancel` | query tenant + customer session or legacy guest phone | customer/legacy guest | REVIEW |
| `/api/customer/session` | customer session | customer session | OK |
| `/api/customer/phone-login` | query tenant | public customer login | OK |
| `/api/customer/phone-register` | query tenant | public customer registration | OK |
| `/api/customer/liff-login` | n/a | paused | OK |
| `/api/member` | customer session tenant | customer session | OK |
| `/api/customer-history` | customer session tenant | customer session | OK |
| `/api/customer-points` | customer session tenant | customer session | OK |
| `/api/customer-profile` | customer session only | customer session | OK |
| `/api/dashboard` | merchant session tenant | merchant session | OK |
| `/api/store` | merchant session tenant | merchant session | OK |
| `/api/settings` | merchant session tenant | merchant session | OK |
| `/api/services` | merchant session tenant | merchant session | OK |
| `/api/staff` | merchant session tenant | merchant session | OK |
| `/api/resources` | merchant session tenant | merchant session | OK |
| `/api/customers` | merchant session tenant | merchant session | OK |
| `/api/customers/export` | merchant session tenant | merchant session | OK |
| `/api/merchant/liff-login` | identity auth -> tenant_admins | merchant LINE login | OK |
| `/api/platform*` | platform session | platform session | OK |
| `/api/applications` | creates tenant/application | public application | OK |
| `/api/trials` | creates trial tenant | public trial | OK |
| `/api/referrals/claim` | platform LINE referral | platform CRM | OK |

## Current Guard

The Worker now has an explicit API route classifier.

Expected behavior:

- Unknown `/api/*` returns `404 API_ROUTE_NOT_FOUND`.
- Known API with wrong method returns `405 API_METHOD_NOT_ALLOWED`.
- Non-API pages are not affected by the API guard.

This reduces accidental public API exposure when new routes are added.

## Known REVIEW Items

### Legacy Guest Cancel

`/api/bookings/cancel` still supports legacy guest cancellation by booking id and phone.

Risk:

- Phone is weaker than a signed cancel token.

Recommended fix:

- Add booking cancel token for guest bookings.
- Keep logged-in customer cancellation by session customer_id.

### Transitional Customer Profile

`/api/customer-profile` requires Customer Session. It must not accept phone query lookup without a session.

Risk:

- Useful for booking compatibility, but should not become a formal member data API.

Recommended fix:

- Done: require Customer Session for this endpoint.
- Keep full member profile behind `/api/member` only.

## Tenant Isolation Test Plan

Create two tenants: A and B.

Test cases:

1. A merchant session cannot read B dashboard by changing `?tenant=B`.
2. A merchant session cannot read B customers.
3. A merchant session cannot export B workbook.
4. A customer session for A cannot read B member profile.
5. A customer session for A cannot read B points.
6. A customer session for A cannot read B booking history.
7. Guest booking on A cannot attach to B customer.
8. Same identity can have A customer and B customer as separate rows.
9. Unknown `/api/*` fails closed.
10. Wrong method on known API returns 405.

## Immediate Status

- Route boundary repair: done.
- API fail-closed guard: done.
- Automated smoke test: added.
- Full A/B tenant data test: pending.

## Next Required Work

1. Add an A/B tenant fixture or scripted remote-safe test.
2. Replace legacy guest cancellation phone check with cancel token.
3. Done: require `/api/customer-profile` Customer Session and remove phone fallback.
4. Keep Customer LINE parked until phone + ROC birthday flow is stable.