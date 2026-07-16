import assert from "node:assert/strict";
import app from "../src/index.js";
import { createRuntime } from "../src/runtime/composition-root.js";
import { createTenantContext } from "../src/runtime/tenant-context.js";
import { createIdempotencyEnvelope } from "../src/runtime/idempotency-envelope.js";
import { createBookingCommandService } from "../src/domains/booking/index.js";
import { createBookingRepository } from "../src/repositories/booking-repository.js";
import { createBookingEventRepository } from "../src/repositories/booking-event-repository.js";
import { validateMerchantNoteCommand, sanitizeBookingEventMetadata } from "../src/domains/booking/booking-command-validation.js";

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
    ...overrides
  };
}

function routeDb(options = {}) {
  const calls = [];
  const booking = options.booking === undefined ? makeBooking() : options.booking;
  const events = options.events ? [...options.events] : [{ event_type: "created", from_status: null, to_status: "pending", actor_type: "customer", reason: null, metadata_json: "{}", created_at: "2026-07-16 09:00:00" }];
  function exec(sql, binds) {
    if (sql.includes("FROM tenant_admins a JOIN identities")) {
      return { results: [{ admin_id: "admin-a", identity_id: "identity-a", tenant_id: "tenant-a", role: "owner", admin_status: "active", identity_status: "active", tenant_status: options.tenantStatus || "active", tenant_name: "Tenant A", contract_start: "2026-07-01", contract_end: "2027-07-01", billing_plan_id: "solo", staff_limit: 2, active_staff_count: 1 }] };
    }
    if (sql.includes("FROM tenants t WHERE t.id = ?")) {
      return { results: [{ name: "Tenant A", status: options.tenantStatus || "active", contract_start: "2026-07-01", contract_end: "2027-07-01", billing_plan_id: "solo", staff_limit: 2, booking_enabled: 1, active_staff_count: 1, active_booking_staff_count: 1 }] };
    }
    if (sql.includes("FROM bookings b") && sql.includes("WHERE b.tenant_id = ? AND b.id = ?")) {
      if (!booking || binds[0] !== "tenant-a" || binds[1] !== booking.id) return { results: [] };
      return { results: [{ ...booking }] };
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

async function routeJson(path, db, payload = {}, headers = {}) {
  const request = new Request("https://example.test" + path, { method: "POST", headers: { cookie: await merchantCookie("tenant-a"), "content-type": "application/json", ...headers }, body: JSON.stringify(payload) });
  const response = await app.fetch(request, env(db), {});
  return { response, body: JSON.parse(await response.text()) };
}

function commandContext() {
  return { tenantContext: createTenantContext({ tenantId: "tenant-a", source: "test" }), authContext: { actor: { type: "merchant", id: "merchant" } }, logger: { error() {} } };
}

function countSql(db, fragment) {
  return db.calls.filter((call) => call.sql.includes(fragment)).length;
}

assert.equal(validateMerchantNoteCommand({ note: "x".repeat(1001) }).code, "VALIDATION_FAILED");
assert.deepEqual(sanitizeBookingEventMetadata({ token: "secret", cookie: "session", oldName: "A", lineUid: "U123" }), { oldName: "A" });
const envelope = createIdempotencyEnvelope(new Request("https://example.test", { headers: { "Idempotency-Key": "idem-1", "X-Request-Id": "req-1" } }), { source: "test" });
assert.equal(envelope.key, "idem-1");
assert.equal(envelope.persistence, "not_implemented");

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
  assert.equal(response.status, 400);
  assert.equal(body.error.code, "VALIDATION_FAILED");
  assert.equal(countSql(db, "UPDATE bookings SET merchant_note"), 0);
  assert.equal(db.events.length, 1);
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
{
  const db = routeDb();
  await routeJson("/api/merchant/bookings/booking-1/status", db, { status: "confirmed", expected_updated_at: "2026-07-16T00:00:00Z" });
  assert.equal(countSql(db, "UPDATE bookings SET status"), 1, "status route remains legacy mutation path");
}

console.log("booking-command-boundary-test: PASS");
