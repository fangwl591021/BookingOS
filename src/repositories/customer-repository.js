import { requireTenantId } from "./guards.js";

export function createCustomerRepository(db) {
  return {
    async findById(tenantId, customerId) {
      const scopedTenantId = requireTenantId(tenantId);
      if (!db || !customerId) return null;
      return db.prepare("SELECT * FROM customers WHERE tenant_id = ? AND id = ? LIMIT 1").bind(scopedTenantId, customerId).first();
    }
  };
}

