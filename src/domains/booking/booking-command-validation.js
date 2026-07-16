import { commandError } from "./booking-command-result.js";

export function limitCommandText(value, maxLength) {
  const text = String(value || "").trim();
  return text.slice(0, Math.max(1, Number(maxLength || 120)));
}

export function expectedUpdatedAtFromCommand(command = {}) {
  return String(command.expectedUpdatedAt || command.expected_updated_at || "").trim();
}

export function validateMerchantNoteCommand(command = {}) {
  return {
    bookingId: String(command.bookingId || "").trim(),
    note: limitCommandText(command.note, 1000),
    expectedUpdatedAt: expectedUpdatedAtFromCommand(command)
  };
}

export function validateCustomerInfoCommand(command = {}) {
  const name = limitCommandText(command.customerName || command.customer_name, 80);
  if (!name) return commandError("CUSTOMER_NAME_REQUIRED");
  return {
    bookingId: String(command.bookingId || "").trim(),
    customerName: name,
    customerPhone: limitCommandText(command.customerPhone || command.customer_phone, 32),
    expectedUpdatedAt: expectedUpdatedAtFromCommand(command)
  };
}

const BOOKING_STATUSES = Object.freeze(["pending", "confirmed", "checked_in", "in_service", "completed", "no_show", "cancelled"]);
const B4_STATUS_TRANSITIONS = Object.freeze(new Set([
  "pending->confirmed",
  "confirmed->checked_in",
  "checked_in->in_service",
  "in_service->completed",
  "confirmed->no_show"
]));
const B5_MERCHANT_CANCELLATION_TRANSITIONS = Object.freeze(new Set([
  "pending->cancelled",
  "confirmed->cancelled",
  "checked_in->cancelled"
]));

export function normalizeBookingCommandStatus(status) {
  const raw = String(status || "confirmed").trim().toLowerCase();
  const aliases = {
    "已確認": "confirmed",
    "待確認": "pending",
    "已取消": "cancelled",
    "取消": "cancelled",
    "完成": "completed",
    "已完成": "completed",
    "未到店": "no_show",
    "已到店": "checked_in",
    "服務中": "in_service"
  };
  const normalized = aliases[raw] || raw;
  return BOOKING_STATUSES.includes(normalized) ? normalized : "confirmed";
}

export function isB4BookingStatusTransition(fromStatus, toStatus) {
  const from = normalizeBookingCommandStatus(fromStatus);
  const to = normalizeBookingCommandStatus(toStatus);
  return B4_STATUS_TRANSITIONS.has(`${from}->${to}`);
}

export function isB5MerchantCancellationTransition(fromStatus, toStatus) {
  const from = normalizeBookingCommandStatus(fromStatus);
  const to = normalizeBookingCommandStatus(toStatus);
  return B5_MERCHANT_CANCELLATION_TRANSITIONS.has(`${from}->${to}`);
}

export function validateBookingStatusCommand(command = {}) {
  const bookingId = String(command.bookingId || "").trim();
  const fromStatus = normalizeBookingCommandStatus(command.fromStatus);
  const toStatus = normalizeBookingCommandStatus(command.status || command.toStatus);
  if (!isB4BookingStatusTransition(fromStatus, toStatus)) return commandError("INVALID_BOOKING_STATUS_TRANSITION");
  return {
    bookingId,
    fromStatus,
    toStatus,
    reason: limitCommandText(command.reason, 300),
    expectedUpdatedAt: expectedUpdatedAtFromCommand(command)
  };
}

export function validateMerchantCancellationCommand(command = {}) {
  const bookingId = String(command.bookingId || "").trim();
  const fromStatus = normalizeBookingCommandStatus(command.fromStatus);
  const toStatus = normalizeBookingCommandStatus(command.status || command.toStatus);
  if (!isB5MerchantCancellationTransition(fromStatus, toStatus)) return commandError("INVALID_BOOKING_STATUS_TRANSITION");
  return {
    bookingId,
    fromStatus,
    toStatus,
    reason: limitCommandText(command.reason, 300),
    expectedUpdatedAt: expectedUpdatedAtFromCommand(command)
  };
}

export function assertExpectedVersion(currentUpdatedAt, expectedUpdatedAt) {
  const expected = String(expectedUpdatedAt || "").trim();
  if (!expected) return null;
  if (String(currentUpdatedAt || "") !== expected) return commandError("BOOKING_CONFLICT");
  return null;
}

const SENSITIVE_METADATA_KEYS = /(authorization|cookie|token|secret|password|line|uid|reply|access|id_token|session)/i;

export function sanitizeBookingEventMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const safe = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_METADATA_KEYS.test(key)) continue;
    if (value && typeof value === "object") continue;
    safe[key] = value;
  }
  return safe;
}
