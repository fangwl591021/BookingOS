# Tenant Audit

日期：2026-07-10
範圍：`src/index.js`、`migrations/*.sql`
狀態：唯讀掃描，尚未修補。

## AIWE Rule

任何租戶資料表 SQL 如果沒有 tenant filter，視為 P0。

本次判斷：

- `OK`：有使用目前 tenant，或租戶資料以 `tenant_id` 寫入。
- `P0`：租戶資料表查詢/更新沒有 `WHERE tenant_id = ?` 或等價限制。
- `GLOBAL`：平台總後台全域表，預期跨店管理，例如 `tenants`、`tenant_applications`、`billing_orders`、`platform_line_contacts`。
- `REVIEW`：登入/綁定流程需要從帳號反查 tenant，技術上沒有 tenant filter，但可能是必要例外；依新規則先列出，不能默默放過。

## API / Worker / CRUD Matrix

| Surface | Method | Tenant 來源 | CRUD 限制 | 狀態 | 備註 |
| --- | --- | --- | --- | --- | --- |
| `/api/dashboard` | GET | `activeTenantId` | 店家登入保護 | OK | `dashboardData(env, date, activeTenantId)` |
| `/api/availability` | GET | `activeTenantId` | 公開客戶端 | OK | 只讀該 tenant 的服務、班表、預約 |
| `/api/store` | GET/POST | `activeTenantId` | POST 需店家登入 | OK | 更新 `tenants.id = tenantId` |
| `/api/settings` | GET/POST | `activeTenantId` | POST 需店家登入 | OK | `business_settings WHERE tenant_id = ?` |
| `/api/services` | GET/POST | `activeTenantId` | POST 需店家登入 | OK | `services`、`service_durations` 均有 tenant |
| `/api/staff` | GET/POST | `activeTenantId` | POST 需店家登入 | OK | 有方案人數限制與 tenant |
| `/api/resources` | GET/POST | `activeTenantId` | POST 需店家登入 | OK | `resource_types WHERE tenant_id = ?` |
| `/api/customers/export` | GET | `activeTenantId` | 需店家登入 | OK | 匯出三表皆有 tenant |
| `/api/customers` | GET | `activeTenantId` | 需店家登入 | OK | `customers WHERE tenant_id = ?` |
| `/api/customer-profile` | GET | `activeTenantId` | 公開客戶端 | OK | 手機查詢限制在 tenant 內 |
| `/api/member` | GET/POST | `activeTenantId` | 公開客戶端 | OK | 會員建立/更新有 tenant |
| `/api/bookings` | POST | `activeTenantId` | 公開客戶端 | OK | 建立 booking/customer/points 都寫 tenant |
| `/api/bookings/cancel` | POST | `activeTenantId` | 公開客戶端手機驗證 | OK | booking/customer/points 都有 tenant |
| `/line-webhook` | POST | query/path tenant | LINE signature | OK | 店家 OA webhook 先解析 tenant 再驗證設定 |
| `/api/merchant/liff-login` | POST | LINE user 反查 | LINE profile | REVIEW | 會從 `tenant_admins` 或 `platform_line_contacts` 反查 tenant，部分 SQL 無 tenant filter |
| `/merchant-login` | POST | 表單 tenant 或帳號反查 | 密碼 | REVIEW | 全域帳號反查 `tenant_admins` / `platform_line_contacts` 可能跨 tenant |
| `/api/platform` | GET | 平台總後台 | 平台登入 | GLOBAL | 預期跨 tenant 管理 |
| `/api/platform/*` | POST | 平台總後台 | 平台登入 | GLOBAL | 預期跨 tenant 管理 |
| `/api/applications` | POST | 無 tenant，申請中 | 公開申請 | GLOBAL | 尚未核准 tenant |
| `/api/trials` | POST | 建立新 tenant | 公開試用 | GLOBAL | 建立新租戶流程 |
| `/api/referrals/claim` | POST | 平台好友 CRM | 公開 referral | GLOBAL | 平台 LINE 好友，不是店家客戶資料 |
| `/platform-line-webhook` | POST | 平台 LINE OA | LINE signature | GLOBAL | 平台 CRM，不是店家租戶資料 |

## `FROM bookings` 專項掃描

