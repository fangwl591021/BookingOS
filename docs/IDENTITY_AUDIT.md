# Identity Audit

日期：2026-07-10
範圍：`src/index.js`、`migrations/*.sql`、遠端 D1 schema
狀態：唯讀稽核，沒有修程式、沒有改資料表。

## AIWE Rule

Identity 優先於 Tenant。

順序必須是：

```text
Identity -> Tenant -> Permission -> Data
```

不是：

```text
Tenant -> Identity
```

原因：同一個人未來可能同時是多家店的老闆、管理者、設計師、師傅或客戶。系統必須先確認「這個人是誰」，再決定「他這次要進哪一家店」，最後才判斷權限與資料範圍。

## 目前 Schema 摘要

### 沒有獨立 users 表

目前沒有：

- `users`
- `tenant_users`
- `roles`
- `sessions`

目前身份分散在：

| 表 | 用途 | 身份欄位 | tenant 關係 |
| --- | --- | --- | --- |
| `tenant_admins` | 店家後台管理者 | `name`, `phone`, `email`, `line_user_id`, `role` | 每列都有 `tenant_id` |
| `customers` | 店家客戶/會員 | `name`, `phone`, `line_user_id` | 每列都有 `tenant_id` |
| `platform_line_contacts` | 加入 BookingOS 平台官方 LINE 的店家線索/業主 | `line_user_id`, `display_name`, `phone`, `email` | 可選 `tenant_id`，但 `line_user_id` 是主鍵 |
| ENV secrets | 平台/店家密碼 | `PLATFORM_ADMIN_*`, `MERCHANT_ADMIN_PASSWORD` | 不屬於任何資料表 |

### tenant_admins 實際欄位

遠端 D1 目前 `tenant_admins` 欄位：

- `id`
- `tenant_id`
- `name`
- `phone`
- `email`
- `line_user_id`
- `role`
- `permissions_json`
- `status`
- `last_login_at`
- `created_at`
- `updated_at`

重點：沒有 `password` 欄位。店家帳密登入使用同一組全域 `MERCHANT_ADMIN_PASSWORD`，帳號用 `tenant_admins.phone/email/name` 或 `platform_line_contacts` 反查。

## 1. 目前登入到底有哪些方式？

### A. 平台總後台帳密登入

入口：

- `GET /platform-login`
- `POST /platform-login`

流程：

```mermaid
flowchart TD
  A[輸入平台帳號密碼] --> B[比對 ENV PLATFORM_ADMIN_USER]
  B --> C[比對 ENV PLATFORM_ADMIN_PASSWORD]
  C --> D[寫入 bookingos_platform_session cookie]
  D --> E[進入 /platform]
```

特性：

- 不查 DB user。
- 不知道是哪個 `user_id`。
- 不知道 `role`。
- Session 只是固定 secret。
- 進入平台後視為最高權限。

### B. 店家後台帳密登入

入口：

- `GET /merchant-login?tenant=...`
- `POST /merchant-login`

目前流程：

```mermaid
flowchart TD
  A[輸入帳號 + 全域店家密碼] --> B{是否為平台帳密}
  B -- 是 --> C[直接用 requestedTenantId 建立店家 session]
  B -- 否 --> D[比對 ENV MERCHANT_ADMIN_PASSWORD]
  D --> E[先用 requestedTenantId 查 tenant_admins]
  E -- 找到 --> F[使用該 tenant_id]
  E -- 找不到 --> G[查 platform_line_contacts requestedTenantId]
  G -- 找到 --> F
  G -- 找不到 --> H[全域查 tenant_admins LIMIT 1]
  H -- 找到 --> F
  H -- 找不到 --> I[全域查 platform_line_contacts LIMIT 1]
  I -- 找到 --> F
  F --> J[寫入 bookingos_merchant_session = tenant_id]
  J --> K[進入 merchant/settings/customers]
```

風險：

- 全域 fallback 使用 `LIMIT 1`。
- 如果 Tony 同時是店 A、店 B、店 C 管理者，現在不會顯示選店，而是挑到第一筆。
- 密碼不是每個 admin 自己的密碼，是全店家共用的 ENV 密碼。
- Session 只存 tenant，不存 user，也不存 role。

### C. 店家後台 LIFF 登入

入口：

- `POST /api/merchant/liff-login`

目前流程：

