## 2026-07-11 - Task 016B First Batch Onboarding Smoke

### Added

- Added `docs/FIRST_BATCH_ONBOARDING_SMOKE.md` with production first-batch store URL verification, onboarding checklist, and next actions.

### Verified

- `/store/anhe`, `/store/sunny-hair`, `/store/mile-massage`, and `/store/wang-master` all resolve with the correct tenant and no demo fallback.
- 米樂按摩 and 王師傅整人大師 correctly show setup incomplete because service items are not configured yet.
- `npm run smoke` passed 12/12.
- Remote D1 reports no migrations to apply.
## 2026-07-11 - Task 016 Supplement Staff Selection Onboarding

### Changed

- Merchant onboarding now treats required staff plan selection as incomplete and blocks go-live completion.
- Added setup checklist item `方案人員接單狀態已確認`.
- Onboarding test bookings and formal booking enablement are blocked while staff selection is required.
- Onboarding test bookings now only use staff with `plan_booking_status = active`.
- Merchant and platform pages show plan-limited staff as a valid retained state, not as data corruption.
- Platform tenant checks now expose over-limit status, pending staff selection, plan-limited staff count, and affected future booking count.

### Safety

- Existing `plan_limited` staff are not automatically changed back to active.
- Existing bookings remain retained for manual handling.
## 2026-07-11 - Task 015D Staff Plan Selection

### Added

- Added `staff_members.plan_booking_status` through migration `0016_staff_plan_booking_status.sql`.
- Added merchant API `POST /api/merchant/staff/plan-selection` for explicit post-downgrade staff selection.

### Changed

- Plan downgrade no longer uses `sort_order` or name to decide which staff can accept new bookings.
- Public availability, booking creation, and system assignment now only use staff marked `active` for plan booking status.
- When staff selection is required, new booking APIs return 409 `STAFF_PLAN_SELECTION_REQUIRED` until the merchant selects eligible staff.

### Safety

- Existing staff, customers, bookings, payroll context, and future bookings are not deleted, disabled, cancelled, or reassigned automatically.
- Future bookings assigned to `plan_limited` staff are reported with masked customer phone numbers for manual handling.
## 2026-07-10 - Task 006 D1 Migration History Reconcile

### Added

- 新增 `docs/D1_MIGRATION_BASELINE.md`，記錄 production D1 migration history baseline、schema 對照、操作紀錄、回復方式與未來 migration SOP。
- README 新增 D1 migration 基本流程與禁止事項。

### Changed

- 遠端 D1 `d1_migrations` 已安全補記 `0002` 到 `0012`，避免 Wrangler 將已存在 schema 誤判為 pending。
- 更新 `PROJECT_STATUS.md`、`KNOWN_ISSUES.md`、`docs/MIGRATION_CHECKLIST.md` 與 `docs/SCHEMA_FREEZE.md`。

### Verified

- `wrangler d1 migrations list bookingos-db --remote` 回報 no migrations to apply。
- `wrangler d1 migrations apply bookingos-db --local` 回報 no migrations to apply。
- 正式資料筆數不變：tenants 3、bookings 4、customers 2、tenant_admins 3、identities 2、identity_auth 2。
- `GET https://bookingos.fangwl591021.workers.dev/api/health` 正常。

### Not Changed

- 未修改登入、Session、LIFF、預約、CRM 或 Identity backfill。
## 2026-07-10 - Task 005 Additive Identity Migration

### Added

- 新增 `migrations/0012_additive_identity.sql`，建立 `identities`、`identity_auth` 與 nullable identity link columns。
- 新增 `scripts/identity-audit.mjs`，提供本機/遠端 D1 identity schema 與資料風險 audit。
- 新增 `scripts/identity-backfill.mjs`，提供可重跑的 scoped LINE identity backfill。
- 新增 `docs/IDENTITY_MIGRATION_REPORT.md`，記錄本機與遠端 migration/backfill 結果。

### Changed

- 更新 `docs/MIGRATION_CHECKLIST.md` 與 `docs/IDENTITY_MIGRATION_PLAN.md`，標示 Task 005 已完成 additive schema，PHONE/EMAIL 與 customer unique identity constraint 延後。
- `.gitignore` 新增 `.local-backups/`，避免 D1 備份資料進入版本控制。

