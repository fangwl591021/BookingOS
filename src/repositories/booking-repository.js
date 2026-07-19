import { requireTenantId } from "./guards.js";

const BOOKING_SELECT = `
  SELECT b.*, s.name AS staff_name, sv.name AS service_name,
         rt.name AS resource_type_name, c.name AS customer_name, c.phone AS customer_phone, COALESCE(c.identity_id, '') AS customer_identity_id
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
    async findOperationById(tenantId, bookingId) {
      const scopedTenantId = requireTenantId(tenantId);
      if (!db || !bookingId) return null;
      return db.prepare(`
        SELECT b.*, COALESCE(sm.name, b.staff_id) AS staff_name, COALESCE(s.resource_type_id, '') AS resource_type_id, COALESCE(c.identity_id, '') AS customer_identity_id
        FROM bookings b
        LEFT JOIN staff_members sm ON sm.id = b.staff_id AND sm.tenant_id = b.tenant_id
        LEFT JOIN services s ON s.id = b.service_id AND s.tenant_id = b.tenant_id
        LEFT JOIN customers c ON c.id = b.customer_id AND c.tenant_id = b.tenant_id
        WHERE b.tenant_id = ? AND b.id = ?
      `).bind(scopedTenantId, bookingId).first();
    },
    async updateMerchantNote(tenantId, bookingId, input = {}) {
      const scopedTenantId = requireTenantId(tenantId);
      if (!db || !bookingId) return { meta: { changes: 0 } };
      const expectedUpdatedAt = String(input.expectedUpdatedAt || "").trim();
      return db.prepare(`UPDATE bookings SET merchant_note = ?, updated_at = ? WHERE tenant_id = ? AND id = ?${expectedUpdatedAt ? " AND updated_at = ?" : ""}`)
        .bind(input.note || "", input.updatedAt, scopedTenantId, bookingId, ...(expectedUpdatedAt ? [expectedUpdatedAt] : []))
        .run();
    },
    async updateCustomerInfo(tenantId, bookingId, input = {}) {
      const scopedTenantId = requireTenantId(tenantId);
      if (!db || !bookingId) return { meta: { changes: 0 } };
      const expectedUpdatedAt = String(input.expectedUpdatedAt || "").trim();
      return db.prepare(`UPDATE bookings SET customer_name = ?, customer_phone = ?, updated_at = ? WHERE tenant_id = ? AND id = ?${expectedUpdatedAt ? " AND updated_at = ?" : ""}`)
        .bind(input.customerName || "", input.customerPhone || null, input.updatedAt, scopedTenantId, bookingId, ...(expectedUpdatedAt ? [expectedUpdatedAt] : []))
        .run();
    },
    async updateStatus(tenantId, bookingId, input = {}) {
      const scopedTenantId = requireTenantId(tenantId);
      if (!db || !bookingId) return { meta: { changes: 0 } };
      const expectedUpdatedAt = String(input.expectedUpdatedAt || "").trim();
      const setParts = ["status = ?", "updated_at = ?"];
      if (input.toStatus === "checked_in") setParts.push("checked_in_at = COALESCE(checked_in_at, datetime('now'))");
      if (input.toStatus === "in_service") setParts.push("service_started_at = COALESCE(service_started_at, datetime('now'))");
      if (input.toStatus === "completed") setParts.push("completed_at = COALESCE(completed_at, datetime('now'))");
      return db.prepare(`UPDATE bookings SET ${setParts.join(", ")} WHERE tenant_id = ? AND id = ? AND status = ?${expectedUpdatedAt ? " AND updated_at = ?" : ""}`)
        .bind(input.toStatus, input.updatedAt, scopedTenantId, bookingId, input.fromStatus, ...(expectedUpdatedAt ? [expectedUpdatedAt] : []))
        .run();
    },
    async cancelMerchantStatus(tenantId, bookingId, input = {}) {
      const scopedTenantId = requireTenantId(tenantId);
      if (!db || !bookingId) return { meta: { changes: 0 } };
      const expectedUpdatedAt = String(input.expectedUpdatedAt || "").trim();
      return db.prepare(`UPDATE bookings SET status = ?, updated_at = ?, cancelled_at = COALESCE(cancelled_at, datetime('now')), cancelled_by = COALESCE(cancelled_by, 'merchant'), cancel_reason = COALESCE(NULLIF(?, ''), cancel_reason) WHERE tenant_id = ? AND id = ? AND status = ?${expectedUpdatedAt ? " AND updated_at = ?" : ""}`)
        .bind(input.toStatus, input.updatedAt, input.reason || "", scopedTenantId, bookingId, input.fromStatus, ...(expectedUpdatedAt ? [expectedUpdatedAt] : []))
        .run();
    },
    async cancelCustomerStatus(tenantId, bookingId, input = {}) {
      const scopedTenantId = requireTenantId(tenantId);
      if (!db || !bookingId || !input.customerId) return { meta: { changes: 0 } };
      return db.prepare("UPDATE bookings SET status = 'cancelled', cancelled_at = COALESCE(cancelled_at, datetime('now')), cancelled_by = COALESCE(cancelled_by, 'customer'), cancel_reason = COALESCE(NULLIF(?, ''), cancel_reason), updated_at = ? WHERE tenant_id = ? AND id = ? AND customer_id = ? AND status = ?")
        .bind(input.reason || "", input.updatedAt, scopedTenantId, bookingId, input.customerId, input.fromStatus)
        .run();
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
