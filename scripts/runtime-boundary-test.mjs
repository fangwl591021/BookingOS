import assert from "node:assert/strict";
import { AppError, TenantContextError, errorResponse, safeErrorSummary } from "../src/runtime/errors.js";
import { sanitizeLogValue } from "../src/runtime/logger.js";
import { createModuleRegistry } from "../src/runtime/module-registry.js";
import { createTenantContext, requireTenantContext, assertTenantScope } from "../src/runtime/tenant-context.js";
import { authContextFromMerchantSession, authContextFromCustomerSession, hasCapability } from "../src/runtime/auth-context.js";
import { createRuntime } from "../src/runtime/composition-root.js";

function fakeDb() {
  const calls = [];
  const db = {
    calls,
    prepare(sql) {
      return {
        bind(...binds) {
          calls.push({ sql, binds });
          return {
            async all() { return { results: [] }; },
            async first() { return null; }
          };
        }
      };
    }
  };
  return db;
}

async function responseJson(response) {
  return JSON.parse(await response.text());
}

{
  const context = createTenantContext({ tenantId: "tenant-a", source: "merchant_session" });
  assert.equal(requireTenantContext(context).tenantId, "tenant-a");
  assert.throws(() => requireTenantContext(createTenantContext()), TenantContextError);
  assert.equal(assertTenantScope("tenant-a", "tenant-a"), true);
  assert.throws(() => assertTenantScope("tenant-a", "tenant-b"), TenantContextError);
}

{
  const auth = authContextFromMerchantSession({ ok: true, tenantId: "tenant-a", principal: { adminId: "admin-1", role: "owner", tenantAccess: { capabilities: ["tenant.read"] } } });
  assert.equal(auth.actorType, "merchant");
  assert.equal(auth.tenantId, "tenant-a");
  assert.equal(hasCapability(auth, "tenant.read"), true);
  const customer = authContextFromCustomerSession({ ok: true, tenantId: "tenant-a", customerId: "customer-1", identityId: "identity-1" });
  assert.equal(customer.actorType, "customer");
  assert.equal(customer.roles[0], "Customer");
}

{
  const response = await errorResponse(new AppError("TEST_ERROR", "Safe message", { httpStatus: 409 }));
  assert.equal(response.status, 409);
  assert.deepEqual(await responseJson(response), { ok: false, error: { code: "TEST_ERROR", message: "Safe message" } });
  assert.deepEqual(safeErrorSummary(new Error("raw secret should not escape")), { name: "AppError", code: "INTERNAL_ERROR", httpStatus: 500, retryable: false });
}

{
  const sanitized = sanitizeLogValue({ authorization: "Bearer secret-token", channelAccessToken: "abc", phone: "0927136847", nested: { line_user_id: "Uabcdef123456" }, tenantId: "tenant-a" });
  const text = JSON.stringify(sanitized);
  assert.notEqual(sanitized.authorization, "Bearer secret-token");
  assert.notEqual(sanitized.channelAccessToken, "abc");
  assert.ok(!text.includes("secret-token"));
  assert.ok(!text.includes("0927136847"));
  assert.equal(sanitized.tenantId, "tenant-a");
}

{
  const registry = createModuleRegistry();
  const ids = registry.list().map((item) => item.id);
  assert.ok(ids.includes("core-runtime"));
  assert.ok(ids.includes("line-adapter"));
  assert.ok(ids.includes("web-push-adapter"));
  assert.equal(registry.get("core-runtime").routes.includes("/api/health"), true);
  assert.equal(registry.health().every((item) => item.id && item.status), true);
}

{
  const db = fakeDb();
  const runtime = createRuntime({ DB: db, PUSH_KV: {}, RELEASE_SHA: "test-sha", DATABASE_ID: "should-not-leak" });
  await runtime.repositories.serviceRepository.listActive("tenant-a");
  await runtime.repositories.staffRepository.listActive("tenant-a");
  assert.match(db.calls[0].sql, /WHERE tenant_id = \?/);
  assert.deepEqual(db.calls[0].binds, ["tenant-a"]);
  assert.match(db.calls[1].sql, /WHERE tenant_id = \?/);
  assert.deepEqual(db.calls[1].binds, ["tenant-a"]);
  await assert.rejects(() => runtime.repositories.serviceRepository.listActive(""), /TENANT_REQUIRED/);
}

{
  const runtime = createRuntime({ DB: {}, PUSH_KV: {}, RELEASE_SHA: "test-sha", SECRET_TOKEN: "must-not-leak" });
  const request = new Request("https://example.test/api/settings?tenant=tenant-a", { headers: { "x-request-id": "req-1" } });
  const requestContext = runtime.createRequestContext(request, { tenantContext: createTenantContext({ tenantId: "tenant-a" }) });
  assert.equal(requestContext.requestId, "req-1");
  assert.equal(requestContext.tenantContext.tenantId, "tenant-a");
  const health = runtime.diagnostics.publicHealth();
  assert.equal(health.ok, true);
  assert.equal(health.database, true);
  assert.equal(health.push, true);
  const serialized = JSON.stringify(health);
  assert.ok(!serialized.includes("must-not-leak"));
  assert.ok(!serialized.includes("DATABASE_ID"));
}

console.log("runtime-boundary contracts passed");
