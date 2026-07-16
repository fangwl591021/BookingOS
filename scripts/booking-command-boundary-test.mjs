import assert from "node:assert/strict";
import app from "../src/index.js";
import { createTenantContext } from "../src/runtime/tenant-context.js";
import { createIdempotencyEnvelope } from "../src/runtime/idempotency-envelope.js";
import { createBookingCommandService } from "../src/domains/booking/index.js";
import { createBookingRepository } from "../src/repositories/booking-repository.js";
import { createBookingEventRepository } from "../src/repositories/booking-event-repository.js";
import { validateMerchantNoteCommand, sanitizeBookingEventMetadata, isB4BookingStatusTransition, isB5MerchantCancellationTransition } from "../src/domains/booking/booking-command-validation.js";

const SESSION_SECRET = "booking-command-secret";

function base64Url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function hmacBase64Url(secret, payloadSegment) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadSegment));
  return Buffer.from(signature).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function merchantCookie(tenantId = "tenant-a") {
  const now = Math.floor(Date.now() / 1000);
  const payload = { v: 1, sub: "identity-a", tenant_id: tenantId, role: "owner", iat: now, exp: now + 3600 };
  const payloadSegment = base64Url(JSON.stringify(payload));
  return "bookingos_merchant_session=" + encodeURIComponent(payloadSegment + "." + await hmacBase64Url(SESSION_SECRET, payloadSegment));
}

function makeBooking(overrides = {}) {
  return {
    id: "booking-1",
    tenant_id: "tenant-a",
    booking_date: "2026-07-16",
    start_time: "09:00",
    end_time: "10:00",
    status: "pending",
    staff_id: "staff-1",
    staff_name: "Tony",
    service_id: "svc-1",
    service_name: "Service A",
    resource_type_id: "room",
    duration_minutes: 60,
    price: 1200,
    customer_id: "",
    customer_name: "Guest A",
    customer_phone: "0912345678",
    merchant_note: "",
    source: "web",
    updated_at: "2026-07-16T00:00:00Z",
    checked_in_at: null,
    service_started_at: null,
    completed_at: null,
    cancelled_at: null,
    cancelled_by: null,
    cancel_reason: null,
    ...overrides
  };
}

