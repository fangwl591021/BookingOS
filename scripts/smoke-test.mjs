const baseUrl = (process.env.BOOKINGOS_BASE_URL || "https://bookingos.fangwl591021.workers.dev").replace(/\/+$/, "");
const tenant = process.env.BOOKINGOS_TENANT || "demo-tenant";
const slug = process.env.BOOKINGOS_STORE_SLUG || "anhe";

const checks = [];

function addCheck(name, fn) {
  checks.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, { redirect: "manual", ...options });
}

addCheck("health endpoint works", async () => {
  const res = await request("/api/health");
  assert(res.status === 200, `expected 200, got ${res.status}`);
  const data = await res.json();
  assert(data.ok === true, "health did not return ok=true");
});

addCheck("unknown api fails closed", async () => {
  const res = await request("/api/unknown-route");
  assert(res.status === 404, `expected 404, got ${res.status}`);
  const data = await res.json();
  assert(data?.error?.code === "API_ROUTE_NOT_FOUND", "missing API_ROUTE_NOT_FOUND");
});

addCheck("wrong api method returns 405", async () => {
  const res = await request("/api/health", { method: "POST" });
  assert(res.status === 405, `expected 405, got ${res.status}`);
  assert(res.headers.get("allow") === "GET", "expected Allow: GET");
});

addCheck("store booking page loads", async () => {
  const res = await request(`/store/${slug}`);
  assert(res.status === 200, `expected 200, got ${res.status}`);
  const text = await res.text();
  assert(text.includes("BookingOS Book"), "booking page marker missing");
  assert(!text.includes("Merchant Console"), "store booking must not show merchant login");
});

addCheck("store /book alias loads", async () => {
  const res = await request(`/store/${slug}/book`);
  assert(res.status === 200, `expected 200, got ${res.status}`);
  const text = await res.text();
  assert(text.includes("BookingOS Book"), "booking page marker missing");
});

addCheck("legacy tenant booking redirects to store slug", async () => {
  const res = await request(`/book?tenant=${encodeURIComponent(tenant)}`);
  assert(res.status === 302, `expected 302, got ${res.status}`);
  const location = res.headers.get("location") || "";
  assert(location.endsWith(`/store/${slug}`), `expected /store/${slug}, got ${location}`);
});

addCheck("store member page redirects to store login", async () => {
  const res = await request(`/store/${slug}/member`);
  assert(res.status === 302, `expected 302, got ${res.status}`);
  const location = res.headers.get("location") || "";
  assert(location.includes(`/store/${slug}/login`), `expected store login redirect, got ${location}`);
  assert(!location.includes("/merchant-login"), `must not redirect to merchant-login: ${location}`);
});

addCheck("legacy member routes redirect to store slug", async () => {
  const cases = [
    [`/member-login?tenant=${encodeURIComponent(tenant)}`, `/store/${slug}/login`],
    [`/member?tenant=${encodeURIComponent(tenant)}`, `/store/${slug}/member`],
    [`/points?tenant=${encodeURIComponent(tenant)}`, `/store/${slug}/points`],
    [`/history?tenant=${encodeURIComponent(tenant)}`, `/store/${slug}/history`]
  ];
  for (const [path, expected] of cases) {
    const res = await request(path);
    assert(res.status === 302, `expected 302 for ${path}, got ${res.status}`);
    const location = res.headers.get("location") || "";
    assert(location.includes(expected), `expected ${expected}, got ${location}`);
  }
});

addCheck("unknown store slug returns STORE_NOT_FOUND", async () => {
  const res = await request("/store/not-exist-store");
  assert(res.status === 404, `expected 404, got ${res.status}`);
  const data = await res.json();
  assert(data?.error?.code === "STORE_NOT_FOUND", "missing STORE_NOT_FOUND");
});

addCheck("merchant login ignores customer intent parameters", async () => {
  const cases = [
    `/merchant-login?tenant=${encodeURIComponent(tenant)}&next=%2Fmember`,
    "/merchant-login?intent=register",
    "/merchant-login?liff.state=%2Fmember%3Ftenant%3Ddemo-tenant"
  ];
  for (const path of cases) {
    const res = await request(path);
    assert(res.status === 200, `expected 200 for ${path}, got ${res.status}`);
    const text = await res.text();
    assert(text.includes("Merchant Console"), `merchant marker missing for ${path}`);
    assert(!text.includes("會員登入"), `customer login marker leaked into merchant login for ${path}`);
  }
});

addCheck("availability endpoint is public and onboarding-gated", async () => {
  const res = await request(`/api/availability?tenant=${encodeURIComponent(tenant)}&date=2026-07-11&serviceId=therapy&duration=60&staffId=any`);
  assert(res.status === 200 || res.status === 409, `expected 200 or onboarding 409, got ${res.status}`);
  const data = await res.json();
  if (res.status === 409) {
    assert(data?.error?.code === "ONBOARDING_INCOMPLETE", "unexpected onboarding gate response");
    return;
  }
  assert(data.ok === true, "availability did not return ok=true");
  assert(Array.isArray(data.slots), "availability slots missing");
});

addCheck("customer profile requires customer session", async () => {
  const cases = [
    `/api/customer-profile?tenant=${encodeURIComponent(tenant)}`,
    `/api/customer-profile?tenant=${encodeURIComponent(tenant)}&phone=0927136847`
  ];
  for (const path of cases) {
    const res = await request(path);
    assert(res.status === 401, `expected 401 for ${path}, got ${res.status}`);
    const data = await res.json();
    assert(data?.error?.code === "CUSTOMER_SESSION_REQUIRED", `missing CUSTOMER_SESSION_REQUIRED for ${path}`);
    assert(data?.error?.message === "請先登入會員", `unexpected message for ${path}: ${data?.error?.message}`);
  }
});

let failed = 0;
for (const check of checks) {
  try {
    await check.fn();
    console.log(`PASS ${check.name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${check.name}: ${error.message}`);
  }
}

if (failed) {
  console.error(`${failed} smoke check(s) failed`);
  process.exit(1);
}

console.log(`All ${checks.length} smoke checks passed`);
