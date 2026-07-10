# Merchant Identity Login

日期：2026-07-10
狀態：Task 007 已實作。

## Scope

本文件只描述店家帳密登入 POST /merchant-login 的 V1 dual-read identity resolution。

本輪未變更：Platform Login、LIFF Login、Customer Login、Booking、CRM、Points、Merchant Cookie 格式、Session storage。

## Login Sources

店家權限唯一來源是 tenant_admins。platform_line_contacts 只代表平台官方帳號好友與註冊 lead，不可作為店家登入權限來源。

V1 店家密碼仍使用 MERCHANT_ADMIN_PASSWORD。這是 transition fallback，不是 identity_auth 密碼。

## Tenant Resolution

### Explicit Tenant

當登入表單帶 tenant：先驗證密碼，只查該 tenant 的 active tenant_admins；0 筆失敗，1 筆進入該店，多筆回 MERCHANT_ACCOUNT_CONFLICT 且不發 cookie。

### No Tenant

當登入表單沒有 tenant：先驗證密碼，只用 normalized phone/email 對 active tenant_admins 比對；不使用 name 做全域搜尋。0 筆失敗，1 家店進入，多家店回 TENANT_SELECTION_REQUIRED JSON 且不發 cookie。

## Identity Resolution

Feature flag：MERCHANT_IDENTITY_RESOLUTION_ENABLED=true。

登入找到唯一 tenant_admins 後才解析 identity。若 tenant_admins.identity_id 已有值，必須存在於 identities 且 status active；若為 null，建立一個 scoped identity 給該 admin。

不得用 phone/email 自動合併 identity。Feature flag 關閉時，只跳過 create/link identity，不恢復舊的全域 LIMIT 1 或 CRM auth。

## Cookie Compatibility

本輪不更改店家 cookie 格式。

## Logs

店家登入 log scope：merchant_login。敏感值只允許 hash 或非 PII id，不可記錄 password、raw phone、raw email、raw account、cookie。

## Expected Responses

| Case | Response | Cookie |
| --- | --- | --- |
| Wrong password | Redirect error | No |
| No admin match | Redirect error | No |
| Duplicate admin inside one tenant | 409 MERCHANT_ACCOUNT_CONFLICT | No |
| Same account manages multiple tenants | 409 TENANT_SELECTION_REQUIRED | No |
| Single tenant admin | Redirect merchant page | Yes |
| Broken identity reference | Error JSON | No |

## Rollback

1. Disable identity create/link with MERCHANT_IDENTITY_RESOLUTION_ENABLED=false only if identity creation is the problem.
2. If tenant selection or login routing is broken, rollback Worker version.
3. Do not remove identity tables or additive columns during incident response.

## Task 008 Session Update

POST /merchant-login 在唯一 active tenant_admin 與 identity 解析成功後，改發 signed merchant session cookie。

Cookie 內 role 只是 snapshot；後台 request 仍以 `tenant_admins` 目前 role/status 重新驗證。若 role 被改動，既有 cookie 會失效並要求重新登入。

舊 tenant-only cookie 已不能通過 protected route。LIFF Login 尚未切換，需另開 Task。