function routeDb(options = {}) {
  const calls = [];
  const booking = options.booking === undefined ? makeBooking() : options.booking;
  const events = options.events ? [...options.events] : [{ event_type: "created", from_status: null, to_status: "pending", actor_type: "customer", reason: null, metadata_json: "{}", created_at: "2026-07-16 09:00:00" }];
  function rowForBooking(binds) {
    if (!booking || binds[0] !== "tenant-a" || binds[1] !== booking.id) return null;
    return { ...booking };
  }
  function exec(sql, binds) {
    if (sql.includes("FROM tenant_admins a JOIN identities")) {
      return { results: [{ admin_id: "admin-a", identity_id: "identity-a", tenant_id: "tenant-a", role: "owner", admin_status: "active", identity_status: "active", tenant_status: options.tenantStatus || "active", tenant_name: "Tenant A", contract_start: options.contractStart || "2026-07-01", contract_end: options.contractEnd || "2027-07-01", billing_plan_id: "solo", staff_limit: 2, active_staff_count: 1 }] };
    }
    if (sql.includes("FROM tenants t WHERE t.id = ?")) {
      return { results: [{ name: "Tenant A", status: options.tenantStatus || "active", contract_start: options.contractStart || "2026-07-01", contract_end: options.contractEnd || "2027-07-01", billing_plan_id: "solo", staff_limit: 2, booking_enabled: 1, active_staff_count: 1, active_booking_staff_count: 1 }] };
    }
    if (sql.includes("FROM bookings b") && sql.includes("WHERE b.tenant_id = ? AND b.id = ?")) {
      const row = rowForBooking(binds);
      return { results: row ? [row] : [] };
    }
    if (sql.includes("FROM bookings WHERE tenant_id") && sql.includes("AND id") && sql.includes("LIMIT 1")) {
      const row = rowForBooking(binds);
      return { results: row ? [row] : [] };
    }
    if (sql.startsWith("UPDATE bookings SET merchant_note")) {
      if (options.throwUpdate) throw new Error("SQLITE_CONSTRAINT: hidden sql details");
      if (options.updateChanges === 0) return { meta: { changes: 0 } };
      booking.merchant_note = binds[0];
      booking.updated_at = binds[1];
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith("UPDATE bookings SET customer_name")) {
      if (options.updateChanges === 0) return { meta: { changes: 0 } };
      booking.customer_name = binds[0];
      booking.customer_phone = binds[1];
      booking.updated_at = binds[2];
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith("UPDATE bookings SET status")) {
      if (options.statusUpdateChanges === 0) return { meta: { changes: 0 } };
      const hasCancelReason = sql.includes("cancel_reason");
      const tenantIndex = hasCancelReason ? 3 : 2;
      const expectedUpdatedAt = sql.includes("AND updated_at = ?") ? binds.at(-1) : "";
      if (binds[tenantIndex] !== "tenant-a" || binds[tenantIndex + 1] !== booking.id || binds[tenantIndex + 2] !== booking.status) return { meta: { changes: 0 } };
      if (expectedUpdatedAt && expectedUpdatedAt !== booking.updated_at) return { meta: { changes: 0 } };
      booking.status = binds[0];
      booking.updated_at = binds[1];
      if (sql.includes("checked_in_at")) booking.checked_in_at ||= "2026-07-16 10:00:00";
      if (sql.includes("service_started_at")) booking.service_started_at ||= "2026-07-16 10:00:00";
      if (sql.includes("completed_at")) booking.completed_at ||= "2026-07-16 10:00:00";
      if (hasCancelReason) {
        booking.cancelled_at ||= "2026-07-16 10:00:00";
        booking.cancelled_by ||= "merchant";
        booking.cancel_reason ||= binds[2] || null;
      }
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith("INSERT INTO booking_events")) {
      events.push({ event_type: binds[3], from_status: binds[4], to_status: binds[5], actor_type: binds[6], actor_id: binds[7], reason: binds[8], metadata_json: binds[9], created_at: "2026-07-16 10:00:00" });
      return { meta: { changes: 1 } };
    }
    if (sql.includes("FROM booking_events")) {
      if (options.throwEvents) throw new Error("SELECT * FROM secret failure");
      return { results: events };
    }
    if (sql.startsWith("INSERT OR IGNORE INTO line_notification_deliveries")) {
      if (options.throwNotificationInsert) throw new Error("notification unavailable");
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith("UPDATE line_notification_deliveries")) return { meta: { changes: 1 } };
    if (sql.includes("SELECT line_user_id FROM customers")) return { results: options.lineUid ? [{ line_user_id: options.lineUid }] : [] };
    if (sql.includes("point_transactions")) return { results: [{ points: 0 }] };
    if (sql.startsWith("UPDATE customers SET")) return { meta: { changes: 1 } };
    if (sql.includes("FROM line_oa_settings")) return { results: [] };
    return { results: [] };
  }
  return {
    calls,
    booking,
    events,
    prepare(sql) {
      return {
        bind(...binds) {
          calls.push({ sql, binds });
          return {
            all: async () => exec(sql, binds),
            first: async () => (exec(sql, binds).results || [])[0] || null,
            run: async () => exec(sql, binds)
          };
        }
      };
    }
  };
}

function env(db) {
  return { DB: db, MERCHANT_SESSION_SECRET: SESSION_SECRET, MERCHANT_SESSION_TTL_SECONDS: "3600" };
}

async function routeJson(path, db, payload = {}, headers = {}, tenantId = "tenant-a") {
  const request = new Request("https://example.test" + path, { method: "POST", headers: { cookie: await merchantCookie(tenantId), "content-type": "application/json", ...headers }, body: JSON.stringify(payload) });
  const response = await app.fetch(request, env(db), {});
  return { response, body: JSON.parse(await response.text()) };
}

async function publicRouteJson(path, db, payload = {}, headers = {}) {
  const request = new Request("https://example.test" + path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(payload) });
  const response = await app.fetch(request, env(db), {});
  return { response, body: JSON.parse(await response.text()) };
}

