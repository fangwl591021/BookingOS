function text(value) {
  return String(value || "").trim();
}

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean).map(String) : [];
}

export function createAuthContext(input = {}) {
  return {
    isAuthenticated: Boolean(input.isAuthenticated),
    actorType: text(input.actorType || "anonymous"),
    actorId: text(input.actorId),
    identityId: text(input.identityId),
    tenantId: text(input.tenantId),
    roles: list(input.roles),
    capabilities: list(input.capabilities),
    sessionReference: text(input.sessionReference)
  };
}

export function anonymousAuthContext() {
  return createAuthContext({ actorType: "anonymous" });
}

export function authContextFromMerchantSession(session = {}) {
  if (!session?.ok) return anonymousAuthContext();
  const principal = session.principal || {};
  return createAuthContext({
    isAuthenticated: true,
    actorType: "merchant",
    actorId: principal.adminId || principal.identityId || session.tenantId,
    identityId: principal.identityId,
    tenantId: session.tenantId || principal.tenantId,
    roles: [principal.role || session.role].filter(Boolean),
    capabilities: principal.tenantAccess?.capabilities || [],
    sessionReference: "merchant_session"
  });
}

export function authContextFromCustomerSession(session = {}) {
  if (!session?.ok) return anonymousAuthContext();
  return createAuthContext({
    isAuthenticated: true,
    actorType: "customer",
    actorId: session.customerId,
    identityId: session.identityId,
    tenantId: session.tenantId,
    roles: ["Customer"],
    capabilities: [],
    sessionReference: "customer_session"
  });
}

export function hasCapability(authContext, capability) {
  return Boolean(capability && authContext?.capabilities?.includes(capability));
}
