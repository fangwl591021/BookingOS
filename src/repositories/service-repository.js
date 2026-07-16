import { requireTenantId } from "./guards.js";

export function createServiceRepository(db) {
  async function listServices(tenantId, { includeDisabled = false } = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    if (!db) return [];
    const durationJoin = includeDisabled ? "LEFT JOIN service_durations d ON d.service_id = s.id AND d.tenant_id = s.tenant_id" : "JOIN service_durations d ON d.service_id = s.id AND d.tenant_id = s.tenant_id AND d.enabled = 1";
    const serviceFilter = includeDisabled ? "" : " AND s.enabled = 1";
    const rows = await db.prepare("SELECT s.id, s.name, s.category, s.enabled AS service_enabled, s.sort_order, s.resource_type_id, rt.name AS resource_type_name, s.point_redeem_limit, d.minutes, d.price, d.enabled AS duration_enabled FROM services s " + durationJoin + " LEFT JOIN resource_types rt ON rt.id = s.resource_type_id AND rt.tenant_id = s.tenant_id WHERE s.tenant_id = ?" + serviceFilter + " ORDER BY s.sort_order, s.name, d.minutes").bind(scopedTenantId).all();
    const grouped = new Map();
    for (const row of rows.results || []) {
      if (!grouped.has(row.id)) grouped.set(row.id, { id: row.id, name: row.name, category: row.category || "", enabled: Number(row.service_enabled || 0) === 1, sortOrder: Number(row.sort_order || 0), resourceTypeId: row.resource_type_id || "", resourceTypeName: row.resource_type_name || "", pointRedeemLimit: Number(row.point_redeem_limit || 0), prices: [] });
      if (row.minutes !== null && row.minutes !== undefined) grouped.get(row.id).prices.push({ minutes: Number(row.minutes), price: Number(row.price || 0), enabled: Number(row.duration_enabled ?? 1) === 1 });
    }
    return Array.from(grouped.values());
  }

  return {
    async listActive(tenantId) {
      return listServices(tenantId, { includeDisabled: false });
    },
    async listAll(tenantId) {
      return listServices(tenantId, { includeDisabled: true });
    },
    async findById(tenantId, serviceId) {
      const services = await listServices(tenantId, { includeDisabled: true });
      return services.find((service) => service.id === serviceId) || null;
    },
    async listDurations(tenantId, serviceId) {
      const service = await this.findById(tenantId, serviceId);
      return service?.prices || [];
    }
  };
}
