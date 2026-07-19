import assert from "node:assert/strict";
import app from "../src/index.js";

const SECRET = "guest-cancel-token-test-secret";
const WEEKLY_HOURS = JSON.stringify({
  monday: { closed: false, open: "09:00", close: "18:00", breakStart: "", breakEnd: "" },
  tuesday: { closed: false, open: "09:00", close: "18:00", breakStart: "", breakEnd: "" },
  wednesday: { closed: false, open: "09:00", close: "18:00", breakStart: "", breakEnd: "" },
  thursday: { closed: false, open: "09:00", close: "18:00", breakStart: "", breakEnd: "" },
  friday: { closed: false, open: "09:00", close: "18:00", breakStart: "", breakEnd: "" },
  saturday: { closed: false, open: "09:00", close: "18:00", breakStart: "", breakEnd: "" },
  sunday: { closed: false, open: "09:00", close: "18:00", breakStart: "", breakEnd: "" }
});

function base64Url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function hmacBase64Url(secret, payloadSegment) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadSegment));
  return Buffer.from(signature).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function customerCookie({ tenantId = "tenant-a", customerId = "cust-1", identityId = "identity-customer" } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { v: 1, sub: identityId, tenant_id: tenantId, customer_id: customerId, role: "Customer", iat: now, exp: now + 3600 };
  const payloadSegment = base64Url(JSON.stringify(payload));
  return "bookingos_customer_session=" + encodeURIComponent(payloadSegment + "." + await hmacBase64Url(SECRET, payloadSegment));
}
async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value || "")));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function tokenHash(tenantId, bookingId, token) {
  return sha256Hex(`${tenantId}:${bookingId}:${token}`);
}

function makeBooking(overrides = {}) {
  return {
    id: "booking-1",
    tenant_id: "tenant-a",
    customer_id: "cust-1",
    customer_name: "Guest A",
    customer_phone: "0912345678",
    status: "pending",
    booking_date: "2026-07-20",
    start_time: "09:00",
    end_time: "10:00",
    service_id: "svc-1",
    staff_id: "staff-1",
    updated_at: "2026-07-20 00:00:00",
    ...overrides
  };
}

