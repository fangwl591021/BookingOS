# BookingOS

BookingOS 是 Cloudflare Workers + D1 的預約 SaaS 原型。

## D1 Migration

正式 D1：`bookingos-db`

本機套用 migration：

```bash
npx wrangler d1 migrations apply bookingos-db --local
```

正式套用前必須先查 pending 與備份：

```bash
npx wrangler d1 migrations list bookingos-db --remote
npx wrangler d1 export bookingos-db --remote --output .local-backups/<backup-name>.sql
```

確認 pending 只包含新的 migration 後，才可執行：

```bash
npx wrangler d1 migrations apply bookingos-db --remote
```

禁止未檢查 pending 清單就直接套用 remote migration。D1 history baseline 詳見：`docs/D1_MIGRATION_BASELINE.md`。

## Merchant Login Identity Resolution

POST /merchant-login uses tenant_admins as the only merchant permission source. It does not use platform_line_contacts for merchant password login.

Set MERCHANT_ADMIN_PASSWORD as a Cloudflare Secret. MERCHANT_IDENTITY_RESOLUTION_ENABLED=true enables additive identity create/link after exactly one active tenant_admins row is resolved.

No-tenant login matches normalized phone/email only. If the same account can manage multiple tenants, the Worker returns TENANT_SELECTION_REQUIRED and does not issue a merchant cookie.

See docs/MERCHANT_IDENTITY_LOGIN.md for the full transition rules and rollback notes.

## Merchant Signed Session Interface

店家帳密登入已切換為 signed merchant cookie interface。Production 必須先設定 `MERCHANT_SESSION_SECRET`，否則 `/merchant-login` 會回 `SESSION_CONFIG_INVALID` 且不發 cookie。

Session payload 解析後包含 `identity_id`、`tenant_id`、`role`、`issued_at`、`expires_at` 與 `session_version`；每次後台請求仍會重新查 `identities`、`tenant_admins`、`tenants`，DB role 才是權限真相來源。

詳見 `docs/MERCHANT_SESSION_INTERFACE.md`。

## Merchant Tenant Picker

Multi-tenant merchant password login returns a short-lived signed selection token instead of choosing a store automatically. The login page renders a tenant picker and `POST /merchant-select-tenant` revalidates DB permission before issuing the real signed merchant session.

See `docs/MERCHANT_TENANT_PICKER.md`.

## Merchant LIFF Identity Login

Task 010 moves merchant LIFF login to verified LINE token -> IdentityAuth -> tenant_admins.identity_id. It does not accept front-end supplied LINE UID as authentication and reuses signed merchant sessions plus tenant picker.

## Customer Identity Session

Task 011 adds Customer LIFF identity login and a signed customer session cookie. Customer profile, points and history now use `tenant_id + customer_id` from the verified session. Public guest booking remains supported.

Required production secret: `CUSTOMER_SESSION_SECRET`. See `docs/CUSTOMER_IDENTITY_SESSION.md`.
## Store Slug URLs

Task 012 adds tenant-owned public store URLs.

Canonical customer entry:

```text
/store/{slug}
/store/{slug}/book
/store/{slug}/login
/store/{slug}/member
/store/{slug}/points
/store/{slug}/history
```

Demo tenant:

```text
/store/anhe
```

Legacy tenant query URLs such as `/book?tenant=demo-tenant` and `/member-login?tenant=demo-tenant` are retained only as redirects to the slug URL when the tenant has a slug. New customer-facing links should use `/store/{slug}`.

## Plan and Trial Enforcement

Task 015 centralizes tenant business access in `evaluateTenantAccess(tenant, now)`. Plans define staff limits, trial accounts run for 60 days, active contracts receive a 7-day grace period after expiry, and expired/grace tenants become readonly with new bookings disabled.

Public availability and booking creation return `TENANT_BOOKING_DISABLED` when a tenant cannot accept bookings. Staff limits are enforced on save without automatically deleting or disabling existing staff during downgrades. If a downgrade leaves the tenant over the staff limit, the tenant must explicitly choose which enabled staff remain eligible for new bookings. Until that selection is complete, public and manual booking creation returns `STAFF_PLAN_SELECTION_REQUIRED`; existing future bookings are preserved and reported through `planImpact` for manual handling.

See `docs/PLAN_AND_TRIAL_ENFORCEMENT.md`.
Task 015C closes out the first legacy tenant billing audit. `demo-tenant` is recorded as the active platform demo store for 2026-07-11 through 2027-07-10. `sunny-hair` remains a trial tenant through 2026-09-09 under the 60-day rule. Two legacy trial tenants still require Tony-approved slugs before public store URLs are assigned.

## Merchant Go-Live Onboarding

Task 017 adds the merchant self-service onboarding wizard at `/merchant/onboarding`. New tenants start with `booking_enabled = 0`; merchants complete store profile, hours, template/service setup, staff bindings, resources, setup test booking, and then open formal booking.

Formal booking requires setup completion, setup test completion, no staff plan-selection blocker, and `tenants.booking_enabled = 1`. See `docs/MERCHANT_ONBOARDING_WIZARD.md`, `docs/STORE_GO_LIVE_CHECKLIST.md`, and `docs/MERCHANT_QUICK_START.md`.