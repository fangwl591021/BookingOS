import { ValidationError } from "../../runtime/errors.js";

export function validateServiceListOptions(options = {}) {
  const raw = options.includeDisabled;
  if (raw === undefined || raw === null || raw === "") return { includeDisabled: false };
  if (raw === true || raw === 1 || raw === "1" || raw === "true") return { includeDisabled: true };
  if (raw === false || raw === 0 || raw === "0" || raw === "false") return { includeDisabled: false };
  throw new ValidationError("include_disabled must be a boolean flag", { safeDetails: { field: "include_disabled" } });
}
