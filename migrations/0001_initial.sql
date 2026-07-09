-- BookingOS D1 schema v0.1
-- Multi-tenant fields are included from day one to avoid data mixing later.

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Taipei',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS business_settings (
  tenant_id TEXT PRIMARY KEY,
  open_time TEXT NOT NULL DEFAULT '09:00',
  close_time TEXT NOT NULL DEFAULT '18:00',
  break_start TEXT,
  break_end TEXT,
  closed_days_json TEXT NOT NULL DEFAULT '[]',
  allow_overtime_booking INTEGER NOT NULL DEFAULT 0,
  slot_step_minutes INTEGER NOT NULL DEFAULT 30,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS service_durations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (service_id) REFERENCES services(id),
  UNIQUE (service_id, minutes)
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  line_user_id TEXT,
  line_display_name TEXT,
  birthday TEXT,
  note TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  marketing_opt_in INTEGER NOT NULL DEFAULT 1,
  points_balance INTEGER NOT NULL DEFAULT 0,
  total_points_earned INTEGER NOT NULL DEFAULT 0,
  total_points_used INTEGER NOT NULL DEFAULT 0,
  referral_code TEXT,
  referred_by_customer_id TEXT,
  referred_by_code TEXT,
  referred_at TEXT,
  total_bookings INTEGER NOT NULL DEFAULT 0,
  no_show_count INTEGER NOT NULL DEFAULT 0,
  last_booking_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (referred_by_customer_id) REFERENCES customers(id),
  UNIQUE (tenant_id, phone),
  UNIQUE (tenant_id, line_user_id),
  UNIQUE (tenant_id, referral_code)
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_id TEXT,
  staff_id TEXT NOT NULL DEFAULT 'tony',
  service_id TEXT,
  service_name TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  booking_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed',
  source TEXT NOT NULL DEFAULT 'web',
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (service_id) REFERENCES services(id)
);

CREATE TABLE IF NOT EXISTS point_transactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  booking_id TEXT,
  type TEXT NOT NULL,
  points INTEGER NOT NULL,
  reason TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (booking_id) REFERENCES bookings(id)
);

CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  referrer_customer_id TEXT NOT NULL,
  referred_customer_id TEXT NOT NULL,
  referral_code TEXT,
  reward_status TEXT NOT NULL DEFAULT 'pending',
  reward_points INTEGER NOT NULL DEFAULT 0,
  first_booking_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  rewarded_at TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (referrer_customer_id) REFERENCES customers(id),
  FOREIGN KEY (referred_customer_id) REFERENCES customers(id),
  FOREIGN KEY (first_booking_id) REFERENCES bookings(id)
);

CREATE INDEX IF NOT EXISTS idx_services_tenant ON services(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_durations_service ON service_durations(service_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_phone ON customers(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_date ON bookings(tenant_id, booking_date, start_time);
CREATE INDEX IF NOT EXISTS idx_points_customer ON point_transactions(customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_customer_id, created_at);

INSERT OR IGNORE INTO tenants (id, name, phone, address, timezone)
VALUES ('demo-tenant', '安和整復調理', '02-2345-6789', '台北市大安區安和路一段 88 號', 'Asia/Taipei');

INSERT OR IGNORE INTO business_settings (tenant_id, open_time, close_time, break_start, break_end, closed_days_json, allow_overtime_booking, slot_step_minutes)
VALUES ('demo-tenant', '09:00', '18:00', '12:00', '13:00', '["星期三"]', 0, 30);

INSERT OR IGNORE INTO services (id, tenant_id, name, category, sort_order) VALUES
('therapy', 'demo-tenant', '整復調理', '整復推拿', 1),
('neck', 'demo-tenant', '肩頸放鬆', '放鬆保養', 2),
('deep', 'demo-tenant', '深層筋膜', '進階療程', 3);

INSERT OR IGNORE INTO service_durations (id, tenant_id, service_id, minutes, price) VALUES
('therapy-60', 'demo-tenant', 'therapy', 60, 1200),
('therapy-90', 'demo-tenant', 'therapy', 90, 1700),
('therapy-120', 'demo-tenant', 'therapy', 120, 2200),
('neck-30', 'demo-tenant', 'neck', 30, 700),
('neck-60', 'demo-tenant', 'neck', 60, 1200),
('neck-90', 'demo-tenant', 'neck', 90, 1700),
('deep-90', 'demo-tenant', 'deep', 90, 1900),
('deep-120', 'demo-tenant', 'deep', 120, 2500);
