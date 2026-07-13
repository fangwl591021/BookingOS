# Sprint 3 - Engagement Foundation

Status: implemented on 2026-07-12

## Scope

Tenant-scoped LINE Messaging API settings, encrypted credential storage, token verification, webhook fail-closed routing, webhook event deduplication, Health Check, LINE Login fields, LIFF fields, and minimal booking notification delivery.

## Security

- `LINE_CREDENTIALS_ENCRYPTION_KEY` is a Worker Secret.
- Credentials use AES-256-GCM with a fresh 12-byte IV per value.
- AAD is `tenant_id + credential_type + key_version`.
- API responses expose only configured flags and masked values.
- Existing plaintext columns remain only for transition reads; new writes use ciphertext columns and clear plaintext when a replacement value is entered.
- No secret, token, ciphertext, IV, or Authorization header is written to logs or repository files.

## Routes

- Merchant UI: `/settings`
- Settings API: `/api/line/settings`
- Token verification: `/api/line/verify-token`
- Webhook configuration check: `/api/line/verify-webhook`
- Health Check: `/api/line/health`
- Tenant Webhook: `/line-webhook?tenant={tenant_id}`

Webhook behavior is fail-closed: missing Tenant is 400, unknown Tenant or disabled integration is 404, and missing/invalid signature is 401. There is no demo Tenant fallback.

## Migrations

- `0021_line_engagement_foundation.sql`: LINE status/profile fields, encrypted credential columns, and `line_webhook_events`.
- `0022_line_notification_deliveries.sql`: Tenant-scoped booking notification idempotency.

## Booking notifications

The existing booking event hook supports `created`, `confirmed`, `cancelled`, and `rescheduled`. Delivery loads the booking Tenant's encrypted Access Token only. Missing customer LINE binding is recorded as `skipped`; duplicate delivery keys are not sent again.

## Verification

- `npm run check`
- `npm run test:line-engagement`
- `npm run test:weekly-hours`
- `npm run test:operations`
- `npm run smoke` (12/12)
- Remote D1 migrations: no migrations pending after deployment.

## Operational limitation

The first real Tenant OA message and push notification still require the store owner to enter credentials in `/settings` and configure the displayed Webhook URL in LINE Developers Console. No real LINE credentials are stored in this repository or test fixtures.
