import { requireTenantId } from "./guards.js";

export function createStaffRepository(db) {
  async function listStaff(tenantId, { includeDisabled = false } = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    if (!db) return [];
    const filter = includeDisabled ? "" : " AND enabled = 1";
    const rows = await db.prepare("SELECT id, name, avatar_url, phone, email, role, enabled, sort_order, service_ids, crm_permissions, COALESCE(plan_booking_status, 'active') AS plan_booking_status FROM staff_members WHERE tenant_id = ?" + filter + " ORDER BY sort_order, name").bind(scopedTenantId).all();
    return rows.results || [];
  }

  return {
    async listActive(tenantId) {
      const rows = await listStaff(tenantId, { includeDisabled: false });
      return rows.filter((row) => String(row.plan_booking_status || "active") === "active");
    },
    async listAll(tenantId) {
      return listStaff(tenantId, { includeDisabled: true });
    },
    async findById(tenantId, staffId) {
      const scopedTenantId = requireTenantId(tenantId);
      if (!db || !staffId) return null;
      return db.prepare("SELECT id, name, avatar_url, phone, email, role, enabled, sort_order, service_ids, crm_permissions, COALESCE(plan_booking_status, 'active') AS plan_booking_status FROM staff_members WHERE tenant_id = ? AND id = ? LIMIT 1").bind(scopedTenantId, staffId).first();
    },
    async listServicesForStaff(tenantId, staffId) {
      const staff = await this.findById(tenantId, staffId);
      if (!staff?.service_ids) return null;
      try {
        const parsed = JSON.parse(staff.service_ids);
        return Array.isArray(parsed) ? parsed : null;
      } catch (_error) {
        return String(staff.service_ids).split(",").map((item) => item.trim()).filter(Boolean);
      }
    }
  };
}
