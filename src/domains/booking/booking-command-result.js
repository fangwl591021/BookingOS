export const BOOKING_COMMAND_ERRORS = Object.freeze({
  BOOKING_NOT_FOUND: { status: 404, message: "Booking not found" },
  BOOKING_CONFLICT: { status: 409, message: "此預約已被其他人更新，請重新整理" },
  CUSTOMER_NAME_REQUIRED: { status: 400, message: "請輸入顧客姓名" },
  VALIDATION_FAILED: { status: 400, message: "Validation failed" },
  PERMISSION_DENIED: { status: 403, message: "Permission denied" },
  TENANT_SCOPE_MISMATCH: { status: 403, message: "Tenant scope mismatch" },
  INVALID_BOOKING_STATUS_TRANSITION: { status: 409, message: "此預約狀態無法執行這項操作" },
  BOOKING_NOTE_UPDATE_FAILED: { status: 500, message: "Unable to update booking note" },
  BOOKING_CUSTOMER_UPDATE_FAILED: { status: 500, message: "Unable to update booking customer" },
  BOOKING_STATUS_UPDATE_FAILED: { status: 500, message: "Unable to update booking status" },
  BOOKING_POINTS_ROLLBACK_FAILED: { status: 500, message: "Unable to rollback booking points" },
  BOOKING_EVENT_READ_FAILED: { status: 500, message: "Unable to load booking events" }
});

export function commandOk(data = {}) {
  return { ok: true, ...data };
}

export function commandError(code, overrides = {}) {
  const base = BOOKING_COMMAND_ERRORS[code] || BOOKING_COMMAND_ERRORS.VALIDATION_FAILED;
  return {
    ok: false,
    code,
    message: overrides.message || base.message,
    status: Number(overrides.status || base.status || 400),
    details: overrides.details || {}
  };
}

export function isCommandError(result) {
  return result && result.ok === false && result.code;
}
