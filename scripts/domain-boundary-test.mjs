import assert from "node:assert/strict";
import app from "../src/index.js";
import { createRuntime } from "../src/runtime/composition-root.js";
import { createTenantContext } from "../src/runtime/tenant-context.js";
import { createServiceRepository } from "../src/repositories/service-repository.js";
import { createStaffRepository } from "../src/repositories/staff-repository.js";
import { createBookingRepository } from "../src/repositories/booking-repository.js";
import { createServiceDomain } from "../src/domains/service/index.js";
import { createStaffDomain } from "../src/domains/staff/index.js";
import { createBookingDomain } from "../src/domains/booking/index.js";
import { toServiceView } from "../src/domains/service/service-mapper.js";
import { toStaffView } from "../src/domains/staff/staff-mapper.js";
import { toBookingView } from "../src/domains/booking/booking-mapper.js";
import { validateServiceListOptions } from "../src/domains/service/service-validation.js";
import { validateStaffListOptions } from "../src/domains/staff/staff-validation.js";
import { validateBookingListFilters } from "../src/domains/booking/booking-validation.js";

const SESSION_SECRET = "domain-boundary-secret";

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

function fakeDb(results = []) {
  const calls = [];
  return { calls, prepare(sql) { return { bind(...binds) { calls.push({ sql, binds }); return { all: async () => ({ results }), first: async () => results[0] || null }; } }; } };
}

function routeDb(options = {}) {
  const calls = [];
  const activeServiceRows = options.serviceRows ?? [{ id: "svc-1", name: "Service A", category: "cat", service_enabled: 1, sort_order: 1, resource_type_id: "room", resource_type_name: "Room", point_redeem_limit: 0, minutes: 60, price: 1200, duration_enabled: 1 }];
  const allServiceRows = options.allServiceRows ?? activeServiceRows;
  const activeStaffRows = options.staffRows ?? [{ id: "staff-1", name: "Tony", avatar_url: "", phone: "", email: "", role: "staff", enabled: 1, sort_order: 1, service_ids: '["svc-1"]', crm_permissions: "[]", plan_booking_status: "active" }];
  const allStaffRows = options.allStaffRows ?? activeStaffRows;
  const bookingRows = options.bookingRows ?? [{ id: "booking-1", tenant_id: "tenant-a", booking_date: "2026-07-16", start_time: "09:00", end_time: "10:00", status: "pending", staff_id: "staff-1", staff_name: "Tony", service_id: "svc-1", service_name: "Service A", duration_minutes: 60, price: 1200, customer_name: "Guest A", customer_phone: "0912345678", source: "web", updated_at: "2026-07-16T00:00:00Z" }];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...binds) {
          calls.push({ sql, binds });
          const exec = async () => {
            if (sql.includes("FROM tenant_admins a JOIN identities")) return { results: [{ admin_id: "admin-a", identity_id: "identity-a", tenant_id: "tenant-a", role: "owner", admin_status: "active", identity_status: "active", tenant_status: "active", tenant_name: "Tenant A", contract_start: "2026-07-01", contract_end: "2027-07-01", billing_plan_id: "solo", staff_limit: 2, active_staff_count: 1 }] };
            if (sql.includes("FROM services s")) { if (options.throwServices) throw new Error("service db failed"); return { results: sql.includes("LEFT JOIN service_durations") ? allServiceRows : activeServiceRows }; }
            if (sql.includes("FROM staff_members") && sql.includes("COALESCE(plan_booking_status, 'active') = 'plan_limited'")) return { results: [] };
            if (sql.includes("FROM staff_members")) return { results: sql.includes("AND enabled = 1") ? activeStaffRows : allStaffRows };
            if (sql.includes("FROM bookings b") && sql.includes("COALESCE(sm.plan_booking_status, 'active') = 'plan_limited'")) return { results: [] };
            if (sql.includes("FROM bookings b")) { if (options.throwBookings) throw new Error("booking db failed"); return { results: bookingRows }; }
            return { results: [] };
          };
          return { all: exec, first: async () => (await exec()).results[0] || null };
        }
      };
    }
  };
}

function requestContext(tenantId = "tenant-a") { return { tenantContext: createTenantContext({ tenantId, source: "test" }) }; }
function assertTenantScoped(call, tableName = "tenant") { assert.ok(call.sql.includes("tenant_id = ?"), tableName + " query must filter tenant_id"); assert.equal(call.binds[0], "tenant-a", tableName + " query must bind tenant first"); }
function routeEnv(db) { return { DB: db, MERCHANT_SESSION_SECRET: SESSION_SECRET, MERCHANT_SESSION_TTL_SECONDS: "3600" }; }
async function routeJson(path, db) { const response = await app.fetch(new Request("https://example.test" + path, { headers: { cookie: await merchantCookie("tenant-a") } }), routeEnv(db), {}); return { response, body: JSON.parse(await response.text()) }; }
function countQueries(db, fragment) { return db.calls.filter((call) => call.sql.includes(fragment)).length; }

