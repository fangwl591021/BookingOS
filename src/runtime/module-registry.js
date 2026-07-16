export const MODULES = Object.freeze([
  { id: "core-runtime", version: "0.1.0", status: "partial", routes: ["/api/health"], capabilities: ["diagnostics"], dependencies: [] },
  { id: "booking", version: "0.1.0", status: "legacy-compatible", routes: ["/api/bookings", "/api/availability"], capabilities: ["booking.create", "booking.read"], dependencies: ["weekly-hours", "service", "staff"] },
  { id: "weekly-hours", version: "0.1.0", status: "active", routes: [], capabilities: ["schedule.read"], dependencies: [] },
  { id: "staff", version: "0.1.0", status: "legacy-compatible", routes: ["/api/staff"], capabilities: ["staff.read", "staff.write"], dependencies: [] },
  { id: "service", version: "0.1.0", status: "legacy-compatible", routes: ["/api/services"], capabilities: ["service.read", "service.write"], dependencies: [] },
  { id: "settings", version: "0.1.0", status: "legacy-compatible", routes: ["/api/settings", "/api/store"], capabilities: ["tenant.read", "tenant.settings.write"], dependencies: [] },
  { id: "line-adapter", version: "0.1.0", status: "adapter", routes: ["/line-webhook", "/api/line/settings"], capabilities: ["line.settings.write"], dependencies: ["settings"] },
  { id: "web-push-adapter", version: "0.1.0", status: "adapter", routes: ["/api/push/status", "/api/push/subscribe", "/push-sw.js"], capabilities: ["notification.push"], dependencies: [] }
]);

export function createModuleRegistry(modules = MODULES) {
  const byId = new Map(modules.map((module) => [module.id, Object.freeze({ ...module })]));
  return {
    list() {
      return Array.from(byId.values());
    },
    get(id) {
      return byId.get(id) || null;
    },
    health() {
      return Array.from(byId.values()).map((module) => ({
        id: module.id,
        version: module.version,
        status: module.status
      }));
    }
  };
}
