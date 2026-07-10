# Identity Migration Report

日期：2026-07-10
任務：Task 005 Additive Identity Migration
狀態：完成。未切換登入、Session、LIFF、預約、CRM 行為。

## Local Status

- Local migration: complete.
- Local schema audit: pass.
- Local backfill dry run: pass.
- Local backfill apply: pass.
- Local idempotency check: pass, second apply wrote 0 statements.

Local final audit:

| Item | Count / Status |
| --- | --- |
| `identities` | exists, 0 rows |
| `identity_auth` | exists, 0 rows |
| `tenant_admins.identity_id` | exists |
| `customers.identity_id` | exists |
| `customers.customer_no` | exists |
| `platform_line_contacts.identity_id` | exists |
| Forbidden `identity_profiles` | absent |
| Forbidden new `admins` | absent |
| Forbidden `sessions` | absent |

Local test D1 had no seed data, so backfill wrote 0 rows.

## Remote Status

- Remote D1 backup: complete.
- Backup output: `.local-backups/bookingos-db-pre-identity-20260710.sql`.
- Backup directory is ignored by git through `.gitignore`.
- Remote additive schema: complete by direct `wrangler d1 execute --remote --file migrations/0012_additive_identity.sql`.
- Remote backfill: complete for scoped LINE contacts only.
- Remote idempotency check: pass, second apply wrote 0 statements.

Remote final audit:

| Item | Count / Status |
| --- | --- |
| `tenant_admins` | 3 rows |
| `customers` | 2 rows |
| `platform_line_contacts` | 2 rows |
| `identities` | 2 rows |
| `identity_auth` | 2 rows |
| LINE non-empty / unique / duplicate | 2 / 2 / 0 |
| Phone non-empty / unique normalized / duplicate | 5 / 4 / 1 |
| Email non-empty / duplicate | 0 / 0 |
| Ambiguous needs review | 1 |

## Schema Added

Tables:

- `identities`
- `identity_auth`

Columns:

- `tenant_admins.identity_id`
- `customers.identity_id`
- `customers.customer_no`
- `platform_line_contacts.identity_id`

Indexes:

- `idx_identity_auth_identity`
- `idx_identity_auth_provider_uid`
- `idx_identity_auth_phone`
- `idx_identity_auth_email`
- `idx_tenant_admins_identity`
- `idx_customers_identity`
- `idx_platform_line_contacts_identity`

Not created:

- `identity_profiles`
- new `admins`
- `sessions`
- unique `customers(tenant_id, identity_id)`

## Backfill Rule

This migration does not merge identities by phone or email.

Backfill only creates identity rows when there is scoped LINE evidence:

- `platform:<line_user_id>` for `platform_line_contacts`
- `tenant:<tenant_id>:<line_user_id>` for tenant-scoped records

Remote result:

- Planned statements: 6
- Executed statements: 6
- Identities created: 2
- Identity auth rows created: 2
- Platform contact links created: 2
- Customer links created: 0
- Tenant admin links created: 0
- Conflicts: 0

## Regression Tests

Passed:

- `node --check src/index.js`
- `node --check scripts/identity-audit.mjs`
- `node --check scripts/identity-backfill.mjs`
- `git diff --check`
- Local D1 schema audit
- Local D1 backfill dry run/apply/idempotency
- Remote D1 backup
- Remote D1 schema audit
- Remote D1 backfill dry run/apply/idempotency

Not changed:

- Login behavior
- Session behavior
- LIFF behavior
- Booking behavior
- CRM behavior
- Tenant routing behavior
- Worker deployment

## Risks

### P0

Remote D1 migration history is not aligned. `wrangler d1 migrations list --remote` still shows old migrations pending. Do not run full remote `wrangler d1 migrations apply` until history is reconciled.

### P1

Remote audit found 1 duplicated/cross-tenant normalized phone hash. This is intentionally not merged. It must be manually reviewed before PHONE auth backfill or customer unique identity constraints.

### P1

`tenant_admins.identity_id` and `customers.identity_id` remain null because current safe evidence is insufficient. This is expected and keeps login/session behavior unchanged.

## Next Phase Readiness

| Area | Ready? | Note |
| --- | --- | --- |
| Merchant login identity read path | Yes, schema is ready | Must implement tenant picker, no `LIMIT 1`. |
| LIFF login identity read path | Yes, schema is ready | Must define provider scope and session interface first. |
| Customer session migration | Partially | Needs Session Interface before behavior switch. |
| PHONE / EMAIL auth backfill | No | Needs verification source and duplicate review. |
| `customers(tenant_id, identity_id)` unique index | No | Deferred until duplicate audit is clean. |

## Recommended Next Task

Implement Identity Read Path without deleting legacy columns:

1. Resolve login credential through `identity_auth`.
2. Load tenant roles from `tenant_admins.identity_id`.
3. If more than one tenant role exists, show tenant picker.
4. Session resolver returns `identity_id`, `tenant_id`, `role`, and optional `customer_id`.
5. Keep legacy phone/password login fallback during transition.
