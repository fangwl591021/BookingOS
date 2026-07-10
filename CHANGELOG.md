# CHANGELOG.md

## Unreleased

### Added

- 新增 `docs/IDENTITY_AUDIT.md`，整理目前登入方式、Session、Identity/Tenant 關係與 V2 模型方向。

- 新增 `docs/TENANT_AUDIT.md`，完整列出 API、Worker、CRUD 與 SQL tenant filter audit。

- 接入 AIWE Dev System 專案文件。
- 新增 `AGENTS.md`，定義本 repo 工作規則。
- 新增 `PROJECT_BRIEF.md`，整理產品定位、主要使用者與核心流程。
- 新增 `ARCHITECTURE.md`，記錄 Cloudflare Worker、D1、LINE、tenant 與部署架構。
- 新增 `DECISIONS.md`，記錄本階段不改框架、不換平台、不抽共用模組等決策。
- 新增 `PROJECT_STATUS.md`，標示已驗證、未驗證與尚未完成項目。
- 新增 `NEXT_SPRINT.md`，列出最短可交付修補路線。
- 新增 `KNOWN_ISSUES.md`，列出目前安全、tenant、方案限制與測試風險。
- 新增 `.env.example`，說明目前 Cloudflare binding 與 LINE 設定存放位置。

### Security

- 新增 AIWE Rule：Identity 優先於 Tenant，登入需先識別 user，再選 tenant，再判斷 permission。

- 新增 AIWE Rule：任何租戶資料表 SQL 沒有 tenant filter，一律列為 P0 資料外洩風險。

- 客戶、會員、取消預約、點數與匯出流程改為依目前 tenant 存取。
- 客戶/預約/點數/介紹人 JOIN 補上 tenant 條件，避免跨店資料串接。
- 平台帳密、店家預設密碼與 session secret 改為 Cloudflare env/secret。
- `PUBLIC_BASE_URL` 與 `DEFAULT_TENANT_ID` 改為 Worker vars。
- 平台 LINE token/secret 支援 env 覆蓋 D1 設定。
- 店家 LINE token/secret 支援全域與 tenant-scoped env 覆蓋。
- `/platform-line-webhook` 與 `/line-webhook` 新增 LINE signature 驗證。
### Changed

- Task 002 已完成第一輪 tenant 隔離修補，業務功能不新增。

### Verified

- `node --check src/index.js`
- `git diff --check`
- `GET https://bookingos.fangwl591021.workers.dev/api/health`
- `wrangler deploy --config wrangler.toml --dry-run`
- D1 tenants/bookings/customers 基本查詢
- 正式網址跨 tenant 客戶資料 smoke test：demo 可讀、兩家 trial 回 `profile:null`
- 已正式部署至 Cloudflare Workers，Version ID：`5ba8a1ad-14ab-45f4-beb2-55f668569550`

### Not Verified

- 本輪未完整測試客戶預約端到端流程。
- `npm run check` 因本機 sandbox ACL 問題未完成，但等價語法檢查已通過。
