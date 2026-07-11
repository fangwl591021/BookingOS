import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const DB_NAME = "bookingos-db";
const REPORT_PATH = "docs/LEGACY_TENANT_BILLING_AUDIT.md";
const BASELINE_COMMIT = "4c4260bca53bbf6be910ebe3530010be107e23ea";
const TRIAL_DAYS = 60;
const GRACE_DAYS = 7;
const VALID_STATUSES = new Set(["trial", "active", "suspended", "cancelled"]);
const VALID_BILLING_CYCLES = new Set(["annual"]);
const STORE_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

const PLANS = new Map([
  ["solo", { name: "Solo", annualPrice: 3000, staffLimit: 1, extraStaffAnnualPrice: null }],
  ["small", { name: "Small", annualPrice: 5000, staffLimit: 2, extraStaffAnnualPrice: null }],
  ["growth", { name: "Growth", annualPrice: 8000, staffLimit: 4, extraStaffAnnualPrice: null }],
  ["team", { name: "Team", annualPrice: 12000, staffLimit: 8, extraStaffAnnualPrice: 1000 }]
]);

const args = process.argv.slice(2);
const tenantArg = args.find((arg) => arg.startsWith("--tenant="));
const tenantFilter = tenantArg ? tenantArg.slice("--tenant=".length).trim() : "";
const mode = args.includes("--remote-apply-safe") ? "apply" : args.includes("--remote-report") ? "report" : "help";

if (mode === "help") {
  console.log("Usage: node scripts/audit-tenant-billing.mjs --remote-report [--tenant=<id>]");
  console.log("       node scripts/audit-tenant-billing.mjs --remote-apply-safe [--tenant=<id>]");
  process.exit(0);
}

function sqlQuote(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function runD1(command) {
  const sql = String(command || "").replace(/\s+/g, " ").trim();
  const result = process.platform === "win32"
    ? spawnSync("powershell.exe", ["-NoProfile", "-Command", `& npx.cmd wrangler d1 execute ${DB_NAME} --remote --json --command ${JSON.stringify(sql)}`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      })
    : spawnSync("npx", ["wrangler", "d1", "execute", DB_NAME, "--remote", "--json", "--command", sql], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      });
  if (result.status !== 0) {
    throw new Error(`wrangler d1 failed (${result.status})\n${result.error?.message || result.stderr || result.stdout}`);
  }
  const output = String(result.stdout || "").trim();
  if (!output) return { results: [], meta: {} };
  let parsed;
  try {
    parsed = JSON.parse(output);
  } catch (error) {
    throw new Error(`Failed to parse wrangler JSON output: ${output.slice(0, 500)}`);
  }
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!first?.success) throw new Error(`D1 query failed: ${output.slice(0, 500)}`);
  return first;
}

function query(command) {
  return runD1(command).results || [];
}

function execute(command) {
  return runD1(command).meta || {};
}

