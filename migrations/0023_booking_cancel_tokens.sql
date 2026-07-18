CREATE TABLE IF NOT EXISTS booking_cancel_tokens (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  booking_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'revoked', 'expired')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  revoked_at TEXT,
  revoked_reason TEXT,
  replaced_by_token_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT,
  created_reason TEXT,
  last_verified_at TEXT,
  verify_count INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (booking_id) REFERENCES bookings(id),
  FOREIGN KEY (replaced_by_token_id) REFERENCES booking_cancel_tokens(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_cancel_tokens_hash
  ON booking_cancel_tokens(token_hash);

CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_cancel_tokens_one_active
  ON booking_cancel_tokens(tenant_id, booking_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_booking_cancel_tokens_booking_active
  ON booking_cancel_tokens(tenant_id, booking_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_booking_cancel_tokens_expiry
  ON booking_cancel_tokens(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_booking_cancel_tokens_replaced_by
  ON booking_cancel_tokens(replaced_by_token_id);
