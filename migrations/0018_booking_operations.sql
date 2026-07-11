CREATE TABLE IF NOT EXISTS booking_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  booking_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  actor_type TEXT NOT NULL DEFAULT 'merchant',
  actor_id TEXT,
  reason TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (booking_id) REFERENCES bookings(id)
);

CREATE INDEX IF NOT EXISTS idx_booking_events_tenant_booking ON booking_events(tenant_id, booking_id, created_at);
CREATE INDEX IF NOT EXISTS idx_booking_events_tenant_created ON booking_events(tenant_id, created_at);

ALTER TABLE bookings ADD COLUMN checked_in_at TEXT;
ALTER TABLE bookings ADD COLUMN service_started_at TEXT;
ALTER TABLE bookings ADD COLUMN completed_at TEXT;
ALTER TABLE bookings ADD COLUMN cancelled_at TEXT;
ALTER TABLE bookings ADD COLUMN cancelled_by TEXT;
ALTER TABLE bookings ADD COLUMN cancel_reason TEXT;
ALTER TABLE bookings ADD COLUMN merchant_note TEXT;
