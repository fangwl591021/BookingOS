# ARCHITECTURE.md

## 系統範圍

預約服務通目前是單一 Cloudflare Worker 應用。`src/index.js` 同時包含前端 HTML 輸出、API 路由、D1 資料存取、LINE webhook 與平台/店家後台。

## 架構圖文字版

```text
使用者瀏覽器 / LINE LIFF
    ↓
Cloudflare Workers: bookingos.fangwl591021.workers.dev
    ↓
src/index.js 路由
    ├─ 客戶預約頁 /book
    ├─ 會員頁 /member /points /history
    ├─ 店家後台 /merchant /settings /schedule /customers
    ├─ 平台總後台 /platform
    ├─ API /api/*
    ├─ 店家 LINE Webhook /line-webhook
    └─ 平台 LINE Webhook /platform-line-webhook
    ↓
Cloudflare D1 binding: env.DB / bookingos-db
    ↓
LINE Messaging API / LIFF SDK / LINE Profile API
```

## 前端

- 無獨立前端框架。
- Worker 直接回傳 HTML、CSS 與 inline JavaScript。
- 主要頁面：
  - `/book`
  - `/member`
  - `/points`
  - `/history`
  - `/merchant`
  - `/settings`
  - `/customers`
  - `/platform`
  - `/pricing`
  - `/apply`
  - `/trial`

## 後端

- Cloudflare Worker，入口 `src/index.js`。
- `package.json` 腳本：
  - `npm run dev` → `wrangler dev`
  - `npm run deploy` → `wrangler deploy`
  - `npm run check` → `node --check src/index.js`
- API 回應目前多為 `{ ok: true/false }`，尚未完全符合 AIWE `success/data/error` 建議格式。

## Cloudflare 使用方式

- `wrangler.toml`:
  - Worker name: `bookingos`
  - Main: `src/index.js`
  - D1 binding: `DB`
  - D1 database: `bookingos-db`
  - workers.dev enabled
- 目前未使用 Cloudflare Pages 或 Pages Functions。

## 資料儲存

主要資料儲存在 Cloudflare D1。migrations 目前包含：

- `tenants`
- `business_settings`
- `services`
- `service_durations`
- `customers`
- `bookings`
- `point_transactions`
- `referrals`
- `staff_members`
- `resource_types`
- `tenant_admins`
- `tenant_applications`

`src/index.js` 另有 `ensurePlatformSchema()`，會補建平台管理、LINE OA、收款訂單、Webhook 紀錄等資料表。

## 身份驗證

目前有三種登入或授權概念：

- 平台總後台：`/platform-login`，使用程式內硬編碼帳密。
- 店家後台帳密：`/merchant-login`，使用店家 Admin 手機/Email/姓名或綁定 CRM 名稱 + 預設密碼。
- 店家 LINE 綁定登入：`/api/merchant/liff-login`，用 LINE UID 對應 `platform_line_contacts` 或 `tenant_admins`。

已知限制：平台帳密與店家預設密碼仍硬編碼在 `src/index.js`，正式交付前必須移至 Cloudflare Secret 或其他安全設定。

## LINE 串接

### 平台官方帳號

- Webhook: `/platform-line-webhook`
- 設定表：`platform_line_oa_settings`
- 用途：業主加入好友、店家註冊/試用、登入、好友 CRM、分享推薦 QR。
- Messaging API：用於回覆「會員分享」等關鍵字。
- LIFF：`login_liff_id` 用於店家登入；`registration_liff_id` 用於推薦/註冊流程。

### 店家官方帳號

- Webhook: `/line-webhook?tenant=<tenant_id>` 或 `/line-webhook/<tenant_id>`
- 設定表：`line_oa_settings`
- 用途：各店若要使用自己的 LINE OA，可在平台後台填寫 Channel 與 LIFF 欄位。

已知限制：目前 webhook 未實作 LINE 簽章驗證，屬 P0/P1 安全問題。

## 店家與租戶隔離方式

- 主要以 URL query `tenant=<tenant_id>` 決定租戶。
- 資料表大多以 `tenant_id` 欄位隔離。
- `tenantIdFromUrl()` 預設回到 `demo-tenant`。

已知限制：部分舊函式仍直接使用 `TENANT_ID` 常數，例如取消預約與部分會員資料查詢，可能造成非預設店資料混用。

## 預約資料流程

```text
/book 載入店家資料
→ /api/availability 查詢可用時段
→ 前端選服務、日期、時長、人員、時段
→ /api/bookings 寫入 bookings
→ 同步建立或更新 customers
→ 依規則寫入 point_transactions / referrals
→ 店家後台與客戶歷史讀取 D1
```

## 部署流程

```text
npm run check
npx wrangler deploy --config wrangler.toml --dry-run
npx wrangler deploy --config wrangler.toml
```

目前線上網址：

- `https://bookingos.fangwl591021.workers.dev`

## 環境變數與 Secret

目前程式主要使用 Cloudflare binding `env.DB`。LINE Channel 與 token 是從 D1 設定表讀取，不是環境變數。

| 名稱 | 用途 | 必填 | 備註 |
| ---- | ---- | ---- | ---- |
| DB | Cloudflare D1 binding | 是 | 在 `wrangler.toml` 設定，不放 `.env` |

## 已知限制

- `src/index.js` 是大型單檔，維護風險高。
- 平台與店家登入安全仍不足。
- Webhook 簽章未驗證。
- API 格式未統一到 AIWE 建議格式。
- 沒有自動化測試。
- 本機 dev 尚未在本輪成功驗證。