function createDb(options = {}) {
  const calls = [];
  const events = [];
  const tokens = options.tokens ? options.tokens.map((token) => ({ ...token })) : [];
  const booking = options.booking === undefined ? makeBooking() : options.booking;
  const batchCalls = [];

  function tenantRow() {
    return {
      id: "tenant-a",
      slug: "anhe",
      name: "安和整復調理",
      brand_name: "安和整復調理",
      brand_primary_color: "#176b5b",
      phone: "02-2345-6789",
      email: "",
      address: "台北市",
      logo_url: "",
      business_type: "整復推拿",
      timezone: "Asia/Taipei",
      status: "active",
      contract_start: "2026-07-01",
      contract_end: "2027-07-01",
      billing_plan_id: "solo",
      staff_limit: 2,
      booking_enabled: 1,
      setup_test_completed_at: "2026-07-01 00:00:00",
      onboarding_status: "completed",
      onboarding_completed_at: "2026-07-01 00:00:00",
      active_staff_count: 1,
      active_booking_staff_count: 1
    };
  }

  function rowsFor(sql, binds) {
    if (sql.includes("FROM tenants t WHERE t.slug = ?")) {
      return binds[0] === "anhe" ? [tenantRow()] : [];
    }
    if (sql.includes("FROM tenants t WHERE t.id = ?")) {
      return binds[0] === "tenant-a" ? [tenantRow()] : [];
    }
    if (sql.includes("FROM business_settings")) {
      return [{ weekly_hours_json: WEEKLY_HOURS, allow_overtime_booking: 0, point_spend_amount: 100, point_reward_points: 1 }];
    }
    if (sql.includes("FROM services s")) {
      return [{ id: "svc-1", name: "整復調理", category: "整復", service_enabled: 1, sort_order: 1, resource_type_id: "room", resource_type_name: "床位", point_redeem_limit: 0, minutes: 60, price: 1200, duration_enabled: 1 }];
    }
    if (sql.includes("FROM resource_types")) {
      return [{ id: "room", name: "床位", quantity: 1 }];
    }
    if (sql.includes("FROM staff_members")) {
      return [{ id: "staff-1", name: "Tony", avatar_url: "", phone: "", email: "", role: "整復師", enabled: 1, sort_order: 1, service_ids: JSON.stringify(["svc-1"]), crm_permissions: "[]", plan_booking_status: "active" }];
    }
    if (sql.includes("FROM bookings") && sql.includes("source = 'setup_test'")) {
      return [{ count: 1 }];
    }
    if (sql.includes("FROM bookings b") && sql.includes("WHERE b.tenant_id = ? AND b.booking_date = ?")) {
      return [];
    }
    if (sql.includes("FROM customers c") && sql.includes("JOIN identities i") && sql.includes("WHERE c.id = ?")) {
      return binds[0] === "cust-1" && binds[1] === "tenant-a" ? [{ customer_id: "cust-1", identity_id: binds[2], tenant_id: "tenant-a", name: "Guest A", phone: "0912345678", email: "", customer_status: "active", identity_status: "active", tenant_status: "active", tenant_name: "安和整復調理" }] : [];
    }
    if (sql.includes("FROM customers c") && sql.includes("LEFT JOIN customers r") && sql.includes("WHERE c.tenant_id = ? AND c.id = ?")) {
      return binds[0] === "tenant-a" && binds[1] === "cust-1" ? [{ id: "cust-1", tenant_id: "tenant-a", identity_id: "identity-customer", customer_no: "C001", name: "Guest A", phone: "0912345678", email: "", gender: "", address: "", birthday: "", marketing_opt_in: 0, preferred_service: "", allergy_note: "", contact_preference: "phone", points_balance: 0, total_points_earned: 0, total_points_used: 0, referral_code: "REF001", referred_by_code: "", referrer_name: "", total_bookings: 0, last_booking_at: "", status: "active", created_at: "2026-07-01 00:00:00" }] : [];
    }
    if (sql.includes("FROM customers WHERE tenant_id = ? AND phone = ?")) {
      return options.existingCustomer === false ? [] : [{ id: "cust-1" }];
    }
    if (sql.includes("SELECT points_balance FROM customers")) {
      return [{ points_balance: 0 }];
    }
    if (sql.includes("SELECT b.id, b.customer_id, b.customer_phone, b.status")) {
      if (!booking || binds[0] !== "tenant-a" || binds[1] !== booking.id) return [];
      return [{ ...booking, member_phone: booking.customer_phone }];
    }
    if (sql.includes("SELECT id FROM booking_cancel_tokens WHERE tenant_id = ? AND booking_id = ? LIMIT 1")) {
      return tokens.filter((token) => token.tenant_id === binds[0] && token.booking_id === binds[1]).slice(0, 1);
    }
    if (sql.includes("SELECT id, status, expires_at FROM booking_cancel_tokens")) {
      return tokens.filter((token) => token.tenant_id === binds[0] && token.booking_id === binds[1] && token.token_hash === binds[2]).slice(0, 1);
    }
    if (sql.includes("point_transactions")) {
      return [{ points: 10 }];
    }
    if (sql.includes("SELECT line_user_id FROM customers")) return [];
    if (sql.includes("FROM line_oa_settings")) return [];
    return [];
  }

  function runSql(sql, binds) {
    const normalizedSql = sql.trimStart();
    if (normalizedSql.startsWith("INSERT INTO bookings")) {
      return { meta: { changes: 1 } };
    }
    if (normalizedSql.startsWith("INSERT INTO booking_cancel_tokens")) {
      if (options.failTokenInsert) throw new Error("TOKEN_INSERT_FAILED");
      const row = { id: binds[0], tenant_id: binds[1], booking_id: binds[2], token_hash: binds[3], status: "active", expires_at: binds[4] };
      tokens.push(row);
      return { meta: { changes: 1 } };
    }
    if (normalizedSql.startsWith("UPDATE booking_cancel_tokens SET status = 'used'")) {
      const token = tokens.find((item) => item.tenant_id === binds[0] && item.id === binds[1] && item.status === "active");
      if (token && !options.failMarkUsed) token.status = "used";
      return { meta: { changes: token && !options.failMarkUsed ? 1 : 0 } };
    }
    if (normalizedSql.startsWith("UPDATE booking_cancel_tokens SET last_verified_at")) {
      return { meta: { changes: 1 } };
    }
    if (normalizedSql.startsWith("UPDATE bookings SET status = 'cancelled'")) {
      if (booking) {
        booking.status = "cancelled";
        booking.cancelled_by = binds[0];
      }
      return { meta: { changes: booking ? 1 : 0 } };
    }
    if (normalizedSql.startsWith("INSERT INTO booking_events")) {
      events.push({ event_type: binds[3], from_status: binds[4], to_status: binds[5] });
      return { meta: { changes: 1 } };
    }
    if (normalizedSql.startsWith("UPDATE customers SET total_bookings") || normalizedSql.startsWith("UPDATE customers SET")) {
      return { meta: { changes: 1 } };
    }
    if (normalizedSql.startsWith("INSERT INTO point_transactions")) {
      return { meta: { changes: 1 } };
    }
    return { meta: { changes: 1 } };
  }

  function statement(sql, binds = []) {
    return {
      sql,
      binds,
      bind(...nextBinds) {
        calls.push({ sql, binds: nextBinds });
        return statement(sql, nextBinds);
      },
      all: async () => ({ results: rowsFor(sql, binds) }),
      first: async () => rowsFor(sql, binds)[0] || null,
      run: async () => runSql(sql, binds)
    };
  }

  return {
    calls,
    events,
    tokens,
    booking,
    batchCalls,
    prepare(sql) {
      return statement(sql);
    },
    async batch(statements) {
      batchCalls.push(statements.map((item) => item.sql));
      for (const item of statements) await item.run();
      return statements.map(() => ({ success: true }));
    }
  };
}

