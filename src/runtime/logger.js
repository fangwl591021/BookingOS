const SENSITIVE_KEY_PATTERN = /(authorization|cookie|token|secret|password|phone|email|line|uid|reply|endpoint|ciphertext|iv|key|body)/i;
const REDACTED = "[REDACTED]";

function maskScalar(value) {
  if (value == null) return value;
  const text = String(value);
  if (!text) return text;
  if (text.length <= 8) return REDACTED;
  return `${text.slice(0, 3)}...${text.slice(-2)}`;
}

export function sanitizeLogValue(value, key = "") {
  if (SENSITIVE_KEY_PATTERN.test(String(key || ""))) return maskScalar(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeLogValue(item, key));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [entryKey, sanitizeLogValue(entryValue, entryKey)]));
  }
  return value;
}

export function createLogger(base = {}) {
  const baseFields = sanitizeLogValue(base);
  function write(level, event, fields = {}) {
    const record = {
      timestamp: new Date().toISOString(),
      level,
      event: String(event || "runtime.event"),
      ...baseFields,
      ...sanitizeLogValue(fields)
    };
    const line = JSON.stringify(record);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
    return record;
  }
  return {
    child(fields = {}) {
      return createLogger({ ...baseFields, ...sanitizeLogValue(fields) });
    },
    debug(event, fields) {
      return write("debug", event, fields);
    },
    info(event, fields) {
      return write("info", event, fields);
    },
    warn(event, fields) {
      return write("warn", event, fields);
    },
    error(event, fields) {
      return write("error", event, fields);
    }
  };
}
