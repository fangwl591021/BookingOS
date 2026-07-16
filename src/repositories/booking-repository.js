import { requireTenantId } from "./guards.js";

export function createBookingRepository(db) {
  return {
    async findById(tenantId, bookingId) {
      const scopedTenantId = requireTenantId(tenantId);
      if (!db || !bookingId) return null;
      return db.prepare("SELECT * FROM bookings WHERE tenant_id = ? AND id = ? LIMIT 1").bind(scopedTenantId, bookingId).first();
    },
    async listByDateRange(tenantId, range = {}) {
      const scopedTenantId = requireTenantId(tenantId);
      if (!db) return [];
      const start = String(range.start || "");
      const end = String(range.end || start || "");
      const rows = await db.prepare("SELECT * FROM bookings WHERE tenant_id = ? AND booking_date >= ? AND booking_date <= ? ORDER BY booking_date, start_time").bind(scopedTenantId, start, end).all();
      return rows.results || [];
    }
  };
}