function commandContext() {
  return { tenantContext: createTenantContext({ tenantId: "tenant-a", source: "test" }), authContext: { actor: { type: "merchant", id: "merchant" } }, logger: { error() {} } };
}

function countSql(db, fragment) {
  return db.calls.filter((call) => call.sql.includes(fragment)).length;
}

function firstSqlIndex(db, fragment) {
  return db.calls.findIndex((call) => call.sql.includes(fragment));
}

async function statusRoute(status, options = {}, payload = {}) {
  const db = routeDb(options);
  const result = await routeJson("/api/merchant/bookings/booking-1/status", db, { status, expected_updated_at: options.booking?.updated_at || "2026-07-16T00:00:00Z", ...payload });
  return { db, ...result };
}

assert.equal(validateMerchantNoteCommand({ note: "x".repeat(1001) }).note.length, 1000);
assert.deepEqual(sanitizeBookingEventMetadata({ token: "secret", cookie: "session", oldName: "A", lineUid: "U123" }), { oldName: "A" });
assert.equal(isB4BookingStatusTransition("pending", "confirmed"), true);
assert.equal(isB4BookingStatusTransition("checked_in", "completed"), false);
assert.equal(isB4BookingStatusTransition("pending", "cancelled"), false);
assert.equal(isB5MerchantCancellationTransition("pending", "cancelled"), true);
assert.equal(isB5MerchantCancellationTransition("confirmed", "cancelled"), true);
assert.equal(isB5MerchantCancellationTransition("checked_in", "cancelled"), true);
assert.equal(isB5MerchantCancellationTransition("in_service", "cancelled"), false);
const envelope = createIdempotencyEnvelope(new Request("https://example.test", { headers: { "Idempotency-Key": "idem-1", "X-Request-Id": "req-1" } }), { source: "test" });
assert.equal(envelope.key, "idem-1");
assert.equal(envelope.persistence, "not_implemented");

