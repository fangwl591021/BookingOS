-- Tenant-scoped LINE booking notification delivery idempotency.
CREATE TABLE IF NOT EXISTS line_notification_deliveries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  booking_id TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  delivery_key TEXT NOT NULL,
  status TEXT NOT NULL,
  error_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (tenant_id, delivery_key),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (booking_id) REFERENCES bookings(id)
);

CREATE INDEX IF NOT EXISTS idx_line_notification_deliveries_booking
ON line_notification_deliveries (tenant_id, booking_id, notification_type);
