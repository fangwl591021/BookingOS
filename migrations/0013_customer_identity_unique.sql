-- BookingOS Task 011 customer identity uniqueness.
-- Safe only after local and remote duplicate audits return no rows.

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_tenant_identity_unique
ON customers(tenant_id, identity_id)
WHERE identity_id IS NOT NULL;