assert.deepEqual(validateServiceListOptions({ includeDisabled: "1" }), { includeDisabled: true });
assert.deepEqual(validateStaffListOptions({ includeDisabled: "0" }), { includeDisabled: false });
assert.throws(() => validateServiceListOptions({ includeDisabled: "bad" }), /boolean flag/);
assert.throws(() => validateBookingListFilters({ dateFrom: "2026-07-20", dateTo: "2026-07-19" }, "2026-07-16"), /date_from/);
assert.throws(() => validateBookingListFilters({ status: "unknown" }, "2026-07-16"), /Invalid booking status/);

const serviceView = toServiceView({ id: "svc-1", name: "Service A", enabled: 1, prices: [{ minutes: 60, price: 1200 }] });
assert.deepEqual(Object.keys(serviceView), ["id", "name", "category", "enabled", "sortOrder", "resourceTypeId", "resourceTypeName", "pointRedeemLimit", "prices"]);
assert.equal(serviceView.prices[0].minutes, 60);
const staffView = toStaffView({ id: "staff-1", name: "Tony", enabled: 1, service_ids: '["svc-1"]', plan_booking_status: "active" });
assert.equal(staffView.serviceIds[0], "svc-1");
assert.equal(staffView.planBookingStatus, "active");
const bookingView = toBookingView({ id: "booking-1", booking_date: "2026-07-16", start_time: "09:00", status: "confirmed", staff_id: "staff-1", staff_name: "Tony", service_name: "Service A", price: 1200 });
assert.equal(bookingView.booking_id, "booking-1");
assert.equal(bookingView.statusLabel, "\u5df2\u78ba\u8a8d");
assert.equal(bookingView.canCancel, true);

const serviceDb = fakeDb([{ id: "svc-1", name: "Service A", service_enabled: 1, minutes: 60, price: 1200, duration_enabled: 1 }]);
const serviceRepo = createServiceRepository(serviceDb);
const serviceDomain = createServiceDomain({ serviceRepository: serviceRepo });
const services = await serviceDomain.listServices(requestContext(), { includeDisabled: false });
assert.equal(services.length, 1);
assertTenantScoped(serviceDb.calls[0], "services");
assert.equal(serviceDb.calls[0].sql.includes("SELECT *"), false);
await assert.rejects(() => serviceDomain.listServices({ tenantContext: createTenantContext({}) }), /Tenant context is required/);

const staffDb = fakeDb([{ id: "staff-1", name: "Tony", enabled: 1, service_ids: '["svc-1"]', plan_booking_status: "active" }]);
const staffRepo = createStaffRepository(staffDb);
const staffDomain = createStaffDomain({ staffRepository: staffRepo });
const staff = await staffDomain.listStaff(requestContext(), { includeDisabled: false });
assert.equal(staff[0].id, "staff-1");
assertTenantScoped(staffDb.calls[0], "staff");
assert.equal(staffDb.calls[0].sql.includes("SELECT *"), false);

const bookingDb = fakeDb([{ id: "booking-1", booking_date: "2026-07-16", start_time: "09:00", status: "pending", price: 1200 }]);
const bookingRepo = createBookingRepository(bookingDb);
const bookingDomain = createBookingDomain({ bookingRepository: bookingRepo });
const bookings = await bookingDomain.listBookings(requestContext(), { date: "2026-07-16", today: "2026-07-16" });
assert.equal(bookings.bookings.length, 1);
assertTenantScoped(bookingDb.calls[0], "bookings");
assert.equal(bookingDb.calls[0].sql.includes("SELECT *"), false);

const runtime = createRuntime({ DB: fakeDb() });
assert.ok(runtime.domains.serviceDomain);
assert.ok(runtime.domains.staffDomain);
assert.ok(runtime.domains.bookingDomain);
assert.equal(runtime.modules.get("booking").status, "partial");
assert.equal(runtime.modules.get("staff").status, "partial");
assert.equal(runtime.modules.get("service").status, "partial");

