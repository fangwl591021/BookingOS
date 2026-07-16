import { requireTenantId } from "./guards.js";

const ALLOWED_EVENT_TYPES = new Set(["merchant_note_updated", "customer_updated"]);

export function createBookingEventRepository(db) {
  return {
    async listByBookingId(tenantId, bookingId) {
      const scopedTenantId = requireTenantId(tenantId);
      if (!db || !bookingId) return [];
      const rows = await db.prepare("SELECT event_type, from_status, to_status, actor_type, reason, metadata_json, created_at FROM booking_events WHERE tenant_id = ? AND booking_id = ? ORDER BY created_at ASC").bind(scopedTenantId, bookingId).all();
      return rows.results || [];
    },
    async append(event = {}) {
      const scopedTenantId = requireTenantId(event.tenantId);
      if (!db || !event.bookingId) return { meta: { changes: 0 } };
      if (!ALLOWED_EVENT_TYPES.has(String(event.eventType || ""))) return { meta: { changes: 0 } };
      return db.prepare("INSERT INTO booking_events (id, tenant_id, booking_id, event_type, from_status, to_status, actor_type, actor_id, reason, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))")
        .bind(
          crypto.randomUUID(),
          scopedTenantId,
          event.bookingId,
          event.eventType,
          event.fromStatus || null,
          event.toStatus || null,
          event.actorType || "merchant",
          event.actorId || null,
          event.reason || null,
          event.metadata ? JSON.stringify(event.metadata) : null
        )
        .run();
    }
  };
}
