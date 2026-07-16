const DEFAULT_MESSAGES = {
  VALIDATION_FAILED: "Validation failed",
  AUTH_REQUIRED: "Authentication required",
  PERMISSION_DENIED: "Permission denied",
  TENANT_REQUIRED: "Tenant is required",
  TENANT_NOT_FOUND: "Tenant not found",
  TENANT_SCOPE_MISMATCH: "Tenant scope mismatch",
  RESOURCE_NOT_FOUND: "Resource not found",
  CONFLICT: "Conflict",
  EXTERNAL_SERVICE_FAILED: "External service failed",
  INTERNAL_ERROR: "Internal error"
};

const DEFAULT_STATUS = {
  VALIDATION_FAILED: 400,
  AUTH_REQUIRED: 401,
  PERMISSION_DENIED: 403,
  TENANT_REQUIRED: 400,
  TENANT_NOT_FOUND: 404,
  TENANT_SCOPE_MISMATCH: 403,
  RESOURCE_NOT_FOUND: 404,
  CONFLICT: 409,
  EXTERNAL_SERVICE_FAILED: 502,
  INTERNAL_ERROR: 500
};

export class AppError extends Error {
  constructor(code = "INTERNAL_ERROR", message = "", options = {}) {
    super(message || DEFAULT_MESSAGES[code] || DEFAULT_MESSAGES.INTERNAL_ERROR);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = Number(options.httpStatus || DEFAULT_STATUS[code] || 500);
    this.safeDetails = options.safeDetails && typeof options.safeDetails === "object" ? options.safeDetails : {};
    this.retryable = Boolean(options.retryable);
    if (options.cause) this.cause = options.cause;
  }
}

export class ValidationError extends AppError {
  constructor(message, options = {}) {
    super("VALIDATION_FAILED", message, { httpStatus: 400, ...options });
  }
}

export class AuthenticationError extends AppError {
  constructor(message, options = {}) {
    super("AUTH_REQUIRED", message, { httpStatus: 401, ...options });
  }
}

export class AuthorizationError extends AppError {
  constructor(message, options = {}) {
    super("PERMISSION_DENIED", message, { httpStatus: 403, ...options });
  }
}

export class TenantContextError extends AppError {
  constructor(code, message, options = {}) {
    super(code || "TENANT_REQUIRED", message, options);
  }
}

export class NotFoundError extends AppError {
  constructor(message, options = {}) {
    super("RESOURCE_NOT_FOUND", message, { httpStatus: 404, ...options });
  }
}

export class ConflictError extends AppError {
  constructor(message, options = {}) {
    super("CONFLICT", message, { httpStatus: 409, ...options });
  }
}

export class ExternalServiceError extends AppError {
  constructor(message, options = {}) {
    super("EXTERNAL_SERVICE_FAILED", message, { httpStatus: 502, retryable: true, ...options });
  }
}

export class InternalError extends AppError {
  constructor(message, options = {}) {
    super("INTERNAL_ERROR", message, { httpStatus: 500, ...options });
  }
}

export function normalizeError(error) {
  if (error instanceof AppError) return error;
  return new InternalError(DEFAULT_MESSAGES.INTERNAL_ERROR, { cause: error });
}

export function errorResponse(error, headers = {}) {
  const normalized = normalizeError(error);
  return Response.json({
    ok: false,
    error: {
      code: normalized.code,
      message: normalized.message,
      ...(Object.keys(normalized.safeDetails || {}).length ? { details: normalized.safeDetails } : {})
    }
  }, {
    status: normalized.httpStatus,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers
    }
  });
}

export function safeErrorSummary(error) {
  const normalized = normalizeError(error);
  return {
    name: normalized.name,
    code: normalized.code,
    httpStatus: normalized.httpStatus,
    retryable: normalized.retryable
  };
}
