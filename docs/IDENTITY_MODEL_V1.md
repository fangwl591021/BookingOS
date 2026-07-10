# BookingOS V1 Identity Model

日期：2026-07-10
狀態：設計確認文件，尚未執行 migration，尚未修改程式。

## 核心原則

Identity（平台身份）不等於 Customer（店家會員）。

- Identity 只回答：我是誰。
- Customer 只回答：我在這家店是什麼會員。
- Tenant 只回答：這是哪一家店。
- Permission 只回答：這個身份在這家店可以做什麼。
- Data 只回答：這家店自己的預約、CRM、點數、消費、備註。

Identity 永遠不存：

- 姓名
- 生日
- 地址
- 點數
- CRM 備註
- 消費紀錄
- 店家標籤
- 醫療/整復/髮色/美甲紀錄

這些全部屬於店家的 Customer 資料，不屬於平台 Identity。

## 企業級資料邊界

平台可以知道：

- 這個 identity 有哪些登入憑證。
- 這個 identity 關聯幾家店。
- 這個 identity 在每家店的角色。

平台不應知道或集中管理：

- 店家客戶的 CRM 備註。
- 看診/整復/髮色/美睫/美甲紀錄。
- 客戶在某店的生日、地址、偏好與消費。
- 點數、券、標籤、追蹤紀錄。

這些是各 tenant 自己的 customer data。

## V1 Target ER Diagram

```mermaid
erDiagram
  IDENTITIES ||--o{ IDENTITY_CREDENTIALS : has
  IDENTITIES ||--o{ ADMINS : manages
  IDENTITIES ||--o{ CUSTOMERS : appears_as
  TENANTS ||--o{ ADMINS : grants_access
  TENANTS ||--o{ CUSTOMERS : owns
  TENANTS ||--o{ STAFF : employs
  IDENTITIES ||--o{ STAFF : optional_login
  CUSTOMERS ||--o{ BOOKINGS : makes
  STAFF ||--o{ BOOKINGS : serves
  SERVICES ||--o{ BOOKINGS : booked_for
  RESOURCE_TYPES ||--o{ BOOKINGS : capacity
  CUSTOMERS ||--o{ CUSTOMER_POINTS : earns_or_spends
  CUSTOMERS ||--o{ CUSTOMER_COUPONS : owns
  CUSTOMERS ||--o{ CUSTOMER_TAGS : tagged
  CUSTOMERS ||--o{ CUSTOMER_NOTES : noted
  CUSTOMERS ||--o{ CUSTOMER_FOLLOWUPS : followup

  IDENTITIES {
    text id PK
    text status
    text created_at
    text updated_at
  }

  IDENTITY_CREDENTIALS {
    text id PK
    text identity_id FK
    text provider
    text provider_user_id
    text phone
    text email
    text verified_at
    text created_at
    text updated_at
  }

  TENANTS {
    text id PK
    text name
    text plan
    text status
  }

  ADMINS {
    text id PK
    text identity_id FK
    text tenant_id FK
    text role
    text status
    text permissions_json
    text created_at
    text updated_at
  }

  CUSTOMERS {
    text id PK
    text tenant_id FK
    text identity_id FK
    text customer_no
    text name
    text phone
    text birthday
    text gender
    text address
    text member_level
    int points
    text status
    text created_at
    text updated_at
  }

  STAFF {
    text id PK
    text tenant_id FK
    text identity_id FK
    text name
    text role
    text service_ids
    text status
  }

  BOOKINGS {
    text id PK
    text tenant_id FK
    text customer_id FK
    text staff_id FK
    text service_id FK
    text resource_id
    text booking_date
    text start_time
    text end_time
    text status
  }

  CUSTOMER_POINTS {
    text id PK
    text customer_id FK
    text booking_id
    text type
    int points
    text reason
  }

  CUSTOMER_COUPONS {
    text id PK
    text customer_id FK
    text coupon_code
    text status
  }

  CUSTOMER_TAGS {
    text id PK
    text customer_id FK
    text tag
  }

  CUSTOMER_NOTES {
    text id PK
    text customer_id FK
    text note
    text created_by
  }

  CUSTOMER_FOLLOWUPS {
    text id PK
    text customer_id FK
    text due_at
    text status
    text note
  }
```

## Login Flow

### Admin Login

```mermaid
flowchart TD
  A[LINE Login / Phone OTP / Email / Password] --> B[Resolve Identity]
  B --> C[Find identities.id]
  C --> D[Query admins by identity_id]
  D --> E{How many active tenant roles?}
  E -- 0 --> F[No admin permission]
  E -- 1 --> G[Use that tenant]
  E -- 2+ --> H[Show tenant picker]
  H --> I[User selects tenant]
  G --> J[Create session: identity_id + tenant_id + role]
  I --> J
  J --> K[Enter merchant admin]
```

### Customer Login

```mermaid
flowchart TD
  A[LINE Login / Phone OTP] --> B[Resolve Identity]
  B --> C[Find identities.id]
  C --> D[Current tenant from URL or LIFF context]
  D --> E[Query customers by tenant_id + identity_id]
  E -- Exists --> F[Use customer profile]
  E -- Missing --> G[Create tenant customer]
  F --> H[Create member session: identity_id + tenant_id + customer_id + role member]
  G --> H
  H --> I[Booking / Points / History]
```

## Session Model

Session must contain at minimum:

```json
{
  "identity_id": "idn_...",
  "tenant_id": "tenant_...",
  "role": "owner|manager|staff|viewer|member",
  "expires_at": "2026-07-10T12:00:00Z"
}
```

For customer/member session, add:

```json
{
  "customer_id": "cus_..."
}
```

Do not use a session that only contains tenant.

## Why Identity Must Not Store Customer CRM

Example:

- Tony 在 A 店沒有留下生日。
- Tony 在 B 店填生日與地址。
- Tony 在 C 店是員工，不是客戶。

If Identity stores birthday/address/CRM, then B 店的資料 could leak into A 店 or platform. That violates SaaS privacy boundaries.

Therefore:

- Identity stores login identity only.
- Customer stores tenant-specific member data.
- Admin stores tenant-specific role.
- Staff stores tenant-specific staff profile, optionally linked to identity.