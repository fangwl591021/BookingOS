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
## BookingOS V1 Schema Freeze 2026-07-10

- 已採納 Identity 修正版：V1 只有 `identities`、`identity_auth`、`customers.identity_id`、`tenant_admins.identity_id`。
- V1 不建立 `identity_profiles`、新 `admins` table、`sessions` table。
- Session 只凍結 Interface，儲存方式待後續選擇。
- 已新增 `docs/SCHEMA_FREEZE.md` 與 `docs/MIGRATION_CHECKLIST.md`。
- 本輪仍未修改程式、資料庫、migration 或部署。

## Task 005 Additive Identity Migration 2026-07-10

- 已新增 `migrations/0012_additive_identity.sql`，只做 additive schema，不切換登入、Session、LIFF、預約或 CRM 行為。
- 已新增 `identities`、`identity_auth`、`tenant_admins.identity_id`、`customers.identity_id`、`customers.customer_no`、`platform_line_contacts.identity_id` 與必要索引。
- 未建立 `identity_profiles`、新 `admins` table、`sessions` table，也未建立 `customers(tenant_id, identity_id)` unique index。
- 本機 D1 migration、audit、backfill dry run、backfill apply、第二次 idempotency apply 均通過。
- 遠端 D1 已先備份至 `.local-backups/bookingos-db-pre-identity-20260710.sql`，此目錄已加入 `.gitignore`。
- 遠端 D1 已套用 `0012_additive_identity.sql`，並只以 scoped LINE 回填 2 筆 `identities`、2 筆 `identity_auth`、2 筆 `platform_line_contacts.identity_id`。
- 遠端 audit 仍有 1 組 duplicated/cross-tenant phone hash，已保留為人工審查，不做自動合併。
- 注意：遠端 D1 migration history 尚未與 repo 對齊，後續不可直接跑整批 `wrangler d1 migrations apply --remote`，需先 reconcile。

## Task 006 D1 Migration History Reconcile 2026-07-10

- 已完成遠端 D1 schema 與 `d1_migrations` tracking table 盤點。
- 已確認 Wrangler 版本：`4.110.0`。
- 已確認 production D1 `database_id`：`86120cac-4bf0-4a76-8dea-eacd3287cd15`。
- 已在正式操作前備份：`.local-backups/bookingos-db-pre-history-reconcile-20260710.sql`，不提交 Git。
- 採用方案 B：安全補記 Migration History。
- 已補記 `0002_customer_profile_fields.sql` 到 `0012_additive_identity.sql` 共 11 筆到 `d1_migrations`。
- `wrangler d1 migrations list bookingos-db --remote` 已回報 `No migrations to apply`。
- 正式資料筆數不變：tenants 3、bookings 4、customers 2、tenant_admins 3、identities 2、identity_auth 2。
- `/api/health` 正常。
- 已新增 `docs/D1_MIGRATION_BASELINE.md` 與 README D1 migration SOP。
- 本輪未修改登入、Session、LIFF、預約、CRM 或 Identity backfill。

## Task 007 Merchant Login Dual-Read Identity Resolution 2026-07-10

- 已重寫 POST /merchant-login 的店家帳密登入解析，不再用平台好友 CRM platform_line_contacts 作為店家權限來源。
- 店家權限唯一來源為 tenant_admins；密碼仍使用 V1 MERCHANT_ADMIN_PASSWORD。
- 無 tenant 登入時只用 normalized phone/email 比對；多店命中回 TENANT_SELECTION_REQUIRED，不發 cookie。
- 指定 tenant 登入時只查該 tenant；多筆 admin 衝突回 MERCHANT_ACCOUNT_CONFLICT。
- 已移除店家帳密登入的全域 LIMIT 1 自動選店行為。
- 已加入 MERCHANT_IDENTITY_RESOLUTION_ENABLED，只控制 identity create/link，不會恢復舊登入安全風險。
- 本輪未修改 Platform Login、LIFF Login、Customer Login、Booking、CRM、Points 或 Merchant Cookie 格式。
- 已部署 Cloudflare Workers Version ID：f7084943-b95e-41d3-9a0c-a74880dbee57。
- 部署前已確認 remote D1 migrations 無 pending，並備份至 .local-backups/bookingos-db-pre-merchant-identity-login-20260710.sql。
- 線上 smoke test：/api/health 正常；錯誤密碼不發 cookie；指定 tenant 與無 tenant 單店帳密登入皆成功。
- 本輪登入測試建立 1 筆 tenant_admin identity；部署後筆數：tenants 3、bookings 4、customers 2、tenant_admins 3、identities 3、identity_auth 2。

