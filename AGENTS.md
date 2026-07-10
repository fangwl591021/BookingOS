# AGENTS.md

本文件是 Codex 在「預約服務通 / BookingOS」Repository 工作前必須遵守的專案規則。本專案接入 AIWE Dev System，基準來源為 `fangwl591021/aiwe-dev-system` commit `79b351f7ba46317919236e2ff3d2edc78c45dc53`。

## 開始工作前必讀

每次任務開始前，必須先閱讀：

- `README.md`
- `AGENTS.md`
- `PROJECT_BRIEF.md`
- `PROJECT_STATUS.md`
- `ARCHITECTURE.md`
- `DECISIONS.md`
- `NEXT_SPRINT.md`
- `KNOWN_ISSUES.md`
- 相關程式檔案與 `wrangler.toml`

若文件與 Tony 最新指示衝突，以 Tony 最新確認為準，並更新文件。

## 專案規則

- 本專案是獨立預約 SaaS，不依賴 WordPress 母站執行。
- 目前以 GitHub 與 Cloudflare Workers + D1 為主要開發、部署環境。
- 不得自行加入 Supabase、Firebase、Neon、PlanetScale 或其他後端平台。
- 不得自行更換框架或把專案搬成新的前端框架。
- 不得建立第二套相同 API；新增功能前必須先搜尋 `src/index.js` 與 migrations。
- 優先完成可交付版本，不做大規模重構。
- 涉及 LINE OA 時，必須先確認目前 Channel、Webhook、Login、Messaging API 的實際用途。
- 不得將真實 Token、Secret、Channel Secret、Access Token 或密碼寫入 Git。
- 每次任務完成後必須更新 `PROJECT_STATUS.md` 與 `CHANGELOG.md`。
- AIWE Rule：任何租戶資料表 SQL 若沒有 tenant filter，全部視為 P0 資料外洩風險；不得降級為 P1。新增或修改 API/SQL/CRUD 前必須先確認 tenant_id。

## AIWE 共用規範摘要

- 產品獨立，規範共用，知識沉澱，模組可移植。
- 先盤點現有功能與檔案，不重複建立已存在功能。
- 小步修改，明確記錄修改範圍與驗證方式。
- 不得宣稱測試成功，除非實際執行。
- Webhook 應驗證簽章；Secret 應放在環境變數或平台 Secret。

## 可重用候選標記

若發現可回收至 AIWE Dev System 的模組，只能先標記：

- Candidate for reuse
- 建議模組名稱
- 相依套件
- 環境變數
- 適用範圍
- 尚未抽離原因

未經至少一個真實專案驗證前，不得宣稱為正式共用模組。
