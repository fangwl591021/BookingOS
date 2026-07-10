# BookingOS Identity Migration Checklist

日期：2026-07-10
狀態：Checklist only。尚未執行 migration，尚未修改資料庫，尚未修改程式。

## Gate 0: Before Any Migration

- [ ] Confirm `docs/SCHEMA_FREEZE.md` is accepted.
- [ ] Confirm no `identity_profiles` table.
- [ ] Confirm no new `admins` table.
- [ ] Confirm no `sessions` table in V1 migration.
- [ ] Confirm `tenant_admins` remains the tenant role table.
- [ ] Confirm Identity stores no business data.
- [ ] Confirm Customer owns CRM, points, tags, coupons, consumption, notes.

## Gate 1: Additive Schema

- [ ] Create `identities`.
- [ ] Create `identity_auth`.
- [ ] Add `customers.identity_id` nullable.
- [ ] Add `customers.customer_no` nullable.
- [ ] Add `tenant_admins.identity_id` nullable.
- [ ] Add `identity_auth` indexes.
- [ ] Add `tenant_admins.identity_id` index.
- [ ] Add `customers(tenant_id, identity_id)` unique index where identity exists.
- [ ] Verify existing app still runs without using new columns.

## Gate 2: Backfill

- [ ] Backfill identities from `tenant_admins` trusted phone/email/LINE evidence.
- [ ] Backfill `identity_auth` rows for LINE, PHONE, EMAIL.
- [ ] Write `tenant_admins.identity_id`.
- [ ] Backfill Customer identity only when evidence is safe.
- [ ] Write `customers.identity_id` where confident.
- [ ] Export ambiguous matches for manual review.
- [ ] Do not auto-merge uncertain phone/email matches.

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