```mermaid
flowchart TD
  A[LIFF 取得 LINE User ID] --> B[查 platform_line_contacts by line_user_id LIMIT 1]
  B -- 有 tenant_id --> C[使用 contact.tenant_id]
  B -- 無 --> D[查 tenant_admins by line_user_id LIMIT 1]
  D -- 找到 --> E[使用 admin.tenant_id]
  C --> F[寫入 bookingos_merchant_session = tenant_id]
  E --> F
  F --> G[回傳 redirect]
```

風險：

- `platform_line_contacts.line_user_id` 是主鍵，所以平台好友 CRM 一個 LINE 目前只能直接掛一個 `tenant_id`。
- `tenant_admins.line_user_id` 沒有全域唯一限制，可以同 LINE 出現在多 tenant，但登入時 `LIMIT 1`。
- 沒有選店頁。
- 沒有把 `role` 放入 session。

### D. 客戶端會員/預約身份

入口：

- `/book?tenant=...`
- `/member?tenant=...`
- `/points?tenant=...`
- `/history?tenant=...`
- `/api/member`
- `/api/customer-profile`
- `/api/bookings`

目前流程：

```mermaid
flowchart TD
  A[客戶輸入姓名/手機] --> B[依 tenant_id + phone 查 customers]
  B -- 有 --> C[更新/讀取該店會員]
  B -- 無 --> D[建立該 tenant 的 customer]
  C --> E[預約/點數/歷史]
  D --> E
```

特性：

- 客戶會員目前主要靠 `tenant_id + phone`。
- `customers.line_user_id` 欄位存在，但目前客戶端沒有完整 LINE Login 綁定流程。
- 沒有客戶 session；多數動作靠手機查詢或送出。
- 同一 LINE/手機可以在不同 tenant 各有一筆 customer，schema 支援。

### E. 平台官方 LINE 好友身份

入口：

- `/platform-line-webhook`
- `/refer`
- `/api/referrals/claim`

用途：

- 記錄加入 BookingOS 官方 LINE 的店家線索/業主。
- 不是店家客戶會員。
- `platform_line_contacts.line_user_id` 是主鍵，一個 LINE 只有一筆平台好友資料。
- 可用 `tenant_id` 標記此人目前歸屬哪一家店，但不支援一個平台好友同時綁多店。

## 2. 目前 Session 存哪些欄位？

| Session | Cookie | 目前存放內容 | 是否有 user_id | 是否有 tenant_id | 是否有 role | 評估 |
| --- | --- | --- | --- | --- | --- | --- |
| 平台總後台 | `bookingos_platform_session` | `PLATFORM_SESSION_SECRET` 固定值 | 否 | 否 | 否 | 只代表通過平台密碼 |
| 店家後台 | `bookingos_merchant_session` | `encodeURIComponent(tenantId)` | 否 | 是，只有 tenant | 否 | 不知道登入者是誰，也不知道 role |
| 客戶端會員 | 無正式 session | 手機/表單資料 | 否 | 由 URL 決定 | 否 | 沒有登入態 |
| LIFF 登入 | 最終仍寫 merchant cookie | `tenantId` | 否 | 是，只有 tenant | 否 | LINE user ID 沒進 session |

結論：目前 Session 不符合目標模型。

目標應是：

```json
{
  "user_id": "...",
  "tenant_id": "...",
  "role": "owner|admin|staff|viewer|member"
}
```

目前只有：

```json
{
  "tenant_id": "..."
}
```

或平台：

```json
{
  "platform_secret_matched": true
}
```

## 3. 目前一個人最多可以幾家店？

### Schema 上

| 身份來源 | 是否支援一人多店 | 原因 |
| --- | --- | --- |
| `tenant_admins` by phone/email/name | 支援，但沒有正確登入 UX | 同一 phone/email/name 可以出現在多筆不同 tenant，沒有 unique 限制 |
| `tenant_admins` by line_user_id | 支援，但登入會錯 | 沒有 unique 限制，但目前 `LIMIT 1` |
| `customers` by phone | 支援 | `UNIQUE (tenant_id, phone)`，不是全域 unique |
| `customers` by line_user_id | 支援 | `UNIQUE (tenant_id, line_user_id)`，不是全域 unique |
| `platform_line_contacts` | 不支援真正多店 | `line_user_id` 是主鍵，只有一個 `tenant_id` 欄位 |

### 實際遠端資料上

本次讀取遠端 D1 檢查：

- `tenant_admins.phone` 跨多店：目前 0 筆。
- `tenant_admins.line_user_id` 跨多店：目前 0 筆。
- `customers.phone` 跨多店：目前 0 筆。
- `customers.line_user_id` 跨多店：目前 0 筆。

