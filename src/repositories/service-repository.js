import { requireTenantId } from "./guards.js";

export function createServiceRepository(db) {
  return {
    async listActive(tenantId) {
      const scopedTenantId = requireTenantId(tenantId);
      if (!db) return [];
      const rows = await db.prepare("SELECT id, name, category, sort_order FROM services WHERE tenant_id = ? AND enabled = 1 ORDER BY sort_order, name").bind(scopedTenantId).all();
      return rows.results || [];
    }
  };
}

