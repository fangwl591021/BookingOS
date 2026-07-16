import { commandError } from "./booking-command-result.js";

export function limitCommandText(value, maxLength) {
  const text = String(value || "").trim();
  return text.slice(0, Math.max(1, Number(maxLength || 120)));
}

export function expectedUpdatedAtFromCommand(command = {}) {
  return String(command.expectedUpdatedAt || command.expected_updated_at || "").trim();
}

export function validateMerchantNoteCommand(command = {}) {
  const rawNote = String(command.note || "").trim();
  if (rawNote.length > 1000) return commandError("VALIDATION_FAILED", { message: "店家備註不可超過 1000 字" });
  return {
    bookingId: String(command.bookingId || "").trim(),
    note: rawNote,
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
