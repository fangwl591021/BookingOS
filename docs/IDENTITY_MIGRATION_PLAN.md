# Identity Migration Plan

日期：2026-07-10
狀態：規劃文件，尚未執行 migration，尚未修改程式。

## Current Schema vs Target Schema

| Area | Current | Target | Action | Priority |
| --- | --- | --- | --- | --- |
| Platform identity | 無 `identities` 表 | `identities(id, status, created_at, updated_at)` | 新增 | Immediate |
| Login credentials | 分散在 `tenant_admins.line_user_id/phone/email`、`customers.line_user_id/phone`、`platform_line_contacts.line_user_id` | `identity_credentials(identity_id, provider, provider_user_id, phone, email)` | 新增並逐步回填 | Immediate |
| Tenant | `tenants` 已存在 | `tenants` 保留，補 `plan` 可沿用 `billing_plan_id` | 保留 | No change now |
| Customer | `customers` 有 `tenant_id`, `phone`, `line_user_id`, CRM/points 欄位 | `customers` 加 `identity_id`, 保留所有店家會員資料 | 新增欄位，不搬 CRM | Immediate |
| Admin | `tenant_admins` 混合身份與 tenant role | `admins(identity_id, tenant_id, role, status)` | 新增 `admins`，舊表暫時保留 | Immediate |
| Staff | `staff_members` 沒有 `identity_id` | `staff_members.identity_id nullable` | 新增 nullable 欄位 | Deferred |
| Booking | `bookings` 有 `tenant_id`, `customer_id`, `staff_id` | 保持，不加 `identity_id` | 保留 | No change |
| Points | `point_transactions` 用 `customer_id` | `customer_points` 或保留 `point_transactions`，仍用 `customer_id` | 先保留現名 | Deferred |
| Coupon | 目前無 coupon 表 | `customer_coupons(customer_id, ...)` | 新增時以 customer 為主 | Deferred |
| CRM tags | `customers.tags_json` | `customer_tags(customer_id, tag)` | 可延後拆表 | Deferred |
| CRM notes | `customers.note` / 後續 notes | `customer_notes(customer_id, note, created_by)` | 可延後拆表 | Deferred |
| Followups | 無 | `customer_followups(customer_id, ...)` | 新功能再做 | Deferred |
| Session | cookie 只存 secret 或 tenant | `sessions(identity_id, tenant_id, role, customer_id?, expires_at)` | 新增 | Immediate |

## Current Tables To Keep

### `tenants`

Keep. This remains the tenant boundary.

### `customers`

Keep. This is tenant-owned member/CRM data.

Add:

- `identity_id TEXT NULL`
- `customer_no TEXT NULL`
- maybe `member_level TEXT NULL`

Do not remove current customer fields in the first migration.

### `bookings`

Keep. Booking belongs to tenant/customer/staff/service/resource.

Do not add `identity_id` to bookings.

### `point_transactions`

Keep for now. It already uses `tenant_id` and `customer_id`.

Long-term naming may become `customer_points`, but not required for V1 stability.

## Tables To Add Immediately

### `identities`

```sql
CREATE TABLE IF NOT EXISTS identities (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

No name, birthday, address, points, CRM fields.

### `identity_credentials`

```sql
CREATE TABLE IF NOT EXISTS identity_credentials (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_user_id TEXT,
  phone TEXT,
  email TEXT,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (identity_id) REFERENCES identities(id)
);
```

Suggested unique indexes:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_identity_credentials_provider_user
ON identity_credentials(provider, provider_user_id)
WHERE provider_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_identity_credentials_phone
ON identity_credentials(phone)
WHERE phone IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_identity_credentials_email
ON identity_credentials(email)
WHERE email IS NOT NULL;
```

### `admins`

```sql
CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  permissions_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (identity_id) REFERENCES identities(id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  UNIQUE(identity_id, tenant_id, role)
);
```

This replaces the meaning of `tenant_admins`, but `tenant_admins` should remain during transition.

