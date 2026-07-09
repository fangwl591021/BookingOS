# NEXT_SPRINT.md

## 目標

用最短路線把預約服務通從「可展示原型」整理成「可交付給店家試用」版本。

## Task 001: 安全設定收斂

- 優先級：P0
- 目標：移除 `src/index.js` 內硬編碼平台帳密、店家預設密碼與正式 base URL。
- 交付：
  - 改用 Cloudflare Secrets 或明確的 D1 設定表。
  - `.env.example` 更新設定說明。
  - 平台與店家登入仍可正常使用。
- 驗收：
  - Repo 中不再出現真實密碼。
  - 未設定必要 secret 時，後台顯示可理解錯誤。

## Task 002: LINE Webhook 簽章驗證

- 優先級：P0
- 目標：平台與店家 webhook 均驗證 `x-line-signature`。
- 交付：
  - `/platform-line-webhook` 使用平台 Channel Secret 驗證。
  - `/line-webhook` 使用對應 tenant 的 Channel Secret 驗證。
  - webhook 驗證失敗回傳 401。
- 驗收：
  - LINE Verify 成功。
  - 非 LINE 請求不會寫入 CRM 或 webhook log。

## Task 003: Tenant 隔離修補

- 優先級：P1
- 目標：取消預約、會員歷史、點數、CRM 查詢全部以 URL 或登入 tenant 為準。
- 交付：
  - 移除核心流程中不該使用的 `TENANT_ID` 常數。
  - 補最小查詢檢查清單。
- 驗收：
  - 不同 tenant 的預約、會員、點數不互相出現。

## Task 004: 方案限制集中控管

- 優先級：P1
- 目標：試用版與付費方案的人員數量限制在 API 層統一阻擋。
- 交付：
  - 新增/複製服務人員前先檢查方案上限。
  - 超額時顯示升級或購買提示。
  - 不只在前端警示，也要後端拒絕寫入。
- 驗收：
  - 試用版無法新增第二位師傅。
  - 正式方案依方案人數正確放行。

## Task 005: 核心預約端到端驗證

- 優先級：P1
- 目標：完成客戶預約、取消、點數、推薦與店家後台顯示的最小測試線。
- 交付：
  - 手動測試腳本或最小自動化測試。
  - `KNOWN_ISSUES.md` 同步更新剩餘問題。
  - `PROJECT_STATUS.md` 移除已解決風險。
- 驗收：
  - 可完成一筆指定人員預約。
  - 可完成一筆系統安排預約。
  - 取消會回補或扣回正確點數。
