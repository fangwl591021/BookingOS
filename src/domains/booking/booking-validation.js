import { ValidationError } from "../../runtime/errors.js";

const VALID_STATUSES = new Set(["", "pending", "confirmed", "checked_in", "in_service", "completed", "no_show", "cancelled"]);

function dateText(value, field) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new ValidationError(`${field} must be YYYY-MM-DD`, { safeDetails: { field } });
  return text;
}

function boolFlag(value) {
  const text = String(value ?? "").trim().toLowerCase();
  return value === true || text === "1" || text === "true" || text === "yes";
}

export function validateBookingListFilters(filters = {}, today = "") {
  const date = dateText(filters.date, "date");
  const dateFrom = dateText(filters.dateFrom || filters.date_from, "date_from") || date || today;
  const dateTo = dateText(filters.dateTo || filters.date_to, "date_to") || date || dateFrom;
  if (dateFrom && dateTo && dateFrom > dateTo) throw new ValidationError("date_from must be before date_to", { safeDetails: { field: "date_from" } });
  const status = String(filters.status || "").trim();
  if (!VALID_STATUSES.has(status)) throw new ValidationError("Invalid booking status filter", { safeDetails: { field: "status" } });
  const limit = Math.min(200, Math.max(1, Number(filters.limit || 100)));
  const page = Math.max(1, Number(filters.page || 1));
  return {
    dateFrom,
    dateTo,
    status,
    statusRaw: status,
    staffId: String(filters.staffId || filters.staff_id || "").trim(),
    serviceId: String(filters.serviceId || filters.service_id || "").trim(),
    keyword: String(filters.keyword || filters.customer_keyword || "").trim(),
    includeCancelled: boolFlag(filters.includeCancelled || filters.include_cancelled),
    limit,
    page,
    offset: (page - 1) * limit
  };
}