### `sessions`

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  tenant_id TEXT,
  role TEXT NOT NULL,
  customer_id TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (identity_id) REFERENCES identities(id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
```

## Tables/Fields To Deprecate Later

| Current | Replacement | When |
| --- | --- | --- |
| `tenant_admins` | `admins` + `identities` + `identity_credentials` | After login/session migration works |
| `customers.line_user_id` | `customers.identity_id` + `identity_credentials` | After customer LINE login is stable |
| `customers.phone` as login identity | `identity_credentials.phone`, while customer keeps phone as tenant copy | After OTP/login migration |
| `platform_line_contacts.tenant_id` single tenant link | `admins` or future lead-to-tenant relation | After platform CRM redesign |
| `customers.tags_json` | `customer_tags` | When CRM grows |
| `customers.note` | `customer_notes` | When CRM grows |

## Immediate Migration Plan

### Phase 0: Documentation Lock

Status: done by this planning task.

- Confirm Identity != Customer.
- Confirm Identity has no CRM fields.
- Confirm Booking and Points point to Customer, not Identity.
- Confirm session must include `identity_id`, `tenant_id`, `role`.

### Phase 1: Additive Schema Only

No behavior switch yet.

1. Add `identities`.
2. Add `identity_credentials`.
3. Add `admins`.
4. Add `sessions`.
5. Add nullable `customers.identity_id`.
6. Add nullable `staff_members.identity_id` only if needed.

Safe because existing code can ignore new tables/columns.

### Phase 2: Backfill Identity Records

1. For every `tenant_admins` row with phone/email/line_user_id, create or find identity.
2. Create `identity_credentials` for each login credential.
3. Create `admins(identity_id, tenant_id, role)` for each tenant admin row.
4. For every `customers` row with line_user_id or phone, create or find identity and write `customers.identity_id`.
5. For conflicts, do not merge automatically if phone/email/LINE evidence is ambiguous; mark for review.

### Phase 3: Login Read Path

Change login logic to:

1. Resolve Identity from credential.
2. Query `admins` by `identity_id`.
3. If one tenant, create session.
4. If multiple tenants, show tenant picker.
5. If none, reject or route to application/trial flow.

Do not use global `LIMIT 1` to choose tenant.

### Phase 4: Session Read Path

1. Replace merchant cookie value from tenant-only to session id or signed payload.
2. Session must resolve to `identity_id`, `tenant_id`, `role`.
3. All protected admin routes use session tenant and role.
4. Platform admin should also become identity-based later, but can stay env-gated during transition.

### Phase 5: Customer Login

1. LINE/phone login resolves identity.
2. Tenant comes from current booking URL / LIFF context.
3. Query `customers WHERE tenant_id = ? AND identity_id = ?`.
4. If missing, create customer for that tenant.
5. Customer session contains `identity_id`, `tenant_id`, `role=member`, `customer_id`.

## Deferred Migration Plan

These should not block BookingOS V1 stability:

- Split `customer_tags` from `customers.tags_json`.
- Split `customer_notes` from `customers.note`.
- Add `customer_followups`.
- Rename `point_transactions` to `customer_points`.
- Add `customer_coupons`.
- Add staff login beyond simple nullable `staff_members.identity_id`.
- Convert platform login from ENV account to identity-based super admin.

## Compatibility Rules During Migration

- Existing `/book`, `/member`, `/api/bookings` must continue to work while `identity_id` is nullable.
- Existing tenant isolation remains P0: every tenant-owned query still needs tenant filter.
- New identity tables do not allow platform access to customer CRM.
- If a credential maps to multiple tenants, the UI must show tenant selection.
- Do not delete `tenant_admins` until `admins` has been proven in production.

## Proposed Migration Files

Suggested future migrations:

1. `0012_identity_core.sql`
   - `identities`
   - `identity_credentials`
   - `sessions`
2. `0013_admins_identity.sql`
   - `admins`
   - indexes
3. `0014_customer_identity_link.sql`
   - `ALTER TABLE customers ADD COLUMN identity_id TEXT`
   - `ALTER TABLE customers ADD COLUMN customer_no TEXT`
   - indexes
4. `0015_staff_identity_link.sql`
   - `ALTER TABLE staff_members ADD COLUMN identity_id TEXT`

Do not run these until the flow design is confirmed.