function dateOnly(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function parseDate(value) {
  const day = dateOnly(value);
  if (!day) return null;
  const date = new Date(`${day}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value, days) {
  const date = parseDate(value);
  if (!date) return "";
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return formatDate(next);
}

function daysBetween(start, end) {
  const a = parseDate(start);
  const b = parseDate(end);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function todayTaipei() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function compareDate(a, b) {
  const left = dateOnly(a);
  const right = dateOnly(b);
  if (!left || !right) return null;
  return left.localeCompare(right);
}

function evaluateTenantAccess(tenant, today = todayTaipei()) {
  const status = String(tenant.status || "").trim();
  if (status === "suspended" || status === "cancelled" || status === "paused") return "disabled";
  const contractEnd = dateOnly(tenant.contract_end);
  const staffLimit = Number(tenant.staff_limit || 0);
  const enabledStaff = Number(tenant.enabled_staff_count || 0);
  if (staffLimit > 0 && enabledStaff > staffLimit) return "over_staff_limit";
  if (status === "trial") {
    if (contractEnd && compareDate(contractEnd, today) < 0) return "expired";
    return "trial";
  }
  if (status === "active") {
    if (contractEnd && compareDate(addDays(contractEnd, GRACE_DAYS), today) < 0) return "expired";
    return "active";
  }
  return "unknown";
}

function addAnomaly(target, code, level, message, fix = null) {
  target.anomalies.push({ code, level, message, fix });
}

function highestLevel(anomalies) {
  if (anomalies.some((item) => item.level === "BLOCKING_ERROR")) return "BLOCKING_ERROR";
  if (anomalies.some((item) => item.level === "MANUAL_REVIEW")) return "MANUAL_REVIEW";
  if (anomalies.some((item) => item.level === "SAFE_AUTO_FIX")) return "SAFE_AUTO_FIX";
  return "NO_CHANGE_REQUIRED";
}

function auditTenant(row, duplicateSlugs, today) {
  const result = { tenant: row, anomalies: [], fixes: [], access: evaluateTenantAccess(row, today), classification: "NO_CHANGE_REQUIRED" };
  const status = String(row.status || "").trim();
  const planId = String(row.billing_plan_id || "").trim();
  const plan = PLANS.get(planId);
  const billingCycle = String(row.billing_cycle || "").trim();
  const slug = String(row.slug || "").trim();
  const paidOrders = Number(row.paid_order_count || 0);
  const paidPlanVariantCount = Number(row.paid_plan_variant_count || 0);
  const trialConvertOrders = Number(row.trial_convert_order_count || 0);

  if (!VALID_STATUSES.has(status)) addAnomaly(result, "INVALID_STATUS", "BLOCKING_ERROR", `status=${status || "blank"} is not an allowed tenant status.`);
  if (!slug) addAnomaly(result, "MISSING_SLUG", "MANUAL_REVIEW", "Tenant has no store slug. Needs human-approved public URL mapping.");
  else if (!STORE_SLUG_PATTERN.test(slug)) addAnomaly(result, "INVALID_SLUG", "MANUAL_REVIEW", `slug=${slug} does not match the public store slug rule.`);
  else if (duplicateSlugs.has(slug)) addAnomaly(result, "DUPLICATE_SLUG", "BLOCKING_ERROR", `slug=${slug} is used by multiple tenants.`);

  if (!planId) addAnomaly(result, "MISSING_PLAN", "MANUAL_REVIEW", "billing_plan_id is blank.");
  else if (!plan) addAnomaly(result, "INVALID_PLAN", "MANUAL_REVIEW", `billing_plan_id=${planId} is not one of ${Array.from(PLANS.keys()).join(", ")}.`);

  if (plan) {
    if (Number(row.staff_limit || 0) !== plan.staffLimit) {
      addAnomaly(result, "STAFF_LIMIT_MISMATCH", "SAFE_AUTO_FIX", `staff_limit=${row.staff_limit ?? "blank"}; expected ${plan.staffLimit}.`, { staff_limit: plan.staffLimit });
    }
    if (Number(row.annual_price || 0) !== plan.annualPrice) {
      const conflictingPaidPlan = row.last_paid_plan && row.last_paid_plan !== planId;
      if (paidPlanVariantCount > 1 || conflictingPaidPlan) {
        addAnomaly(result, "ANNUAL_PRICE_MISMATCH_PAID_CONFLICT", "MANUAL_REVIEW", `annual_price=${row.annual_price ?? "blank"}; expected ${plan.annualPrice}, but paid order history conflicts.`);
      } else {
        addAnomaly(result, "ANNUAL_PRICE_MISMATCH", "SAFE_AUTO_FIX", `annual_price=${row.annual_price ?? "blank"}; expected ${plan.annualPrice}.`, { annual_price: plan.annualPrice });
      }
    }
  }

  if (!billingCycle) addAnomaly(result, "MISSING_BILLING_CYCLE", "SAFE_AUTO_FIX", "billing_cycle is blank; BookingOS V1 is annual-only.", { billing_cycle: "annual" });
  else if (!VALID_BILLING_CYCLES.has(billingCycle)) addAnomaly(result, "INVALID_BILLING_CYCLE", "MANUAL_REVIEW", `billing_cycle=${billingCycle}; expected annual.`);

  const start = dateOnly(row.contract_start);
  const end = dateOnly(row.contract_end);
  if (row.contract_start && !start) addAnomaly(result, "INVALID_CONTRACT_START", "MANUAL_REVIEW", `contract_start=${row.contract_start} is not parseable.`);
  if (row.contract_end && !end) addAnomaly(result, "INVALID_CONTRACT_END", "MANUAL_REVIEW", `contract_end=${row.contract_end} is not parseable.`);
  if (start && end && compareDate(start, end) > 0) addAnomaly(result, "CONTRACT_START_AFTER_END", "MANUAL_REVIEW", `contract_start=${start} is after contract_end=${end}.`);

  if (status === "trial") {
    if (!start) addAnomaly(result, "TRIAL_MISSING_START", "MANUAL_REVIEW", "Trial tenant is missing contract_start.");
    if (!end) {
      if (start && paidOrders === 0 && trialConvertOrders === 0) {
        addAnomaly(result, "TRIAL_MISSING_END", "SAFE_AUTO_FIX", `Trial tenant has no contract_end; expected ${TRIAL_DAYS} days from ${start}.`, { contract_end: addDays(start, TRIAL_DAYS) });
      } else {
        addAnomaly(result, "TRIAL_MISSING_END_WITH_EVIDENCE", "MANUAL_REVIEW", "Trial tenant has no contract_end but has payment/convert evidence or missing start.");
      }
    }
    if (start && end) {
      const length = daysBetween(start, end);
      if (length !== TRIAL_DAYS && length !== TRIAL_DAYS - 1) {
        addAnomaly(result, "TRIAL_LENGTH_MISMATCH", "MANUAL_REVIEW", `Trial length is ${length} days; current rule is ${TRIAL_DAYS} days.`);
      }
    }
    if (end && compareDate(end, today) < 0 && result.access !== "expired") {
      addAnomaly(result, "TRIAL_EXPIRED_ACCESS_MISMATCH", "BLOCKING_ERROR", `Trial ended at ${end}, but access evaluated as ${result.access}.`);
    }
    if (paidOrders > 0) addAnomaly(result, "TRIAL_HAS_PAID_ORDER", "MANUAL_REVIEW", "Trial tenant has paid order history; conversion status must be checked manually.");
  }

  if (status === "active") {
    if (!start) addAnomaly(result, "ACTIVE_MISSING_START", "MANUAL_REVIEW", "Active tenant is missing contract_start.");
    if (!end) addAnomaly(result, "ACTIVE_MISSING_END", "MANUAL_REVIEW", "Active tenant is missing contract_end.");
    if (end && compareDate(addDays(end, GRACE_DAYS), today) < 0 && result.access !== "expired") {
      addAnomaly(result, "ACTIVE_EXPIRED_ACCESS_MISMATCH", "BLOCKING_ERROR", `Active contract ended ${end} plus grace, but access evaluated as ${result.access}.`);
    }
    if (paidOrders === 0) addAnomaly(result, "ACTIVE_NO_PAID_ORDER", "NO_CHANGE_REQUIRED", "Active tenant has no paid order in current data; keep as audit note only.");
  }

  if (Number(row.enabled_staff_count || 0) > Number(row.staff_limit || 0) && Number(row.staff_limit || 0) > 0) {
    addAnomaly(result, "ENABLED_STAFF_OVER_LIMIT", "NO_CHANGE_REQUIRED", `Enabled staff=${row.enabled_staff_count}; staff_limit=${row.staff_limit}.`);
    if (result.access !== "over_staff_limit") addAnomaly(result, "OVER_LIMIT_ACCESS_MISMATCH", "BLOCKING_ERROR", "Tenant is over staff limit but access evaluation did not flag it.");
  }

  if (paidOrders > 1) addAnomaly(result, "MULTIPLE_PAID_ORDERS", "NO_CHANGE_REQUIRED", `paid_order_count=${paidOrders}; audit note only.`);

  result.fixes = result.anomalies.filter((item) => item.fix).map((item) => item.fix);
  result.classification = highestLevel(result.anomalies);
  return result;
}

function fetchAuditRows() {
  const where = tenantFilter ? `WHERE t.id = ${sqlQuote(tenantFilter)}` : "";
  const tenants = query(`
SELECT t.id, t.slug, t.name, t.status, t.billing_plan_id, t.staff_limit,
       t.contract_start, t.contract_end, t.billing_cycle, t.annual_price,
       t.extra_staff_annual_price, t.created_at, t.updated_at,
       (SELECT COUNT(*) FROM staff_members sm WHERE sm.tenant_id = t.id AND sm.enabled = 1) AS enabled_staff_count,
       (SELECT COUNT(*) FROM billing_orders bo WHERE bo.tenant_id = t.id AND bo.status = 'pending') AS pending_order_count,
       (SELECT COUNT(*) FROM billing_orders bo WHERE bo.tenant_id = t.id AND bo.status = 'paid') AS paid_order_count,
       (SELECT COUNT(DISTINCT bo.billing_plan_id) FROM billing_orders bo WHERE bo.tenant_id = t.id AND bo.status = 'paid') AS paid_plan_variant_count,
       (SELECT bo.billing_plan_id FROM billing_orders bo WHERE bo.tenant_id = t.id AND bo.status = 'paid' ORDER BY COALESCE(bo.paid_at, bo.updated_at, bo.created_at) DESC LIMIT 1) AS last_paid_plan,
       (SELECT bo.paid_at FROM billing_orders bo WHERE bo.tenant_id = t.id AND bo.status = 'paid' ORDER BY COALESCE(bo.paid_at, bo.updated_at, bo.created_at) DESC LIMIT 1) AS last_paid_at,
       (SELECT COUNT(*) FROM billing_orders bo WHERE bo.tenant_id = t.id AND bo.source = 'trial_convert') AS trial_convert_order_count
FROM tenants t
${where}
ORDER BY t.created_at ASC, t.id ASC`);
  const duplicateRows = query("SELECT slug FROM tenants WHERE slug IS NOT NULL AND slug <> '' GROUP BY slug HAVING COUNT(*) > 1");
  return { tenants, duplicateSlugs: new Set(duplicateRows.map((row) => String(row.slug || "").trim()).filter(Boolean)) };
}

function summarize(results) {
  const summary = {
    total: results.length,
    noChange: 0,
    safeAutoFix: 0,
    manualReview: 0,
    blockingError: 0,
    anomalies: new Map(),
    plannedFixes: 0
  };
  for (const result of results) {
    if (result.classification === "BLOCKING_ERROR") summary.blockingError += 1;
    else if (result.classification === "MANUAL_REVIEW") summary.manualReview += 1;
    else if (result.classification === "SAFE_AUTO_FIX") summary.safeAutoFix += 1;
    else summary.noChange += 1;
    summary.plannedFixes += Object.keys(collectSafeFixes(result, true)).length;
    for (const anomaly of result.anomalies) {
      summary.anomalies.set(anomaly.code, (summary.anomalies.get(anomaly.code) || 0) + 1);
    }
  }
  return summary;
}

function collectSafeFixes(result, includeMixed = false) {
  if (!includeMixed && result.classification !== "SAFE_AUTO_FIX") return {};
  const patch = {};
  for (const fix of result.fixes) Object.assign(patch, fix);
  return patch;
}

function renderValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value).replace(/\|/g, "\\|");
}

function renderReport(results, appliedFixes = []) {
  const summary = summarize(results);
  const backupPath = process.env.BOOKINGOS_AUDIT_BACKUP_PATH || "not exported for report-only run";
  const now = new Date().toISOString();
  const anomalyRows = Array.from(summary.anomalies.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const plannedFixRows = results.flatMap((result) => {
    const patch = collectSafeFixes(result, true);
    return Object.keys(patch).map((key) => ({ tenant: result.tenant.id, field: key, value: patch[key] }));
  });

  const lines = [];
  lines.push("# Legacy Tenant Billing Audit");
  lines.push("");
  lines.push(`Generated: ${now}`);
  lines.push(`Timezone rule: Asia/Taipei`);
  lines.push(`Baseline commit: ${BASELINE_COMMIT}`);
  lines.push(`D1 database: ${DB_NAME} remote`);
  lines.push(`Current trial rule: ${TRIAL_DAYS} days`);
  lines.push(`Grace period rule: ${GRACE_DAYS} days`);
  lines.push(`Tenant filter: ${tenantFilter || "all"}`);
  lines.push(`Backup path: ${backupPath}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Count |");
  lines.push("| --- | ---: |");
  lines.push(`| Tenants scanned | ${summary.total} |`);
  lines.push(`| No change required | ${summary.noChange} |`);
  lines.push(`| Safe auto-fix tenants | ${summary.safeAutoFix} |`);
  lines.push(`| Manual review tenants | ${summary.manualReview} |`);
  lines.push(`| Blocking error tenants | ${summary.blockingError} |`);
  lines.push(`| Planned safe field fixes | ${plannedFixRows.length} |`);
  lines.push(`| Applied field fixes | ${appliedFixes.length} |`);
  lines.push("");
  lines.push("## Anomaly Counts");
  lines.push("");
  if (!anomalyRows.length) lines.push("No anomalies found.");
  else {
    lines.push("| Code | Count |");
    lines.push("| --- | ---: |");
    for (const [code, count] of anomalyRows) lines.push(`| ${code} | ${count} |`);
  }
  lines.push("");
  lines.push("## Tenant Audit Results");
  lines.push("");
  lines.push("| Tenant | Slug | Status | Access | Plan | Staff | Contract | Billing | Orders | Result | Notes |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const result of results) {
    const t = result.tenant;
    const notes = result.anomalies.length ? result.anomalies.map((item) => `${item.level}:${item.code}`).join("<br>") : "OK";
    lines.push(`| ${renderValue(t.id)}<br>${renderValue(t.name)} | ${renderValue(t.slug)} | ${renderValue(t.status)} | ${renderValue(result.access)} | ${renderValue(t.billing_plan_id)} | ${renderValue(t.enabled_staff_count)}/${renderValue(t.staff_limit)} | ${renderValue(dateOnly(t.contract_start))} - ${renderValue(dateOnly(t.contract_end))} | ${renderValue(t.billing_cycle)}<br>NT$${renderValue(t.annual_price)} | paid ${renderValue(t.paid_order_count)}<br>pending ${renderValue(t.pending_order_count)} | ${result.classification} | ${notes} |`);
  }
  lines.push("");
  lines.push("## Planned Safe Fixes");
  lines.push("");
  if (!plannedFixRows.length) lines.push("No safe auto-fixes planned.");
  else {
    lines.push("| Tenant | Field | New Value |");
    lines.push("| --- | --- | --- |");
    for (const fix of plannedFixRows) lines.push(`| ${renderValue(fix.tenant)} | ${renderValue(fix.field)} | ${renderValue(fix.value)} |`);
  }
  lines.push("");
  lines.push("## Applied Safe Fixes");
  lines.push("");
  if (!appliedFixes.length) lines.push("No safe auto-fixes applied in this run.");
  else {
    lines.push("| Tenant | Field | New Value |");
    lines.push("| --- | --- | --- |");
    for (const fix of appliedFixes) lines.push(`| ${renderValue(fix.tenant)} | ${renderValue(fix.field)} | ${renderValue(fix.value)} |`);
  }
  lines.push("");
  lines.push("## Items Not Modified");
  lines.push("");
  lines.push("- Invalid or missing plan/status/slug values require manual review.");
  lines.push("- Duplicate slugs are blocking and are not auto-fixed.");
  lines.push("- Paid order conflicts are not auto-fixed.");
  lines.push("- Active tenants missing contract dates are not auto-fixed.");
  lines.push("- Staff over-limit tenants are not auto-fixed; the access rule must keep blocking new staff usage.");
  lines.push("");
  lines.push("## Verification Notes");
  lines.push("");
  lines.push("- This report is generated from remote D1 read queries.");
  lines.push("- Safe apply mode refuses to run when any BLOCKING_ERROR exists.");
  lines.push("- The current trial rule is 60 days by owner instruction on 2026-07-11.");
  lines.push("");
  return lines.join("\n");
}

function writeReport(results, appliedFixes = []) {
  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, renderReport(results, appliedFixes), "utf8");
}

function applySafeFixes(results) {
  const blocking = results.filter((result) => result.classification === "BLOCKING_ERROR");
  if (blocking.length) {
    throw new Error(`Refusing safe apply because ${blocking.length} blocking tenant(s) exist.`);
  }
  const applied = [];
  for (const result of results) {
    const patch = collectSafeFixes(result, true);
    const keys = Object.keys(patch);
    if (!keys.length) continue;
    const assignments = keys.map((key) => `${key} = ${typeof patch[key] === "number" ? patch[key] : sqlQuote(patch[key])}`);
    assignments.push("updated_at = datetime('now')");
    const meta = execute(`UPDATE tenants SET ${assignments.join(", ")} WHERE id = ${sqlQuote(result.tenant.id)}`);
    if (Number(meta.changes || 0) !== 1) {
      throw new Error(`Expected exactly one tenant row update for ${result.tenant.id}, got ${meta.changes || 0}.`);
    }
    for (const key of keys) applied.push({ tenant: result.tenant.id, field: key, value: patch[key] });
  }
  return applied;
}

function runAudit() {
  const today = todayTaipei();
  const { tenants, duplicateSlugs } = fetchAuditRows();
  return tenants.map((tenant) => auditTenant(tenant, duplicateSlugs, today));
}

let results = runAudit();
if (mode === "report") {
  writeReport(results);
  const summary = summarize(results);
  console.log(JSON.stringify({ ok: true, mode, reportPath: REPORT_PATH, summary }, null, 2));
} else if (mode === "apply") {
  const applied = applySafeFixes(results);
  results = runAudit();
  writeReport(results, applied);
  const summary = summarize(results);
  console.log(JSON.stringify({ ok: true, mode, reportPath: REPORT_PATH, applied, summary }, null, 2));
}
