function text(value, maxLength = 160) {
  return String(value || "").trim().slice(0, maxLength);
}

export function createIdempotencyEnvelope(request, options = {}) {
  const headers = request?.headers;
  const key = text(headers?.get("Idempotency-Key"), 120);
  const requestId = text(options.requestId || headers?.get("X-Request-Id"), 120);
  const source = text(options.source || "merchant", 40);
  const fingerprint = key ? `${source}:${key}` : "";
  return {
    key,
    fingerprint,
    source,
    requestId,
    receivedAt: new Date().toISOString(),
    persistence: "not_implemented",
    replayProtection: "not_implemented",
    storedResult: "not_implemented"
  };
}
