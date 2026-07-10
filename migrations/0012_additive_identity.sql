-- BookingOS additive identity schema migration.
-- This migration only adds identity foundation tables/columns/indexes.
-- It must not change login, session, LIFF, booking, CRM, or webhook behavior.

CREATE TABLE IF NOT EXISTS identities (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS identity_auth (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_uid TEXT,
  normalized_phone TEXT,
  normalized_email TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,
  last_login_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (identity_id) REFERENCES identities(id)
);

ALTER TABLE tenant_admins ADD COLUMN identity_id TEXT;
ALTER TABLE customers ADD COLUMN identity_id TEXT;
ALTER TABLE customers ADD COLUMN customer_no TEXT;

-- platform_line_contacts is currently created by src/index.js ensurePlatformSchema().
-- Define it here as well so identity migration can be applied on fresh local/test D1.
CREATE TABLE IF NOT EXISTS platform_line_contacts (
  line_user_id TEXT PRIMARY KEY,
  display_name TEXT,
  picture_url TEXT,
  phone TEXT,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'owner_lead',
  lead_status TEXT NOT NULL DEFAULT 'new_friend',
  source TEXT NOT NULL DEFAULT 'line_oa',
  tenant_id TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  note TEXT,
  followed_at TEXT,
  unfollowed_at TEXT,
  last_event_type TEXT,
  last_message TEXT,
  last_interaction_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  referrer_line_user_id TEXT
);

ALTER TABLE platform_line_contacts ADD COLUMN identity_id TEXT;

CREATE INDEX IF NOT EXISTS idx_identity_auth_identity
ON identity_auth(identity_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_identity_auth_provider_uid
ON identity_auth(provider, provider_uid)
WHERE provider_uid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_identity_auth_phone
ON identity_auth(provider, normalized_phone)
WHERE provider = 'PHONE'
  AND normalized_phone IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_identity_auth_email
ON identity_auth(provider, normalized_email)
WHERE provider = 'EMAIL'
  AND normalized_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_admins_identity
ON tenant_admins(identity_id);

CREATE INDEX IF NOT EXISTS idx_customers_identity
ON customers(identity_id);

CREATE INDEX IF NOT EXISTS idx_platform_line_contacts_identity
ON platform_line_contacts(identity_id);