{
  const db = routeDb();
  const { response, body } = await routeJson("/api/services?tenant=tenant-a", db);
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(body), ["ok", "services"]);
  assert.deepEqual(Object.keys(body.services[0]), ["id", "name", "category", "enabled", "sortOrder", "resourceTypeId", "resourceTypeName", "pointRedeemLimit", "prices"]);
  assert.equal(body.services[0].prices[0].minutes, 60);
  assert.equal(countQueries(db, "FROM services s"), 1);
}
{
  const db = routeDb({ serviceRows: [], allServiceRows: [] });
  const { response, body } = await routeJson("/api/services?tenant=tenant-a", db);
  assert.equal(response.status, 200);
  assert.deepEqual(body, { ok: true, services: [] });
  assert.equal(countQueries(db, "FROM services s"), 1);
}
{
  const db = routeDb({ allServiceRows: [{ id: "svc-disabled", name: "Disabled", category: "", service_enabled: 0, sort_order: 2, resource_type_id: "", resource_type_name: "", point_redeem_limit: 0, minutes: 30, price: 500, duration_enabled: 1 }] });
  const { response, body } = await routeJson("/api/services?tenant=tenant-a&include_disabled=1", db);
  assert.equal(response.status, 200);
  assert.equal(body.services[0].id, "svc-disabled");
  assert.ok(db.calls.find((call) => call.sql.includes("FROM services s")).sql.includes("LEFT JOIN service_durations"));
}
{
  const db = routeDb();
  const { response, body } = await routeJson("/api/services?tenant=tenant-a&include_disabled=maybe", db);
  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, "VALIDATION_FAILED");
  assert.equal(countQueries(db, "FROM services s"), 0);
}
{
  const db = routeDb({ staffRows: [] });
  const { response, body } = await routeJson("/api/staff?tenant=tenant-a", db);
  assert.equal(response.status, 200);
  assert.deepEqual(body, { ok: true, staffMembers: [] });
  assert.equal(countQueries(db, "SELECT id, name, avatar_url"), 1);
}
{
  const db = routeDb();
  const { response, body } = await routeJson("/api/staff?tenant=tenant-a&include_disabled=1", db);
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(body), ["ok", "staffMembers"]);
  assert.deepEqual(Object.keys(body.staffMembers[0]), ["id", "name", "avatarUrl", "phone", "email", "role", "enabled", "sortOrder", "serviceIds", "crmPermissions", "planBookingStatus"]);
  assert.equal(countQueries(db, "SELECT id, name, avatar_url"), 1);
}
{
  const db = routeDb();
  const { response, body } = await routeJson("/api/merchant/bookings?tenant=tenant-a&date=2026-07-16&status=pending&staff_id=staff-1&service_id=svc-1&limit=1&page=2", db);
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(body), ["ok", "summary", "bookings", "planLimited"]);
  assert.deepEqual(Object.keys(body.summary), ["total", "pending", "confirmed", "checkedIn", "inService", "completed", "noShow", "cancelled", "expectedRevenue", "completedRevenue"]);
  assert.deepEqual(Object.keys(body.bookings[0]), ["booking_id", "tenant_id", "customer_id", "customer_type", "customer_name", "customer_phone_masked", "staff", "service_id", "service", "resource_type_id", "duration", "price", "date", "start_time", "end_time", "status", "statusLabel", "source", "merchant_note", "updated_at", "canConfirm", "canCheckIn", "canStartService", "canComplete", "canNoShow", "canCancel", "canReschedule", "canReassign"]);
  assert.deepEqual(Object.keys(body.planLimited), ["affectedBookings", "staff"]);
  const bookingCall = db.calls.find((call) => call.sql.includes("FROM bookings b") && call.sql.includes("LIMIT ? OFFSET ?"));
  assert.ok(bookingCall.sql.includes("b.status = ?"));
  assert.ok(bookingCall.sql.includes("b.staff_id = ?"));
  assert.ok(bookingCall.sql.includes("b.service_id = ?"));
  assert.deepEqual(bookingCall.binds.slice(-2), [1, 1]);
}
{
  const db = routeDb();
  const { response, body } = await routeJson("/api/merchant/bookings?tenant=tenant-a&date_from=2026-07-20&date_to=2026-07-19", db);
  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, "VALIDATION_FAILED");
  assert.equal(countQueries(db, "FROM bookings b"), 0);
}
{
  const db = routeDb({ throwServices: true });
  const { response, body } = await routeJson("/api/services?tenant=tenant-a", db);
  assert.equal(response.status, 500);
  assert.deepEqual(body, { ok: false, error: { code: "SERVICE_READ_FAILED", message: "Unable to load services" } });
}

console.log("domain-boundary-test: PASS");
