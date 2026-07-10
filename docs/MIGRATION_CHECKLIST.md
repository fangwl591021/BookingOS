# BookingOS Identity Migration Checklist

日期：2026-07-10
狀態：Task 005 Additive Identity Migration 已完成。未切換登入、Session、LIFF、預約、CRM 行為。

## Gate 0: Before Any Migration

- [x] Confirm `docs/SCHEMA_FREEZE.md` is accepted.
- [x] Confirm no `identity_profiles` table.
- [x] Confirm no new `admins` table.
- [x] Confirm no `sessions` table in V1 migration.
- [x] Confirm `tenant_admins` remains the tenant role table.
- [x] Confirm Identity stores no business data.
- [x] Confirm Customer owns CRM, points, tags, coupons, consumption, notes.

## Gate 1: Additive Schema

- [x] Create `identities`.
- [x] Create `identity_auth`.
- [x] Add `customers.identity_id` nullable.
- [x] Add `customers.customer_no` nullable.
- [x] Add `tenant_admins.identity_id` nullable.
- [x] Add `platform_line_contacts.identity_id` nullable.
- [x] Add `identity_auth` indexes.
- [x] Add `tenant_admins.identity_id` index.
- [x] Add `customers.identity_id` index; defer unique `customers(tenant_id, identity_id)` until audit proves no duplicates.
- [x] Add `platform_line_contacts.identity_id` index.
- [x] Verify existing app still runs without using new columns.

## Gate 2: Backfill

- [x] Backfill identities only from scoped LINE evidence.
- [x] Backfill `identity_auth` rows for scoped LINE only.
- [x] Do not create PHONE or EMAIL auth from unverified phone/email values.
- [x] Write `platform_line_contacts.identity_id` where safe.
- [x] Leave `tenant_admins.identity_id` unchanged where no LINE evidence exists.
- [x] Leave `customers.identity_id` unchanged where no LINE evidence exists.
- [x] Export ambiguous phone/email matches for manual review through audit output.
- [x] Do not auto-merge uncertain phone/email matches.
- [x] Backfill is idempotent: second run writes 0 statements.

## Gate 3: Login Read Path

- [ ] Merchant login resolves credential through `identity_auth`.
- [ ] Merchant login queries `tenant_admins.identity_id`.
- [ ] Multiple tenant roles show tenant picker.
- [ ] Global tenant selection with `LIMIT 1` is removed.
- [ ] Platform contact table is not used as auth source.
- [ ] LINE UID is not treated as primary identity.

## Gate 4: Session Interface

- [ ] Define `resolveSession(request)` interface.
- [ ] Interface returns `identity_id`.
- [ ] Interface returns `tenant_id` for tenant routes.
- [ ] Interface returns `role`.
- [ ] Interface returns `permissions`.
- [ ] Interface returns `customer_id` for customer routes.
- [ ] Storage implementation selected only after interface is stable.

## Gate 5: Customer Flow

- [ ] Customer LINE/phone login resolves Identity through `identity_auth`.
- [ ] Customer profile lookup prefers `tenant_id + identity_id`.
- [ ] Phone fallback remains during transition.
- [ ] Booking writes `customer_id`.
- [ ] Points write `customer_id`.
- [ ] Booking history reads by `customer_id`.
- [ ] Cancel booking authorizes through Customer session when available.

## Gate 6: Tenant Isolation Tests

- [ ] A店 admin cannot see B店 customers.
- [ ] A店 admin cannot export B店 customer workbook.
- [ ] A店 customer cannot see B店 booking history.
- [ ] Same identity with two tenant_admin rows must choose tenant.
- [ ] Same identity as Customer in two tenants has two Customer rows.
- [ ] All Customer reads remain tenant-scoped.

## Gate 7: Cleanup Later

- [ ] Stop using `tenant_admins.phone/email/line_user_id` for auth.
- [ ] Keep fields until production login migration is proven.
- [ ] Consider staff identity after merchant/customer identity is stable.
- [ ] Consider Customer CRM split tables later.
- [ ] Consider Session storage table only if Signed Cookie/KV/DO/JWT are insufficient.