## Task 008 Merchant Signed Session Interface 2026-07-10

- 已將店家帳密登入成功 cookie 改為 HMAC-SHA256 signed session。
- Session payload 包含 identity、tenant、role、iat、exp、version；不建立 sessions table。
- 店家受保護頁面/API 會拒絕 legacy tenant-only cookie，並每次 DB revalidate `identities`、`tenant_admins`、`tenants`。
- Protected route 會以 session tenant 為準；request query/body tenant 不一致會回 `TENANT_SCOPE_MISMATCH`。
- 已新增 `docs/MERCHANT_SESSION_INTERFACE.md` 與環境變數範本。
- 尚未部署：正式環境目前缺少 `MERCHANT_SESSION_SECRET`，部署前必須先設定 Secret 並備份 D1。

## Task 008 Deployment Result 2026-07-10

- 已設定 Cloudflare Secret：`MERCHANT_SESSION_SECRET`。
- 已備份正式 D1：`.local-backups/bookingos-db-pre-merchant-session-20260710.sql`，不提交 Git。
- 已部署 Cloudflare Workers Version ID：`e8bc0de6-3a65-4f4e-8c9c-a1aa3af045b5`。
- Smoke test：無 cookie 401、legacy cookie 401、signed cookie 同店 200、tampered cookie 401、tenant mismatch 403、logout 後 401。

## Task 009 Merchant Tenant Picker 2026-07-10

- Added short-lived HMAC signed merchant tenant selection token.
- Added `POST /merchant-select-tenant` with DB revalidation against identities, tenant_admins and tenants.
- Multi-tenant password login now returns `TENANT_SELECTION_REQUIRED` with `selection_token`; it does not issue the real merchant cookie.
- Login page renders an in-page tenant picker without storing token in URL or Local Storage.
- No migration and no session table were added.
- LIFF Login, Customer Login and Booking flow were not changed.
- Local D1 smoke passed: multi-login token, no pre-selection cookie, select tenant 200, mismatch 403, tampered 401, expired 401, wrong purpose 401, token-as-session 401.

## Task 009 Deployment Result 2026-07-10

- Deployed Cloudflare Workers Version ID: `99804da2-7c0f-432c-83e3-5f36e84dbd3c`.
- Remote D1 backup: `.local-backups/bookingos-db-pre-tenant-picker-20260710.sql`.
- Remote D1 migrations: No migrations to apply.
- `MERCHANT_SESSION_SECRET` exists in Cloudflare Secrets.
- `MERCHANT_TENANT_SELECTION_TTL_SECONDS=300` is deployed as a Worker var.
- Live smoke: `/api/health` 200, merchant login page 200 with tenant picker script, single-tenant login 302 with signed cookie, selected tenant dashboard 200, mismatched tenant redirects with `TENANT_SCOPE_MISMATCH`, bad selection token 401, bad merchant session cookie rejected.

## Task 010 Merchant LIFF Identity Login 2026-07-10

- Merchant LIFF login now posts a LINE ID Token instead of front-end supplied LINE UID.
- Worker verifies LINE token against the configured LINE Login Channel ID before resolving identity.
- Merchant auth resolves through scoped IdentityAuth and tenant_admins.identity_id.
- platform_line_contacts is not used for merchant authorization.
- Single tenant creates a signed merchant session; multiple tenants reuse Task 009 tenant picker.
- No migration and no session table were added.

## Task 010 Deployment Result 2026-07-10

- Deployed Cloudflare Workers Version ID: `d8551d2a-6811-45da-8324-ce5686bde9b4`.
- Remote D1 backup: `.local-backups/bookingos-db-pre-merchant-liff-identity-20260710.sql`.
- Remote D1 migrations: No migrations to apply.
- `MERCHANT_SESSION_SECRET` exists in Cloudflare Secrets.
- Platform LINE Login Channel ID and Login LIFF ID are configured in D1.
- `MERCHANT_LIFF_IDENTITY_LOGIN_ENABLED=true` is deployed as a Worker var.
- Live smoke: `/api/health` 200, `/merchant-login` 200, login page sends `id_token`, missing token rejected, invalid ID Token rejected with `LIFF_TOKEN_INVALID`, password merchant login still creates signed cookie, dashboard 200.
- Real LIFF success-path smoke requires a live LINE ID Token from the configured LIFF app.

