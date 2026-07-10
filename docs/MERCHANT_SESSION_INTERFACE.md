# Merchant Signed Session Interface

日期：2026-07-10
狀態：Task 008 已實作程式面，部署需先設定 `MERCHANT_SESSION_SECRET`。

## Scope

本文件定義 BookingOS V1 店家後台的 Signed Session Interface。

本輪變更範圍：

- 店家帳密登入成功後改發 signed merchant cookie。
- 店家受保護頁面與 API 改由 signed session 解析 `identity_id`、`tenant_id`、`role`。
- 每次請求都重新查 DB 驗證 `identities`、`tenant_admins`、`tenants`。
- 不建立 `sessions` table。
- 不修改 Platform Login、Customer Login、Booking business flow。

## Environment

Production 必須設定：

```text
MERCHANT_SESSION_SECRET=<random secret>
MERCHANT_SESSION_TTL_SECONDS=43200
MERCHANT_SIGNED_SESSION_ENABLED=true
MERCHANT_LEGACY_SESSION_COMPAT_ENABLED=true
```

`MERCHANT_SESSION_SECRET` 缺少時，店家帳密登入會回 `SESSION_CONFIG_INVALID`，不會發 cookie。

## Cookie Format

Cookie name：`bookingos_merchant_session`

Value：

```text
base64url(json_payload).base64url(hmac_sha256(payload_segment))
```

Payload：

```json
{
  "v": 1,
  "sub": "identity_id",
  "tenant_id": "tenant id",
  "role": "TenantOwner",
  "iat": 1234567890,
  "exp": 1234611090
}
```

欄位對應：

| Payload | Interface | 說明 |
| --- | --- | --- |
| `sub` | `identity_id` | 平台身份 |
| `tenant_id` | `tenant_id` | 目前登入店家 |
| `role` | `role` | cookie snapshot；實際權限以 DB 為準 |
| `iat` | `issued_at` | 簽發時間 |
| `exp` | `expires_at` | 過期時間 |
| `v` | `session_version` | Session schema version |

Cookie flags：`HttpOnly; Secure; SameSite=Lax; Path=/`。

## Validation Rules

每次店家後台請求都會：

1. 檢查 cookie 是否存在。
2. 拒絕 legacy tenant-only cookie。
3. 驗證 HMAC signature。
4. 驗證 payload schema、version、issued_at、expires_at。
5. 查詢 `tenant_admins + identities + tenants`。
6. 確認 identity active、tenant active/trial、tenant_admin active。
7. 以 DB role 為準；若 cookie role 與 DB role 不一致，要求重新登入。
8. 若 query/body 帶入其他 tenant，回 `TENANT_SCOPE_MISMATCH`。

## Permission Interface

V1 role mapping：

| Role | 權限方向 |
| --- | --- |
| `TenantOwner` | 店家全部管理權限 |
| `TenantManager` | 大多數店家管理權限 |
| `Staff` | 預約與排班相關的限制權限 |

Protected route 會依 API/頁面判斷需要的 permission。Cookie 裡的 role 只做 snapshot，不是權限真相來源。

## Legacy Compatibility

`MERCHANT_LEGACY_SESSION_COMPAT_ENABLED=true` 只代表可以辨識舊 cookie 並要求重新登入。

舊的 tenant-only cookie 不可取得店家後台或 API 權限，也不會自動升級成 signed session。

## LIFF Login Note

Task 008 沒有切換 LIFF Login。既有 LIFF endpoint 仍可能產生 legacy tenant-only cookie；因 protected route 已拒絕 legacy cookie，所以它不能取得店家後台權限。

後續應另開 Task，讓 LIFF Login 也走 Identity Resolution、Tenant Selection 與 signed session 發放。

## Deploy Gate

部署前必須完成：

1. `wrangler d1 migrations list bookingos-db --remote` 顯示無 pending。
2. 正式 D1 已備份。
3. Cloudflare Secret 已設定 `MERCHANT_SESSION_SECRET`。
4. `node --check src/index.js` 通過。
5. `npm run check` 或等價 smoke test 通過。

若缺少 `MERCHANT_SESSION_SECRET`，不可部署，否則店家帳密登入會被安全阻擋。

## Smoke Test Checklist

- 無 cookie 讀 `/api/dashboard` 應回 401。
- legacy `bookingos_merchant_session=demo-tenant` 應回 401 或導回登入。
- 正確帳密登入應取得含 `.` 的 signed cookie。
- 使用 signed cookie 讀同 tenant 後台 API 應成功。
- signed cookie 被竄改後應回 401。
- signed cookie query/body 指到其他 tenant 應回 403 `TENANT_SCOPE_MISMATCH`。
- 登出後 cookie 被清除，後台 API 不可再讀取。

## Task 008 Deployment Result 2026-07-10

- 已設定 Cloudflare Secret：`MERCHANT_SESSION_SECRET`。
- 已備份正式 D1：`.local-backups/bookingos-db-pre-merchant-session-20260710.sql`，不提交 Git。
- 已部署 Cloudflare Workers Version ID：`e8bc0de6-3a65-4f4e-8c9c-a1aa3af045b5`。
- Smoke test：無 cookie 401、legacy cookie 401、signed cookie 同店 200、tampered cookie 401、tenant mismatch 403、logout 後 401。

## Task 009 Tenant Selection Token

Merchant tenant selection token is separate from merchant session. It uses the same secret but a different payload purpose: `merchant_tenant_selection`.

The token contains `sub` and allowed `tenant_ids`, but no role and no `tenant_id` session field. The merchant session validator rejects it if it is used as `bookingos_merchant_session`.
