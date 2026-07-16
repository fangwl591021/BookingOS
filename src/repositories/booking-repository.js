import { requireTenantId } from "./guards.js";

const BOOKING_SELECT = `
  SELECT b.*, s.name AS staff_name, sv.name AS service_name,
         rt.name AS resource_type_name, c.name AS customer_name, c.phone AS customer_phone
  FROM bookings b
  LEFT JOIN staff_members s ON s.id = b.staff_id AND s.tenant_id = b.tenant_id
  LEFT JOIN services sv ON sv.id = b.service_id AND sv.tenant_id = b.tenant_id
  LEFT JOIN resource_types rt ON rt.id = b.resource_id AND rt.tenant_id = b.tenant_id
  LEFT JOIN customers c ON c.id = b.customer_id AND c.tenant_id = b.tenant_id
`;

export function createBookingRepository(db) {
  return {
    async findById(tenantId, bookingId) {
      const scopedTenantId = requireTenantId(tenantId);
      if (!db || !bookingId) return null;
      return db.prepare(BOOKING_SELECT + " WHERE b.tenant_id = ? AND b.id = ? LIMIT 1").bind(scopedTenantId, bookingId).first();
    },
    async listByDateRange(tenantId, range = {}) {
      const scopedTenantId = requireTenantId(tenantId);
      if (!db) return [];
      const start = String(range.start || "");
      const end = String(range.end || start || "");
      const rows = await db.prepare("SELECT * FROM bookings WHERE tenant_id = ? AND booking_date >= ? AND booking_date <= ? ORDER BY booking_date, start_time").bind(scopedTenantId, start, end).all();
      return rows.results || [];
    },
    async listMerchantBookings(tenantId, filters = {}) {
      const scopedTenantId = requireTenantId(tenantId);
      if (!db) return [];
      const clauses = ["b.tenant_id = ?"];
      const binds = [scopedTenantId];
      if (filters.date) {
        clauses.push("b.booking_date = ?");
        binds.push(filters.date);
      } else {
        clauses.push("b.booking_date >= ?");
        clauses.push("b.booking_date <= ?");
        binds.push(filters.dateFrom, filters.dateTo);
      }
      if (filters.status && filters.status !== "all") {
        clauses.push("b.status = ?");
        binds.push(filters.status);
      }
      if (filters.staffId) {
        clauses.push("b.staff_id = ?");
        binds.push(filters.staffId);
      }
      if (filters.serviceId) {
        clauses.push("b.service_id = ?");
        binds.push(filters.serviceId);
      }
      if (!filters.includeCancelled) {
        clauses.push("b.status != 'cancelled'");
      }
      if (filters.keyword) {
        clauses.push("(c.name LIKE ? OR c.phone LIKE ? OR b.customer_name LIKE ? OR b.customer_phone LIKE ?)");
        const keyword = "%" + filters.keyword + "%";
        binds.push(keyword, keyword, keyword, keyword);
      }
      const limit = Number(filters.limit || 80);
      const offset = Math.max(0, Number(filters.page || 1) - 1) * limit;
      binds.push(limit, offset);
      const rows = await db.prepare(BOOKING_SELECT + " WHERE " + clauses.join(" AND ") + " ORDER BY b.booking_date DESC, b.start_time DESC LIMIT ? OFFSET ?").bind(...binds).all();
      return rows.results || [];
    },
    async listPlanLimitedStaff(tenantId) {
      const scopedTenantId = requireTenantId(tenantId);
      if (!db) return [];
      const rows = await db.prepare("SELECT id, name FROM staff_members WHERE tenant_id = ? AND enabled = 1 AND COALESCE(plan_booking_status, 'active') = 'plan_limited'").bind(scopedTenantId).all();
      return rows.results || [];
    },
    async listAffectedPlanLimitedBookings(tenantId, today) {
      const scopedTenantId = requireTenantId(tenantId);
      if (!db) return [];
      const rows = await db.prepare(`
        SELECT b.id, b.booking_date, b.start_time, b.staff_id, s.name AS staff_name
        FROM bookings b
        JOIN staff_members s ON s.id = b.staff_id AND s.tenant_id = b.tenant_id
        WHERE b.tenant_id = ?
          AND b.status != 'cancelled'
          AND b.booking_date >= ?
          AND s.enabled = 1
          AND COALESCE(s.plan_booking_status, 'active') = 'plan_limited'
        ORDER BY b.booking_date, b.start_time
      `).bind(scopedTenantId, today).all();
      return rows.results || [];
    }
  };
}
