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
| 客戶預約頁 `/book` | 部分完成 | 已有服務、時段、人員、點數折抵流程，但需完整多租戶 E2E 驗證。 |
| 會員頁 `/member` `/points` `/history` | 部分完成 | 已有會員資料、點數、紀錄概念；需驗證 tenant 隔離與取消回補。 |
| 店家後台 `/merchant` | 部分完成 | 可查看預約、CRM、店家資料；管理動作需補強。 |
| 店家設定 `/settings` | 部分完成 | 可設定店家、服務、人員、資源；試用版方案限制需補強。 |
| 平台總後台 `/platform` | 部分完成 | 已有店家、試用、收款、審核、LINE OA、好友 CRM。 |
| LINE 平台 Webhook | 部分完成 | 可收好友資料與分享推薦；尚未驗證簽章。 |
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
| P0 | 登入密碼與 base URL 硬編碼 | `src/index.js` 仍含平台帳密、店家預設密碼與正式網址。 |
| P0 | LINE Webhook 未驗證簽章 | `/platform-line-webhook` 與 `/line-webhook` 接收事件時未檢查 LINE signature。 |
| P1 | Tenant 隔離不完全 | 部分函式仍使用 `TENANT_ID` 常數，可能讓非預設店資料混用。 |
| P1 | 方案限制未集中控管 | 試用版仍可能新增超額服務人員，需統一在 API 層阻擋。 |
| P1 | 缺少端到端測試 | 預約、取消、點數、推薦與付款狀態需建立最小驗證清單。 |

## 本輪未完成事項

- 未改動任何業務流程。
- 未部署正式版本。
- 未將任何模組搬到 AIWE Dev System。
- `npm run check` 因本機 sandbox ACL 問題未完成，但等價的 `node --check src/index.js` 已成功。