### Verified

- `node --check src/index.js`
- `node --check scripts/identity-audit.mjs`
- `node --check scripts/identity-backfill.mjs`
- `git diff --check`
- Local D1 migration, audit, backfill dry run, backfill apply, idempotency apply
- Remote D1 backup, schema apply, audit, backfill dry run, backfill apply, idempotency apply

### Not Changed

- 未修改登入、Session、LIFF、預約、CRM 或部署流程。

## 2026-07-10 - Identity Schema Freeze

- 更新 `docs/IDENTITY_MODEL_V1.md`：採納 V1 Freeze，移除 `identity_profiles`、新 `admins` 表與 `sessions` 表。
- 更新 `docs/IDENTITY_MIGRATION_PLAN.md`：改為新增 `identity_auth`、`customers.identity_id`、`tenant_admins.identity_id`，Session 僅凍結 Interface。
- 新增 `docs/SCHEMA_FREEZE.md` 與 `docs/MIGRATION_CHECKLIST.md`，作為真正 migration 前的 gate。
- 更新 ADR-005：BookingOS Architecture Rule，Identity 永遠不存商業資料，商業資料全部屬於 Customer。

# CHANGELOG.md

## Unreleased

### Added

- 新增 `docs/IDENTITY_MODEL_V1.md`，定義 Identity、Customer、Admin、Staff、Session 與 ER 圖。
- 新增 `docs/IDENTITY_MIGRATION_PLAN.md`，列出 schema 差距、立即/延後 migration 與過渡規則。

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

- 新增 ADR-005《Identity 與 Customer 分離》，平台 Identity 不存 Customer CRM/點數/消費/備註。

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

## 2026-07-10 - Task 007 Merchant Login Dual-Read Identity Resolution

### Security

- 店家帳密登入改為只依 tenant_admins 判斷店家權限，不再使用 platform_line_contacts 作為登入來源。
- 無 tenant 登入時移除全域 LIMIT 1 自動選店；多店命中會要求選店且不發 cookie。
- 密碼先驗證再做 tenant/admin matching，降低帳號枚舉風險。
- identity create/link 僅在找到唯一 active tenant_admins 後執行，且不使用 phone/email 自動合併。

### Added

- 新增 MERCHANT_IDENTITY_RESOLUTION_ENABLED feature flag。
- 新增 docs/MERCHANT_IDENTITY_LOGIN.md。

### Not Changed

- 未修改 Platform Login、LIFF Login、Customer Login、Booking、CRM、Points、Merchant Cookie 格式或 Session storage。

## 2026-07-10 - Task 008 Merchant Signed Session Interface

### Security

- 店家帳密登入改發 HMAC-SHA256 signed merchant cookie。
- Merchant Session payload 納入 identity、tenant、role、iat、exp 與 version。
- 店家 protected routes 改為每次 DB revalidate `identities`、`tenant_admins`、`tenants`。
- Legacy tenant-only cookie 不再授權後台，僅要求重新登入。
- Request tenant 與 session tenant 不一致時回 `TENANT_SCOPE_MISMATCH`。

### Added

- 新增 `docs/MERCHANT_SESSION_INTERFACE.md`。
- `.env.example` 新增 merchant signed session env。

### Not Deployed

- 尚未部署；production 需先設定 `MERCHANT_SESSION_SECRET` 並完成 D1 backup。

### Deployed

- Task 008 已部署至 Cloudflare Workers Version ID：`e8bc0de6-3a65-4f4e-8c9c-a1aa3af045b5`。
- 已設定 `MERCHANT_SESSION_SECRET`，正式 D1 已先備份。
- Live smoke test 通過：no cookie 401、legacy 401、signed 200、tampered 401、mismatch 403、logout 401。

## 2026-07-10 - Task 009 Merchant Tenant Picker

### Added

- Added short-lived signed tenant selection token for multi-tenant merchant login.
- Added `POST /merchant-select-tenant`.
- Added in-page tenant picker UI on merchant login page.
- Added `docs/MERCHANT_TENANT_PICKER.md`.

