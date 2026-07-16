import { requireTenantId } from "./guards.js";

export function createStaffRepository(db) {
  return {
    async listActive(tenantId) {
      const scopedTenantId = requireTenantId(tenantId);
      if (!db) return [];
      const rows = await db.prepare("SELECT id, name, role, service_ids, sort_order FROM staff_members WHERE tenant_id = ? AND enabled = 1 AND COALESCE(plan_booking_status, 'active') = 'active' ORDER BY sort_order, name").bind(scopedTenantId).all();
      return rows.results || [];
    }
  };
}

