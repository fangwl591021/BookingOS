import { anonymousAuthContext } from "./auth-context.js";
import { createTenantContext } from "./tenant-context.js";

function randomRequestId() {
  try {
    return crypto.randomUUID();
  } catch (_error) {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

export function createRequestContext(runtime, request, options = {}) {
  const url = options.url || new URL(request.url);
  const requestId = request.headers.get("x-request-id") || randomRequestId();
  const tenantContext = options.tenantContext || createTenantContext({});
  const authContext = options.authContext || anonymousAuthContext();
  const logger = (runtime.logger || console).child ? runtime.logger.child({ requestId, route: url.pathname }) : runtime.logger;
  return {
    requestId,
    request,
    url,
    method: request.method,
    pathname: url.pathname,
    env: runtime.env,
    tenantContext,
    authContext,
    logger,
    startedAt: Date.now()
  };
}