function env(db, rollout = "verify") {
  return {
    DB: db,
    CUSTOMER_SESSION_SECRET: SECRET,
    CUSTOMER_SESSION_TTL_SECONDS: "3600",
    GUEST_CANCEL_TOKEN_ROLLOUT: rollout
  };
}

async function post(path, db, payload, rollout = "verify", headers = {}) {
  const request = new Request("https://example.test" + path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(payload) });
  const response = await app.fetch(request, env(db, rollout), {});
  return { response, body: JSON.parse(await response.text()) };
}

async function get(path, db = createDb(), rollout = "verify") {
  const response = await app.fetch(new Request("https://example.test" + path), env(db, rollout), {});
  return { response, text: await response.text() };
}

async function captureLogs(action) {
  const originalLog = console.log;
  const lines = [];
  console.log = (line) => lines.push(String(line));
  try {
    const result = await action();
    return { result, lines };
  } finally {
    console.log = originalLog;
  }
}

async function withThrowingLogger(action) {
  const originalLog = console.log;
  console.log = () => { throw new Error("LOGGER_FAILED"); };
  try {
    return await action();
  } finally {
    console.log = originalLog;
  }
}

function parseGuestCancelObservations(lines) {
  return lines
    .map((line) => {
      try { return JSON.parse(line); } catch (error) { return null; }
    })
    .filter((record) => record?.event === "guest_cancel.observation");
}

function assertSafeObservationLogs(lines, disallowedValues = []) {
  const text = lines.join("\n");
  for (const value of disallowedValues.filter(Boolean)) {
    assert.equal(text.includes(value), false, `safe observations must not include ${value}`);
  }
  for (const record of parseGuestCancelObservations(lines)) {
    assert.deepEqual(Object.keys(record).sort(), ["credentialRowPresent", "event", "eventType", "level", "pathType", "reasonCode", "result", "rolloutMode", "runtimeVersion", "service", "timestamp"].sort());
  }
}

function countSql(db, fragment) {
  return db.calls.filter((call) => call.sql.includes(fragment)).length;
}

function firstSqlIndex(db, fragment) {
  return db.calls.findIndex((call) => call.sql.includes(fragment));
}

