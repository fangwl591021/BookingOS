export function toServiceView(record = {}) {
  const prices = Array.isArray(record.prices) ? record.prices : [];
  return {
    id: String(record.id || ""),
    name: String(record.name || ""),
    category: String(record.category || ""),
    enabled: record.enabled !== false,
    sortOrder: Number(record.sortOrder || record.sort_order || 0),
    resourceTypeId: String(record.resourceTypeId || record.resource_type_id || ""),
    resourceTypeName: String(record.resourceTypeName || record.resource_type_name || ""),
    pointRedeemLimit: Number(record.pointRedeemLimit || record.point_redeem_limit || 0),
    prices: prices.map((price) => ({
      minutes: Number(price.minutes || 0),
      price: Number(price.price || 0),
      enabled: price.enabled !== false
    }))
  };
}