所以：目前資料沒有發生一人多店，但 schema 已經允許部分情境發生；登入流程還沒準備好。

## 4. 如果三家店，登入哪一家？

目前答案：系統不會問，會自動挑一筆。

### 店家帳密登入

優先順序：

1. 如果表單帶 `tenant`，先查該 tenant 的 `tenant_admins`。
2. 查不到，查該 tenant 的 `platform_line_contacts`。
3. 還查不到，全域查 `tenant_admins LIMIT 1`。
4. 還查不到，全域查 `platform_line_contacts LIMIT 1`。

因此如果 Tony 同時屬於三家店：

- 有帶 tenant 且該 tenant 命中：登入該 tenant。
- 沒帶 tenant 或 requested tenant 沒命中：資料庫回哪筆，就進哪家。
- 使用者不會看到「請選擇登入店家」。

### 店家 LIFF 登入

優先順序：

1. 查 `platform_line_contacts` 的 `line_user_id LIMIT 1`，有 tenant 就用它。
2. 否則查 `tenant_admins.line_user_id LIMIT 1`。

因此如果 LINE UID 同時屬於三家店：

- 目前不會列出三家。
- 會自動使用第一筆查詢結果。
- 這正是目前 Identity Model 最大缺口。

## 目前身份模型圖

```mermaid
erDiagram
  TENANTS ||--o{ TENANT_ADMINS : has
  TENANTS ||--o{ CUSTOMERS : has
  TENANTS ||--o{ BOOKINGS : has
  TENANTS ||--o{ LINE_OA_SETTINGS : has
  PLATFORM_LINE_CONTACTS }o--o| TENANTS : current_tenant

  TENANTS {
    text id PK
    text name
    text status
  }

  TENANT_ADMINS {
    text id PK
    text tenant_id FK
    text name
    text phone
    text email
    text line_user_id
    text role
    text permissions_json
    text status
  }

  CUSTOMERS {
    text id PK
    text tenant_id FK
    text name
    text phone
    text line_user_id
    int points_balance
  }

  PLATFORM_LINE_CONTACTS {
    text line_user_id PK
    text display_name
    text phone
    text email
    text lead_status
    text tenant_id
  }
```

目前模型其實是：

```text
Tenant -> tenant_admins / customers
```

不是：

```text
Identity -> tenant_memberships -> tenant
```

## 建議 V2 方向，尚不執行

先不要急著改資料表，但模型應往這個方向收斂：

```mermaid
erDiagram
  USERS ||--o{ USER_IDENTITIES : has
  USERS ||--o{ TENANT_USERS : belongs_to
  TENANTS ||--o{ TENANT_USERS : has
  ROLES ||--o{ TENANT_USERS : grants
  USERS ||--o{ CUSTOMER_MEMBERSHIPS : member_of
  TENANTS ||--o{ CUSTOMER_MEMBERSHIPS : has_customer

  USERS {
    text id PK
    text display_name
    text phone
    text email
    text created_at
  }

  USER_IDENTITIES {
    text id PK
    text user_id FK
    text provider
    text provider_user_id
  }

  TENANT_USERS {
    text user_id FK
    text tenant_id FK
    text role
    text status
  }

  ROLES {
    text id PK
    text scope
    text permissions_json
  }

  CUSTOMER_MEMBERSHIPS {
    text user_id FK
    text tenant_id FK
    text customer_id
  }
```

登入流程應變成：

```mermaid
flowchart TD
  A[LINE Login 或帳密] --> B[解析 Identity]
  B --> C[找到 user_id]
  C --> D[查 tenant_users / customer_memberships]
  D --> E{幾家店?}
  E -- 0 --> F[無權限或建立申請]
  E -- 1 --> G[直接進該店]
  E -- 多家 --> H[顯示選店]
  H --> I[選定 tenant]
  G --> J[建立 session: user_id + tenant_id + role]
  I --> J
  J --> K[進入資料層]
```

## 本輪結論

1. 目前登入方式有：平台帳密、店家帳密、店家 LIFF、客戶手機會員、平台 LINE 好友 webhook。
2. 目前 session 不存完整身份，只存平台 secret 或 tenant id。
3. schema 部分支援一人多店，但沒有 users / membership 中介模型。
4. 如果一人三家店，現在不會選店，會用 requested tenant 或 `LIMIT 1` 自動決定。
5. 下一步不應先修某個 `LIMIT 1`，而是先決定 V2 Identity Model：`users -> identities -> tenant_users -> roles -> session`。