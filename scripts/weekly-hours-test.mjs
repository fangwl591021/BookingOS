import assert from "node:assert/strict";
import { defaultWeeklyHours, validateWeeklyHours, dayHoursForDate } from "../src/weekly-hours.js";

const weekly = defaultWeeklyHours();
weekly.monday = { closed: false, open: "09:00", close: "18:00", breakStart: "12:00", breakEnd: "13:00" };
weekly.tuesday = { closed: false, open: "10:00", close: "19:00", breakStart: "14:00", breakEnd: "15:00" };
weekly.wednesday = { closed: true, open: "", close: "", breakStart: "", breakEnd: "" };
weekly.thursday = { closed: false, open: "08:30", close: "17:30", breakStart: "", breakEnd: "" };
weekly.friday = { closed: false, open: "09:30", close: "20:00", breakStart: "16:00", breakEnd: "16:30" };
weekly.saturday = { closed: false, open: "09:00", close: "12:00", breakStart: "", breakEnd: "" };
weekly.sunday = { closed: true, open: "", close: "", breakStart: "", breakEnd: "" };

const valid = validateWeeklyHours(weekly);
assert.equal(valid.ok, true);
assert.equal(valid.complete, true);
assert.equal(dayHoursForDate(weekly, "2026-07-13").open, "09:00");
assert.equal(dayHoursForDate(weekly, "2026-07-14").breakStart, "14:00");
assert.equal(dayHoursForDate(weekly, "2026-07-15").closed, true);

const badOrder = { ...weekly, monday: { ...weekly.monday, open: "18:00", close: "09:00" } };
assert.equal(validateWeeklyHours(badOrder).code, "WEEKLY_HOURS_OPEN_CLOSE_INVALID");
const badBreak = { ...weekly, monday: { ...weekly.monday, breakStart: "08:00", breakEnd: "09:30" } };
assert.equal(validateWeeklyHours(badBreak).code, "WEEKLY_HOURS_BREAK_INVALID");
const badJson = validateWeeklyHours("{");
assert.equal(badJson.code, "WEEKLY_HOURS_INVALID_JSON");
assert.equal(validateWeeklyHours({ monday: weekly.monday }).code, "WEEKLY_HOURS_INCOMPLETE");
console.log("weekly-hours tests passed");