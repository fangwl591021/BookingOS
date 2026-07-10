# KNOWN_ISSUES.md

## Resolved 2026-07-10: 平台與店家登入設定硬編碼

- 狀態：已改為 `PLATFORM_ADMIN_USER`、`PLATFORM_ADMIN_PASSWORD`、`PLATFORM_SESSION_SECRET`、`MERCHANT_ADMIN_PASSWORD`。
- 注意：正式環境必須在 Cloudflare Secrets 設定這些值，缺值時登入會失敗但不會 fallback 到硬編碼密碼。

## Resolved 2026-07-10: LINE Webhook 未驗證簽章

- 狀態：平台與店家 webhook 已驗證 `x-line-signature`。
- 平台 webhook 使用 `PLATFORM_LINE_CHANNEL_SECRET` 或 D1 `platform_line_oa_settings.channel_secret`。
- 店家 webhook 使用 tenant scoped env、`LINE_CHANNEL_SECRET` 或 D1 `line_oa_settings.channel_secret`。
- 缺 secret 回 503，簽章錯誤回 401。

## P1: 多租戶資料隔離仍有舊常數

- 位置：`cancelBooking()`、`loadCustomerProfile()`、部分會員/點數查詢。
- 現象：部分查詢仍綁定 `TENANT_ID`，不是使用目前網址或登入來源的 tenant。
- 風險：非 `demo-tenant` 店家可能讀不到自己的資料，或取消/點數異動落在錯誤 tenant。
- 建議：所有客戶、預約、點數、CRM API 都必須明確傳入 tenant。

## P1: 試用與付費方案限制尚未集中控管

- 現象：試用版應只允許一位師傅，但目前仍可能新增第二位。
- 風險：收費方案無法有效管控，收款訂單與實際功能不一致。
- 建議：將方案限制放在後端 API，前端只做提示；超額時直接拒絕儲存。

## P1: 客戶預約流程缺少完整端到端驗證

- 現象：服務、時段、人員、點數與送出預約已存在，但尚未有固定驗證腳本。
- 風險：後續修改 UI 或排班時容易破壞預約寫入、點數折抵或推薦關係。
- 建議：先建立 3 條最小手動測試：系統安排、指定人員、取消預約。

## P1: 指定人員滿檔規則尚未完成

- 現象：「只等指定人員」與「可接受其他安排」仍停留在產品方向，未形成完整 API 與 UX。
- 風險：客戶可能以為指定成功，但實際被系統安排其他人，或無法等待指定人員。
- 建議：先決定店家設定開關，再實作客戶端確認流程。

## P2: `src/index.js` 單檔過大

- 現象：前端 HTML、CSS、API、資料庫、LINE webhook 都集中在單一檔案。
- 風險：小改動容易影響不相關區塊，語法錯誤也會造成整個 Worker 失效。
- 建議：核心穩定後再拆分路由、資料存取、LINE 工具與頁面模板。

## P2: API 回應格式未統一

- 現象：多數 API 使用 `{ ok: true/false }`，尚未統一為 AIWE 建議的 `{ success, data, error, meta }`。
- 風險：前端錯誤處理與跨專案共用工具較難一致。
- 建議：新 API 先使用標準格式；舊 API 在不破壞前端下逐步調整。
