CREATE TABLE IF NOT EXISTS guest_cancel_observation_daily (
  day TEXT NOT NULL,
  rollout_mode TEXT NOT NULL CHECK (rollout_mode IN ('off', 'write', 'verify', 'enforce')),
  event_type TEXT NOT NULL,
  result TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  path_type TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (
    day,
    rollout_mode,
    event_type,
    result,
    reason_code,
    path_type
  )
);

CREATE INDEX IF NOT EXISTS idx_guest_cancel_observation_daily_event
  ON guest_cancel_observation_daily(event_type, day);

CREATE INDEX IF NOT EXISTS idx_guest_cancel_observation_daily_sunset
  ON guest_cancel_observation_daily(day, event_type, result, path_type);
