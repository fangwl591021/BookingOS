# Identity Migration Plan

日期：2026-07-10
狀態：Schema Freeze 後的規劃文件，尚未執行 migration，尚未修改程式。

## Current Schema vs Frozen Target

| Area | Current | Frozen Target | Action | Priority |
| --- | --- | --- | --- | --- |
| Platform identity | 無 `identities` 表 | `identities(id, status, created_at, updated_at)` | 新增 | Immediate |
| Login auth | 分散在 `tenant_admins.line_user_id/phone/email`、`customers.line_user_id/phone`、`platform_line_contacts.line_user_id` | `identity_auth(identity_id, provider, provider_uid, normalized_phone, normalized_email, verified, metadata_json)` | 新增並逐步回填 | Immediate |
| Tenant | `tenants` 已存在 | 保留 | 不變 | No change |
| Customer | `customers` 有 tenant CRM 與 phone/line_user_id | `customers.identity_id` nullable；CRM 欄位保留在 Customer | 新增欄位 | Immediate |
| Tenant Admin | `tenant_admins` 混合登入欄位與 tenant role | `tenant_admins.identity_id` nullable；原 phone/email/line_user_id 暫時保留 | 新增欄位，不新增 admins 表 | Immediate |
| Staff | `staff_members` 沒有 `identity_id` | `staff_members.identity_id nullable` | 延後 | Deferred |
| Booking | `bookings` 有 `tenant_id`, `customer_id`, `staff_id` | 保持，不加 `identity_id` | 保留 | No change |
| Points | `point_transactions` 用 `customer_id` | 保持，用 `customer_id` | 保留 | No change |
| Session | cookie 只存 secret 或 tenant | Session Interface：可解析 `identity_id`, `tenant_id`, `role`, `customer_id?`, `expires_at` | 不新增 table，後續選實作 | Immediate design only |

## Frozen Immediate Schema

### `identities`

```sql
CREATE TABLE IF NOT EXISTS identities (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Identity 不得加入姓名、生日、地址、點數、CRM、標籤、優惠券、消費或任何店家商業資料。

### `identity_auth`

```sql
CREATE TABLE IF NOT EXISTS identity_auth (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_uid TEXT,
  normalized_phone TEXT,
  normalized_email TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,
  last_login_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (identity_id) REFERENCES identities(id)
);
```

Provider values:

- `LINE`
- `PHONE`
- `EMAIL`
- future: `GOOGLE`, `APPLE`

LINE display name、picture URL、locale 等 provider snapshot 先放 `metadata_json`，不拆 `identity_profiles`。

### `customers` add columns

```sql
ALTER TABLE customers ADD COLUMN identity_id TEXT;
ALTER TABLE customers ADD COLUMN customer_no TEXT;
```

### `tenant_admins` add column

```sql
ALTER TABLE tenant_admins ADD COLUMN identity_id TEXT;
```

不新增 `admins` table。`tenant_admins` 繼續作為 V1 tenant role table。

## Immediate Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_identity_auth_identity
ON identity_auth(identity_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_identity_auth_provider_uid
ON identity_auth(provider, provider_uid)
WHERE provider_uid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_identity_auth_phone
ON identity_auth(provider, normalized_phone)
WHERE provider = 'PHONE' AND normalized_phone IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_identity_auth_email
ON identity_auth(provider, normalized_email)
WHERE provider = 'EMAIL' AND normalized_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_admins_identity
ON tenant_admins(identity_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_tenant_identity
ON customers(tenant_id, identity_id)
WHERE identity_id IS NOT NULL;
```

## Not In V1 Schema Freeze

| Item | Decision | Reason |
| --- | --- | --- |
| `identity_profiles` | Do not create | Provider display data belongs in `identity_auth.metadata_json` until real need appears. |
| New `admins` table | Do not create | Existing app depends on `tenant_admins`; adding `admins` creates unnecessary double migration. |
| `sessions` table | Do not create | First freeze a Session Interface; storage can be Signed Cookie, KV, Durable Object, JWT, or DB later. |
| `staff_members.identity_id` | Deferred | Staff login can wait until merchant/customer identity is stable. |
| `customer_tags`, `customer_notes`, `customer_followups`, `customer_coupons` | Deferred | These are CRM feature expansions, not Identity blockers. |

## Migration Checklist

### Phase 0: Freeze Documents

Status: current task.

- Freeze `identities`.
- Freeze `identity_auth`.
- Freeze `customers.identity_id`.
- Freeze `tenant_admins.identity_id`.
- Freeze Session Interface, not Session Table.
- Confirm no `identity_profiles`, no new `admins` table.

### Phase 1: Additive Schema Only

No behavior switch.

1. Add `identities`.
2. Add `identity_auth`.
3. Add nullable `customers.identity_id`.
4. Add nullable `customers.customer_no`.
5. Add nullable `tenant_admins.identity_id`.
6. Add indexes.

### Phase 2: Backfill Identity Records

1. For each `tenant_admins` row with LINE/phone/email, create or find Identity.
2. Create `identity_auth` rows for verified or trusted login evidence.
3. Write `tenant_admins.identity_id`.
4. For each `customers` row with LINE/phone, create or find Identity only when match evidence is safe.
5. Write `customers.identity_id` where confident.
6. Do not auto-merge ambiguous phone/email matches.

### Phase 3: Login Read Path

1. Resolve credential through `identity_auth`.
2. Query `tenant_admins WHERE identity_id = ?`.
3. If one tenant role exists, enter that tenant.
4. If multiple tenant roles exist, show tenant picker.
5. If none, reject or route to application/trial flow.
6. Remove all global `LIMIT 1` tenant selection behavior.

### Phase 4: Session Interface

1. Replace tenant-only session meaning with a resolver that returns `identity_id`, `tenant_id`, `role`, `customer_id?`, `expires_at`.
2. Decide storage after interface is stable: Signed Cookie, KV, Durable Object, JWT, or DB.
3. Protected merchant APIs must check role/permission through the resolver.

### Phase 5: Customer Login

1. LINE/phone login resolves Identity through `identity_auth`.
2. Tenant comes from booking URL or LIFF context.
3. Query `customers WHERE tenant_id = ? AND identity_id = ?`.
4. If missing, create Customer for that tenant.
5. Booking, points, history continue using `customer_id`.

## Compatibility Rules

- Existing `/book`, `/member`, `/api/bookings` must continue to work while `identity_id` is nullable.
- Tenant isolation remains P0.
- Identity and IdentityAuth must not expose Customer CRM to platform-level data.
- Phone/email in Customer remain tenant profile fields; phone/email in IdentityAuth are verified login methods.
- Do not delete `tenant_admins.phone/email/line_user_id` until login migration is proven.

## Proposed Future Migration Files

Suggested later, not created in this task:

1. `0012_identity_core.sql`
   - `identities`
   - `identity_auth`
   - indexes
2. `0013_identity_links.sql`
   - `ALTER TABLE customers ADD COLUMN identity_id TEXT`
   - `ALTER TABLE customers ADD COLUMN customer_no TEXT`
   - `ALTER TABLE tenant_admins ADD COLUMN identity_id TEXT`
   - link indexes

Do not run migrations until Schema Freeze is reviewed and approved.