| Line | SQL | Tenant filter | 狀態 |
| --- | --- | --- | --- |
| `1050` | Platform tenant list subquery `(SELECT COUNT(*) FROM bookings b WHERE b.tenant_id = t.id)` | `b.tenant_id = t.id` | OK |
| `1828` | `loadBookings()` | `WHERE b.tenant_id = ?` | OK |
| `1932` | Customer workbook history | `WHERE b.tenant_id = ?` | OK |
| `1991` | Customer profile booking history | `WHERE tenant_id = ?` | OK |

結論：目前沒有找到 `SELECT ... FROM bookings` 缺少 tenant filter 的地方。

## P0 / REVIEW SQL 清單

| Line | Table | SQL 摘要 | 狀態 | 原因 |
| --- | --- | --- | --- | --- |
| `411` | `tenant_admins` | `${adminSql} LIMIT 1` | P0 / REVIEW | 店家帳密登入 fallback 以帳號反查 tenant，沒有 `WHERE tenant_id = ?`。如果同一手機/Email 存在多店，可能登入錯店。 |
| `447` | `tenant_admins` | `SELECT tenant_id FROM tenant_admins WHERE line_user_id = ? ... LIMIT 1` | P0 / REVIEW | LIFF 登入用 LINE UID 反查 tenant，沒有 tenant filter。需要決定是否允許一個 LINE 管多店，以及如何選店。 |
| `1058` | `tenant_admins` | `SELECT ... FROM tenant_admins ORDER BY tenant_id...` | GLOBAL / REVIEW | 平台總後台全域管理可接受，但此表本身是租戶表；需明確標記為 platform-only 例外。 |
| `1074` | `line_oa_settings` | `SELECT ... FROM line_oa_settings` | GLOBAL / REVIEW | 平台頁列出各店 LINE OA 設定，需平台權限，屬全域管理例外。 |

## Tenant-scoped SQL 已通過清單

| Area | Tables | 狀態 |
| --- | --- | --- |
| Dashboard/availability | `business_settings`, `services`, `service_durations`, `resource_types`, `staff_members`, `bookings` | OK |
| Customer CRM | `customers`, `bookings`, `point_transactions` | OK |
| Member profile | `customers`, `bookings`, `point_transactions` | OK |
| Booking create | `customers`, `bookings`, `point_transactions`, `referrals` | OK |
| Booking cancel | `bookings`, `customers`, `point_transactions` | OK |
| Settings CRUD | `business_settings`, `services`, `service_durations`, `resource_types`, `staff_members`, `tenants` | OK |
| Tenant admin creation/reconcile | `tenant_admins`, `staff_members` | OK where tenant is known |

## Platform-global Tables

這些表本來就是平台總後台跨店管理，不適用單店 tenant filter，但所有入口必須有平台登入：

- `tenants`
- `tenant_applications`
- `billing_orders`
- `platform_line_oa_settings`
- `platform_line_contacts`
- `platform_referrals`
- `platform_line_webhook_logs`

## 第二步修補建議，不在本次執行

1. 店家帳密登入不要使用全域 `tenant_admins` fallback，必須：
   - 先指定 tenant 再登入；或
   - 帳號登入後若命中多 tenant，進入選店頁；或
   - `tenant_admins` 增加唯一登入帳號與明確綁定規則。
2. LIFF 店家登入若一個 LINE UID 可屬於多店，必須回傳店家列表，不可 `LIMIT 1` 自動挑第一家。
3. `platformData()` 裡讀 `tenant_admins`、`line_oa_settings` 保留，但註解或封裝成 `platformOnlyQuery()`，避免日後被誤用。
4. 建立 SQL lint：凡租戶表 `SELECT/UPDATE/DELETE` 沒有 `tenant_id` 或 platform-only 註記，直接 fail。

## 第三步 Tenant 測試計畫

必做真人流程：

1. 建立 A 店與 B 店。
2. A 店登入，建立 A 店服務、師傅、客戶、預約。
3. B 店登入，確認看不到 A 店 CRM、預約、點數、設定資料。
4. B 店建立自己的服務、師傅、客戶、預約。
5. A 店重新登入，確認看不到 B 店資料。
6. 用 A 店客戶手機查 `/api/customer-profile?tenant=A` 可回資料。
7. 同手機查 `/api/customer-profile?tenant=B` 必須 `profile:null`。
8. 匯出 A 店 Excel 不得含 B 店客戶、預約、點數。
9. 匯出 B 店 Excel 不得含 A 店客戶、預約、點數。
10. 取消 A 店預約，不得影響 B 店點數。

建議自動化：新增 `scripts/tenant-audit-test.mjs`，用 D1 建立測試 tenant，跑 API smoke test 後清理測試資料。
