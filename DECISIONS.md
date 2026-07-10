# DECISIONS.md

## ADR-001: 產品獨立部署

- 日期：2026-07-10
- 決策：預約服務通是獨立系統，不依賴 WordPress 母站執行。
- 背景：AIWE Dev System 定義「產品獨立，規範共用」。
- 選擇原因：預約服務通需要獨立部署、獨立資料與獨立 LINE/Cloudflare 設定。
- 放棄方案：把預約服務通塞入 WordPress 母站或 AIWE Dev System monorepo。
- 影響：部署與資料管理集中在本 Repo + Cloudflare Worker/D1。
- 是否可逆：可逆，但需重新設計部署與資料邊界。

## ADR-002: 不先導入額外後端平台

- 日期：2026-07-10
- 決策：目前不主動加入 Supabase、Firebase、Neon、PlanetScale 等服務。
- 背景：現有程式已使用 Cloudflare Workers + D1。
- 選擇原因：先依現有架構完成可交付版本，避免重做 API 與資料模型。
- 放棄方案：改用新的 BaaS 或外部資料庫。
- 影響：資料表、API 與部署繼續沿用 D1。
- 是否可逆：可逆，但不是第一階段。

## ADR-003: 優先結案

- 日期：2026-07-10
- 決策：優先完成客戶預約、店家後台及必要 LINE 串接，不先擴充非必要功能。
- 背景：目前功能已多，阻塞點主要在核心流程驗證、權限、安全與文件。
- 選擇原因：避免繼續增加點數、優惠券、AI 排班等非必要範圍。
- 放棄方案：先做完整 CRM、金流、自動通知、複雜報表。
- 影響：NEXT_SPRINT 僅列最短可交付工作。
- 是否可逆：可逆，核心完成後可擴充。

## ADR-004: 共用資產延後抽離

- 日期：2026-07-10
- 決策：先在本專案驗證 LINE、API、Cloudflare 經驗，成功後再整理回 AIWE Dev System。
- 背景：目前 LINE 與 Cloudflare 串接仍混合平台與店家兩種用途。
- 選擇原因：過早抽象會增加維護成本，也可能沉澱錯誤模式。
- 放棄方案：本輪直接抽模組到 `aiwe-dev-system`。
- 影響：只在完成報告列可重用候選，不搬移程式。
- 是否可逆：可逆。


## ADR-005: Identity 與 Customer 分離

- 日期：2026-07-10
- 決策：BookingOS V1 將平台身份 Identity 與店家會員 Customer 分離。Identity 只代表「我是誰」，Customer 代表「我在這家店是什麼會員」。
- 背景：SaaS 會遇到同一個人同時管理多家店、在不同店擔任不同角色、或同時是某店客戶與另一店員工的情境。若以 tenant 或 phone/LINE UID 直接當主身份，登入、選店、權限與資料隱私會混在一起。
- 選擇原因：Identity 必須先於 Tenant；登入流程應為 `Identity -> Tenant -> Permission -> Data`。平台不應存放店家 Customer 的 CRM、生日、地址、點數、消費、看診/髮色/美甲備註等資料。
- 放棄方案：使用 `tenant_admins` 或 `customers.line_user_id` 作為主身份；用 LINE UID 當主鍵；登入時用 `LIMIT 1` 自動選店；把姓名、生日、CRM 備註放進平台 Identity。
- 目標模型：新增 `identities`、`identity_credentials`、`admins`、`sessions`；`customers` 保留店家會員資料並新增 `identity_id`；`staff_members.identity_id` 可為 nullable；`bookings`、點數、券、CRM 全部指向 `customer_id`，不指向 `identity_id`。
- 影響：後續登入、Session、權限與多店切換都必須依 Identity Model 設計；現有 `tenant_admins` 暫時保留為過渡表，不立即刪除。
- 是否可逆：概念上不建議逆轉。可分階段 migration，且在未切換登入前保持相容。

## ADR-006: 第一版維持單一 Worker

- 日期：2026-07-10
- 決策：第一版維持 `src/index.js` 單一 Worker，不在本輪切分前後端或導入框架。
- 背景：現有可部署版本已運行於 Cloudflare Workers。
- 選擇原因：減少重構風險，先補安全、驗證與交付文件。
- 放棄方案：拆成前端框架 + API 專案。
- 影響：短期維護需要更嚴格的文件與小步修改。
- 是否可逆：可逆，待核心流程穩定後再拆。
