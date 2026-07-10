# Identity Migration Plan

日期：2026-07-10
狀態：Task 005 Additive Identity Migration 已完成。Schema 已加入本機與遠端 D1；尚未切換登入、Session、LIFF、預約或 CRM 行為。

## Current Schema vs Frozen Target

| Area | Current | Frozen Target | Action | Priority |
| --- | --- | --- | --- | --- |
| Platform identity | 已新增 `identities` 表 | `identities(id, status, created_at, updated_at)` | 已完成 | Immediate |
| Login auth | 既有登入欄位仍保留；已新增 `identity_auth` | `identity_auth(identity_id, provider, provider_uid, normalized_phone, normalized_email, verified, metadata_json)` | 已完成 schema；LINE scoped backfill 已完成 | Immediate |
| Tenant | `tenants` 已存在 | 保留 | 不變 | No change |
| Customer | `customers` 已新增 nullable `identity_id`、`customer_no` | `customers.identity_id` nullable；CRM 欄位保留在 Customer | 已完成 schema；資料未強制合併 | Immediate |
| Tenant Admin | `tenant_admins` 已新增 nullable `identity_id` | `tenant_admins.identity_id` nullable；原 phone/email/line_user_id 暫時保留 | 已完成 schema；資料未強制合併 | Immediate |
| Platform LINE Contact | `platform_line_contacts` 已新增 nullable `identity_id` | 平台好友可連到 Identity，但不成為 Customer CRM | 已完成 schema；遠端 2 筆 LINE 已回填 | Immediate |
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

### Link columns

```sql
ALTER TABLE customers ADD COLUMN identity_id TEXT;
ALTER TABLE customers ADD COLUMN customer_no TEXT;
ALTER TABLE tenant_admins ADD COLUMN identity_id TEXT;
ALTER TABLE platform_line_contacts ADD COLUMN identity_id TEXT;
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
ON tenant_admins(identity_id);

CREATE INDEX IF NOT EXISTS idx_customers_identity
ON customers(identity_id);

CREATE INDEX IF NOT EXISTS idx_platform_line_contacts_identity
ON platform_line_contacts(identity_id);
```

本輪刻意不建立 `UNIQUE customers(tenant_id, identity_id)`，直到 production audit 證明不會有重複 Customer。

## Not In V1 Schema Freeze

| Item | Decision | Reason |
| --- | --- | --- |
| `identity_profiles` | Do not create | Provider display data belongs in `identity_auth.metadata_json` until real need appears. |
| New `admins` table | Do not create | Existing app depends on `tenant_admins`; adding `admins` creates unnecessary double migration. |
| `sessions` table | Do not create | First freeze a Session Interface; storage can be Signed Cookie, KV, Durable Object, JWT, or DB later. |
| `staff_members.identity_id` | Deferred | Staff login can wait until merchant/customer identity is stable. |
| `customer_tags`, `customer_notes`, `customer_followups`, `customer_coupons` | Deferred | These are CRM feature expansions, not Identity blockers. |

## Migration Status

### Phase 0: Freeze Documents

Status: complete.

### Phase 1: Additive Schema Only

Status: complete locally and remotely.

Migration file: `migrations/0012_additive_identity.sql`.

### Phase 2: Backfill Identity Records

Status: partial and safe.

- Backfilled only scoped LINE records.
- Remote result: 2 identities, 2 identity_auth rows, 2 platform contact links.
- Phone/email were audit-only and were not used to merge records.
- Remote audit still has 1 duplicated/cross-tenant normalized phone hash requiring manual review.

### Phase 3: Login Read Path

Status: not started.

### Phase 4: Session Interface

Status: not started.

### Phase 5: Customer Login

Status: not started.

## Compatibility Rules

- Existing `/book`, `/member`, `/api/bookings` must continue to work while `identity_id` is nullable.
- Tenant isolation remains P0.
- Identity and IdentityAuth must not expose Customer CRM to platform-level data.
- Phone/email in Customer remain tenant profile fields; phone/email in IdentityAuth are verified login methods.
- Do not delete `tenant_admins.phone/email/line_user_id` until login migration is proven.

## Operational Notes

- Remote D1 historical migration table is not aligned: `wrangler d1 migrations list --remote` still shows old migrations pending.
- To avoid applying old migrations unexpectedly, Task 005 applied only `migrations/0012_additive_identity.sql` by direct `wrangler d1 execute --file` after backup.
- Before any future `wrangler d1 migrations apply --remote`, reconcile D1 migration history.

## Task 007 Update: Merchant Login Read Path

狀態：已開始切換 Merchant Login read path，但仍維持 V1 merchant cookie。

- POST /merchant-login 已改為 dual-read：先讀 legacy tenant_admins.phone/email/name，再解析/建立 identity_id。
- 不以 identity_auth 作為 merchant password source；MERCHANT_ADMIN_PASSWORD 仍是 V1 過渡密碼。
- 不用 phone/email 建立 identity_auth 或自動合併 identity。
- platform_line_contacts 不再作為店家帳密登入權限來源。
- 無 tenant 多店命中會回 TENANT_SELECTION_REQUIRED；不再全域 LIMIT 1 選店。
- Session Interface 尚未切換；Merchant Cookie 格式未改。

## Task 008 Update: Merchant Session Interface

狀態：程式面已切換 Merchant protected routes 與帳密登入 cookie；尚未部署。

- Merchant Cookie 改為 signed stateless session，不新增 `sessions` table。
- Payload 使用 `sub` 表示 `identity_id`，並保存 `tenant_id`、`role`、`iat`、`exp`、`v`。
- Protected route 每次請求都從 DB 重新驗證 `tenant_admins.identity_id`、`identities.status`、`tenants.status`。
- DB role 與 cookie role 不一致時要求重新登入。
- Legacy tenant-only cookie 僅相容辨識，不可授權，不自動升級。
- LIFF Login 尚未納入本 Task，後續需另行切換。
