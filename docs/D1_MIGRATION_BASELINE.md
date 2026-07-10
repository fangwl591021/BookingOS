# D1 Migration Baseline

日期：2026-07-10
任務：Task 006 D1 Migration History Reconcile
資料庫：`bookingos-db`
D1 database_id：`86120cac-4bf0-4a76-8dea-eacd3287cd15`
Wrangler：`4.110.0`

## 問題背景

BookingOS production D1 的實際 schema 已經包含多個 legacy migration 的變更，但 Wrangler migration history table 只記錄 `0001_initial.sql`。

Task 005 已用受控方式直接套用 `0012_additive_identity.sql`，避免整批 remote migration 重跑；因此 Task 006 的目標是讓 D1 history 與實際 schema 對齊，使未來新增 migration 可以回到標準 Wrangler 流程。

## 原因

遠端 D1 內的 tracking table 是 `d1_migrations`：

| Column | Type | Note |
| --- | --- | --- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT |
| `name` | TEXT | UNIQUE |
| `applied_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP NOT NULL |

Task 開始前的 history 只有：

| id | name | applied_at |
| --- | --- | --- |
| 1 | `0001_initial.sql` | `2026-07-07 09:44:15` |

但 `wrangler d1 migrations list bookingos-db --remote` 顯示 `0002` 到 `0012` pending。若直接執行 `wrangler d1 migrations apply bookingos-db --remote`，多個 `ALTER TABLE ADD COLUMN` 會重跑，造成 schema conflict；部分 `CREATE TABLE IF NOT EXISTS` 雖可重跑，但不應混在整批 apply 中冒險。

## 遠端 Migration History 現況

Reconcile 後：

| id | name | applied_at |
| --- | --- | --- |
| 1 | `0001_initial.sql` | `2026-07-07 09:44:15` |
| 2 | `0002_customer_profile_fields.sql` | `2026-07-10 03:11:53` |
| 3 | `0003_point_reward_ratio.sql` | `2026-07-10 03:11:53` |
| 4 | `0004_service_point_redeem_limit.sql` | `2026-07-10 03:11:53` |
| 5 | `0005_staff_members.sql` | `2026-07-10 03:11:53` |
| 6 | `0006_resource_types.sql` | `2026-07-10 03:11:53` |
| 7 | `0007_tenant_logo.sql` | `2026-07-10 03:11:53` |
| 8 | `0008_staff_service_ids.sql` | `2026-07-10 03:11:53` |
| 9 | `0009_staff_crm_permissions.sql` | `2026-07-10 03:11:53` |
| 10 | `0010_tenant_admins.sql` | `2026-07-10 03:11:53` |
| 11 | `0011_tenant_applications.sql` | `2026-07-10 03:11:53` |
| 12 | `0012_additive_identity.sql` | `2026-07-10 03:11:53` |

`wrangler d1 migrations list bookingos-db --remote` 現在回報：`No migrations to apply`。

## 實際 Schema 現況

遠端只讀查證：

```sql
SELECT name, type, sql
FROM sqlite_master
WHERE type IN ('table', 'index')
ORDER BY type, name;
```

遠端目前有 23 tables、48 indexes。Task 006 沒有刪除或重建任何正式資料表。

主要資料筆數 reconcile 前後一致：

| Table | Count |
| --- | ---: |
| `tenants` | 3 |
| `bookings` | 4 |
| `customers` | 2 |
| `tenant_admins` | 3 |
| `identities` | 2 |
| `identity_auth` | 2 |

`/api/health` 回應正常：

```json
{"ok":true,"service":"BookingOS","version":"0.2.2-resource-capacity","database":true}
```

## Migration 對照表

| Migration | 主要變更 | 遠端 Schema 是否已存在 | History 是否已記錄 | 判定 | 重跑風險 |
| --- | --- | --- | --- | --- | --- |
| `0001_initial.sql` | 建立 tenants、business_settings、services、service_durations、customers、bookings、point_transactions、referrals 與初始 index/seed | Yes | Yes | Applied | 多數 `CREATE IF NOT EXISTS` 安全；seed `INSERT OR IGNORE` 安全 |
| `0002_customer_profile_fields.sql` | `customers` 新增 email、gender、address、preferred_service、allergy_note、contact_preference | Yes | Yes after reconcile | Applied outside history, now reconciled | `ALTER TABLE ADD COLUMN` 重跑會失敗 |
| `0003_point_reward_ratio.sql` | `business_settings` 新增 point_spend_amount、point_reward_points | Yes | Yes after reconcile | Applied outside history, now reconciled | `ALTER TABLE ADD COLUMN` 重跑會失敗 |
| `0004_service_point_redeem_limit.sql` | `services` 新增 point_redeem_limit | Yes | Yes after reconcile | Applied outside history, now reconciled | `ALTER TABLE ADD COLUMN` 重跑會失敗 |
| `0005_staff_members.sql` | 建立 staff_members、idx_staff_members_tenant、seed Tony | Yes | Yes after reconcile | Applied outside history, now reconciled | `CREATE IF NOT EXISTS` / `INSERT OR IGNORE` 大致安全 |
| `0006_resource_types.sql` | 建立 resource_types、index、services.resource_type_id、seed bed、更新 demo services | Yes | Yes after reconcile | Applied outside history, now reconciled | `ALTER TABLE ADD COLUMN` 重跑會失敗；UPDATE 不應重跑 |
| `0007_tenant_logo.sql` | `tenants.logo_url` | Yes | Yes after reconcile | Applied outside history, now reconciled | `ALTER TABLE ADD COLUMN` 重跑會失敗 |
| `0008_staff_service_ids.sql` | `staff_members.service_ids` | Yes | Yes after reconcile | Applied outside history, now reconciled | `ALTER TABLE ADD COLUMN` 重跑會失敗 |
| `0009_staff_crm_permissions.sql` | `staff_members.crm_permissions` | Yes | Yes after reconcile | Applied outside history, now reconciled | `ALTER TABLE ADD COLUMN` 重跑會失敗 |
| `0010_tenant_admins.sql` | 建立 tenant_admins、idx_tenant_admins_tenant | Yes | Yes after reconcile | Applied outside history, now reconciled | `CREATE IF NOT EXISTS` 安全 |
| `0011_tenant_applications.sql` | `tenants.contract_start/end`、建立 tenant_applications、index | Yes | Yes after reconcile | Applied outside history, now reconciled | `ALTER TABLE ADD COLUMN` 重跑會失敗 |
| `0012_additive_identity.sql` | 建立 identities、identity_auth、identity link columns、identity indexes | Yes | Yes after reconcile | Applied outside history, now reconciled | 多個 `ALTER TABLE ADD COLUMN` 重跑會失敗 |

## 採用的 Reconcile 方案

採用方案 B：安全補記 Migration History。

理由：

1. 已逐一查證遠端 schema 包含 `0002` 到 `0012` 的 table、column、index。
2. Wrangler tracking table 名稱、欄位與既有 migration name 格式已確認。
3. 補記只寫入 `d1_migrations.name`，不重跑 schema SQL，不碰正式業務資料表。
4. 操作前已建立遠端 D1 備份。
5. 補記 SQL 使用 `INSERT OR IGNORE`，可重跑且不會重複新增。

未採用方案 A 的原因：

- 既有 Wrangler tracking table 已存在且格式簡單，直接補記能回到標準 Wrangler 流程，不需要改目錄或建立新 baseline 起點。

未採用方案 C 的原因：

- 遠端 schema 與目前 migration 檔案可對上，沒有必要拋棄既有 migration history 另建新起點。

## 正式環境操作紀錄

操作前備份：

```text
.local-backups/bookingos-db-pre-history-reconcile-20260710.sql
```

此目錄已被 `.gitignore` 排除，不得提交 Git。

正式補記 SQL：

```sql
INSERT OR IGNORE INTO d1_migrations (name) VALUES
('0002_customer_profile_fields.sql'),
('0003_point_reward_ratio.sql'),
('0004_service_point_redeem_limit.sql'),
('0005_staff_members.sql'),
('0006_resource_types.sql'),
('0007_tenant_logo.sql'),
('0008_staff_service_ids.sql'),
('0009_staff_crm_permissions.sql'),
('0010_tenant_admins.sql'),
('0011_tenant_applications.sql'),
('0012_additive_identity.sql');
```

Wrangler 回報：

- `changes`: 11
- `last_row_id`: 12
- `changed_db`: true

## 新環境初始化方式

全新開發或測試 D1 仍應從完整 `migrations/` 目錄建立，不使用 production history 補記 SQL。

本機初始化：

```bash
npm install
npx wrangler d1 migrations apply bookingos-db --local
npm run check
```

正式新環境初始化：

```bash
npx wrangler d1 create <new-database-name>
# 更新 wrangler.toml 的 database_id
npx wrangler d1 migrations apply <new-database-name> --remote
```

注意：只有 production 既有 D1 需要本次 reconcile。新環境不要手動插入 `d1_migrations`。

## 未來新增 Migration SOP

1. 建立新 migration，編號從 `0013_*.sql` 開始。
2. 本機執行：`npx wrangler d1 migrations apply bookingos-db --local`。
3. 執行：`npm run check`。
4. 正式操作前備份：`npx wrangler d1 export bookingos-db --remote --output .local-backups/<name>.sql`。
5. 查 pending：`npx wrangler d1 migrations list bookingos-db --remote`。
6. 確認 pending 只包含新 migration。
7. 套用：`npx wrangler d1 migrations apply bookingos-db --remote`。
8. 驗證資料筆數與 `/api/health`。
9. 更新 migration report / status / changelog。

## 禁止執行的指令

目前禁止：

```bash
npx wrangler d1 migrations apply bookingos-db --remote
```

如果沒有先查 pending 清單，不得直接執行。原因是 production schema 曾經和 history 不一致；雖然本次已修復，但未來仍必須確認 pending 只包含新 migration。

也禁止：

```bash
# 不得為了清 pending 而重跑舊 migration 檔
npx wrangler d1 execute bookingos-db --remote --file migrations/0002_customer_profile_fields.sql
```

## 回滾與恢復方法

如果 history 補記後發現錯誤：

1. 不要重跑 migration。
2. 使用 `.local-backups/bookingos-db-pre-history-reconcile-20260710.sql` 作為恢復來源。
3. 若只需回退 history，可在確認後刪除 `d1_migrations` 補記的 name rows；但這會再次讓 Wrangler pending 顯示舊 migration，不建議除非判定補記錯誤。
4. 若資料表受損，使用備份建立新 D1，再切換 `wrangler.toml` database_id。Task 006 未發生此狀況。

## 完成結論

- Legacy migrations 已逐一盤點。
- 遠端實際 schema 已只讀查證。
- Wrangler tracking table 已確認。
- `0002` 到 `0012` 已安全補記到 `d1_migrations`。
- 正式資料筆數不變。
- `/api/health` 正常。
- 後續 migration 可從 `0013` 開始使用標準 Wrangler 流程，但必須先查 pending 清單與備份。
