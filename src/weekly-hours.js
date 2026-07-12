export const WEEKDAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
export const WEEKDAY_LABELS = { monday: "星期一", tuesday: "星期二", wednesday: "星期三", thursday: "星期四", friday: "星期五", saturday: "星期六", sunday: "星期日" };

export function emptyDay() {
  return { closed: true, open: "", close: "", breakStart: "", breakEnd: "" };
}

export function defaultWeeklyHours() {
  return Object.fromEntries(WEEKDAY_KEYS.map((key) => [key, emptyDay()]));
}

function validTime(value) {
  return value === "" || (typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value));
}

export function normalizeWeeklyHours(value) {
  let source = value;
  if (typeof source === "string") {
    try { source = JSON.parse(source); } catch (error) { return { ok: false, code: "WEEKLY_HOURS_INVALID_JSON", message: "營業時間資料格式無效" }; }
  }
  if (!source || typeof source !== "object" || Array.isArray(source)) return { ok: false, code: "WEEKLY_HOURS_INVALID", message: "營業時間資料格式無效" };
  const weeklyHours = {};
  for (const key of WEEKDAY_KEYS) {
    const day = source[key] && typeof source[key] === "object" ? source[key] : {};
    const closed = Boolean(day.closed);
    weeklyHours[key] = {
      closed,
      open: closed ? "" : String(day.open || ""),
      close: closed ? "" : String(day.close || ""),
      breakStart: closed ? "" : String(day.breakStart || ""),
      breakEnd: closed ? "" : String(day.breakEnd || "")
    };
  }
  return { ok: true, weeklyHours, complete: hasCompleteWeeklyHours(source) };
}

export function hasCompleteWeeklyHours(value) {
  return value && typeof value === "object" && !Array.isArray(value) && WEEKDAY_KEYS.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

export function validateWeeklyHours(value) {
  const normalized = normalizeWeeklyHours(value);
  if (!normalized.ok) return normalized;
  for (const key of WEEKDAY_KEYS) {
    const day = normalized.weeklyHours[key];
    if (day.closed) continue;
    if (!day.open || !day.close) return { ok: false, code: "WEEKLY_HOURS_INCOMPLETE", message: `${WEEKDAY_LABELS[key]}請填寫開店與打烊時間`, field: key };
    if (!validTime(day.open) || !validTime(day.close) || !validTime(day.breakStart) || !validTime(day.breakEnd)) return { ok: false, code: "WEEKLY_HOURS_TIME_INVALID", message: `${WEEKDAY_LABELS[key]}時間格式無效`, field: key };
    if (day.open >= day.close) return { ok: false, code: "WEEKLY_HOURS_OPEN_CLOSE_INVALID", message: `${WEEKDAY_LABELS[key]}開店時間必須早於打烊時間`, field: key };
    if ((day.breakStart && !day.breakEnd) || (!day.breakStart && day.breakEnd)) return { ok: false, code: "WEEKLY_HOURS_BREAK_INCOMPLETE", message: `${WEEKDAY_LABELS[key]}休息時間需完整填寫`, field: key };
    if (day.breakStart && day.breakEnd && (day.breakStart >= day.breakEnd || day.breakStart < day.open || day.breakEnd > day.close)) return { ok: false, code: "WEEKLY_HOURS_BREAK_INVALID", message: `${WEEKDAY_LABELS[key]}休息時間必須位於營業時間內`, field: key };
  }
  return normalized;
}

export function weekdayKeyForDate(dateText) {
  const match = String(dateText || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  const weekday = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
  return WEEKDAY_KEYS[weekday === 0 ? 6 : weekday - 1] || "";
}

export function dayHoursForDate(value, dateText) {
  const normalized = normalizeWeeklyHours(value);
  const key = weekdayKeyForDate(dateText);
  const day = normalized.ok ? normalized.weeklyHours[key] : emptyDay();
  return { ...(day || emptyDay()), weekday: key, weeklyHours: normalized.ok ? normalized.weeklyHours : defaultWeeklyHours(), invalid: !normalized.ok, breaks: day && day.breakStart && day.breakEnd ? [{ start: day.breakStart, end: day.breakEnd, label: "休息" }] : [] };
}
