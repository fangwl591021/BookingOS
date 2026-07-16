function maskPhone(phone = "") {
  const value = String(phone || "");
  if (value.length <= 4) return value;
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}

export function bookingStatusLabel(status = "") {
  return {
    pending: "待確認",
    confirmed: "已確認",
    checked_in: "已到店",
    in_service: "服務中",
    completed: "已完成",
    no_show: "未到店",
    cancelled: "已取消"
  }[String(status || "")] || String(status || "");
}

export function toBookingView(row = {}) {
  const status = String(row.status || "pending");
  return {
    booking_id: String(row.id || ""),
    tenant_id: String(row.tenant_id || ""),
    customer_id: String(row.customer_id || ""),
    customer_type: row.customer_id ? "member" : "guest",
    customer_name: String(row.customer_name || ""),
    customer_phone_masked: maskPhone(row.customer_phone || ""),
    staff: { id: String(row.staff_id || ""), name: String(row.staff_name || row.staff_id || "") },
    service_id: String(row.service_id || ""),
    service: String(row.service_name || ""),
    resource_type_id: String(row.resource_type_id || ""),
    duration: Number(row.duration_minutes || 0),
    price: Number(row.price || 0),
    date: String(row.booking_date || ""),
    start_time: String(row.start_time || ""),
    end_time: String(row.end_time || ""),
    status,
    statusLabel: bookingStatusLabel(status),
    source: String(row.source || "web"),
    merchant_note: String(row.merchant_note || ""),
    updated_at: String(row.updated_at || ""),
    canConfirm: status === "pending",
    canCheckIn: status === "confirmed",
    canStartService: status === "checked_in",
    canComplete: status === "in_service",
    canNoShow: status === "confirmed",
    canCancel: ["pending", "confirmed", "checked_in"].includes(status),
    canReschedule: ["pending", "confirmed"].includes(status),
    canReassign: ["pending", "confirmed"].includes(status)
  };
}
