import { requireTenantContext } from "../../runtime/tenant-context.js";
import { validateBookingListFilters } from "./booking-validation.js";
import { toBookingView } from "./booking-mapper.js";

export function createBookingDomain({ bookingRepository } = {}) {
  return {
    validateListFilters: validateBookingListFilters,
    toBookingView,
    async listBookings(context, filters = {}) {
      const tenant = requireTenantContext(context?.tenantContext || { tenantId: context?.tenantId, isResolved: Boolean(context?.tenantId) });
      const today = String(filters.today || "").trim();
      const normalized = validateBookingListFilters(filters, today);
      const rows = await bookingRepository.listMerchantBookings(tenant.tenantId, normalized);
      const limitedStaff = await bookingRepository.listPlanLimitedStaff(tenant.tenantId);
      const affectedRows = await bookingRepository.listAffectedPlanLimitedBookings(tenant.tenantId, today || normalized.dateFrom);
      return {
        bookings: rows.map(toBookingView),
        planLimited: {
          affectedBookings: affectedRows.map(toBookingView),
          staff: limitedStaff
        },
        filters: normalized
      };
    },
    async getBooking(context, bookingId) {
      const tenant = requireTenantContext(context?.tenantContext || { tenantId: context?.tenantId, isResolved: Boolean(context?.tenantId) });
      const row = await bookingRepository.findById(tenant.tenantId, bookingId);
      return row ? toBookingView(row) : null;
    }
  };
}
