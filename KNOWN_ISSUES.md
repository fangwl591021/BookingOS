# KNOWN_ISSUES.md

## Resolved 2026-07-10: 平台與店家登入設定硬編碼

- 狀態：已改為 `PLATFORM_ADMIN_USER`、`PLATFORM_ADMIN_PASSWORD`、`PLATFORM_SESSION_SECRET`、`MERCHANT_ADMIN_PASSWORD`。
- 注意：正式環境必須在 Cloudflare Secrets 設定這些值，缺值時登入會失敗但不會 fallback 到硬編碼密碼。

## Resolved 2026-07-10: LINE Webhook 未驗證簽章

- 狀態：平台與店家 webhook 已驗證 `x-line-signature`。
- 平台 webhook 使用 `PLATFORM_LINE_CHANNEL_SECRET` 或 D1 `platform_line_oa_settings.channel_secret`。
- 店家 webhook 使用 tenant scoped env、`LINE_CHANNEL_SECRET` 或 D1 `line_oa_settings.channel_secret`。
- 缺 secret 回 503，簽章錯誤回 401。

## Resolved 2026-07-10: 多租戶客戶流程隔離舊常數

- 狀態：`/api/customer-profile`、`/api/member`、`/api/bookings/cancel`、預約建立、客戶匯出已改為使用目前 tenant。
- 客戶、預約、點數與介紹人 JOIN 皆加入 tenant 條件。
- 已用正式網址驗證：`demo-tenant` 可讀 `0927136847`，`trial-mrd14uce` 與 `trial-mrdj8djy` 同手機回 `profile:null`。
- 注意：後續新增 API 時仍必須明確傳入 tenant，不可直接使用全域預設 tenant。

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

## Resolved 2026-07-10: 遠端 D1 migration history 尚未與 repo 對齊

- 狀態：已採用安全補記 Migration History 方案，將 `0002` 到 `0012` 寫入 `d1_migrations`。
- 驗證：`wrangler d1 migrations list bookingos-db --remote` 已回報 `No migrations to apply`。
- 注意：未來仍禁止未檢查 pending 清單就直接執行 remote apply；詳見 `docs/D1_MIGRATION_BASELINE.md`。

## P1: PHONE / EMAIL identity backfill 尚不可自動執行

- 現象：遠端 audit 發現 1 組 duplicated/cross-tenant normalized phone hash。
- 風險：若用 phone 自動合併 identity，可能把不同店家的不同 Customer 或 Admin 誤合併。
- 現況：Task 005 僅使用 scoped LINE 回填，PHONE/EMAIL 只做 audit，不建立 auth。
- 建議：建立 verified phone/email 來源後，再分批建立 PHONE/EMAIL auth。

## Resolved 2026-07-10: 店家帳密登入全域 LIMIT 1 與 CRM 權限混用

- 狀態：POST /merchant-login 已改為只以 tenant_admins 作為店家權限來源。
- 無 tenant 登入只用 normalized phone/email；多店命中會回 TENANT_SELECTION_REQUIRED，不再自動選第一家。
- 指定 tenant 登入只查該 tenant；同店多筆重複 admin 會回 MERCHANT_ACCOUNT_CONFLICT。
- platform_line_contacts 不再作為店家帳密登入來源。
- 注意：LIFF Login 尚未納入 Task 007，後續需另開 Task 處理多店選店。

## P0 Gate: Production MERCHANT_SESSION_SECRET must be set before Task 008 deploy

- 現象：Task 008 signed merchant session 需要 `MERCHANT_SESSION_SECRET`。
- 目前策略：缺 secret 時 `/merchant-login` 回 `SESSION_CONFIG_INVALID`，不發 cookie，不 fallback 到舊 tenant-only session。
- 部署要求：正式部署前必須先設定 Cloudflare Secret，並確認 D1 migration list 無 pending 與完成 D1 備份。

## P1: LIFF Merchant Login still needs signed session migration

- 現象：Task 008 未修改 LIFF Login；既有 LIFF endpoint 仍可能產生 legacy tenant-only cookie。
- 風險：使用者從 LIFF 入口會被 protected route 要求重新登入，不能直接進後台。
- 安全狀態：legacy tenant-only cookie 已不能取得後台 API 權限，不會自動升級。
- 建議：另開 Task 將 LIFF Login 接到 Identity Resolution、Tenant Selection 與 signed session。

## P1: Tenant Picker token is not one-time-use in V1

- Status: Task 009 uses short TTL, signed purpose-scoped token and DB revalidation.
- Limitation: No server-side nonce store was added, so a valid selection token can theoretically be reused within the TTL.
- Risk reduction: Token cannot become a merchant session, does not contain PII, expires quickly, and every selection revalidates DB permission.
