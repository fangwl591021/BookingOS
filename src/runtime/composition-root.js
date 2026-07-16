import { createLogger } from "./logger.js";
import { createModuleRegistry } from "./module-registry.js";
import { createDiagnostics } from "./diagnostics.js";
import { createRequestContext } from "./request-context.js";
import { createRepositories } from "../repositories/index.js";

export function createRuntime(env, executionContext = null) {
  const moduleRegistry = createModuleRegistry();
  const logger = createLogger({
    service: "BookingOS",
    runtimeVersion: "b1-runtime-boundary-foundation"
  });
  const repositories = createRepositories(env?.DB);
  const diagnostics = createDiagnostics(env, moduleRegistry);
  return {
    env,
    executionContext,
    logger,
    repositories,
    modules: moduleRegistry,
    diagnostics,
    createRequestContext(request, options = {}) {
      return createRequestContext(this, request, options);
    }
  };
}