{
  const db = createDb();
  const { result, lines } = await captureLogs(() => post("/api/bookings?tenant=tenant-a", db, { serviceId: "svc-1", duration: 60, date: "2026-07-20", startTime: "09:00", staffId: "staff-1", customerName: "Guest A", customerPhone: "0912345678" }, "write"));
  const { response, body } = result;
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(db.batchCalls.length, 1, "guest booking and token row use one D1 batch when rollout writes tokens");
  assert.equal(db.tokens.length, 1);
  assert.match(db.tokens[0].token_hash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(body).includes(db.tokens[0].token_hash), false);
  assert.equal(JSON.stringify(db.tokens).includes("0912345678"), false);
  assert.equal(typeof body.cancelUrl, "string", "eligible guest booking returns one-time cancelUrl");
  const cancelUrl = new URL(body.cancelUrl, "https://example.test");
  assert.equal(cancelUrl.pathname, "/store/anhe/cancel");
  assert.equal(cancelUrl.search, "", "cancelUrl must not put token in query string");
  const cancelParams = new URLSearchParams(cancelUrl.hash.slice(1));
  assert.equal(cancelParams.get("b"), body.bookingId);
  const plaintextToken = cancelParams.get("t") || "";
  assert.match(plaintextToken, /^[A-Za-z0-9_-]{32,256}$/);
  assert.equal(await tokenHash("tenant-a", body.bookingId, plaintextToken), db.tokens[0].token_hash);
  assert.equal(JSON.stringify(db.tokens).includes(plaintextToken), false, "plaintext token must not be persisted in token rows");
  assert.equal(JSON.stringify(db.calls).includes(plaintextToken), false, "plaintext token must not be bound into SQL calls");
  const observations = parseGuestCancelObservations(lines);
  assert.ok(observations.some((record) => record.eventType === "guest_cancel_token_issued" && record.rolloutMode === "write" && record.credentialRowPresent === true));
  assertSafeObservationLogs(lines, ["tenant-a", "booking-1", "0912345678", db.tokens[0].token_hash, plaintextToken]);
}


{
  const db = createDb();
  const cookie = await customerCookie();
  const { response, body } = await post("/api/bookings?tenant=tenant-a", db, { serviceId: "svc-1", duration: 60, date: "2026-07-20", startTime: "09:00", staffId: "staff-1", customerName: "Member A", customerPhone: "0912345678" }, "write", { cookie });
  assert.equal(response.status, 200, "customer session booking still succeeds");
  assert.equal(body.ok, true);
  assert.equal(db.tokens.length, 0, "customer session bookings do not receive guest cancel tokens");
  assert.equal(body.cancelUrl, undefined, "customer session bookings do not receive cancelUrl");
}

{
  const db = createDb({ failTokenInsert: true });
  let thrown = null;
  const { lines } = await captureLogs(async () => {
    try {
      await post("/api/bookings?tenant=tenant-a", db, { serviceId: "svc-1", duration: 60, date: "2026-07-20", startTime: "09:00", staffId: "staff-1", customerName: "Guest A", customerPhone: "0912345678" }, "write");
    } catch (error) {
      thrown = error;
    }
  });
  assert.equal(thrown?.message, "TOKEN_INSERT_FAILED", "token row failure must not return a successful booking response");
  assert.equal(JSON.stringify(db.calls).includes("#b="), false, "failed token insert must not bind cancelUrl into SQL");
  assertSafeObservationLogs(lines, ["0912345678"]);
}

{
  const { response, text } = await get("/store/anhe/cancel#b=booking-1&t=secret-token-value");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.match(text, /<meta name="referrer" content="no-referrer">/);
  assert.match(text, /history\.replaceState\(null,document\.title,location\.pathname\+location\.search\)/);
  assert.match(text, /JSON\.stringify\(\{bookingId,token\}\)/);
  assert.equal(text.includes("secret-token-value"), false, "cancel page must not render fragment token server-side");
}

