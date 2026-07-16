import assert from "node:assert/strict";
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

function fakeDb(results = []) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        bind(...binds) {
          calls.push({ sql, binds });
          return {
            all: async () => ({ results }),
            first: async () => results[0] || null
          };
        }
      };
    }
  };
}

function requestContext(tenantId = "tenant-a") {
  return {
    tenantContext: createTenantContext({ tenantId, source: "test" })
  };
}

function assertTenantScoped(call, tableName = "tenant") {
  assert.ok(call.sql.includes("tenant_id = ?"), tableName + " query must filter tenant_id");
  assert.equal(call.binds[0], "tenant-a", tableName + " query must bind tenant first");
}

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

console.log("domain-boundary-test: PASS");
