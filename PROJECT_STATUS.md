# PROJECT_STATUS.md

最後更新：2026-07-10

## 專案階段

原型可部署，進入交付前整理與安全修補階段。

線上健康檢查目前回報：

- service: `BookingOS`
- version: `0.2.2-resource-capacity`
- database: `true`

## 已完成並於本輪驗證

| 項目 | 狀態 | 驗證方式 |
| ---- | ---- | ---- |
| Worker 語法檢查 | 已通過 | `node --check src/index.js` |
| Git whitespace 檢查 | 已通過 | `git diff --check` |
| Cloudflare Worker dry-run | 已通過 | `wrangler deploy --dry-run` |
| 線上健康檢查 | 已通過 | `GET /api/health` |
| D1 連線 | 已通過 | 查詢 tenants/bookings/customers 筆數 |

## 已存在但本輪未完整端到端驗證

| 功能 | 狀態 | 備註 |
| ---- | ---- | ---- |
| 客戶預約頁 `/book` | 部分完成 | 已有服務、時段、人員、點數折抵流程；客戶資料讀取已做 tenant 隔離，仍需完整 E2E 驗證。 |
| 會員頁 `/member` `/points` `/history` | 部分完成 | 已有會員資料、點數、紀錄概念；需驗證 tenant 隔離與取消回補。 |
| 店家後台 `/merchant` | 部分完成 | 可查看預約、CRM、店家資料；管理動作需補強。 |
| 店家設定 `/settings` | 部分完成 | 可設定店家、服務、人員、資源；試用版方案限制需補強。 |
| 平台總後台 `/platform` | 部分完成 | 已有店家、試用、收款、審核、LINE OA、好友 CRM。 |
| LINE 平台 Webhook | 部分完成 | 已接上簽章驗證；仍需用 LINE 控制台 Verify 與實際訊息端到端確認。 |
| 店家 LINE OA | 雛形 | 有設定欄位與 webhook 入口；尚未完整驗證各店獨立帳號流程。 |

## 尚未完成

- 真正可操作的人員排班週表。
- 指定服務人員「只等指定人員」的完整客戶端 UX。
- 指定人員滿檔時「可接受其他安排」的確認流程。
- 店家端完整預約管理：改期、取消、完成、現場預約與薪資/記帳聯動。
- 金流自動化。
- 自動通知與提醒。
- 自動化測試。

## 目前最大風險

| 等級 | 風險 | 說明 |
| ---- | ---- | ---- |
| Done | Task 001 安全部署 | Cloudflare Secrets 已設定，Worker 已正式部署。 |
| Done | Task 002 Tenant 客戶流程隔離 | 客戶、會員、取消預約、點數與匯出已改用目前 tenant，並已用正式網址跨店驗證。 |
| P1 | 方案限制未集中控管 | 試用版仍可能新增超額服務人員，需統一在 API 層阻擋。 |
| P1 | 缺少端到端測試 | 預約、取消、點數、推薦與付款狀態需建立最小驗證清單。 |

## 本輪未完成事項

- Task 001 程式面已完成：Base URL、平台帳密、店家密碼、LINE token/secret 均改為 env/secret 或 D1 設定來源。
- Webhook Signature 驗證已完成，未通過會回 401。
- 未改動任何預約業務流程。
- 已正式部署至 Cloudflare Workers，Version ID：`ce4b22a4-c3f1-4df5-9b2f-39f0a62c0c61`。
- 未將任何模組搬到 AIWE Dev System。
- `npm run check` 因本機 sandbox ACL 問題未完成，但等價的 `node --check src/index.js` 已成功。
## Task 002 Tenant 隔離驗證

- 已修正 `/api/customer-profile`、`/api/member`、`/api/bookings/cancel` 使用目前網址 tenant。
- 已修正會員更新、新增預約、取消預約、點數扣回/退回、客戶匯出使用目前 tenant。
- 已修正客戶、預約、點數與介紹人 JOIN 條件，避免只靠 id 串到其他 tenant。
- 正式網址 smoke test：`demo-tenant` 查 `0927136847` 可回會員與 31 點；`trial-mrd14uce`、`trial-mrdj8djy` 同手機皆回 `profile:null`。
- 已部署 Cloudflare Workers Version ID：`5ba8a1ad-14ab-45f4-beb2-55f668569550`。

## Tenant Audit 2026-07-10

- 已完成唯讀掃描並產生 `docs/TENANT_AUDIT.md`。
- `SELECT ... FROM bookings` 未發現缺少 tenant filter 的查詢。
- 已列出登入反查 tenant 的 P0 / REVIEW 風險：`tenant_admins` 全域反查可能在多店同帳號時登入錯店。
- 本輪尚未修補，下一步應先處理店家帳密登入與 LIFF 登入的多 tenant 選店規則，再建立 tenant smoke test。

## Identity Audit 2026-07-10

- 已完成唯讀掃描並產生 `docs/IDENTITY_AUDIT.md`。
- 目前沒有獨立 `users`、`tenant_users`、`roles`、`sessions` 表。
- 目前平台 session 只代表平台 secret 命中；店家 session 只存 tenant，不存 `user_id` 與 `role`。
- 目前一人多店在 schema 上部分可發生，但登入流程會以 requested tenant 或 `LIMIT 1` 自動選店。
- 本輪尚未修補；下一步需先確認 V2 Identity Model，再改登入、session、permission。
## BookingOS V1 Identity Model 2026-07-10

- 已產生 `docs/IDENTITY_MODEL_V1.md`：完整 ER Diagram 與登入流程。
- 已產生 `docs/IDENTITY_MIGRATION_PLAN.md`：目前 schema 對照、需新增/修改/廢棄項目、立即與延後 migration。
- 已新增 ADR-005《Identity 與 Customer 分離》，原 ADR-005 單一 Worker 順延為 ADR-006。
- 本輪尚未修改程式或資料庫；migration 需在模型確認後分階段執行。
