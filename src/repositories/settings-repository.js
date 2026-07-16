import { requireTenantId } from "./guards.js";

export function createSettingsRepository(db) {
  return {
    async getTenantSettings(tenantId) {
      const scopedTenantId = requireTenantId(tenantId);
      if (!db) return null;
      return db.prepare(`
        SELECT t.id, t.name, t.slug, t.status, t.timezone, t.brand_name, t.brand_primary_color,
               t.phone, t.email, t.address, t.logo_url, t.onboarding_status,
               bs.weekly_hours_json, bs.allow_overtime_booking, bs.slot_step_minutes
        FROM tenants t
        LEFT JOIN business_settings bs ON bs.tenant_id = t.id
        WHERE t.id = ?
        LIMIT 1
      `).bind(scopedTenantId).first();
    }
  };
}