{
  const { response, text } = await get("/store/anhe");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("referrer-policy"), null, "store booking page must not receive cancel-page referrer policy header");
  assert.match(text, /id="cancel-link-panel" hidden/);
  assert.match(text, /請立即複製保存；離開此頁後無法再次顯示。/);
  assert.match(text, /id="copy-cancel-url" type="button"/);
  assert.match(text, /showCancelLink\(data\.cancelUrl\|\|""\)/);
  assert.equal(/localStorage|sessionStorage|console\.log/.test(text), false, "booking page must not store or debug-log cancelUrl");
}
{
  const db = createDb({ booking: makeBooking({ source: "walk_in" }) });
  const { response, body } = await post("/api/bookings?tenant=tenant-a", db, { serviceId: "svc-1", duration: 60, date: "2026-07-20", startTime: "09:00", staffId: "staff-1", customerName: "Walk In", customerPhone: "", source: "walk_in" }, "write");
  assert.equal(response.status, 200);
  assert.equal(db.tokens.length, 0, "walk-in bookings do not receive guest cancel tokens");
  assert.equal(body.cancelUrl, undefined, "walk-in bookings do not receive cancelUrl");
}

{
  const token = "valid_cancel_token_abcdefghijklmnopqrstuvwxyz123456";
  const hash = await tokenHash("tenant-a", "booking-1", token);
  const db = createDb({ tokens: [{ id: "tok-1", tenant_id: "tenant-a", booking_id: "booking-1", token_hash: hash, status: "active", expires_at: "2099-01-01 00:00:00" }] });
  const { result, lines } = await captureLogs(() => post("/store/anhe/api/bookings/cancel-token", db, { bookingId: "booking-1", token }));
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body, { ok: true });
  assert.equal(db.booking.status, "cancelled");
  const updateIndex = firstSqlIndex(db, "UPDATE bookings SET status = 'cancelled'");
  const pointsIndex = firstSqlIndex(db, "UPDATE customers SET total_bookings");
  const eventIndex = firstSqlIndex(db, "INSERT INTO booking_events");
  assert.ok(updateIndex >= 0 && pointsIndex > updateIndex && eventIndex > pointsIndex, "token cancel keeps update -> rollback -> event order");
  assert.equal(db.tokens[0].status, "used");
  assert.ok(parseGuestCancelObservations(lines).some((record) => record.eventType === "guest_cancel_token_cancel_success" && record.rolloutMode === "verify"));
  assertSafeObservationLogs(lines, ["tenant-a", "booking-1", "0912345678", token, hash]);
}

for (const [label, tokenRow, tokenValue] of [
  ["wrong token", { id: "tok-1", tenant_id: "tenant-a", booking_id: "booking-1", token_hash: await tokenHash("tenant-a", "booking-1", "right_token_abcdefghijklmnopqrstuvwxyz123456"), status: "active", expires_at: "2099-01-01 00:00:00" }, "wrong_token_abcdefghijklmnopqrstuvwxyz123456"],
  ["expired token", { id: "tok-2", tenant_id: "tenant-a", booking_id: "booking-1", token_hash: await tokenHash("tenant-a", "booking-1", "expired_token_abcdefghijklmnopqrstuvwxyz123456"), status: "active", expires_at: "2000-01-01 00:00:00" }, "expired_token_abcdefghijklmnopqrstuvwxyz123456"],
  ["revoked token", { id: "tok-3", tenant_id: "tenant-a", booking_id: "booking-1", token_hash: await tokenHash("tenant-a", "booking-1", "revoked_token_abcdefghijklmnopqrstuvwxyz123456"), status: "revoked", expires_at: "2099-01-01 00:00:00" }, "revoked_token_abcdefghijklmnopqrstuvwxyz123456"],
  ["used token", { id: "tok-4", tenant_id: "tenant-a", booking_id: "booking-1", token_hash: await tokenHash("tenant-a", "booking-1", "used_token_abcdefghijklmnopqrstuvwxyz123456"), status: "used", expires_at: "2099-01-01 00:00:00" }, "used_token_abcdefghijklmnopqrstuvwxyz123456"]
]) {
  const db = createDb({ tokens: [tokenRow] });
  const { response, body } = await post("/store/anhe/api/bookings/cancel-token", db, { bookingId: "booking-1", token: tokenValue });
  assert.equal(response.status, 404, label);
  assert.equal(body.error.code, "CANCELLATION_NOT_AVAILABLE", label);
  assert.equal(countSql(db, "UPDATE bookings SET status = 'cancelled'"), 0, label);
  assert.equal(countSql(db, "INSERT INTO booking_events"), 0, label);
}

