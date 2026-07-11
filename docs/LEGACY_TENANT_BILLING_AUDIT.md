# Legacy Tenant Billing Audit

Generated: 2026-07-11T06:10:55.799Z
Timezone rule: Asia/Taipei
Baseline commit: 4c4260bca53bbf6be910ebe3530010be107e23ea
D1 database: bookingos-db remote
Current trial rule: 60 days
Grace period rule: 7 days
Tenant filter: all
Backup path: .local-backups/tenant-manual-closeout-20260711-141004.sql

## Summary

| Metric | Count |
| --- | ---: |
| Tenants scanned | 4 |
| No change required | 2 |
| Safe auto-fix tenants | 0 |
| Manual review tenants | 2 |
| Blocking error tenants | 0 |
| Planned safe field fixes | 0 |
| Applied field fixes | 0 |

## Anomaly Counts

| Code | Count |
| --- | ---: |
| ACTIVE_NO_PAID_ORDER | 1 |
| MISSING_SLUG | 2 |

## Tenant Audit Results

| Tenant | Slug | Status | Access | Plan | Staff | Contract | Billing | Orders | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| demo-tenant<br>安和整復調理 | anhe | active | active | small | 1/2 | 2026-07-11 - 2027-07-10 | annual<br>NT$5000 | paid 0<br>pending 0 | NO_CHANGE_REQUIRED | Manual platform demo activation. Existing paid order history remains an audit note. |
| trial-mrd14uce<br>米樂按摩 | - | trial | trial | solo | 1/1 | 2026-07-09 - 2026-09-06 | annual<br>NT$3000 | paid 0<br>pending 0 | MANUAL_REVIEW | MISSING_SLUG. Awaiting Tony confirmation before writing slug. |
| trial-mrdj8djy<br>王師傅整人大師 | - | trial | trial | solo | 1/1 | 2026-07-09 - 2026-09-06 | annual<br>NT$3000 | paid 0<br>pending 0 | MANUAL_REVIEW | MISSING_SLUG. Awaiting Tony confirmation before writing slug. |
| sunny-hair<br>晴美髮藝 | sunny-hair | trial | trial | small | 2/2 | 2026-07-11 - 2026-09-09 | annual<br>NT$5000 | paid 0<br>pending 0 | NO_CHANGE_REQUIRED | Trial end manually aligned to the 60-day rule. |

## Task 015C Manual Closeout

Backup before mutation: `.local-backups/tenant-manual-closeout-20260711-141004.sql`

Applied remote D1 updates:

| Tenant | Field | Before | After | Reason |
| --- | --- | --- | --- | --- |
| demo-tenant | contract_start | - | 2026-07-11 | Manual platform demo activation |
| demo-tenant | contract_end | - | 2027-07-10 | Manual platform demo activation |
| sunny-hair | contract_end | 2026-07-25 | 2026-09-09 | Align existing trial to the 60-day rule by explicit Task 015C instruction |

Pending Tony confirmation before update:

| Tenant | Store Name | Suggested legal slugs |
| --- | --- | --- |
| trial-mrd14uce | 米樂按摩 | `mile-massage`, `mile-massage-banqiao`, `mi-le-massage` |
| trial-mrdj8djy | 王師傅整人大師 | `wang-master`, `wang-master-therapy`, `wang-zichi` |

Rules preserved:

- New trials use 60 days.
- Legacy tenants are not automatically extended unless explicitly handled by a manual closeout task.
- Missing slugs are never auto-filled, translated or overwritten without Tony confirmation.
- No Customer, Booking, Staff, Service, Identity, route or login data was changed.
## Planned Safe Fixes

No safe auto-fixes planned.

## Applied Safe Fixes

No safe auto-fixes applied in this run.

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
