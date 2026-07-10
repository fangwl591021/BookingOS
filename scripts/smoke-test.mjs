const baseUrl = (process.env.BOOKINGOS_BASE_URL || "https://bookingos.fangwl591021.workers.dev").replace(/\/+$/, "");
const tenant = process.env.BOOKINGOS_TENANT || "demo-tenant";

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

addCheck("public booking page loads", async () => {
  const res = await request(`/book?tenant=${encodeURIComponent(tenant)}`);
  assert(res.status === 200, `expected 200, got ${res.status}`);
  const text = await res.text();
  assert(text.includes("BookingOS Book"), "booking page marker missing");
});

addCheck("member page redirects to member login", async () => {
  const res = await request(`/member?tenant=${encodeURIComponent(tenant)}`);
  assert(res.status === 302, `expected 302, got ${res.status}`);
  const location = res.headers.get("location") || "";
  assert(location.includes("/member-login"), `expected member-login redirect, got ${location}`);
  assert(!location.includes("/merchant-login"), `must not redirect to merchant-login: ${location}`);
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

addCheck("merchant login remains available", async () => {
  const res = await request(`/merchant-login?tenant=${encodeURIComponent(tenant)}&next=%2Fmerchant`);
  assert(res.status === 200, `expected 200, got ${res.status}`);
  const text = await res.text();
  assert(text.includes("Merchant Console"), "merchant login marker missing");
});

addCheck("availability endpoint remains public", async () => {
  const res = await request(`/api/availability?tenant=${encodeURIComponent(tenant)}&date=2026-07-11&serviceId=therapy&duration=60&staffId=any`);
  assert(res.status === 200, `expected 200, got ${res.status}`);
  const data = await res.json();
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
