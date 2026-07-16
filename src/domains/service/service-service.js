import { requireTenantContext } from "../../runtime/tenant-context.js";
import { validateServiceListOptions } from "./service-validation.js";
import { toServiceView } from "./service-mapper.js";

export function createServiceDomain({ serviceRepository } = {}) {
  return {
    validateListOptions: validateServiceListOptions,
    toServiceView,
    async listServices(context, options = {}) {
      const tenant = requireTenantContext(context?.tenantContext || { tenantId: context?.tenantId, isResolved: Boolean(context?.tenantId) });
      const normalized = validateServiceListOptions(options);
      const rows = normalized.includeDisabled ? await serviceRepository.listAll(tenant.tenantId) : await serviceRepository.listActive(tenant.tenantId);
      return rows.map(toServiceView);
    },
    async getService(context, serviceId) {
      const tenant = requireTenantContext(context?.tenantContext || { tenantId: context?.tenantId, isResolved: Boolean(context?.tenantId) });
      const row = await serviceRepository.findById(tenant.tenantId, serviceId);
      return row ? toServiceView(row) : null;
    }
  };
}
