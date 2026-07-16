import { TenantContextError } from "./errors.js";

const RESERVED_EMPTY = new Set(["", "null", "undefined"]);

function text(value) {
  return String(value || "").trim();
}

export function tenantIdFromRequestUrl(url, env = {}) {
  const value = text(url?.searchParams?.get("tenant"));
  if (value) return value;
  return text(env.DEFAULT_TENANT_ID || "demo-tenant") || "demo-tenant";
}

export function tenantSlugFromPath(pathname = "") {
  const match = String(pathname || "").match(/^\/store\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export function createTenantContext(input = {}) {
  const tenantId = text(input.tenantId);
  const tenantSlug = text(input.tenantSlug);
  const source = text(input.source || (tenantSlug ? "store_slug" : tenantId ? "query" : "unresolved"));
  const status = text(input.tenantStatus || "");
  return {
    tenantId,
    tenantSlug,
    tenantStatus: status,
    source,
    isResolved: Boolean(tenantId || tenantSlug)
  };
}

export function requireTenantContext(context) {
  if (!context?.isResolved || RESERVED_EMPTY.has(context.tenantId) && RESERVED_EMPTY.has(context.tenantSlug)) {
    throw new TenantContextError("TENANT_REQUIRED", "Tenant context is required", { httpStatus: 400 });
  }
  return context;
}

export function assertTenantScope(sessionTenantId, requestTenantId) {
  const sessionTenant = text(sessionTenantId);
  const requestTenant = text(requestTenantId);
  if (sessionTenant && requestTenant && sessionTenant !== requestTenant) {
    throw new TenantContextError("TENANT_SCOPE_MISMATCH", "Request tenant does not match authenticated tenant", { httpStatus: 403 });
  }
  return true;
}
