#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const args = new Set(process.argv.slice(2));
const database = valueAfter("--database") || "bookingos-db";
const remote = args.has("--remote");
const jsonOnly = args.has("--json");

function valueAfter(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function runSql(sql) {
  const wranglerArgs = ["wrangler", "d1", "execute", database, remote ? "--remote" : "--local", "--json", "--command", sql];
  const command = process.platform === "win32" ? "cmd.exe" : "npx";
  const commandArgs = process.platform === "win32" ? ["/c", "npx.cmd", ...wranglerArgs] : wranglerArgs;
  const out = execFileSync(command, commandArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const parsed = JSON.parse(out);
  if (!parsed[0]?.success) throw new Error(`D1 query failed: ${sql}`);
  return parsed[0].results || [];
}

function tableExists(table) {
  return runSql(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`).length > 0;
}

function columns(table) {
  if (!tableExists(table)) return new Set();
  return new Set(runSql(`PRAGMA table_info(${table})`).map((row) => row.name));
}

function count(table) {
  if (!tableExists(table)) return 0;
  return Number(runSql(`SELECT COUNT(*) AS c FROM ${table}`)[0]?.c || 0);
}

function selectRows(table, wantedColumns) {
  if (!tableExists(table)) return [];
  const cols = columns(table);
  const selected = wantedColumns.filter((col) => cols.has(col));
  if (!selected.length) return [];
  return runSql(`SELECT ${selected.join(", ")} FROM ${table}`);
}

function clean(value) {
  return String(value ?? "").trim();
}

function normalizePhone(value) {
  const text = clean(value);
  if (!text) return "";
  const digits = text.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("886") && digits.length >= 11) return `0${digits.slice(3)}`;
  return digits;
}

function normalizeEmail(value) {
  const text = clean(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text : "";
}

function hash(value) {
  if (!value) return "";
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
}

function addToMap(map, key, item) {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(item);
}

const tenantAdmins = selectRows("tenant_admins", ["id", "tenant_id", "name", "phone", "email", "line_user_id", "identity_id"]);
const customers = selectRows("customers", ["id", "tenant_id", "name", "phone", "email", "line_user_id", "identity_id"]);
const platformContacts = selectRows("platform_line_contacts", ["line_user_id", "display_name", "phone", "email", "tenant_id", "identity_id"]);

const all = [
  ...tenantAdmins.map((row) => ({ table: "tenant_admins", id: row.id, tenantId: row.tenant_id, line: clean(row.line_user_id), phone: normalizePhone(row.phone), email: normalizeEmail(row.email), identityId: clean(row.identity_id) })),
  ...customers.map((row) => ({ table: "customers", id: row.id, tenantId: row.tenant_id, line: clean(row.line_user_id), phone: normalizePhone(row.phone), email: normalizeEmail(row.email), identityId: clean(row.identity_id) })),
  ...platformContacts.map((row) => ({ table: "platform_line_contacts", id: row.line_user_id, tenantId: row.tenant_id, line: clean(row.line_user_id), phone: normalizePhone(row.phone), email: normalizeEmail(row.email), identityId: clean(row.identity_id) }))
];

const lineMap = new Map();
const phoneMap = new Map();
const emailMap = new Map();
for (const item of all) {
  addToMap(lineMap, item.line, item);
  addToMap(phoneMap, item.phone, item);
  addToMap(emailMap, item.email, item);
}

function duplicateCount(map) {
  return [...map.values()].filter((items) => items.length > 1).length;
}

function crossTenantCount(map) {
  return [...map.values()].filter((items) => new Set(items.map((item) => item.tenantId).filter(Boolean)).size > 1).length;
}

function noIdentifierCount(rows) {
  return rows.filter((item) => !item.line && !item.phone && !item.email).length;
}

const safeLineScopes = new Set();
for (const item of all) {
  if (!item.line || item.identityId) continue;
  if (item.table === "platform_line_contacts") safeLineScopes.add(`platform:${item.line}`);
  if (item.tenantId && (item.table === "tenant_admins" || item.table === "customers")) safeLineScopes.add(`tenant:${item.tenantId}:${item.line}`);
}

const ambiguousPhone = [...phoneMap.entries()].filter(([, items]) => items.length > 1).length;
const ambiguousEmail = [...emailMap.entries()].filter(([, items]) => items.length > 1).length;
const ambiguousLine = [...lineMap.entries()].filter(([, items]) => {
  const scoped = new Set(items.map((item) => item.table === "platform_line_contacts" ? `platform:${item.line}` : `tenant:${item.tenantId}:${item.line}`));
  return scoped.size > 1;
}).length;

const report = {
  environment: remote ? "remote" : "local",
  database,
  schema: {
    identities: tableExists("identities"),
    identity_auth: tableExists("identity_auth"),
    tenant_admins_identity_id: columns("tenant_admins").has("identity_id"),
    customers_identity_id: columns("customers").has("identity_id"),
    customers_customer_no: columns("customers").has("customer_no"),
    platform_line_contacts_identity_id: columns("platform_line_contacts").has("identity_id"),
    forbidden_identity_profiles: tableExists("identity_profiles"),
    forbidden_admins: tableExists("admins"),
    forbidden_sessions: tableExists("sessions")
  },
  counts: {
    tenant_admins: count("tenant_admins"),
    customers: count("customers"),
    platform_line_contacts: count("platform_line_contacts"),
    identities: count("identities"),
    identity_auth: count("identity_auth")
  },
  line: {
    non_empty: all.filter((item) => item.line).length,
    unique: lineMap.size,
    duplicate: duplicateCount(lineMap),
    cross_tenant: crossTenantCount(lineMap)
  },
  phone: {
    non_empty: all.filter((item) => item.phone).length,
    unique_normalized: phoneMap.size,
    duplicate: duplicateCount(phoneMap),
    cross_tenant: crossTenantCount(phoneMap)
  },
  email: {
    non_empty: all.filter((item) => item.email).length,
    unique_normalized: emailMap.size,
    duplicate: duplicateCount(emailMap)
  },
  candidates: {
    safe_auto_identity_from_scoped_line: safeLineScopes.size,
    ambiguous_needs_review: ambiguousLine + ambiguousPhone + ambiguousEmail,
    no_identifier_records: noIdentifierCount(all)
  },
  masked_samples: {
    duplicate_line_hashes: [...lineMap.entries()].filter(([, items]) => items.length > 1).slice(0, 10).map(([key, items]) => ({ hash: hash(key), count: items.length })),
    duplicate_phone_hashes: [...phoneMap.entries()].filter(([, items]) => items.length > 1).slice(0, 10).map(([key, items]) => ({ hash: hash(key), count: items.length })),
    duplicate_email_hashes: [...emailMap.entries()].filter(([, items]) => items.length > 1).slice(0, 10).map(([key, items]) => ({ hash: hash(key), count: items.length }))
  }
};

if (jsonOnly) console.log(JSON.stringify(report, null, 2));
else {
  console.log("BookingOS Identity Audit");
  console.log(JSON.stringify(report, null, 2));
}
