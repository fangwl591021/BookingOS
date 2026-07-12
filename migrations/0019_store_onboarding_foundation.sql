-- Store onboarding foundation: clean initial schema for new tenants.
ALTER TABLE tenants ADD COLUMN brand_name TEXT;
ALTER TABLE tenants ADD COLUMN brand_primary_color TEXT;
ALTER TABLE tenants ADD COLUMN email TEXT;
ALTER TABLE tenants ADD COLUMN onboarding_status TEXT NOT NULL DEFAULT 'draft' CHECK (onboarding_status IN ('draft', 'completed'));
ALTER TABLE tenants ADD COLUMN onboarding_completed_at TEXT;

ALTER TABLE business_settings ADD COLUMN weekly_hours_json TEXT NOT NULL DEFAULT '{}';