{
  const badToken = "bad token in query-like string";
  const db = createDb();
  const { result, lines } = await captureLogs(() => post("/store/anhe/api/bookings/cancel-token", db, { bookingId: "booking-1", token: badToken }));
  assert.equal(result.response.status, 404);
  assert.equal(result.body.error.code, "CANCELLATION_NOT_AVAILABLE");
  assert.ok(parseGuestCancelObservations(lines).some((record) => record.eventType === "guest_cancel_token_cancel_failure" && record.reasonCode === "malformed"));
  assertSafeObservationLogs(lines, ["tenant-a", "booking-1", "0912345678", badToken]);
}

{
  const token = "disabled_mode_token_abcdefghijklmnopqrstuvwxyz123456";
  for (const rollout of ["write", "off", "typo"]) {
    const db = createDb({ tokens: [{ id: "tok-disabled", tenant_id: "tenant-a", booking_id: "booking-1", token_hash: await tokenHash("tenant-a", "booking-1", token), status: "active", expires_at: "2099-01-01 00:00:00" }] });
    const { result, lines } = await captureLogs(() => post("/store/anhe/api/bookings/cancel-token", db, { bookingId: "booking-1", token }, rollout));
    assert.equal(result.response.status, 404, `${rollout} token API is disabled`);
    assert.equal(result.body.error.code, "CANCELLATION_NOT_AVAILABLE");
    assert.equal(countSql(db, "UPDATE bookings SET status = 'cancelled'"), 0);
    const expectedMode = rollout === "typo" ? "off" : rollout;
    assert.ok(parseGuestCancelObservations(lines).some((record) => record.eventType === "guest_cancel_token_cancel_failure" && record.rolloutMode === expectedMode && record.reasonCode === "token_api_disabled"));
    assertSafeObservationLogs(lines, ["tenant-a", "booking-1", "0912345678", token, db.tokens[0].token_hash]);
  }
}
{
  const db = createDb({ tokens: [{ id: "tok-1", tenant_id: "tenant-a", booking_id: "booking-1", token_hash: "x".repeat(64), status: "active", expires_at: "2099-01-01 00:00:00" }] });
  const { result, lines } = await captureLogs(() => post("/api/bookings/cancel?tenant=tenant-a", db, { bookingId: "booking-1", phone: "0912345678" }, "write"));
  assert.equal(result.response.status, 200, "write mode is a dark launch and must not block phone fallback");
  assert.equal(result.body.ok, true);
  assert.equal(db.booking.status, "cancelled");
  assert.ok(parseGuestCancelObservations(lines).some((record) => record.eventType === "guest_cancel_legacy_fallback_success" && record.rolloutMode === "write" && record.credentialRowPresent === true));
  assertSafeObservationLogs(lines, ["tenant-a", "booking-1", "0912345678", "x".repeat(64)]);
}

for (const rollout of ["verify", "enforce"]) {
  const db = createDb({ tokens: [{ id: "tok-1", tenant_id: "tenant-a", booking_id: "booking-1", token_hash: "x".repeat(64), status: "active", expires_at: "2099-01-01 00:00:00" }] });
  const { result, lines } = await captureLogs(() => post("/api/bookings/cancel?tenant=tenant-a", db, { bookingId: "booking-1", phone: "0912345678" }, rollout));
  assert.equal(result.response.status, 404, `${rollout} mode blocks tokenized phone fallback`);
  assert.equal(result.body.error.code, "CANCELLATION_NOT_AVAILABLE");
  assert.equal(countSql(db, "UPDATE bookings SET status = 'cancelled'"), 0);
  assert.ok(parseGuestCancelObservations(lines).some((record) => record.eventType === "guest_cancel_phone_fallback_blocked" && record.rolloutMode === rollout));
  assertSafeObservationLogs(lines, ["tenant-a", "booking-1", "0912345678", "x".repeat(64)]);
}

for (const rollout of ["off", "typo"]) {
  const db = createDb();
  const { response, body } = await post("/api/bookings?tenant=tenant-a", db, { serviceId: "svc-1", duration: 60, date: "2026-07-20", startTime: "09:00", staffId: "staff-1", customerName: "Guest A", customerPhone: "0912345678" }, rollout);
  assert.equal(response.status, 200);
  assert.equal(db.tokens.length, 0, `${rollout} mode must not create token rows`);
  assert.equal(body.cancelUrl, undefined, `${rollout} mode must not return cancelUrl`);
}

