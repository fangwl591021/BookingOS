# CHANGELOG.md

## Unreleased

### Added

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

- 平台帳密、店家預設密碼與 session secret 改為 Cloudflare env/secret。
- `PUBLIC_BASE_URL` 與 `DEFAULT_TENANT_ID` 改為 Worker vars。
- 平台 LINE token/secret 支援 env 覆蓋 D1 設定。
- 店家 LINE token/secret 支援全域與 tenant-scoped env 覆蓋。
- `/platform-line-webhook` 與 `/line-webhook` 新增 LINE signature 驗證。
### Changed

- 本輪未修改業務功能與現有流程。

### Verified

- `node --check src/index.js`
- `git diff --check`
- `GET https://bookingos.fangwl591021.workers.dev/api/health`
- `wrangler deploy --config wrangler.toml --dry-run`
- D1 tenants/bookings/customers 基本查詢

### Not Verified

- 已正式部署至 Cloudflare Workers，Version ID：`ce4b22a4-c3f1-4df5-9b2f-39f0a62c0c61`。
- 本輪未完整測試客戶預約端到端流程。
- `npm run check` 因本機 sandbox ACL 問題未完成，但等價語法檢查已通過。