### Security

- Multi-tenant password login no longer issues a merchant session before tenant selection.
- Tenant selection revalidates identity, tenant_admin and tenant state in DB.
- Selection token is purpose-scoped and cannot be used as a merchant session.

### Verified

- Local D1 multi-tenant smoke test passed.
- Token tamper, expiry, wrong purpose, non-allowed tenant and token-as-session cases were rejected.

### Not Changed

- No migration, no session table, no LIFF Login change, no Customer Login change.

### Deployed

- Task 009 deployed to Cloudflare Workers Version ID: `99804da2-7c0f-432c-83e3-5f36e84dbd3c`.
- Remote D1 backup created at `.local-backups/bookingos-db-pre-tenant-picker-20260710.sql`.
- Remote migrations confirmed: No migrations to apply.
- Live smoke passed for health, login page, single-tenant signed cookie, selected tenant dashboard, tenant mismatch rejection, invalid selection token, and invalid merchant session cookie.

## 2026-07-10 - Task 010 Merchant LIFF Identity Login

### Security

- Merchant LIFF login now verifies LINE token before resolving merchant access.
- Removed trust in front-end supplied LINE UID for merchant LIFF login.
- Merchant LIFF access now resolves through scoped IdentityAuth and tenant_admins.identity_id.
- platform_line_contacts is not used for merchant authorization.

### Added

- Added docs/MERCHANT_LIFF_IDENTITY_LOGIN.md.
- Added MERCHANT_LIFF_IDENTITY_LOGIN_ENABLED feature flag.

### Not Changed

- No migration, no session table, no Customer Login change, no Platform Login change.

### Deployed

- Task 010 deployed to Cloudflare Workers Version ID: `d8551d2a-6811-45da-8324-ce5686bde9b4`.
- Remote D1 backup created at `.local-backups/bookingos-db-pre-merchant-liff-identity-20260710.sql`.
- Remote migrations confirmed: No migrations to apply.
- Live smoke passed for health, login page ID Token wiring, missing token rejection, invalid ID Token rejection, password merchant login regression, and merchant dashboard access.

## 2026-07-10 - Task 010B Merchant LIFF Live Smoke

### Verified

- Verified real LINE App LIFF login for merchant admin after LIFF Endpoint URL correction.
- Confirmed LINE verify -> scoped IdentityAuth -> tenant_admins.identity_id -> signed merchant session -> merchant dashboard.
- Confirmed no duplicate Identity or IdentityAuth rows were created during live login.

### Operational Note

- LIFF Endpoint URL must point to `/merchant-login?tenant=demo-tenant&next=%2Fmerchant`; `/platform-line-webhook` is only for LINE OA Callback URL.

## 2026-07-10 - Task 011 Customer Identity Session

### Added

- Added Customer LIFF identity login and signed Customer Session foundation.
- Added `/member-login`, `/api/customer/liff-login`, `/api/customer/session`, `/api/customer-history`, `/api/customer-points`, and `/customer-logout`.
- Added `docs/CUSTOMER_IDENTITY_SESSION.md`.
- Added `migrations/0013_customer_identity_unique.sql` partial unique index for `customers(tenant_id, identity_id)`.

### Security

- Customer session payload contains identity_id, tenant_id, customer_id, role, iat and exp only.
- Member profile, points and history now use Customer Session customer_id instead of phone for formal logged-in reads.
- Booking cancellation for logged-in customers checks session customer_id and tenant_id.

### Compatibility

- Public guest booking remains available.
- Legacy booking cancel by bookingId + phone remains temporarily for guests.
### Deployed

- Task 011 deployed to Cloudflare Workers Version ID: a607338b-bc53-443f-b1bc-48d1a9955bef.
- Remote D1 backup created at .local-backups/bookingos-db-pre-customer-session-20260710.sql.
- Remote migration 0013_customer_identity_unique.sql applied.
- Customer session secret configured in Cloudflare Secrets.
- Live success-path Customer LIFF test remains pending; token rejection and regression smoke passed.