## Task 010B Merchant LIFF Live Smoke 2026-07-10

- Live LINE App test passed after correcting the LIFF Endpoint URL to `/merchant-login?tenant=demo-tenant&next=%2Fmerchant`.
- Tonyfang opened the LIFF App and entered `demo-tenant` / Anhe merchant dashboard directly.
- Scoped IdentityAuth `LINE:201***278` was verified and `last_login_at` updated.
- Counts stayed stable: identities 3 -> 3, identity_auth 4 -> 4, tenant_admins 3 -> 3, platform_line_contacts 2 -> 2.
- Regression before acceptance: health 200, public booking page 200, invalid LINE webhook signature 401, platform login 200, merchant password login 200, cookie attributes valid, tampered cookie rejected, logout invalidated session.
- Acceptance status: Merchant LIFF Login Pass.

## Task 011 Customer Identity Session 2026-07-10

- Added Customer LIFF login foundation: `/member-login`, `POST /api/customer/liff-login`, `GET /api/customer/session`, `/customer-logout`.
- Added HMAC-SHA256 signed customer cookie `bookingos_customer_session` with identity_id, tenant_id, customer_id and role=Customer.
- Customer member pages `/member`, `/points`, `/history` now require Customer Session and load data by session customer_id.
- `/api/member`, `/api/customer-history`, `/api/customer-points` use session tenant/customer scope.
- Booking creation keeps guest flow, but valid same-tenant Customer Session now uses session customer_id.
- Logged-in customer cancel uses session customer_id; legacy phone cancel remains as transitional risk.
- Local and remote duplicate audit for `customers(tenant_id, identity_id)` returned no rows; added `0013_customer_identity_unique.sql`.
## Task 011 Deployment Result 2026-07-10

- Deployed Cloudflare Workers Version ID: a607338b-bc53-443f-b1bc-48d1a9955bef.
- Remote D1 backup: .local-backups/bookingos-db-pre-customer-session-20260710.sql.
- CUSTOMER_SESSION_SECRET configured as Cloudflare Secret.
- Remote migration 0013_customer_identity_unique.sql applied; migrations now report no pending.
- Smoke passed: health 200, member protected redirect, member-login page, customer session 401 without cookie, missing/invalid/line_user_id-only LIFF token rejected, public booking page 200, platform login 200, merchant login 200, invalid LINE webhook signature 401.
- Real Customer LIFF success-path live test remains pending because it requires LINE App ID Token from Tony.

## Store Onboarding Foundation 2026-07-12

- Sprint 1 adds the clean Store / Brand / Business onboarding wizard.
- New tenants use onboarding_status = draft until required Store, Brand, contact, address, and seven-day weekly-hours data are valid.
- business_settings.weekly_hours_json is the sole runtime business-hours source; old daily columns are retained as historical schema only and are no longer read or written.
- Availability, booking creation, rescheduling, and booking enablement are blocked until onboarding is completed.
- Local parser tests and the existing 12-check smoke suite pass before remote migration.

## Sprint 2 Operations Foundation 2026-07-12

- Added Service CRUD improvements using existing services and service_durations tables.
- Added Staff CRUD profile fields through migration 0020: avatar_url, phone, and email.
- Added enabled/disabled management, Service search, Staff-Service mapping, and tenant-scoped validation.
- Merchant dashboard now shows Booking Not Ready with missing items until readiness conditions are complete.
- Disabled Services and Staff are excluded from public availability and booking flows.
- Post-deploy smoke passed 12/12.
## Sprint B4 Non-Cancel Booking Status Command Boundary - 2026-07-16

- 分支：`refactor/b4-non-cancel-booking-status-command-boundary`
- 範圍：僅將 `pending -> confirmed`、`confirmed -> checked_in`、`checked_in -> in_service`、`in_service -> completed`、`confirmed -> no_show` 接入 Booking Command Service。
- Legacy 保留：所有取消、取消點數回沖、`checked_in -> completed`、建立預約、改期、改派、Idempotency persistence、LINE/Web Push 實作。
- 通知相容：`pending -> confirmed` 仍透過 legacy `appendBookingEvent()` adapter 先寫入 event，再維持既有 LINE confirmed 與 Web Push confirmed path；通知失敗不影響成功 response。
- Schema / Migration / Remote D1 / Deploy：未執行。

## Sprint B5 Merchant Cancellation Command Boundary - 2026-07-16