{
  const db = createDb();
  const { response, body } = await post("/api/bookings/cancel?tenant=tenant-a", db, { bookingId: "booking-1", phone: "0912345678" });
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(db.booking.status, "cancelled");
}

{
  const token = "consume_fail_token_abcdefghijklmnopqrstuvwxyz123456";
  const hash = await tokenHash("tenant-a", "booking-1", token);
  const db = createDb({ failMarkUsed: true, tokens: [{ id: "tok-1", tenant_id: "tenant-a", booking_id: "booking-1", token_hash: hash, status: "active", expires_at: "2099-01-01 00:00:00" }] });
  const first = await post("/store/anhe/api/bookings/cancel-token", db, { bookingId: "booking-1", token });
  assert.equal(first.response.status, 200);
  const second = await post("/store/anhe/api/bookings/cancel-token", db, { bookingId: "booking-1", token });
  assert.equal(second.response.status, 404);
  assert.equal(countSql(db, "INSERT INTO booking_events"), 1, "booking status prevents repeated cancellation even when mark used fails");
}

{
  const db = createDb();
  const { response, body } = await withThrowingLogger(() => post("/api/bookings?tenant=tenant-a", db, { serviceId: "svc-1", duration: 60, date: "2026-07-20", startTime: "09:00", staffId: "staff-1", customerName: "Logger Fail Guest", customerPhone: "0912345678" }, "write"));
  assert.equal(response.status, 200, "logger failure must not break guest booking create");
  assert.equal(body.ok, true);
  assert.equal(db.batchCalls.length, 1, "logger failure must not change booking/token batch behavior");
  assert.equal(db.tokens.length, 1, "logger failure must not prevent token row creation");
}

{
  const token = "logger_fail_token_abcdefghijklmnopqrstuvwxyz123456";
  const hash = await tokenHash("tenant-a", "booking-1", token);
  const db = createDb({ tokens: [{ id: "tok-logger", tenant_id: "tenant-a", booking_id: "booking-1", token_hash: hash, status: "active", expires_at: "2099-01-01 00:00:00" }] });
  const { response, body } = await withThrowingLogger(() => post("/store/anhe/api/bookings/cancel-token", db, { bookingId: "booking-1", token }));
  assert.equal(response.status, 200, "logger failure must not break token cancellation");
  assert.deepEqual(body, { ok: true });
  assert.equal(db.booking.status, "cancelled");
  assert.equal(db.tokens[0].status, "used");
  const updateIndex = firstSqlIndex(db, "UPDATE bookings SET status = 'cancelled'");
  const pointsIndex = firstSqlIndex(db, "UPDATE customers SET total_bookings");
  const eventIndex = firstSqlIndex(db, "INSERT INTO booking_events");
  assert.ok(updateIndex >= 0 && pointsIndex > updateIndex && eventIndex > pointsIndex, "logger failure must not change token cancel update -> rollback -> event order");
}

{
  const db = createDb({ tokens: [{ id: "tok-logger-phone", tenant_id: "tenant-a", booking_id: "booking-1", token_hash: "x".repeat(64), status: "active", expires_at: "2099-01-01 00:00:00" }] });
  const { response, body } = await withThrowingLogger(() => post("/api/bookings/cancel?tenant=tenant-a", db, { bookingId: "booking-1", phone: "0912345678" }, "write"));
  assert.equal(response.status, 200, "logger failure must not break legacy phone fallback cancellation");
  assert.equal(body.ok, true);
  assert.equal(db.booking.status, "cancelled");
  const updateIndex = firstSqlIndex(db, "UPDATE bookings SET status = 'cancelled'");
  const pointsIndex = firstSqlIndex(db, "UPDATE customers SET total_bookings");
  const eventIndex = firstSqlIndex(db, "INSERT INTO booking_events");
  assert.ok(updateIndex >= 0 && pointsIndex > updateIndex && eventIndex > pointsIndex, "logger failure must not change phone fallback update -> rollback -> event order");
}

console.log("guest-cancel-token-test: PASS");
