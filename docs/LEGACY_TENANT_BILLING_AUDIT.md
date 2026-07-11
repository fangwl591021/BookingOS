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
| No change required | 4 |
| Safe auto-fix tenants | 0 |
| Manual review tenants | 0 |
| Blocking error tenants | 0 |
| Planned safe field fixes | 0 |
| Applied field fixes | 0 |

## Anomaly Counts

| Code | Count |
| --- | ---: |
| ACTIVE_NO_PAID_ORDER | 1 |
| MISSING_SLUG | 0 |

## Tenant Audit Results

| Tenant | Slug | Status | Access | Plan | Staff | Contract | Billing | Orders | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| demo-tenant<br>安和整復調理 | anhe | active | active | small | 1/2 | 2026-07-11 - 2027-07-10 | annual<br>NT$5000 | paid 0<br>pending 0 | NO_CHANGE_REQUIRED | Manual platform demo activation. Existing paid order history remains an audit note. |
| trial-mrd14uce<br>米樂按摩 | mile-massage | trial | trial | solo | 1/1 | 2026-07-09 - 2026-09-06 | annual<br>NT$3000 | paid 0<br>pending 0 | NO_CHANGE_REQUIRED | Slug finalized in Task 015C closeout. |
| trial-mrdj8djy<br>王師傅整人大師 | wang-master | trial | trial | solo | 1/1 | 2026-07-09 - 2026-09-06 | annual<br>NT$3000 | paid 0<br>pending 0 | NO_CHANGE_REQUIRED | Slug finalized in Task 015C closeout. |
| sunny-hair<br>晴美髮藝 | sunny-hair | trial | trial | small | 2/2 | 2026-07-11 - 2026-09-09 | annual<br>NT$5000 | paid 0<br>pending 0 | NO_CHANGE_REQUIRED | Trial end manually aligned to the 60-day rule. |

## Task 015C Manual Closeout

Backup before manual date mutation: `.local-backups/tenant-manual-closeout-20260711-141004.sql`

Backup before slug mutation: `.local-backups/tenant-slug-finalize-20260711-141836.sql`

Applied remote D1 updates:

| Tenant | Field | Before | After | Reason |
| --- | --- | --- | --- | --- |
| demo-tenant | contract_start | - | 2026-07-11 | Manual platform demo activation |
| demo-tenant | contract_end | - | 2027-07-10 | Manual platform demo activation |
| sunny-hair | contract_end | 2026-07-25 | 2026-09-09 | Align existing trial to the 60-day rule by explicit Task 015C instruction |

Final slug closeout:

| Tenant | Store Name | Final Slug | Public URL |
| --- | --- | --- | --- |
| trial-mrd14uce | 米樂按摩 | `mile-massage` | `/store/mile-massage` |
| trial-mrdj8djy | 王師傅整人大師 | `wang-master` | `/store/wang-master` |

Rules preserved:

- New trials use 60 days.
- Legacy tenants are not automatically extended unless explicitly handled by a manual closeout task.
- Missing slugs are never auto-filled, translated or overwritten without Tony confirmation. Tony confirmed `mile-massage` and `wang-master` on 2026-07-11.
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

## Task 015 Status

- Task 015: Closed
- Task 015B: Closed
- Task 015C: Closed