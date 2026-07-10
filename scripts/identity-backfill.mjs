#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const args = new Set(process.argv.slice(2));
const database = valueAfter("--database") || "bookingos-db";
const remote = args.has("--remote");
const apply = args.has("--apply");

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

function ensureSchema() {
  const missing = [];
  if (!tableExists("identities")) missing.push("identities");
  if (!tableExists("identity_auth")) missing.push("identity_auth");
  if (!columns("tenant_admins").has("identity_id")) missing.push("tenant_admins.identity_id");
  if (!columns("customers").has("identity_id")) missing.push("customers.identity_id");
  if (!columns("platform_line_contacts").has("identity_id")) missing.push("platform_line_contacts.identity_id");
  if (missing.length) throw new Error(`Identity schema is not ready: ${missing.join(", ")}`);
}

function clean(value) {
  return String(value ?? "").trim();
}

function sqlString(value) {
  if (value === null || value === undefined || value === "") return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function hashId(prefix, value) {
  return `${prefix}_${createHash("sha256").update(String(value)).digest("hex").slice(0, 24)}`;
}

function maskHash(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
}

function providerUidFor(row) {
  if (!row.line) return "";
  if (row.table === "platform_line_contacts") return `platform:${row.line}`;
  if (row.tenantId) return `tenant:${row.tenantId}:${row.line}`;
  return "";
}

function sourceMetadata(row) {
  return JSON.stringify({ source_table: row.table, scope: row.table === "platform_line_contacts" ? "platform" : "tenant", tenant_id: row.tenantId || null, line_uid_hash: maskHash(row.line) });
}

function selectRows(table, wantedColumns) {
  if (!tableExists(table)) return [];
  const cols = columns(table);
  const selected = wantedColumns.filter((col) => cols.has(col));
  if (!selected.length) return [];
  return runSql(`SELECT ${selected.join(", ")} FROM ${table}`);
}

function executeStatements(statements) {
  let executed = 0;
  for (const sql of statements) {
    if (!apply) continue;
    runSql(sql);
    executed += 1;
  }
  return executed;
}

ensureSchema();

const rows = [
  ...selectRows("tenant_admins", ["id", "tenant_id", "line_user_id", "identity_id"]).map((row) => ({ table: "tenant_admins", keyColumn: "id", key: row.id, tenantId: clean(row.tenant_id), line: clean(row.line_user_id), identityId: clean(row.identity_id) })),
  ...selectRows("customers", ["id", "tenant_id", "line_user_id", "identity_id"]).map((row) => ({ table: "customers", keyColumn: "id", key: row.id, tenantId: clean(row.tenant_id), line: clean(row.line_user_id), identityId: clean(row.identity_id) })),
  ...selectRows("platform_line_contacts", ["line_user_id", "tenant_id", "identity_id"]).map((row) => ({ table: "platform_line_contacts", keyColumn: "line_user_id", key: row.line_user_id, tenantId: clean(row.tenant_id), line: clean(row.line_user_id), identityId: clean(row.identity_id) }))
];

const statements = [];
const stats = {
  mode: apply ? "apply" : "plan_only",
  environment: remote ? "remote" : "local",
  database,
  scanned: rows.length,
  eligible_scoped_line: 0,
  skipped_no_line: 0,
  skipped_existing_identity: 0,
  skipped_unscoped_line: 0,
  conflicts: 0,
  statements_planned: 0,
  statements_executed: 0,
  identities_planned: new Set(),
  identity_auth_planned: new Set(),
  table_links_planned: { tenant_admins: 0, customers: 0, platform_line_contacts: 0 },
  masked_conflicts: []
};

for (const row of rows) {
  if (!row.line) {
    stats.skipped_no_line += 1;
    continue;
  }
  const providerUid = providerUidFor(row);
  if (!providerUid) {
    stats.skipped_unscoped_line += 1;
    continue;
  }
  const identityId = hashId("idn", `LINE:${providerUid}`);
  const authId = hashId("auth", `LINE:${providerUid}`);
  if (row.identityId && row.identityId !== identityId) {
    stats.conflicts += 1;
    if (stats.masked_conflicts.length < 20) stats.masked_conflicts.push({ table: row.table, key_hash: maskHash(row.key), existing_identity_hash: maskHash(row.identityId), planned_identity_hash: maskHash(identityId) });
    continue;
  }
  if (row.identityId === identityId) {
    stats.skipped_existing_identity += 1;
    continue;
  }

  stats.eligible_scoped_line += 1;
  stats.identities_planned.add(identityId);
  stats.identity_auth_planned.add(authId);
  stats.table_links_planned[row.table] += 1;

  const metadata = sourceMetadata(row);
  statements.push(`INSERT OR IGNORE INTO identities (id, status, created_at, updated_at) VALUES (${sqlString(identityId)}, 'active', datetime('now'), datetime('now'))`);
  statements.push(`INSERT OR IGNORE INTO identity_auth (id, identity_id, provider, provider_uid, verified, verified_at, metadata_json, created_at, updated_at) VALUES (${sqlString(authId)}, ${sqlString(identityId)}, 'LINE', ${sqlString(providerUid)}, 0, NULL, ${sqlString(metadata)}, datetime('now'), datetime('now'))`);
  statements.push(`UPDATE ${row.table} SET identity_id = ${sqlString(identityId)} WHERE ${row.keyColumn} = ${sqlString(row.key)} AND identity_id IS NULL`);
}

stats.statements_planned = statements.length;
stats.statements_executed = executeStatements(statements);
const finalReport = {
  ...stats,
  identities_planned: stats.identities_planned.size,
  identity_auth_planned: stats.identity_auth_planned.size
};
console.log(JSON.stringify(finalReport, null, 2));
