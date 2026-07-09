CREATE TABLE IF NOT EXISTS resource_types (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX IF NOT EXISTS idx_resource_types_tenant ON resource_types(tenant_id, enabled, sort_order);

ALTER TABLE services ADD COLUMN resource_type_id TEXT;

INSERT OR IGNORE INTO resource_types (id, tenant_id, name, quantity, sort_order)
VALUES ('bed', 'demo-tenant', '整復床', 2, 1);

UPDATE services SET resource_type_id = COALESCE(resource_type_id, 'bed') WHERE tenant_id = 'demo-tenant';
