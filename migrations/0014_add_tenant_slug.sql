ALTER TABLE tenants ADD COLUMN slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_slug_unique
ON tenants(slug)
WHERE slug IS NOT NULL AND slug != '';

UPDATE tenants
SET slug = 'anhe', updated_at = datetime('now')
WHERE id = 'demo-tenant'
  AND (slug IS NULL OR slug = '');
