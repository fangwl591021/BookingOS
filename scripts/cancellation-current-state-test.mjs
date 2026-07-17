import assert from "node:assert/strict";
import app from "../src/index.js";

const SESSION_SECRET = "cancellation-current-state-secret";

function base64Url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function hmacBase64Url(secret, payloadSegment) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadSegment));
  return Buffer.from(signature).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function customerCookie({ tenantId = "tenant-a", customerId = "cust-1", identityId = "identity-customer" } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { v: 1, sub: identityId, tenant_id: tenantId, customer_id: customerId, role: "Customer", iat: now, exp: now + 3600 };
  const payloadSegment = base64Url(JSON.stringify(payload));
  return "bookingos_customer_session=" + encodeURIComponent(payloadSegment + "." + await hmacBase64Url(SESSION_SECRET, payloadSegment));
}

async function merchantCookie(tenantId = "tenant-a") {
  const now = Math.floor(Date.now() / 1000);
  const payload = { v: 1, sub: "identity-merchant", tenant_id: tenantId, role: "owner", iat: now, exp: now + 3600 };
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
    customer_id: "cust-1",
    customer_name: "Customer A",
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

function createDb(options = {}) {
  const calls = [];
  const booking = options.booking === undefined ? makeBooking() : options.booking;
  const events = [];
  function bookingRow(binds) {
    if (!booking || binds[0] !== "tenant-a" || binds[1] !== booking.id) return null;
    return { ...booking };
  }
  function exec(sql, binds) {
    if (sql.includes("FROM tenant_admins a JOIN identities")) {
      return { results: [{ admin_id: "admin-a", identity_id: "identity-merchant", tenant_id: "tenant-a", role: "owner", admin_status: "active", identity_status: "active", tenant_status: "active", tenant_name: "Tenant A", contract_start: "2026-07-01", contract_end: "2027-07-01", billing_plan_id: "solo", staff_limit: 2, active_staff_count: 1 }] };
    }
    if (sql.includes("FROM tenants t WHERE t.id = ?")) {
      return { results: [{ name: "Tenant A", status: "active", contract_start: "2026-07-01", contract_end: "2027-07-01", billing_plan_id: "solo", staff_limit: 2, booking_enabled: 1, active_staff_count: 1, active_booking_staff_count: 1 }] };
    }
    if (sql.includes("FROM customers c") && sql.includes("JOIN identities i") && sql.includes("JOIN tenants t")) {
      const [customerId, tenantId, identityId] = binds;
      if (customerId !== "cust-1" || tenantId !== "tenant-a" || identityId !== "identity-customer") return { results: [] };
      return { results: [{ customer_id: "cust-1", identity_id: "identity-customer", tenant_id: "tenant-a", name: "Customer A", phone: "0912345678", email: "", customer_status: "active", identity_status: "active", tenant_status: "active", tenant_name: "Tenant A" }] };
    }
    if (sql.includes("FROM bookings b") && sql.includes("LEFT JOIN customers c") && sql.includes("WHERE b.tenant_id = ? AND b.id = ?")) {
      const row = bookingRow(binds);
      return { results: row ? [{ ...row, member_phone: options.memberPhone ?? row.customer_phone }] : [] };
    }
    if (sql.includes("FROM bookings b") && sql.includes("WHERE b.tenant_id = ? AND b.id = ?")) {
      const row = bookingRow(binds);
      return { results: row ? [row] : [] };
    }
    if (sql.includes("SELECT c.id, c.tenant_id") && sql.includes("FROM customers c") && sql.includes("WHERE c.tenant_id = ? AND c.id = ?")) {
      if (binds[0] !== "tenant-a" || binds[1] !== "cust-1") return { results: [] };
      return { results: [{ id: "cust-1", tenant_id: "tenant-a", identity_id: "identity-customer", name: "Customer A", phone: "0912345678", points_balance: 0, total_bookings: 1, status: "active" }] };
    }
    if (sql.includes("SELECT name, phone") && sql.includes("FROM customers") && sql.includes("WHERE tenant_id = ? AND phone = ?")) {
      if (binds[0] !== "tenant-a") return { results: [] };
      return { results: [{ name: "Guest A", phone: binds[1] }] };
    }
    if (sql.startsWith("UPDATE bookings SET status = 'cancelled'")) {
      if (!booking) return { meta: { changes: 0 } };
      booking.status = "cancelled";
      booking.cancelled_at ||= "2026-07-16 10:00:00";
      booking.cancelled_by ||= binds[0];
      booking.cancel_reason ||= binds[1] || null;
      booking.updated_at = "2026-07-16 10:00:00";
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith("UPDATE bookings SET status")) {
      if (!booking || options.statusUpdateChanges === 0) return { meta: { changes: 0 } };
      const hasCancelReason = sql.includes("cancel_reason");
      const tenantIndex = hasCancelReason ? 3 : 2;
      const expectedUpdatedAt = sql.includes("AND updated_at = ?") ? binds.at(-1) : "";
      if (binds[tenantIndex] !== "tenant-a" || binds[tenantIndex + 1] !== booking.id || binds[tenantIndex + 2] !== booking.status) return { meta: { changes: 0 } };
      if (expectedUpdatedAt && expectedUpdatedAt !== booking.updated_at) return { meta: { changes: 0 } };
      booking.status = binds[0];
      booking.updated_at = binds[1];
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
    if (sql.startsWith("INSERT OR IGNORE INTO line_notification_deliveries")) return { meta: { changes: 1 } };
    if (sql.startsWith("UPDATE line_notification_deliveries")) return { meta: { changes: 1 } };
    if (sql.includes("SELECT line_user_id FROM customers")) return { results: [] };
    if (sql.includes("point_transactions")) return { results: [{ points: options.pointSum ?? 10 }] };
    if (sql.startsWith("INSERT INTO point_transactions")) return { meta: { changes: 1 } };
    if (sql.startsWith("UPDATE customers SET")) return { meta: { changes: 1 } };
    if (sql.includes("FROM booking_events")) return { results: events };
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
  return {
    DB: db,
    MERCHANT_SESSION_SECRET: SESSION_SECRET,
    MERCHANT_SESSION_TTL_SECONDS: "3600",
    CUSTOMER_SESSION_SECRET: SESSION_SECRET,
    CUSTOMER_SESSION_TTL_SECONDS: "3600"
  };
}

async function post(path, db, payload = {}, headers = {}) {
  const request = new Request("https://example.test" + path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(payload) });
  const response = await app.fetch(request, env(db), {});
  return { response, body: JSON.parse(await response.text()) };
}

function countSql(db, fragment) {
  return db.calls.filter((call) => call.sql.includes(fragment)).length;
}

function firstSqlIndex(db, fragment) {
  return db.calls.findIndex((call) => call.sql.includes(fragment));
}

{
  const db = createDb();
  const { response, body } = await post("/api/bookings/cancel?tenant=tenant-a", db, { bookingId: "booking-1", reason: "customer cancel" }, { cookie: await customerCookie() });
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(body), ["ok", "profile"]);
  assert.equal(body.ok, true);
  assert.equal(db.booking.status, "cancelled");
  assert.equal(db.booking.cancelled_by, "customer");
  assert.equal(db.events.at(-1).actor_type, "customer");
  assert.equal(db.events.at(-1).actor_id, "cust-1");
}

{
  const db = createDb({ booking: makeBooking({ customer_id: "", customer_phone: "0912345678" }) });
  const { response, body } = await post("/api/bookings/cancel?tenant=tenant-a", db, { bookingId: "booking-1", phone: "0912345678", reason: "guest cancel" });
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(body), ["ok", "profile"]);
  assert.equal(db.booking.cancelled_by, "guest");
  assert.equal(db.events.at(-1).actor_id, "guest");
}

