import { createLogger } from "./logger.js";
import { createModuleRegistry } from "./module-registry.js";
import { createDiagnostics } from "./diagnostics.js";
import { createRequestContext } from "./request-context.js";
import { createRepositories } from "../repositories/index.js";
import { createBookingCommandService, createBookingDomain } from "../domains/booking/index.js";
import { createStaffDomain } from "../domains/staff/index.js";
import { createServiceDomain } from "../domains/service/index.js";

export function createRuntime(env, executionContext = null) {
  const moduleRegistry = createModuleRegistry();
  const logger = createLogger({
    service: "BookingOS",
    runtimeVersion: "b1-runtime-boundary-foundation"
  });
  const repositories = createRepositories(env?.DB);
  const domains = {
    bookingDomain: createBookingDomain({ bookingRepository: repositories.bookingRepository }),
    bookingCommandService: createBookingCommandService({
      bookingRepository: repositories.bookingRepository,
      bookingEventRepository: repositories.bookingEventRepository
    }),
    staffDomain: createStaffDomain({ staffRepository: repositories.staffRepository }),
    serviceDomain: createServiceDomain({ serviceRepository: repositories.serviceRepository })
  };
  const diagnostics = createDiagnostics(env, moduleRegistry);
  return {
    env,
    executionContext,
    logger,
    repositories,
    domains,
    ...domains,
    modules: moduleRegistry,
    diagnostics,
    createRequestContext(request, options = {}) {
      return createRequestContext(this, request, options);
    }
  };
}