- Branch: `refactor/b5-merchant-cancellation-command-boundary`
- Scope: merchant-protected `POST /api/merchant/bookings/:bookingId/status` with payload `status=cancelled`
- Adopted transitions: `pending -> cancelled`, `confirmed -> cancelled`, and `checked_in -> cancelled`
- Legacy retained: customer/guest cancellation, guest phone fallback, booking create, reschedule, reassign, B4 non-cancel transitions, `checked_in -> completed`, idempotency persistence, LINE/Web Push implementation, and deployment.
- Compatibility: cancellation command receives adapters for existing `rollbackBookingCustomerPoints()` and `appendBookingEvent()` to preserve update -> rollback -> event -> notification order.
- Schema / Migration / Remote D1 / Deploy: not performed.

## Sprint B6.1 Cancellation Current-State Tests & Contract Freeze - 2026-07-16

- Branch: `refactor/b6-1-cancellation-current-state-contract`
- Scope: Customer/Guest cancellation current-state tests and documentation only.
- Frozen contracts: Customer Session cancel, Guest `bookingId + phone` fallback, tenant mismatch fallback behavior, repeated cancel behavior, current absence of `expected_updated_at`, current absence of original-status SQL predicate, and current Customer/Guest order `update -> event/notification -> points`.
- Merchant B5 cancellation remains covered as regression: `update -> rollbackBookingCustomerPoints() -> appendBookingEvent()`.
- Product decision recorded: Guest cancellation will become token-only in later B6.x phases; phone fallback remains transitional only.
- Runtime behavior / Schema / Migration / Remote D1 / Deploy: not changed or performed.

- B6.2 blocker: Customer Session tenant mismatch currently falls through to Guest phone fallback when payload phone matches; B6.2 must close this before command-boundary adoption.

## Sprint B6.2 Customer Cancellation Command Boundary - 2026-07-17

- Authenticated Customer Session cancellation now rejects tenant/customer mismatches before Guest fallback.
- Matching Customer Session cancellation uses Booking Command Service with tenant + booking + customer + original-status conditional update.
- Guest phone fallback remains legacy for unauthenticated or invalid-session requests.
- Customer/Guest order remains status update -> appendBookingEvent() -> points; B6.3 will decide point-order unification separately.
- No schema, migration, remote D1 write, secret/binding change, LINE/Web Push implementation change, or deployment.

## Sprint B6.3 Cancellation Point Rollback Consistency Boundary 2026-07-17

- Customer Session cancellation and transitional Guest phone fallback cancellation now share the cancellation order: status update -> rollbackBookingCustomerPoints() -> appendBookingEvent().
- Customer/Guest success response remains `{ ok: true, profile }`.
- Customer Session tenant/customer mismatch still rejects without Guest fallback or side effects.
- Merchant B5 cancellation behavior remains unchanged.
- If point rollback fails after status update, event/notification are not triggered; the existing non-transaction risk is documented for a future transaction/idempotency phase.
- No schema, migration, Remote D1 write, secret/binding change, LINE/Web Push implementation change, or production deployment in this scope.

## Sprint B6.4 Guest Cancellation Token ADR 2026-07-17

- Added a documentation-only ADR and migration proposal for Guest token-only cancellation.
- Decision: new guest bookings should use high-entropy cancellation tokens with hash-only database storage; `bookingId + phone` remains only as transitional fallback for eligible legacy no-token bookings.
- Proposed independent `booking_cancel_tokens` table, indexes, rollout, rollback, observability, and B6.5 minimal implementation scope.
- This does not solve cancellation transactionality, point rollback atomicity, notification persistence, or idempotency.
- No runtime, schema, migration file, Remote D1 write, secret/binding change, LINE/Web Push implementation change, or production deployment in this scope.
## Sprint B6.5 Guest Cancellation Token 2026-07-17

- 新增 `booking_cancel_tokens` schema migration 檔，但尚未套用 remote D1。
- 新增 guest token cancel route：`/store/{slug}/cancel#b={bookingId}&t={token}` 與 `POST /store/{slug}/api/bookings/cancel-token`。
- 新 guest web booking 在 rollout flag 啟用 write/verify/enforce 時建立 hash-only token row；不回傳 token plaintext。
- tokenized booking 在 verify/enforce 時不再允許 phone fallback；legacy no-token booking 保留 phone fallback。
- 本輪未部署、未執行 remote migration、未修改 wrangler/secret/binding，LINE/Web Push 實作未改。
- 仍保留 cancellation 非 transaction 與無 persistent idempotency 的已知風險。
