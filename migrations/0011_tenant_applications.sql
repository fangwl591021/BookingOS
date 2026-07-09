ALTER TABLE tenants ADD COLUMN contract_start TEXT;
ALTER TABLE tenants ADD COLUMN contract_end TEXT;

CREATE TABLE IF NOT EXISTS tenant_applications (
  id TEXT PRIMARY KEY,
  store_name TEXT NOT NULL,
  store_phone TEXT,
  store_address TEXT,
  business_type TEXT,
  owner_name TEXT NOT NULL,
  owner_phone TEXT NOT NULL,
  owner_email TEXT,
  contract_start TEXT,
  contract_end TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  tenant_id TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tenant_applications_status ON tenant_applications(status, created_at);
