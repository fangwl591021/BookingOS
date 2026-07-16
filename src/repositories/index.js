import { createBookingRepository } from "./booking-repository.js";
import { createBookingEventRepository } from "./booking-event-repository.js";
import { createSettingsRepository } from "./settings-repository.js";
import { createCustomerRepository } from "./customer-repository.js";
import { createServiceRepository } from "./service-repository.js";
import { createStaffRepository } from "./staff-repository.js";

export function createRepositories(db) {
  return {
    bookingRepository: createBookingRepository(db),
    bookingEventRepository: createBookingEventRepository(db),
    settingsRepository: createSettingsRepository(db),
    customerRepository: createCustomerRepository(db),
    serviceRepository: createServiceRepository(db),
    staffRepository: createStaffRepository(db)
  };
}

