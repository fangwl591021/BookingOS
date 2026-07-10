# BookingOS Schema Freeze

日期：2026-07-10
狀態：Frozen and migrated additively in Task 005。Task 006 已完成 D1 migration history reconcile。

## Freeze Scope

BookingOS V1 Identity Schema 只凍結以下項目：

1. `identities`
2. `identity_auth`
3. `customers.identity_id`
4. `customers.customer_no`
5. `tenant_admins.identity_id`
6. `platform_line_contacts.identity_id`
7. Session Interface

## Architecture Rule

Identity 永遠不存任何商業資料。

商業資料全部屬於 Customer，包括：

- 姓名
- 生日
- 地址
- 病歷
- 整復紀錄
- 美髮紀錄
- 美甲/美睫紀錄
- 備註
- 點數
- 標籤
- 優惠券
- 消費
- CRM

Identity 只存平台身份。IdentityAuth 只存登入憑證與 provider snapshot。

## Frozen Tables

### identities

```sql
CREATE TABLE IF NOT EXISTS identities (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### identity_auth

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
- future: `GOOGLE`
- future: `APPLE`

`metadata_json` 可存 provider snapshot，例如 LINE display name、picture URL、locale。不得存 Customer CRM 或任何 tenant 商業資料。

## Frozen Columns

### customers

```sql
ALTER TABLE customers ADD COLUMN identity_id TEXT;
ALTER TABLE customers ADD COLUMN customer_no TEXT;
```

### tenant_admins

```sql
ALTER TABLE tenant_admins ADD COLUMN identity_id TEXT;
```

### platform_line_contacts

```sql
ALTER TABLE platform_line_contacts ADD COLUMN identity_id TEXT;
```

## Frozen Indexes

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

## Explicitly Not Frozen

| Item | Decision |
| --- | --- |
| `identity_profiles` | Not created in V1. |
| New `admins` table | Not created in V1. Continue using `tenant_admins`. |
| `sessions` table | Not created in V1. Freeze Session Interface only. |
| `staff_members.identity_id` | Deferred. |
| CRM split tables | Deferred. |
| Point/coupon table rename | Deferred. |

## Session Interface

Any future session implementation must resolve to:

```json
{
  "identity_id": "idn_...",
  "tenant_id": "tenant_...",
  "customer_id": "cus_...",
  "role": "TenantOwner|TenantManager|Staff|Customer|PlatformOwner|PlatformAdmin",
  "permissions": {},
  "expires_at": "2026-07-10T12:00:00Z"
}
```

`customer_id` is required only for Customer session.

Storage is not frozen. Acceptable future implementations include Signed Cookie, KV, Durable Object, JWT, or D1 table.

## Freeze Rule

No migration should be created until this Schema Freeze is explicitly accepted.
