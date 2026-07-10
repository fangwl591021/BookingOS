# BookingOS

BookingOS 是 Cloudflare Workers + D1 的預約 SaaS 原型。

## D1 Migration

正式 D1：`bookingos-db`

本機套用 migration：

```bash
npx wrangler d1 migrations apply bookingos-db --local
```

正式套用前必須先查 pending 與備份：

```bash
npx wrangler d1 migrations list bookingos-db --remote
npx wrangler d1 export bookingos-db --remote --output .local-backups/<backup-name>.sql
```

確認 pending 只包含新的 migration 後，才可執行：

```bash
npx wrangler d1 migrations apply bookingos-db --remote
```

禁止未檢查 pending 清單就直接套用 remote migration。D1 history baseline 詳見：`docs/D1_MIGRATION_BASELINE.md`。

## Merchant Login Identity Resolution

POST /merchant-login uses tenant_admins as the only merchant permission source. It does not use platform_line_contacts for merchant password login.

Set MERCHANT_ADMIN_PASSWORD as a Cloudflare Secret. MERCHANT_IDENTITY_RESOLUTION_ENABLED=true enables additive identity create/link after exactly one active tenant_admins row is resolved.

No-tenant login matches normalized phone/email only. If the same account can manage multiple tenants, the Worker returns TENANT_SELECTION_REQUIRED and does not issue a merchant cookie.

See docs/MERCHANT_IDENTITY_LOGIN.md for the full transition rules and rollback notes.
