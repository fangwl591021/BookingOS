export function requireTenantId(tenantId) {
  const value = String(tenantId || "").trim();
  if (!value) throw new Error("TENANT_REQUIRED");
  return value;
}