{
  const db = createDb({ booking: makeBooking({ customer_id: "", customer_phone: "0912345678" }) });
  const { response, body } = await post("/api/bookings/cancel?tenant=tenant-a", db, { bookingId: "booking-1", phone: "0000000000" });
  assert.equal(response.status, 403);
  assert.equal(body.error, "not allowed");
  assert.equal(countSql(db, "UPDATE bookings SET status = 'cancelled'"), 0);
}

{
  const db = createDb();
  const { response, body } = await post("/api/bookings/cancel?tenant=tenant-a", db, { bookingId: "booking-1", phone: "0912345678" }, { cookie: await customerCookie({ tenantId: "tenant-b" }) });
  assert.equal(response.status, 200, "B6.1 freezes current unsafe legacy behavior: mismatched Customer Session can still fall through to Guest phone fallback");
  assert.equal(body.ok, true);
  assert.equal(countSql(db, "UPDATE bookings SET status = 'cancelled'"), 1);
}

{
  const db = createDb({ booking: makeBooking({ status: "cancelled", cancelled_by: "guest" }) });
  const { response, body } = await post("/api/bookings/cancel?tenant=tenant-a", db, { bookingId: "booking-1", phone: "0912345678" });
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(countSql(db, "UPDATE bookings SET status = 'cancelled'"), 0);
  assert.equal(countSql(db, "INSERT INTO booking_events"), 0);
  assert.equal(countSql(db, "point_transactions"), 0);
}

{
  const db = createDb({ booking: makeBooking({ customer_id: "cust-1", customer_phone: "0912345678" }) });
  const { response } = await post("/api/bookings/cancel?tenant=tenant-a", db, { bookingId: "booking-1", phone: "0912345678", expected_updated_at: "stale" });
  assert.equal(response.status, 200);
  assert.equal(countSql(db, "AND updated_at = ?"), 0, "B6.1 freezes that customer/guest cancel does not yet use expected_updated_at");
  assert.equal(countSql(db, "AND status = ?"), 0, "B6.1 freezes that customer/guest cancel does not yet use an original-status SQL predicate");
}

{
  const db = createDb({ booking: makeBooking({ customer_id: "cust-1", customer_phone: "0912345678" }) });
  await post("/api/bookings/cancel?tenant=tenant-a", db, { bookingId: "booking-1", phone: "0912345678" });
  const updateIndex = firstSqlIndex(db, "UPDATE bookings SET status = 'cancelled'");
  const eventIndex = firstSqlIndex(db, "INSERT INTO booking_events");
  const pointsIndex = firstSqlIndex(db, "UPDATE customers SET total_bookings");
  assert.ok(updateIndex >= 0 && eventIndex > updateIndex && pointsIndex > eventIndex, "B6.1 freezes legacy customer/guest order: update -> event/notification -> points");
}

{
  const db = createDb({ booking: makeBooking({ status: "pending", customer_id: "cust-1" }) });
  const { response, body } = await post("/api/merchant/bookings/booking-1/status", db, { status: "cancelled", expected_updated_at: "2026-07-16T00:00:00Z", reason: "merchant cancel" }, { cookie: await merchantCookie() });
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(body), ["ok", "booking"]);
  const updateIndex = firstSqlIndex(db, "UPDATE bookings SET status");
  const pointsIndex = firstSqlIndex(db, "UPDATE customers SET total_bookings");
  const eventIndex = firstSqlIndex(db, "INSERT INTO booking_events");
  assert.ok(updateIndex >= 0 && pointsIndex > updateIndex && eventIndex > pointsIndex, "merchant B5 cancellation keeps update -> points -> event order");
}

console.log("cancellation-current-state-test: PASS");
