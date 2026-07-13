-- Sprint 3 LINE Engagement Foundation.
-- Secrets are stored only in encrypted ciphertext/IV columns by application code.
ALTER TABLE line_oa_settings ADD COLUMN bot_user_id TEXT;
ALTER TABLE line_oa_settings ADD COLUMN display_name TEXT;
ALTER TABLE line_oa_settings ADD COLUMN picture_url TEXT;
ALTER TABLE line_oa_settings ADD COLUMN webhook_status TEXT NOT NULL DEFAULT 'unverified';
ALTER TABLE line_oa_settings ADD COLUMN webhook_last_verified_at TEXT;
ALTER TABLE line_oa_settings ADD COLUMN webhook_last_error TEXT;
ALTER TABLE line_oa_settings ADD COLUMN messaging_status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE line_oa_settings ADD COLUMN messaging_last_verified_at TEXT;
ALTER TABLE line_oa_settings ADD COLUMN login_channel_id TEXT;
ALTER TABLE line_oa_settings ADD COLUMN login_status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE line_oa_settings ADD COLUMN login_callback_url TEXT;
ALTER TABLE line_oa_settings ADD COLUMN login_last_verified_at TEXT;
ALTER TABLE line_oa_settings ADD COLUMN liff_endpoint_url TEXT;
ALTER TABLE line_oa_settings ADD COLUMN liff_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE line_oa_settings ADD COLUMN liff_status TEXT NOT NULL DEFAULT 'unverified';
ALTER TABLE line_oa_settings ADD COLUMN liff_last_verified_at TEXT;
ALTER TABLE line_oa_settings ADD COLUMN channel_secret_ciphertext TEXT;
ALTER TABLE line_oa_settings ADD COLUMN channel_secret_iv TEXT;
ALTER TABLE line_oa_settings ADD COLUMN channel_access_token_ciphertext TEXT;
ALTER TABLE line_oa_settings ADD COLUMN channel_access_token_iv TEXT;
ALTER TABLE line_oa_settings ADD COLUMN login_channel_secret_ciphertext TEXT;
ALTER TABLE line_oa_settings ADD COLUMN login_channel_secret_iv TEXT;
ALTER TABLE line_oa_settings ADD COLUMN credential_key_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE line_oa_settings ADD COLUMN credentials_updated_at TEXT;

CREATE TABLE IF NOT EXISTS line_webhook_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  webhook_event_id TEXT,
  event_type TEXT NOT NULL,
  source_type TEXT,
  source_user_id TEXT,
  event_timestamp INTEGER,
  is_redelivery INTEGER NOT NULL DEFAULT 0,
  processing_status TEXT NOT NULL DEFAULT 'received',
  error_code TEXT,
  received_at TEXT NOT NULL,
  processed_at TEXT,
  UNIQUE (tenant_id, webhook_event_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX IF NOT EXISTS idx_line_webhook_events_tenant_received
ON line_webhook_events (tenant_id, received_at);
