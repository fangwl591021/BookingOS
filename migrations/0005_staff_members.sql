CREATE TABLE IF NOT EXISTS staff_members (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX IF NOT EXISTS idx_staff_members_tenant ON staff_members(tenant_id, enabled, sort_order);

INSERT OR IGNORE INTO staff_members (id, tenant_id, name, role, sort_order)
VALUES ('tony', 'demo-tenant', 'Tony 師傅', '整復師', 1);
