function parseList(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : null;
  } catch (_error) {
    return String(value).split(",").map((item) => item.trim()).filter(Boolean);
  }
}

function planStatus(value) {
  const status = String(value || "active").trim();
  return status === "plan_limited" ? "plan_limited" : "active";
}

export function toStaffView(record = {}) {
  return {
    id: String(record.id || ""),
    name: String(record.name || ""),
    avatarUrl: String(record.avatarUrl || record.avatar_url || ""),
    phone: String(record.phone || ""),
    email: String(record.email || ""),
    role: String(record.role || ""),
    enabled: record.enabled !== false && Number(record.enabled ?? 1) !== 0,
    sortOrder: Number(record.sortOrder || record.sort_order || 0),
    serviceIds: parseList(record.serviceIds || record.service_ids),
    crmPermissions: parseList(record.crmPermissions || record.crm_permissions) || [],
    planBookingStatus: planStatus(record.planBookingStatus || record.plan_booking_status)
  };
}
