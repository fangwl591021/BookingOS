import { requireTenantContext } from "../../runtime/tenant-context.js";
import { validateStaffListOptions } from "./staff-validation.js";
import { toStaffView } from "./staff-mapper.js";

export function createStaffDomain({ staffRepository } = {}) {
  return {
    validateListOptions: validateStaffListOptions,
    toStaffView,
    async listStaff(context, options = {}) {
      const tenant = requireTenantContext(context?.tenantContext || { tenantId: context?.tenantId, isResolved: Boolean(context?.tenantId) });
      const normalized = validateStaffListOptions(options);
      const rows = normalized.includeDisabled ? await staffRepository.listAll(tenant.tenantId) : await staffRepository.listActive(tenant.tenantId);
      return rows.map(toStaffView);
    },
    async getStaff(context, staffId) {
      const tenant = requireTenantContext(context?.tenantContext || { tenantId: context?.tenantId, isResolved: Boolean(context?.tenantId) });
      const row = await staffRepository.findById(tenant.tenantId, staffId);
      return row ? toStaffView(row) : null;
    }
  };
}