{
  const db = routeDb();
  let appended = null;
  const service = createBookingCommandService({ bookingRepository: createBookingRepository(db), bookingEventRepository: createBookingEventRepository(db) });
  const result = await service.updateBookingStatus(commandContext(), { bookingId: "booking-1", fromStatus: "pending", status: "confirmed", expectedUpdatedAt: "2026-07-16T00:00:00Z", appendStatusEvent: async (event) => { appended = event; } });
  assert.equal(result.ok, true);
  assert.equal(result.booking.status, "confirmed");
  assert.equal(appended.eventType, "status_changed");
  assert.equal(appended.fromStatus, "pending");
  assert.equal(appended.toStatus, "confirmed");
}
{
  const db = routeDb();
  const service = createBookingCommandService({ bookingRepository: createBookingRepository(db), bookingEventRepository: createBookingEventRepository(db) });
  const result = await service.updateMerchantNote(commandContext(), { bookingId: "booking-1", note: "internal note", expectedUpdatedAt: "2026-07-16T00:00:00Z" });
  assert.equal(result.ok, true);
  assert.equal(result.booking.merchant_note, "internal note");
  assert.equal(db.events.at(-1).event_type, "merchant_note_updated");
}
{
  const db = routeDb();
  const { response, body } = await routeJson("/api/merchant/bookings/booking-1/note", db, { note: "Route note", expected_updated_at: "2026-07-16T00:00:00Z" }, { "Idempotency-Key": "route-note-1" });
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(body), ["ok", "booking"]);
  assert.equal(body.booking.merchant_note, "Route note");
  assert.equal(db.events.at(-1).event_type, "merchant_note_updated");
  assert.equal(countSql(db, "UPDATE bookings SET merchant_note"), 1);
}
{
  const db = routeDb();
  const { response, body } = await routeJson("/api/merchant/bookings/booking-1/note", db, { note: "x".repeat(1001), expected_updated_at: "2026-07-16T00:00:00Z" });
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(body), ["ok", "booking"]);
  assert.equal(body.booking.merchant_note.length, 1000);
  assert.equal(countSql(db, "UPDATE bookings SET merchant_note"), 1);
  assert.equal(db.events.at(-1).event_type, "merchant_note_updated");
}
{
  const db = routeDb();
  const { response, body } = await routeJson("/api/merchant/bookings/booking-1/customer", db, { customer_name: "Alice", customer_phone: "0987654321", expected_updated_at: "2026-07-16T00:00:00Z" });
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(body), ["ok", "booking"]);
  assert.equal(body.booking.customer_name, "Alice");
  assert.equal(db.events.at(-1).event_type, "customer_updated");
  assert.equal(JSON.parse(db.events.at(-1).metadata_json).phoneChanged, true);
}
{
  const db = routeDb();
  const { response, body } = await routeJson("/api/merchant/bookings/booking-1/customer", db, { customer_name: "", expected_updated_at: "2026-07-16T00:00:00Z" });
  assert.equal(response.status, 400);
  assert.equal(body.error.code, "CUSTOMER_NAME_REQUIRED");
  assert.equal(countSql(db, "UPDATE bookings SET customer_name"), 0);
}
{
  const { db, response, body } = await statusRoute("confirmed");
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(body), ["ok", "booking"]);
  assert.equal(body.booking.status, "confirmed");
  assert.equal(db.events.at(-1).event_type, "status_changed");
  assert.equal(db.events.at(-1).from_status, "pending");
  assert.equal(db.events.at(-1).to_status, "confirmed");
  assert.equal(countSql(db, "INSERT OR IGNORE INTO line_notification_deliveries"), 1, "confirmed notification adapter path remains active");
}
{
  const { db, response, body } = await statusRoute("confirmed", { throwNotificationInsert: true });
  assert.equal(response.status, 200);
  assert.equal(body.booking.status, "confirmed");
  assert.equal(db.events.at(-1).event_type, "status_changed", "event insert happens before notification failure is swallowed");
}
{
  const { db, response, body } = await statusRoute("checked_in", { booking: makeBooking({ status: "confirmed" }) });
  assert.equal(response.status, 200);
  assert.equal(body.booking.status, "checked_in");
  assert.ok(db.booking.checked_in_at);
  assert.equal(countSql(db, "INSERT OR IGNORE INTO line_notification_deliveries"), 0);
}
{
  const { db, response, body } = await statusRoute("in_service", { booking: makeBooking({ status: "checked_in" }) });
  assert.equal(response.status, 200);
  assert.equal(body.booking.status, "in_service");
  assert.ok(db.booking.service_started_at);
}
{
  const { db, response, body } = await statusRoute("completed", { booking: makeBooking({ status: "in_service" }) });
  assert.equal(response.status, 200);
  assert.equal(body.booking.status, "completed");
  assert.ok(db.booking.completed_at);
}
{
  const { response, body } = await statusRoute("no_show", { booking: makeBooking({ status: "confirmed" }) });
  assert.equal(response.status, 200);
  assert.equal(body.booking.status, "no_show");
}
for (const terminal of ["completed", "no_show", "cancelled"]) {
  const { response, body } = await statusRoute("confirmed", { booking: makeBooking({ status: terminal }) });
  assert.equal(response.status, 409);
  assert.equal(body.error.code, "INVALID_BOOKING_STATUS_TRANSITION");
}
{
  const { db, response, body } = await statusRoute("completed", { booking: makeBooking({ status: "checked_in" }) });
  assert.equal(response.status, 200);
  assert.equal(body.booking.status, "completed");
  assert.ok(db.booking.completed_at, "checked_in -> completed remains legacy-supported outside B4 command set");
}
{
  const { db, response, body } = await statusRoute("cancelled", { booking: makeBooking({ status: "pending", customer_id: "cust-1" }) }, { reason: "customer request" });
  assert.equal(response.status, 200);
  assert.equal(body.booking.status, "cancelled");
  assert.equal(db.events.at(-1).event_type, "cancelled");
  assert.equal(countSql(db, "point_transactions"), 4, "cancel rollback remains legacy path");
}
{
  const { db, response, body } = await statusRoute("cancelled", { booking: makeBooking({ status: "pending", customer_id: "cust-1" }) }, { reason: "customer request" });
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(body), ["ok", "booking"]);
  assert.equal(body.booking.status, "cancelled");
  assert.equal(db.booking.cancelled_by, "merchant");
  assert.equal(db.booking.cancel_reason, "customer request");
  assert.equal(countSql(db, "point_transactions"), 4, "cancel rollback remains adapter-backed legacy path");
  assert.equal(countSql(db, "INSERT OR IGNORE INTO line_notification_deliveries"), 1, "cancelled notification adapter path remains active");
  const updateIndex = firstSqlIndex(db, "UPDATE bookings SET status");
  const rollbackIndex = firstSqlIndex(db, "UPDATE customers SET total_bookings");
  const eventIndex = firstSqlIndex(db, "INSERT INTO booking_events");
  assert.ok(updateIndex >= 0 && rollbackIndex > updateIndex && eventIndex > rollbackIndex, "merchant cancellation preserves update -> rollback -> event order");
}
{
  const { response, body } = await statusRoute("cancelled", { booking: makeBooking({ status: "confirmed", customer_id: "cust-1" }) });
  assert.equal(response.status, 200);
  assert.equal(body.booking.status, "cancelled");
}
{
  const { response, body } = await statusRoute("cancelled", { booking: makeBooking({ status: "checked_in", customer_id: "cust-1" }) });
  assert.equal(response.status, 200);
  assert.equal(body.booking.status, "cancelled");
}
for (const fromStatus of ["in_service", "completed", "no_show"]) {
  const { db, response, body } = await statusRoute("cancelled", { booking: makeBooking({ status: fromStatus, customer_id: "cust-1" }) });
  assert.equal(response.status, 409, fromStatus);
  assert.equal(body.error.code, "INVALID_BOOKING_STATUS_TRANSITION", fromStatus);
  assert.equal(countSql(db, "point_transactions"), 0);
  assert.equal(firstSqlIndex(db, "INSERT INTO booking_events"), -1);
}
{
  const { db, response, body } = await statusRoute("cancelled", { booking: makeBooking({ status: "cancelled", customer_id: "cust-1" }) });
  assert.equal(response.status, 200);
  assert.equal(body.booking.status, "cancelled");
  assert.equal(countSql(db, "point_transactions"), 0);
  assert.equal(firstSqlIndex(db, "INSERT INTO booking_events"), -1);
}
{
  const { db, response, body } = await statusRoute("cancelled", { booking: makeBooking({ status: "pending", customer_id: "cust-1" }), throwNotificationInsert: true });
  assert.equal(response.status, 200);
  assert.equal(body.booking.status, "cancelled");
  assert.equal(db.events.at(-1).event_type, "cancelled", "event insert happens before notification failure is swallowed");
}
{
  const { db, response, body } = await statusRoute("cancelled", { booking: makeBooking({ status: "pending", customer_id: "cust-1" }), statusUpdateChanges: 0 });
  assert.equal(response.status, 409);
  assert.equal(body.error.code, "BOOKING_CONFLICT");
  assert.equal(countSql(db, "point_transactions"), 0);
  assert.equal(firstSqlIndex(db, "INSERT INTO booking_events"), -1);
}
{
  const db = routeDb({ booking: makeBooking({ status: "pending", customer_id: "", customer_phone: "0912345678" }) });
  const { response, body } = await publicRouteJson("/api/bookings/cancel?tenant=tenant-a", db, { bookingId: "booking-1", phone: "0912345678", reason: "guest cancel" });
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(countSql(db, "UPDATE bookings SET status = 'cancelled'"), 1, "customer/guest cancel remains legacy route");
}
{
  const db = routeDb();
  const { response, body } = await routeJson("/api/merchant/bookings/booking-1/status", db, { status: "confirmed", expected_updated_at: "stale" });
  assert.equal(response.status, 409);
  assert.equal(body.error.code, "BOOKING_CONFLICT");
  assert.equal(countSql(db, "UPDATE bookings SET status"), 0);
}
{
  const { db, response, body } = await statusRoute("confirmed", { statusUpdateChanges: 0 });
  assert.equal(response.status, 409);
  assert.equal(body.error.code, "BOOKING_CONFLICT");
  assert.equal(db.events.length, 1);
}
{
  const db = routeDb();
  const { response, body } = await routeJson("/api/merchant/bookings/booking-1/status", db, { status: "confirmed" }, {}, "tenant-b");
  assert.equal(response.status, 404);
  assert.equal(body.error.code, "BOOKING_NOT_FOUND");
  assert.equal(countSql(db, "UPDATE bookings SET status"), 0);
}
{
  const { response, body } = await statusRoute("confirmed", { tenantStatus: "active", contractEnd: "2026-01-01" });
  assert.equal(response.status, 403);
  assert.equal(body.error.code, "TENANT_BOOKING_ACTION_READ_ONLY");
}
{
  const { response, body } = await statusRoute("checked_in", { tenantStatus: "active", contractEnd: "2026-01-01", booking: makeBooking({ status: "confirmed" }) });
  assert.equal(response.status, 200);
  assert.equal(body.booking.status, "checked_in");
}
{
  const { response, body } = await statusRoute("completed", { tenantStatus: "suspended", booking: makeBooking({ status: "in_service" }) });
  assert.equal(response.status, 200);
  assert.equal(body.booking.status, "completed");
}
{
  const { response, body } = await statusRoute("checked_in", { tenantStatus: "suspended", booking: makeBooking({ status: "confirmed" }) });
  assert.equal(response.status, 403);
  assert.equal(body.error.code, "TENANT_BOOKING_ACTION_READ_ONLY");
}
{
  const db = routeDb({ booking: null });
  const { response, body } = await routeJson("/api/merchant/bookings/booking-1/note", db, { note: "x" });
  assert.equal(response.status, 404);
  assert.equal(body.error.code, "BOOKING_NOT_FOUND");
}
{
  const db = routeDb();
  const { response, body } = await routeJson("/api/merchant/bookings/booking-1/note", db, { note: "x", expected_updated_at: "stale" });
  assert.equal(response.status, 409);
  assert.equal(body.error.code, "BOOKING_CONFLICT");
  assert.equal(countSql(db, "UPDATE bookings SET merchant_note"), 0);
  assert.equal(db.events.length, 1);
}
{
  const db = routeDb({ updateChanges: 0 });
  const { response, body } = await routeJson("/api/merchant/bookings/booking-1/note", db, { note: "x", expected_updated_at: "2026-07-16T00:00:00Z" });
  assert.equal(response.status, 409);
  assert.equal(body.error.code, "BOOKING_CONFLICT");
  assert.equal(db.events.length, 1);
}
{
  const db = routeDb();
  const request = new Request("https://example.test/api/merchant/bookings/booking-1/note", { method: "POST", headers: { cookie: await merchantCookie("tenant-b"), "content-type": "application/json" }, body: JSON.stringify({ note: "x" }) });
  const response = await app.fetch(request, env(db), {});
  const body = JSON.parse(await response.text());
  assert.equal(response.status, 404);
  assert.equal(body.error.code, "BOOKING_NOT_FOUND");
  assert.equal(countSql(db, "UPDATE bookings SET merchant_note"), 0);
}
{
  const db = routeDb();
  const { response, body } = await routeJson("/api/merchant/bookings/booking-1/events", db, {});
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(body), ["ok", "events"]);
  assert.deepEqual(Object.keys(body.events[0]), ["event_type", "from_status", "to_status", "actor_type", "reason", "metadata_json", "created_at"]);
}
{
  const db = routeDb({ throwEvents: true });
  const { response, body } = await routeJson("/api/merchant/bookings/booking-1/events", db, {});
  assert.equal(response.status, 500);
  assert.equal(body.error.code, "BOOKING_EVENT_READ_FAILED");
  assert.equal(JSON.stringify(body).includes("SELECT *"), false);
}
{
  const db = routeDb({ throwUpdate: true });
  const { response, body } = await routeJson("/api/merchant/bookings/booking-1/note", db, { note: "x", expected_updated_at: "2026-07-16T00:00:00Z" });
  assert.equal(response.status, 500);
  assert.equal(body.error.code, "BOOKING_NOTE_UPDATE_FAILED");
  assert.equal(JSON.stringify(body).includes("SQLITE"), false);
}

console.log("booking-command-boundary-test: PASS");
