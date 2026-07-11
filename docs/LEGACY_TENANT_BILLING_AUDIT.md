# Legacy Tenant Billing Audit

Generated: 2026-07-11T04:05:08.008Z
Timezone rule: Asia/Taipei
Baseline commit: 4c4260bca53bbf6be910ebe3530010be107e23ea
D1 database: bookingos-db remote
Current trial rule: 60 days
Grace period rule: 7 days
Tenant filter: all
Backup path: .local-backups/legacy-tenant-billing-audit-20260711-120436.sql

## Summary

| Metric | Count |
| --- | ---: |
| Tenants scanned | 4 |
| No change required | 0 |
| Safe auto-fix tenants | 0 |
| Manual review tenants | 4 |
| Blocking error tenants | 0 |
| Planned safe field fixes | 0 |
| Applied field fixes | 1 |

## Anomaly Counts

| Code | Count |
| --- | ---: |
| ACTIVE_MISSING_END | 1 |
| ACTIVE_MISSING_START | 1 |
| ACTIVE_NO_PAID_ORDER | 1 |
| MISSING_SLUG | 2 |
| TRIAL_LENGTH_MISMATCH | 1 |

## Tenant Audit Results

| Tenant | Slug | Status | Access | Plan | Staff | Contract | Billing | Orders | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| demo-tenant<br>安和整復調理 | anhe | active | active | small | 1/2 | - - - | annual<br>NT$5000 | paid 0<br>pending 0 | MANUAL_REVIEW | MANUAL_REVIEW:ACTIVE_MISSING_START<br>MANUAL_REVIEW:ACTIVE_MISSING_END<br>NO_CHANGE_REQUIRED:ACTIVE_NO_PAID_ORDER |
| trial-mrd14uce<br>米樂按摩 | - | trial | trial | solo | 1/1 | 2026-07-09 - 2026-09-06 | annual<br>NT$3000 | paid 0<br>pending 0 | MANUAL_REVIEW | MANUAL_REVIEW:MISSING_SLUG |
| trial-mrdj8djy<br>王師傅整人大師 | - | trial | trial | solo | 1/1 | 2026-07-09 - 2026-09-06 | annual<br>NT$3000 | paid 0<br>pending 0 | MANUAL_REVIEW | MANUAL_REVIEW:MISSING_SLUG |
| sunny-hair<br>晴美髮藝 | sunny-hair | trial | trial | small | 2/2 | 2026-07-11 - 2026-07-25 | annual<br>NT$5000 | paid 0<br>pending 0 | MANUAL_REVIEW | MANUAL_REVIEW:TRIAL_LENGTH_MISMATCH |

## Planned Safe Fixes

No safe auto-fixes planned.

## Applied Safe Fixes

| Tenant | Field | New Value |
| --- | --- | --- |
| demo-tenant | billing_cycle | annual |

## Items Not Modified

- Invalid or missing plan/status/slug values require manual review.
- Duplicate slugs are blocking and are not auto-fixed.
- Paid order conflicts are not auto-fixed.
- Active tenants missing contract dates are not auto-fixed.
- Staff over-limit tenants are not auto-fixed; the access rule must keep blocking new staff usage.

## Verification Notes

- This report is generated from remote D1 read queries.
- Safe apply mode refuses to run when any BLOCKING_ERROR exists.
- The current trial rule is 60 days by owner instruction on 2026-07-11.
