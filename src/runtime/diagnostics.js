export function createDiagnostics(env, moduleRegistry) {
  return {
    health() {
      return {
        status: "ok",
        service: "BookingOS",
        releaseSha: String(env?.RELEASE_SHA || env?.COMMIT_SHA || "unknown"),
        runtimeVersion: "b1-runtime-boundary-foundation",
        modules: moduleRegistry.health(),
        databaseBindingPresent: Boolean(env?.DB),
        kvBindingPresent: Boolean(env?.PUSH_KV),
        timestamp: new Date().toISOString()
      };
    },
    publicHealth() {
      const health = this.health();
      return {
        ok: health.status === "ok",
        service: health.service,
        version: "0.2.2-resource-capacity",
        runtimeVersion: health.runtimeVersion,
        modules: health.modules,
        database: health.databaseBindingPresent,
        push: health.kvBindingPresent
      };
    }
  };
}
