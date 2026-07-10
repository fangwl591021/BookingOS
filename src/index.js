const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

const PLATFORM_SESSION_COOKIE = "bookingos_platform_session";
const MERCHANT_SESSION_COOKIE = "bookingos_merchant_session";
const CUSTOMER_SESSION_COOKIE = "bookingos_customer_session";
const CUSTOMER_REGISTRATION_COOKIE = "bookingos_customer_registration";
const MERCHANT_SESSION_VERSION = 1;
const CUSTOMER_SESSION_VERSION = 1;
const MERCHANT_TENANT_SELECTION_VERSION = 1;
const MERCHANT_TENANT_SELECTION_PURPOSE = "merchant_tenant_selection";
const TENANT_ID = "demo-tenant";

function envValue(env, key, fallback = "") {
  return String((env && env[key]) || fallback || "").trim();
}

function publicBaseUrl(env, requestOrUrl = null) {
  const configured = envValue(env, "PUBLIC_BASE_URL").replace(/\/+$/, "");
  if (configured) return configured;
  try {
    const url = requestOrUrl instanceof URL ? requestOrUrl : new URL(requestOrUrl?.url || String(requestOrUrl || ""));
    return url.origin;
  } catch (error) {
    return "";
  }
}

function defaultTenantId(env) {
  return envValue(env, "DEFAULT_TENANT_ID", TENANT_ID) || TENANT_ID;
}

function platformAdminUser(env) {
  return envValue(env, "PLATFORM_ADMIN_USER");
}

function platformAdminPassword(env) {
  return envValue(env, "PLATFORM_ADMIN_PASSWORD");
}

function platformSessionValue(env) {
  return envValue(env, "PLATFORM_SESSION_SECRET");
}

function merchantAdminPassword(env) {
  return envValue(env, "MERCHANT_ADMIN_PASSWORD");
}

function merchantIdentityResolutionEnabled(env) {
  return envValue(env, "MERCHANT_IDENTITY_RESOLUTION_ENABLED", "true").toLowerCase() !== "false";
}

function merchantSessionSecret(env) {
  return envValue(env, "MERCHANT_SESSION_SECRET");
}

function merchantSessionTtlSeconds(env) {
  const value = Number(envValue(env, "MERCHANT_SESSION_TTL_SECONDS", "43200"));
  if (!Number.isFinite(value) || value < 300) return 43200;
  return Math.min(Math.floor(value), 86400);
}

function merchantSignedSessionEnabled(env) {
  return envValue(env, "MERCHANT_SIGNED_SESSION_ENABLED", "true").toLowerCase() !== "false";
}

function merchantLegacySessionCompatEnabled(env) {
  return envValue(env, "MERCHANT_LEGACY_SESSION_COMPAT_ENABLED", "true").toLowerCase() !== "false";
}

function merchantTenantSelectionTtlSeconds(env) {
  const value = Number(envValue(env, "MERCHANT_TENANT_SELECTION_TTL_SECONDS", "300"));
  if (!Number.isFinite(value) || value < 60) return 300;
  return Math.min(Math.floor(value), 900);
}

function merchantLiffIdentityLoginEnabled(env) {
  return envValue(env, "MERCHANT_LIFF_IDENTITY_LOGIN_ENABLED", "true").toLowerCase() !== "false";
}

function customerSessionSecret(env) {
  return envValue(env, "CUSTOMER_SESSION_SECRET");
}

function customerSessionTtlSeconds(env) {
  const value = Number(envValue(env, "CUSTOMER_SESSION_TTL_SECONDS", "604800"));
  if (!Number.isFinite(value) || value < 300) return 604800;
  return Math.min(Math.floor(value), 2592000);
}

function customerRegistrationTtlSeconds(env) {
  const value = Number(envValue(env, "CUSTOMER_REGISTRATION_TTL_SECONDS", "900"));
  if (!Number.isFinite(value) || value < 120) return 900;
  return Math.min(Math.floor(value), 1800);
}

function customerLiffIdentityLoginEnabled(env) {
  return envValue(env, "CUSTOMER_LIFF_IDENTITY_LOGIN_ENABLED", "true").toLowerCase() !== "false";
}

async function secureCompare(actual, expected) {
  const left = new TextEncoder().encode(String(actual || ""));
  const right = new TextEncoder().encode(String(expected || ""));
  const maxLength = Math.max(left.length, right.length, 1);
  const paddedLeft = new Uint8Array(maxLength);
  const paddedRight = new Uint8Array(maxLength);
  paddedLeft.set(left.slice(0, maxLength));
  paddedRight.set(right.slice(0, maxLength));
  const digestLeft = await crypto.subtle.digest("SHA-256", paddedLeft);
  const digestRight = await crypto.subtle.digest("SHA-256", paddedRight);
  return left.length === right.length && constantTimeEqual(new Uint8Array(digestLeft), new Uint8Array(digestRight));
}

function constantTimeEqual(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(value) {
  try {
    const binary = atob(String(value || ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch (error) {
    return new Uint8Array();
  }
}

async function verifyLineWebhookSignature(bodyText, signature, channelSecret) {
  const secret = String(channelSecret || "").trim();
  const provided = base64ToBytes(signature);
  if (!secret || !provided.length) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(bodyText || ""));
  return constantTimeEqual(base64ToBytes(bytesToBase64(new Uint8Array(digest))), provided);
}

function mergePlatformLineEnv(env, setting = {}) {
  return {
    ...setting,
    basic_id: envValue(env, "PLATFORM_LINE_BASIC_ID", setting.basic_id || ""),
    channel_id: envValue(env, "PLATFORM_LINE_CHANNEL_ID", setting.channel_id || ""),
    channel_secret: envValue(env, "PLATFORM_LINE_CHANNEL_SECRET", setting.channel_secret || ""),
    channel_access_token: envValue(env, "PLATFORM_LINE_CHANNEL_ACCESS_TOKEN", setting.channel_access_token || ""),
    login_liff_id: envValue(env, "PLATFORM_LINE_LOGIN_LIFF_ID", setting.login_liff_id || ""),
    registration_liff_id: envValue(env, "PLATFORM_LINE_REGISTRATION_LIFF_ID", setting.registration_liff_id || ""),
    friend_add_url: envValue(env, "PLATFORM_LINE_FRIEND_ADD_URL", setting.friend_add_url || "")
  };
}

function tenantLineEnvPrefix(tenantId) {
  return String(tenantId || "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function mergeTenantLineEnv(env, setting = {}) {
  const prefix = tenantLineEnvPrefix(setting.tenant_id || "");
  const scopedSecret = prefix ? envValue(env, `LINE_${prefix}_CHANNEL_SECRET`) : "";
  const scopedToken = prefix ? envValue(env, `LINE_${prefix}_CHANNEL_ACCESS_TOKEN`) : "";
  return {
    ...setting,
    channel_secret: scopedSecret || envValue(env, "LINE_CHANNEL_SECRET", setting.channel_secret || ""),
    channel_access_token: scopedToken || envValue(env, "LINE_CHANNEL_ACCESS_TOKEN", setting.channel_access_token || "")
  };
}

const store = {
  name: "安和整復調理",
  phone: "02-2345-6789",
  address: "台北市大安區安和路一段 88 號"
};

const businessHours = {
  open: "09:00",
  close: "18:00",
  breaks: [{ start: "12:00", end: "13:00", label: "午休" }],
  closedDays: ["星期三"],
  allowOvertimeBooking: false,
  pointReward: { spendAmount: 100, rewardPoints: 1 }
};

const services = [
  { id: "therapy", name: "整復調理", category: "整復推拿", resourceTypeId: "bed", resourceTypeName: "整復床", pointRedeemLimit: 0, prices: [{ minutes: 60, price: 1200 }, { minutes: 90, price: 1700 }, { minutes: 120, price: 2200 }] },
  { id: "neck", name: "肩頸放鬆", category: "放鬆保養", resourceTypeId: "bed", resourceTypeName: "整復床", pointRedeemLimit: 0, prices: [{ minutes: 30, price: 700 }, { minutes: 60, price: 1200 }, { minutes: 90, price: 1700 }] },
  { id: "deep", name: "深層筋膜", category: "進階療程", resourceTypeId: "bed", resourceTypeName: "整復床", pointRedeemLimit: 0, prices: [{ minutes: 90, price: 1900 }, { minutes: 120, price: 2500 }] }
];

const resourceTypes = [
  { id: "bed", name: "整復床", quantity: 2 }
];

const bookings = [
  { staffId: "tony", staffName: "Tony 師傅", customer: "王小姐", phone: "0912-345-678", service: "整復調理", duration: 90, start: "10:00", end: "11:30", status: "已確認" },
  { staffId: "tony", staffName: "Tony 師傅", customer: "李先生", phone: "0922-111-888", service: "肩頸放鬆", duration: 60, start: "14:00", end: "15:00", status: "已確認" }
];

const staffMembers = [
  { id: "tony", name: "Tony 師傅", role: "整復師", serviceIds: null, crmPermissions: [] }
];

const billingPlans = [
  { id: "solo", name: "單人版", monthlyPrice: 300, annualPrice: 3000, staffLimit: 1, extraStaffAnnualPrice: null, description: "1 位師傅，適合個人工作室" },
  { id: "small", name: "小店版", monthlyPrice: 500, annualPrice: 5000, staffLimit: 2, extraStaffAnnualPrice: null, description: "2 位師傅，適合雙人店" },
  { id: "growth", name: "成長版", monthlyPrice: 800, annualPrice: 8000, staffLimit: 4, extraStaffAnnualPrice: null, description: "4 位師傅，適合成長中店家" },
  { id: "team", name: "團隊版", monthlyPrice: 1200, annualPrice: 12000, staffLimit: 8, extraStaffAnnualPrice: 1000, description: "8 位師傅，超過 8 位才可加購人員" }
];
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const liffStateParams = liffStateSearchParams(url);
    let activeTenantId = tenantIdFromUrl(url, env);
    if (!url.searchParams.has("tenant") && liffStateParams.get("tenant")) activeTenantId = liffStateParams.get("tenant");

    if (url.pathname === "/platform-login") {
      if (request.method === "POST") return handlePlatformLogin(request, env);
      return html(renderPlatformLoginPage(url.searchParams.get("error") || ""));
    }
    if (url.pathname === "/platform-logout") {
      return redirectWithCookie("/platform-login", `${PLATFORM_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
    }
    if ((url.pathname === "/platform" || url.pathname.startsWith("/api/platform")) && !isPlatformAuthenticated(request, env)) {
      if (url.pathname.startsWith("/api/platform")) return Response.json({ ok: false, error: "platform login required" }, { status: 401, headers: jsonHeaders });
      return Response.redirect(new URL("/platform-login", request.url), 302);
    }
    if (url.pathname === "/merchant-login") {
      const customerIntent = customerIntentFromLoginUrl(url);
      if (customerIntent.ok) {
        const loginNext = customerIntent.next || url.searchParams.get("next") || "/member";
        const loginError = url.searchParams.get("error") || "";
        return html(renderCustomerLoginPage({ store: await loadStore(env, activeTenantId) }, loginNext, loginError));
      }
      if (request.method === "POST") return handleMerchantLogin(request, env);
      const liffId = await merchantLoginLiffId(env);
      return html(renderMerchantLoginPage(url.searchParams.has("tenant") ? activeTenantId : "", url.searchParams.get("next") || "/merchant", url.searchParams.get("error") || "", liffId));
    }
    if (url.pathname === "/api/merchant/liff-login" && request.method === "POST") {
      return handleMerchantLiffLogin(request, env);
    }
    if (url.pathname === "/member-entry") {
      return handleMemberEntry(request, env, activeTenantId);
    }
    if (url.pathname === "/member-register") {
      return html(await renderCustomerRegisterPage(request, env, activeTenantId, url.searchParams.get("error") || ""));
    }
    if (url.pathname === "/api/customer/register" && request.method === "POST") {
      return handleCustomerRegister(request, env);
    }
    if (url.pathname === "/api/customer/phone-login" && request.method === "POST") {
      return handleCustomerPhoneLogin(request, env, activeTenantId);
    }
    if (url.pathname === "/api/customer/phone-register" && request.method === "POST") {
      return handleCustomerPhoneRegister(request, env, activeTenantId);
    }
    if (url.pathname === "/member-login") {
      return html(renderCustomerLoginPage({ store: await loadStore(env, activeTenantId) }, url.searchParams.get("next") || liffStateParams.get("next") || "/member", url.searchParams.get("error") || liffStateParams.get("error") || ""));
    }
    if (url.pathname === "/api/customer/liff-login" && request.method === "POST") {
      return handleCustomerLiffLogin(request, env);
    }
    if (url.pathname === "/api/customer/session") {
      const session = await requireCustomerSession(request, env, activeTenantId);
      if (!session.ok && url.searchParams.get("optional") === "1") return Response.json({ ok: false, success: true, authenticated: false }, { headers: jsonHeaders });
      if (!session.ok) return customerAuthFailureResponse(request, session, activeTenantId);
      return Response.json({ ok: true, success: true, authenticated: true, session: { tenant_id: session.tenantId, customer_id: session.customerId, role: "Customer" }, profile: await loadCustomerProfileById(env, session.tenantId, session.customerId) }, { headers: jsonHeaders });
    }
    if (url.pathname === "/customer-logout") {
      return redirectWithCookie("/member-login?tenant=" + encodeURIComponent(activeTenantId), clearCustomerSessionCookie());
    }
    if (url.pathname === "/merchant-select-tenant" && request.method === "POST") {
      return handleMerchantSelectTenant(request, env);
    }
    if (url.pathname === "/merchant-logout") {
      return redirectWithCookie(`/merchant-login?tenant=${encodeURIComponent(activeTenantId)}`, clearMerchantSessionCookie());
    }
    if (isMerchantProtectedPath(url.pathname)) {
      const auth = await requireMerchantSession(request, env);
      if (!auth.ok) return merchantAuthFailureResponse(request, auth, url.searchParams.has("tenant") ? activeTenantId : "");
      const permission = merchantRoutePermission(url.pathname, request.method);
      const permissionCheck = permission ? requireMerchantPermission(auth, permission) : { ok: true };
      if (!permissionCheck.ok) return merchantAuthFailureResponse(request, permissionCheck, auth.tenantId);
      activeTenantId = auth.tenantId;
    }

    if (url.pathname === "/platform-line-webhook") {
      return handlePlatformLineWebhook(request, env, ctx);
    }
    if (url.pathname === "/line-webhook" || url.pathname.startsWith("/line-webhook/")) {
      return handleLineWebhook(request, env);
    }

    if (url.pathname === "/api/health") {
      return Response.json({ ok: true, service: "BookingOS", version: "0.2.2-resource-capacity", database: Boolean(env.DB) }, { headers: jsonHeaders });
    }

    if (url.pathname === "/api/platform") {
      return Response.json({ ok: true, data: await platformData(env) }, { headers: jsonHeaders });
    }
    if (url.pathname === "/api/applications" && request.method === "POST") {
      return submitTenantApplication(request, env);
    }
    if (url.pathname === "/api/trials" && request.method === "POST") {
      return submitTrialTenant(request, env);
    }
    if (url.pathname === "/api/platform/applications/approve" && request.method === "POST") {
      return approveTenantApplication(request, env);
    }
    if (url.pathname === "/api/platform/trials/convert" && request.method === "POST") {
      return convertTrialTenant(request, env);
    }
    if (url.pathname === "/api/platform/orders/mark-paid" && request.method === "POST") {
      return markBillingOrderPaid(request, env);
    }
    if (url.pathname === "/api/platform/orders/plan" && request.method === "POST") {
      return updateBillingPlan(request, env);
    }
    if (url.pathname === "/api/platform/tenants" && request.method === "POST") {
      return savePlatformTenant(request, env);
    }
    if (url.pathname === "/api/platform/admins" && request.method === "POST") {
      return savePlatformAdmin(request, env);
    }
    if (url.pathname === "/api/platform/platform-line-oa" && request.method === "POST") {
      return savePlatformLineOASettings(request, env);
    }
    if (url.pathname === "/api/platform/line-oa" && request.method === "POST") {
      return savePlatformLineOA(request, env);
    }
    if (url.pathname === "/api/referrals/claim" && request.method === "POST") {
      return claimPlatformReferral(request, env);
    }
    if (url.pathname === "/api/dashboard") {
      return Response.json({ ok: true, ...(await dashboardData(env, todayInTaipei(), activeTenantId)) }, { headers: jsonHeaders });
    }

    if (url.pathname === "/api/availability") {
      return availabilityResponse(url, await dashboardData(env, url.searchParams.get("date") || todayInTaipei(), activeTenantId));
    }


    if (url.pathname === "/api/store") {
      if (request.method === "GET") return Response.json({ ok: true, store: (await dashboardData(env, todayInTaipei(), activeTenantId)).store }, { headers: jsonHeaders });
      if (request.method === "POST") return saveStoreProfile(request, env, activeTenantId);
    }

    if (url.pathname === "/api/settings") {
      if (request.method === "GET") {
        const data = await dashboardData(env, todayInTaipei(), activeTenantId);
        return Response.json({ ok: true, store: data.store, businessHours: data.businessHours }, { headers: jsonHeaders });
      }
      if (request.method === "POST") return saveSettings(request, env, activeTenantId);
    }

    if (url.pathname === "/api/services") {
      if (request.method === "GET") return Response.json({ ok: true, services: (await dashboardData(env, todayInTaipei(), activeTenantId)).services }, { headers: jsonHeaders });
      if (request.method === "POST") return saveServices(request, env, activeTenantId);
    }

    if (url.pathname === "/api/staff") {
      if (request.method === "GET") return Response.json({ ok: true, staffMembers: (await dashboardData(env, todayInTaipei(), activeTenantId)).staffMembers }, { headers: jsonHeaders });
      if (request.method === "POST") return saveStaffMembers(request, env, activeTenantId);
    }

    if (url.pathname === "/api/resources" || url.pathname.startsWith("/api/resources/")) {
      if (request.method === "GET") return Response.json({ ok: true, resourceTypes: (await dashboardData(env, todayInTaipei(), activeTenantId)).resourceTypes }, { headers: jsonHeaders });
      if (request.method === "POST") return saveResourceTypes(request, env, activeTenantId);
    }

    if (url.pathname === "/api/customers/export") {
      return exportCustomerWorkbook(request, env, activeTenantId);
    }
    if (url.pathname === "/api/customers") {
      return Response.json({ ok: true, customers: await loadCustomers(env, activeTenantId) }, { headers: jsonHeaders });
    }

    if (url.pathname === "/api/customer-profile") {
      const session = await readCustomerSession(request, env);
      if (session.ok && session.tenantId === activeTenantId) return Response.json({ ok: true, profile: await loadCustomerProfileById(env, session.tenantId, session.customerId) }, { headers: jsonHeaders });
      return Response.json({ ok: true, profile: await loadCustomerProfile(env, activeTenantId, url.searchParams.get("phone") || "") }, { headers: jsonHeaders });
    }

    if (url.pathname === "/api/member") {
      const session = await requireCustomerSession(request, env, activeTenantId);
      if (!session.ok) return customerAuthFailureResponse(request, session, activeTenantId);
      if (request.method === "POST") return saveMemberProfile(request, env, activeTenantId, session);
      return Response.json({ ok: true, profile: await loadCustomerProfileById(env, session.tenantId, session.customerId) }, { headers: jsonHeaders });
    }

    if (url.pathname === "/api/customer-history") {
      const session = await requireCustomerSession(request, env, activeTenantId);
      if (!session.ok) return customerAuthFailureResponse(request, session, activeTenantId);
      return Response.json({ ok: true, bookings: await loadCustomerBookings(env, session.tenantId, session.customerId) }, { headers: jsonHeaders });
    }

    if (url.pathname === "/api/customer-points") {
      const session = await requireCustomerSession(request, env, activeTenantId);
      if (!session.ok) return customerAuthFailureResponse(request, session, activeTenantId);
      return Response.json({ ok: true, points: await loadCustomerPointTransactions(env, session.tenantId, session.customerId), profile: await loadCustomerProfileById(env, session.tenantId, session.customerId) }, { headers: jsonHeaders });
    }

    if (url.pathname === "/api/bookings/cancel" && request.method === "POST") {
      return cancelBooking(request, env, activeTenantId);
    }

    if (url.pathname === "/api/bookings" && request.method === "POST") {
      return createBooking(request, env, await dashboardData(env, todayInTaipei(), activeTenantId));
    }

    if (url.pathname === "/pricing") {
      return html(renderPricingPage());
    }
    if (url.pathname === "/apply") {
      return html(renderApplicationPage(url.searchParams.get("plan") || "solo"));
    }
    if (url.pathname === "/trial") {
      return html(renderTrialPage(url.searchParams.get("plan") || "solo"));
    }
    if (url.pathname === "/refer") {
      return renderReferralLanding(url, env);
    }
    if (url.pathname === "/platform") {
      return html(renderPlatformPage(await platformData(env), await dashboardData(env, todayInTaipei(), activeTenantId), env, request));
    }
    if (url.pathname === "/book") {
      const data = await dashboardData(env, todayInTaipei(), activeTenantId);
      return html(renderCustomerPage(data));
    }

    if (url.pathname === "/member" || url.pathname === "/points" || url.pathname === "/history") {
      const session = await requireCustomerSession(request, env, activeTenantId);
      if (!session.ok) return customerAuthFailureResponse(request, session, activeTenantId);
      const active = url.pathname === "/points" ? "points" : url.pathname === "/history" ? "history" : "member";
      return html(renderMemberPage(await dashboardData(env, todayInTaipei(), activeTenantId), active));
    }

    if (url.pathname === "/schedule") {
      return html(renderSchedulePage(await dashboardData(env, todayInTaipei(), activeTenantId)));
    }

    if (url.pathname === "/settings") {
      return html(renderSettingsPage(await dashboardData(env, todayInTaipei(), activeTenantId)));
    }

    if (url.pathname === "/customers") {
      return html(renderCustomersPage(await dashboardData(env, todayInTaipei(), activeTenantId), await loadCustomers(env, activeTenantId)));
    }

    if (url.pathname === "/" || url.pathname === "/index.html" || url.pathname === "/merchant") {
      return html(renderMerchantPage(await dashboardData(env, todayInTaipei(), activeTenantId), await loadCustomers(env, activeTenantId)));
    }

    return Response.json({ ok: false, error: "Not found" }, { status: 404, headers: jsonHeaders });
  }
};

function isPlatformAuthenticated(request, env) {
  const sessionValue = platformSessionValue(env);
  if (!sessionValue) return false;
  const cookie = request.headers.get("cookie") || "";
  return cookie.split(";").map((part) => part.trim()).includes(`${PLATFORM_SESSION_COOKIE}=${encodeURIComponent(sessionValue)}`);
}

function redirectWithCookie(location, cookie) {
  return new Response(null, { status: 302, headers: { location, "set-cookie": cookie, "cache-control": "no-store" } });
}

function isCustomerMemberNext(next = "") {
  const path = String(next || "").trim().split("?")[0];
  return path === "/member" || path === "/points" || path === "/history";
}

function customerIntentFromLoginUrl(url) {
  const next = url.searchParams.get("next") || "";
  const intent = String(url.searchParams.get("intent") || "").trim().toLowerCase();
  if (isCustomerMemberNext(next)) return { ok: true, next, intent };
  if (intent === "login" || intent === "register") return { ok: true, next: next || "/member", intent };
  const rawState = String(url.searchParams.get("liff.state") || "").trim();
  if (!rawState) return { ok: false };
  const states = [rawState];
  try { states.push(decodeURIComponent(rawState)); } catch {}
  const hasExplicitMerchantNext = states.some((state) => {
    try {
      const stateUrl = new URL(state, url.origin);
      return stateUrl.pathname === "/merchant" || stateUrl.searchParams.get("next") === "/merchant";
    } catch {
      return state.includes("/merchant") || state.includes("next=%2Fmerchant") || state.includes("next=/merchant");
    }
  });
  if (!hasExplicitMerchantNext && url.searchParams.has("liff.state")) return { ok: true, next: "/member", intent: "login" };
  for (const state of states) {
    try {
      const stateUrl = new URL(state, url.origin);
      const stateNext = stateUrl.searchParams.get("next") || stateUrl.pathname || "";
      const stateIntent = String(stateUrl.searchParams.get("intent") || "").trim().toLowerCase();
      if (isCustomerMemberNext(stateNext) || stateUrl.pathname === "/member-login") return { ok: true, next: stateNext || "/member", intent: stateIntent };
      if (stateIntent === "login" || stateIntent === "register") return { ok: true, next: stateNext || "/member", intent: stateIntent };
    } catch {
      if (state.includes("/member") || state.includes("/points") || state.includes("/history") || state.includes("intent=login") || state.includes("intent=register")) {
        return { ok: true, next: "/member", intent: "" };
      }
    }
  }
  return { ok: false };
}

function customerMemberLoginUrl(request, tenantId = "", next = "/member", error = "") {
  const url = new URL("/member-login", request.url);
  if (tenantId) url.searchParams.set("tenant", tenantId);
  url.searchParams.set("next", safeCustomerNext(next || "/member", "/member"));
  if (error) url.searchParams.set("error", error);
  return url;
}
async function handleMemberEntry(request, env, tenantId = TENANT_ID) {
  const url = new URL(request.url);
  const safeTenant = String(tenantId || url.searchParams.get("tenant") || defaultTenantId(env)).trim();
  const tenant = await env.DB.prepare("SELECT id, status FROM tenants WHERE id = ?").bind(safeTenant).first();
  if (!tenant?.id || !isActiveTenantStatus(tenant.status)) return new Response("Bad Request", { status: 400, headers: { "cache-control": "no-store" } });
  const fallbackNext = "/member?tenant=" + encodeURIComponent(safeTenant);
  const next = safeCustomerNext(url.searchParams.get("next") || fallbackNext, fallbackNext);
  const session = await requireCustomerSession(request, env, safeTenant);
  if (session.ok) {
    const target = new URL(next, request.url);
    if (!target.searchParams.get("tenant")) target.searchParams.set("tenant", safeTenant);
    return Response.redirect(target, 302);
  }
  const error = url.searchParams.get("error") || "";
  return html(renderCustomerLoginPage({ store: await loadStore(env, safeTenant) }, next, error));
}


async function handlePlatformLogin(request, env) {
  const form = await request.formData();
  const account = String(form.get("account") || "").trim();
  const password = String(form.get("password") || "").trim();
  const expectedUser = platformAdminUser(env);
  const expectedPassword = platformAdminPassword(env);
  const sessionValue = platformSessionValue(env);
  if (!expectedUser || !expectedPassword || !sessionValue) {
    return Response.redirect(new URL("/platform-login?error=config", request.url), 302);
  }
  if (!(await secureCompare(account, expectedUser)) || !(await secureCompare(password, expectedPassword))) {
    return Response.redirect(new URL("/platform-login?error=1", request.url), 302);
  }
  return redirectWithCookie("/platform", `${PLATFORM_SESSION_COOKIE}=${encodeURIComponent(sessionValue)}; Path=/; Max-Age=28800; HttpOnly; SameSite=Lax`);
}

function renderPlatformLoginPage(error = "") {
  const message = error === "config" ? `<div class="error">平台登入尚未完成安全設定</div>` : (error ? `<div class="error">帳號或密碼錯誤</div>` : "");
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BookingOS 平台登入</title><style>:root{--bg:#eef2ed;--panel:#fff;--line:#dfe5dd;--ink:#17211d;--muted:#68746d;--green:#06c755;--rail:#10231d}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.card{width:min(420px,calc(100vw - 32px));background:white;border:1px solid var(--line);border-radius:10px;padding:24px;box-shadow:0 18px 50px rgba(16,35,29,.08)}.brand{display:flex;align-items:center;gap:12px;margin-bottom:22px}.mark{width:44px;height:44px;border-radius:10px;background:var(--green);display:grid;place-items:center;font-weight:950;color:#062216}.brand b{font-size:22px}.brand small{display:block;color:var(--muted);margin-top:2px}h1{font-size:24px;margin:0 0 6px}p{margin:0 0 18px;color:var(--muted);line-height:1.5}form{display:grid;gap:12px}label{display:grid;gap:6px;color:var(--muted);font-size:13px;font-weight:850}input{width:100%;min-height:46px;border:1px solid var(--line);border-radius:8px;padding:10px 12px;font:inherit}button{min-height:46px;border:0;border-radius:8px;background:var(--rail);color:white;font-weight:950;font:inherit;cursor:pointer}.line-login{width:100%;background:#06c755;color:#062216;margin:0 0 12px}.divider{text-align:center;color:var(--muted);font-size:12px;margin:2px 0 12px}.line-status{min-height:18px;color:#0f513f;font-size:12px;font-weight:850;margin:0 0 10px}.error{background:#fde2e2;color:#9b1c1c;border:1px solid #f2b8b8;border-radius:8px;padding:10px 12px;margin-bottom:12px;font-weight:850}</style></head><body><main class="card"><div class="brand"><div class="mark">B</div><div><b>BookingOS</b><small>Platform Console</small></div></div><h1>平台總後台登入</h1><p>請輸入平台管理員帳密後進入總後台。</p>${message}<form method="post" action="/platform-login"><label>帳號<input name="account" autocomplete="username" autofocus required></label><label>密碼<input name="password" type="password" autocomplete="current-password" required></label><button type="submit">登入</button></form></main></body></html>`;
}
function isMerchantProtectedPath(pathname) {
  return pathname === "/" || pathname === "/index.html" || pathname === "/merchant" || pathname === "/settings" || pathname === "/schedule" || pathname === "/customers" || pathname === "/api/dashboard" || pathname === "/api/store" || pathname === "/api/settings" || pathname === "/api/services" || pathname === "/api/staff" || pathname === "/api/resources" || pathname.startsWith("/api/resources/") || pathname === "/api/customers" || pathname === "/api/customers/export";
}

function merchantRoutePermission(pathname, method = "GET") {
  const write = String(method || "GET").toUpperCase() !== "GET";
  if (pathname === "/" || pathname === "/index.html" || pathname === "/merchant") return "tenant.read";
  if (pathname === "/settings") return "tenant.settings.write";
  if (pathname === "/schedule") return "schedule.write";
  if (pathname === "/customers") return "crm.read";
  if (pathname === "/api/dashboard") return "tenant.read";
  if (pathname === "/api/store") return write ? "tenant.settings.write" : "tenant.read";
  if (pathname === "/api/settings") return write ? "tenant.settings.write" : "tenant.read";
  if (pathname === "/api/services") return write ? "service.write" : "tenant.read";
  if (pathname === "/api/staff") return write ? "staff.write" : "tenant.read";
  if (pathname === "/api/resources" || pathname.startsWith("/api/resources/")) return write ? "tenant.settings.write" : "tenant.read";
  if (pathname === "/api/customers/export") return "crm.export";
  if (pathname === "/api/customers") return "crm.read";
  return "tenant.read";
}

function merchantSessionValue(tenantId) {
  return encodeURIComponent(String(tenantId || TENANT_ID));
}

function isMerchantAuthenticated(request, tenantId, env) {
  if (isPlatformAuthenticated(request, env)) return true;
  const cookie = request.headers.get("cookie") || "";
  return cookie.split(";").map((part) => part.trim()).includes(`${MERCHANT_SESSION_COOKIE}=${merchantSessionValue(tenantId)}`);
}

function readCookie(request, name) {
  const cookie = request.headers.get("cookie") || "";
  const prefix = String(name || "") + "=";
  const match = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function stringToBase64Url(value) {
  return bytesToBase64Url(new TextEncoder().encode(String(value || "")));
}

function base64UrlToString(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function merchantSessionHmac(env, payloadSegment) {
  const secret = merchantSessionSecret(env);
  if (!secret) throw new Error("MERCHANT_SESSION_SECRET is not configured");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadSegment));
  return bytesToBase64Url(new Uint8Array(signature));
}


function randomNonce(size = 16) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function createMerchantTenantSelectionToken(env, input) {
  const identityId = String(input.identityId || "").trim();
  const tenantIds = Array.from(new Set((input.tenantIds || []).map((id) => String(id || "").trim()).filter(Boolean))).sort();
  if (!identityId || tenantIds.length < 2) throw new Error("Merchant tenant selection principal is incomplete");
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + merchantTenantSelectionTtlSeconds(env);
  const payload = { v: MERCHANT_TENANT_SELECTION_VERSION, purpose: MERCHANT_TENANT_SELECTION_PURPOSE, sub: identityId, tenant_ids: tenantIds, iat, exp, nonce: randomNonce() };
  if (input.authProvider) payload.auth_provider = String(input.authProvider).trim();
  const payloadSegment = stringToBase64Url(JSON.stringify(payload));
  const signatureSegment = await merchantSessionHmac(env, payloadSegment);
  return payloadSegment + "." + signatureSegment;
}

async function verifyMerchantTenantSelectionToken(env, token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return merchantAuthError("TENANT_SELECTION_TOKEN_INVALID", "Tenant selection token format is invalid");
  let payload;
  try {
    const expectedSignature = await merchantSessionHmac(env, parts[0]);
    if (!(await secureCompare(parts[1], expectedSignature))) return merchantAuthError("TENANT_SELECTION_TOKEN_INVALID", "Tenant selection token signature is invalid");
    payload = JSON.parse(base64UrlToString(parts[0]));
  } catch (error) {
    return merchantAuthError("TENANT_SELECTION_TOKEN_INVALID", "Tenant selection token cannot be decoded");
  }
  const now = Math.floor(Date.now() / 1000);
  if (Number(payload.v) !== MERCHANT_TENANT_SELECTION_VERSION) return merchantAuthError("TENANT_SELECTION_TOKEN_INVALID", "Tenant selection token version is invalid");
  if (payload.purpose !== MERCHANT_TENANT_SELECTION_PURPOSE) return merchantAuthError("TENANT_SELECTION_TOKEN_INVALID", "Tenant selection token purpose is invalid");
  if (!payload.sub || !Array.isArray(payload.tenant_ids) || payload.tenant_ids.length < 2 || !payload.iat || !payload.exp || !payload.nonce) return merchantAuthError("TENANT_SELECTION_TOKEN_INVALID", "Tenant selection token is missing required fields");
  if (Number(payload.iat) > now + 300) return merchantAuthError("TENANT_SELECTION_TOKEN_INVALID", "Tenant selection token issued_at is invalid");
  if (Number(payload.exp) <= now) return merchantAuthError("TENANT_SELECTION_TOKEN_EXPIRED", "Tenant selection token has expired");
  const tenantIds = Array.from(new Set(payload.tenant_ids.map((id) => String(id || "").trim()).filter(Boolean))).sort();
  if (tenantIds.length < 2) return merchantAuthError("TENANT_SELECTION_TOKEN_INVALID", "Tenant selection token has no selectable tenants");
  return { ok: true, payload: { v: MERCHANT_TENANT_SELECTION_VERSION, purpose: MERCHANT_TENANT_SELECTION_PURPOSE, sub: String(payload.sub), tenant_ids: tenantIds, iat: Number(payload.iat), exp: Number(payload.exp), nonce: String(payload.nonce) } };
}

function tenantSelectionFailureResponse(auth) {
  const status = auth.status || (auth.code === "TENANT_SELECTION_NOT_ALLOWED" ? 403 : 401);
  return Response.json({ ok: false, success: false, error: { code: auth.code || "TENANT_SELECTION_TOKEN_INVALID", message: auth.message || "Tenant selection failed" } }, { status, headers: jsonHeaders });
}

async function customerSessionHmac(env, payloadSegment) {
  const secret = customerSessionSecret(env);
  if (!secret) throw new Error("CUSTOMER_SESSION_SECRET is not configured");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadSegment));
  return bytesToBase64Url(new Uint8Array(signature));
}

function customerAuthError(code, message, status = 401) {
  return { ok: false, code, message, status };
}

function customerJsonError(code, message, status = 400, data = {}) {
  return Response.json({ ok: false, success: false, error: { code, message }, data }, { status, headers: jsonHeaders });
}

async function createCustomerRegistrationToken(env, input) {
  const identityId = String(input.identityId || "").trim();
  const tenantId = String(input.tenantId || "").trim();
  if (!identityId || !tenantId) throw new Error("Customer registration principal is incomplete");
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + customerRegistrationTtlSeconds(env);
  const payload = { v: 1, purpose: "customer_registration", sub: identityId, tenant_id: tenantId, iat, exp, nonce: randomNonce() };
  const payloadSegment = stringToBase64Url(JSON.stringify(payload));
  const signatureSegment = await customerSessionHmac(env, payloadSegment);
  return payloadSegment + "." + signatureSegment;
}

async function verifyCustomerRegistrationToken(env, token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return customerAuthError("CUSTOMER_REGISTRATION_TOKEN_INVALID", "Customer registration token format is invalid");
  let payload;
  try {
    const expectedSignature = await customerSessionHmac(env, parts[0]);
    if (!(await secureCompare(parts[1], expectedSignature))) return customerAuthError("CUSTOMER_REGISTRATION_TOKEN_INVALID", "Customer registration token signature is invalid");
    payload = JSON.parse(base64UrlToString(parts[0]));
  } catch (error) {
    return customerAuthError("CUSTOMER_REGISTRATION_TOKEN_INVALID", "Customer registration token cannot be decoded");
  }
  const now = Math.floor(Date.now() / 1000);
  if (Number(payload.v) !== 1 || payload.purpose !== "customer_registration") return customerAuthError("CUSTOMER_REGISTRATION_TOKEN_INVALID", "Customer registration token purpose is invalid");
  if (!payload.sub || !payload.tenant_id || !payload.iat || !payload.exp || !payload.nonce) return customerAuthError("CUSTOMER_REGISTRATION_TOKEN_INVALID", "Customer registration token is missing required fields");
  if (Number(payload.iat) > now + 300) return customerAuthError("CUSTOMER_REGISTRATION_TOKEN_INVALID", "Customer registration token issued_at is invalid");
  if (Number(payload.exp) <= now) return customerAuthError("CUSTOMER_REGISTRATION_TOKEN_EXPIRED", "Customer registration token has expired");
  return { ok: true, payload: { sub: String(payload.sub), tenant_id: String(payload.tenant_id), iat: Number(payload.iat), exp: Number(payload.exp), nonce: String(payload.nonce) } };
}

function setCustomerRegistrationCookie(env, token) {
  return CUSTOMER_REGISTRATION_COOKIE + "=" + encodeURIComponent(token) + "; Path=/; Max-Age=" + customerRegistrationTtlSeconds(env) + "; HttpOnly; Secure; SameSite=Lax";
}

function clearCustomerRegistrationCookie() {
  return CUSTOMER_REGISTRATION_COOKIE + "=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax";
}

function customerIsRegistrationComplete(customer) {
  return Boolean(String(customer?.name || "").trim() && String(customer?.phone || "").trim() && String(customer?.tenant_id || "").trim() && String(customer?.identity_id || "").trim() && String(customer?.status || "active") === "active");
}

function safeCustomerNext(value, fallback = "/member") {
  const next = String(value || "").trim();
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  const path = next.split("?")[0];
  return isCustomerMemberNext(path) ? next : fallback;
}


async function createCustomerSession(env, input) {
  const identityId = String(input.identityId || "").trim();
  const tenantId = String(input.tenantId || "").trim();
  const customerId = String(input.customerId || "").trim();
  if (!identityId || !tenantId || !customerId) throw new Error("Customer session principal is incomplete");
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + customerSessionTtlSeconds(env);
  return { v: CUSTOMER_SESSION_VERSION, sub: identityId, tenant_id: tenantId, customer_id: customerId, role: "Customer", iat, exp };
}

async function signCustomerSession(env, payload) {
  const payloadSegment = stringToBase64Url(JSON.stringify(payload));
  const signatureSegment = await customerSessionHmac(env, payloadSegment);
  return payloadSegment + "." + signatureSegment;
}

async function verifyCustomerSession(env, token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return customerAuthError("CUSTOMER_SESSION_INVALID", "Customer session format is invalid");
  let payload;
  try {
    const expectedSignature = await customerSessionHmac(env, parts[0]);
    if (!(await secureCompare(parts[1], expectedSignature))) return customerAuthError("CUSTOMER_SESSION_INVALID", "Customer session signature is invalid");
    payload = JSON.parse(base64UrlToString(parts[0]));
  } catch (error) {
    return customerAuthError("CUSTOMER_SESSION_INVALID", "Customer session cannot be decoded");
  }
  const now = Math.floor(Date.now() / 1000);
  if (Number(payload.v) !== CUSTOMER_SESSION_VERSION) return customerAuthError("CUSTOMER_SESSION_INVALID", "Customer session version is invalid");
  if (!payload.sub || !payload.tenant_id || !payload.customer_id || payload.role !== "Customer" || !payload.iat || !payload.exp) return customerAuthError("CUSTOMER_SESSION_INVALID", "Customer session is missing required fields");
  if (Number(payload.iat) > now + 300) return customerAuthError("CUSTOMER_SESSION_INVALID", "Customer session issued_at is invalid");
  if (Number(payload.exp) <= now) return customerAuthError("CUSTOMER_SESSION_EXPIRED", "Customer session has expired");
  return { ok: true, payload: { v: CUSTOMER_SESSION_VERSION, sub: String(payload.sub), tenant_id: String(payload.tenant_id), customer_id: String(payload.customer_id), role: "Customer", iat: Number(payload.iat), exp: Number(payload.exp) } };
}

async function loadCustomerPrincipal(env, identityId, tenantId, customerId) {
  if (!env.DB) return customerAuthError("CUSTOMER_SESSION_INVALID", "Database is not configured", 503);
  const rows = (await env.DB.prepare(`
    SELECT c.id AS customer_id, c.identity_id, c.tenant_id, c.name, c.phone, c.email, c.status AS customer_status,
      i.status AS identity_status, t.status AS tenant_status, t.name AS tenant_name
    FROM customers c
    JOIN identities i ON i.id = c.identity_id
    JOIN tenants t ON t.id = c.tenant_id
    WHERE c.id = ? AND c.tenant_id = ? AND c.identity_id = ?
  `).bind(customerId, tenantId, identityId).all()).results || [];
  if (rows.length !== 1) return customerAuthError("CUSTOMER_ACCESS_DENIED", "Customer principal is invalid", 403);
  const row = rows[0];
  if (String(row.identity_status || "active") !== "active") return customerAuthError("CUSTOMER_IDENTITY_INVALID", "Identity is not active", 403);
  if (!isActiveTenantStatus(row.tenant_status)) return customerAuthError("CUSTOMER_ACCESS_DENIED", "Tenant is not active", 403);
  if (String(row.customer_status || "active") !== "active") return customerAuthError("CUSTOMER_ACCESS_DENIED", "Customer is not active", 403);
  return { ok: true, principal: { identityId, tenantId, customerId, role: "Customer", tenantName: row.tenant_name || tenantId, customer: row } };
}

async function readCustomerSession(request, env) {
  const token = readCookie(request, CUSTOMER_SESSION_COOKIE);
  if (!token) return customerAuthError("CUSTOMER_SESSION_REQUIRED", "Customer session is required");
  const verified = await verifyCustomerSession(env, decodeURIComponent(token));
  if (!verified.ok) return verified;
  const principal = await loadCustomerPrincipal(env, verified.payload.sub, verified.payload.tenant_id, verified.payload.customer_id);
  if (!principal.ok) return principal;
  return { ok: true, payload: verified.payload, principal: principal.principal, identityId: principal.principal.identityId, tenantId: principal.principal.tenantId, customerId: principal.principal.customerId, role: "Customer" };
}

async function requireCustomerSession(request, env, expectedTenantId = "") {
  const session = await readCustomerSession(request, env);
  if (!session.ok) return session;
  const tenantId = String(expectedTenantId || "").trim();
  if (tenantId && session.tenantId !== tenantId) return customerAuthError("CUSTOMER_TENANT_SCOPE_MISMATCH", "Request tenant does not match customer session", 403);
  if (await requestTenantScopeMismatch(request, session.tenantId)) return customerAuthError("CUSTOMER_TENANT_SCOPE_MISMATCH", "Request tenant does not match customer session", 403);
  return session;
}

async function setCustomerSessionCookie(env, principal) {
  const payload = await createCustomerSession(env, principal);
  const token = await signCustomerSession(env, payload);
  const ttl = Math.max(1, Number(payload.exp || 0) - Math.floor(Date.now() / 1000));
  return CUSTOMER_SESSION_COOKIE + "=" + encodeURIComponent(token) + "; Path=/; Max-Age=" + ttl + "; HttpOnly; Secure; SameSite=Lax";
}

function clearCustomerSessionCookie() {
  return CUSTOMER_SESSION_COOKIE + "=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax";
}

function customerAuthFailureResponse(request, auth, tenantId = "") {
  const status = auth.status || 401;
  if (new URL(request.url).pathname.startsWith("/api/")) return Response.json({ ok: false, success: false, error: { code: auth.code || "CUSTOMER_SESSION_REQUIRED", message: auth.message || "customer login required" } }, { status, headers: jsonHeaders });
  const current = new URL(request.url);
  const url = new URL("/member-login", request.url);
  if (tenantId) url.searchParams.set("tenant", tenantId);
  url.searchParams.set("next", current.pathname + current.search);
  url.searchParams.set("error", auth.code || "CUSTOMER_SESSION_REQUIRED");
  return new Response(null, { status: 302, headers: { location: url.toString(), "set-cookie": clearCustomerSessionCookie(), "cache-control": "no-store" } });
}
function normalizeMerchantRole(role) {
  const raw = String(role || "").trim().toLowerCase();
  if (raw === "tenantowner" || raw === "owner") return "TenantOwner";
  if (raw === "tenantmanager" || raw === "manager" || raw === "admin") return "TenantManager";
  if (raw === "staff" || raw === "viewer") return "Staff";
  return "";
}

function isActiveTenantStatus(status) {
  const value = String(status || "active").trim().toLowerCase();
  return !value || value === "active" || value === "trial";
}

function merchantRolePermissions(role) {
  const normalized = normalizeMerchantRole(role);
  const owner = ["tenant.read", "tenant.settings.write", "service.write", "staff.write", "schedule.write", "booking.read", "booking.write", "crm.read", "crm.write", "crm.export", "line.settings.write"];
  const manager = ["tenant.read", "tenant.settings.write", "service.write", "staff.write", "schedule.write", "booking.read", "booking.write", "crm.read", "crm.write", "crm.export", "line.settings.write"];
  const staff = ["tenant.read", "booking.read", "booking.write", "schedule.write"];
  if (normalized === "TenantOwner") return new Set(owner);
  if (normalized === "TenantManager") return new Set(manager);
  if (normalized === "Staff") return new Set(staff);
  return new Set();
}

function hasMerchantPermission(role, permission) {
  return merchantRolePermissions(role).has(permission);
}

function merchantAuthError(code, message, status = 401) {
  return { ok: false, code, message, status };
}

async function createMerchantSession(env, input) {
  if (!merchantSignedSessionEnabled(env)) throw new Error("Signed merchant session is disabled");
  const identityId = String(input.identityId || "").trim();
  const tenantId = String(input.tenantId || "").trim();
  const normalizedRole = normalizeMerchantRole(input.role);
  if (!identityId || !tenantId || !normalizedRole) throw new Error("Merchant session principal is incomplete");
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + merchantSessionTtlSeconds(env);
  return { v: MERCHANT_SESSION_VERSION, sub: identityId, tenant_id: tenantId, role: normalizedRole, iat, exp };
}

async function signMerchantSession(env, payload) {
  const payloadSegment = stringToBase64Url(JSON.stringify(payload));
  const signatureSegment = await merchantSessionHmac(env, payloadSegment);
  return payloadSegment + "." + signatureSegment;
}

async function verifyMerchantSession(env, token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return merchantAuthError("SESSION_INVALID", "Merchant session format is invalid");
  let payload;
  try {
    const expectedSignature = await merchantSessionHmac(env, parts[0]);
    if (!(await secureCompare(parts[1], expectedSignature))) return merchantAuthError("SESSION_INVALID", "Merchant session signature is invalid");
    payload = JSON.parse(base64UrlToString(parts[0]));
  } catch (error) {
    return merchantAuthError("SESSION_INVALID", "Merchant session cannot be decoded");
  }
  const now = Math.floor(Date.now() / 1000);
  if (Number(payload.v) !== MERCHANT_SESSION_VERSION) return merchantAuthError("SESSION_VERSION_UNSUPPORTED", "Merchant session version is unsupported");
  if (!payload.sub || !payload.tenant_id || !payload.role || !payload.iat || !payload.exp) return merchantAuthError("SESSION_INVALID", "Merchant session is missing required fields");
  if (Number(payload.iat) > now + 300) return merchantAuthError("SESSION_INVALID", "Merchant session issued_at is invalid");
  if (Number(payload.exp) <= now) return merchantAuthError("SESSION_EXPIRED", "Merchant session has expired");
  const role = normalizeMerchantRole(payload.role);
  if (!role) return merchantAuthError("SESSION_INVALID", "Merchant session role is invalid");
  return { ok: true, payload: { v: MERCHANT_SESSION_VERSION, sub: String(payload.sub), tenant_id: String(payload.tenant_id), role, iat: Number(payload.iat), exp: Number(payload.exp) } };
}

async function loadMerchantPrincipal(env, identityId, tenantId) {
  if (!env.DB) return merchantAuthError("AUTH_REQUIRED", "Database is not configured", 503);
  const sql = "SELECT a.id AS admin_id, a.identity_id, a.tenant_id, a.role, a.status AS admin_status, " +
    "i.status AS identity_status, t.status AS tenant_status, t.name AS tenant_name " +
    "FROM tenant_admins a JOIN identities i ON i.id = a.identity_id JOIN tenants t ON t.id = a.tenant_id " +
    "WHERE a.identity_id = ? AND a.tenant_id = ?";
  const rows = (await env.DB.prepare(sql).bind(identityId, tenantId).all()).results || [];
  const activeRows = rows.filter((row) => String(row.admin_status || "active") === "active" && String(row.identity_status || "active") === "active" && isActiveTenantStatus(row.tenant_status));
  if (activeRows.length !== 1) return merchantAuthError("SESSION_PRINCIPAL_INVALID", "Merchant principal is not active", 403);
  const row = activeRows[0];
  const role = normalizeMerchantRole(row.role);
  if (!role) return merchantAuthError("SESSION_PRINCIPAL_INVALID", "Merchant role is invalid", 403);
  return { ok: true, principal: { identityId, tenantId, role, adminId: row.admin_id, tenantName: row.tenant_name || tenantId, permissions: Array.from(merchantRolePermissions(role)) } };
}

async function readMerchantSession(request, env) {
  const token = readCookie(request, MERCHANT_SESSION_COOKIE);
  if (!token) return merchantAuthError("AUTH_REQUIRED", "Merchant session is required");
  if (!token.includes(".")) {
    if (merchantLegacySessionCompatEnabled(env)) return merchantAuthError("AUTH_REQUIRED", "Legacy merchant session requires re-login");
    return merchantAuthError("SESSION_INVALID", "Legacy merchant session is not accepted");
  }
  const verified = await verifyMerchantSession(env, decodeURIComponent(token));
  if (!verified.ok) return verified;
  const principal = await loadMerchantPrincipal(env, verified.payload.sub, verified.payload.tenant_id);
  if (!principal.ok) return principal;
  if (verified.payload.role !== principal.principal.role) return merchantAuthError("SESSION_PRINCIPAL_INVALID", "Merchant role changed; please login again", 403);
  return { ok: true, payload: verified.payload, principal: principal.principal, tenantId: principal.principal.tenantId, role: principal.principal.role };
}

async function requestTenantScopeMismatch(request, sessionTenantId) {
  const url = new URL(request.url);
  const queryTenant = String(url.searchParams.get("tenant") || url.searchParams.get("tenant_id") || "").trim();
  if (queryTenant && queryTenant !== sessionTenantId) return true;
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return false;
  const type = String(request.headers.get("content-type") || "").toLowerCase();
  if (!type.includes("application/json")) return false;
  try {
    const payload = await request.clone().json();
    const bodyTenant = String(payload?.tenantId || payload?.tenant_id || "").trim();
    return Boolean(bodyTenant && bodyTenant !== sessionTenantId);
  } catch (error) {
    return false;
  }
}

async function requireMerchantSession(request, env) {
  const session = await readMerchantSession(request, env);
  if (!session.ok) return session;
  if (await requestTenantScopeMismatch(request, session.tenantId)) return merchantAuthError("TENANT_SCOPE_MISMATCH", "Request tenant does not match merchant session", 403);
  return session;
}

function requireMerchantPermission(session, permission) {
  if (!session?.ok) return merchantAuthError("AUTH_REQUIRED", "Merchant session is required");
  if (!hasMerchantPermission(session.role, permission)) return merchantAuthError("PERMISSION_DENIED", "Merchant permission denied", 403);
  return { ok: true };
}

async function setMerchantSessionCookie(env, principal) {
  const payload = await createMerchantSession(env, principal);
  const token = await signMerchantSession(env, payload);
  const ttl = Math.max(1, Number(payload.exp || 0) - Math.floor(Date.now() / 1000));
  return MERCHANT_SESSION_COOKIE + "=" + encodeURIComponent(token) + "; Path=/; Max-Age=" + ttl + "; HttpOnly; Secure; SameSite=Lax";
}

function clearMerchantSessionCookie() {
  return MERCHANT_SESSION_COOKIE + "=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax";
}

function merchantAuthFailureResponse(request, auth, tenantId = "") {
  const status = auth.status || 401;
  if (new URL(request.url).pathname.startsWith("/api/")) return Response.json({ ok: false, error: auth.code || "AUTH_REQUIRED", message: auth.message || "merchant login required" }, { status, headers: jsonHeaders });
  const url = new URL("/merchant-login", request.url);
  if (tenantId) url.searchParams.set("tenant", tenantId);
  url.searchParams.set("next", new URL(request.url).pathname + new URL(request.url).search);
  url.searchParams.set("error", auth.code || "1");
  return new Response(null, { status: 302, headers: { location: url.toString(), "set-cookie": clearMerchantSessionCookie(), "cache-control": "no-store" } });
}

function normalizeMerchantPhone(value) {
  const digits = String(value || "").trim().replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("886") && digits.length >= 11) return `0${digits.slice(3)}`;
  if (digits.length === 9 && digits.startsWith("9")) return `0${digits}`;
  return digits;
}

function normalizeMerchantEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function normalizeMerchantAccount(value) {
  const raw = String(value || "").trim();
  return {
    raw,
    phone: normalizeMerchantPhone(raw),
    email: normalizeMerchantEmail(raw),
    name: raw.replace(/\s+/g, " ")
  };
}

function normalizeCustomerPhone(value) {
  return normalizeMerchantPhone(value);
}

function normalizeCustomerBirthdayCredential(value) {
  const digits = String(value || "").trim().replace(/\D/g, "");
  if (digits.length !== 8) return "";
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return "";
  return digits;
}

function customerBirthdayMatches(stored, input) {
  const left = normalizeCustomerBirthdayCredential(stored);
  const right = normalizeCustomerBirthdayCredential(input);
  return Boolean(left && right && left === right);
}
function isAllowedMerchantRole(role) {
  return ["owner", "admin", "manager", "staff", "viewer"].includes(String(role || "admin").trim().toLowerCase());
}

function merchantLoginFailureUrl(request, { tenantId = "", explicitTenant = false, next = "/merchant", error = "1" } = {}) {
  const url = new URL("/merchant-login", request.url);
  if (explicitTenant && tenantId) url.searchParams.set("tenant", tenantId);
  if (next) url.searchParams.set("next", next);
  if (error) url.searchParams.set("error", error);
  return url;
}

function merchantLoginJsonError(code, message, status = 400, data = {}) {
  return Response.json({ ok: false, success: false, error: { code, message }, data }, { status, headers: jsonHeaders });
}

function maskPublicId(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= 8) return text.slice(0, 2) + "***";
  return text.slice(0, 6) + "***" + text.slice(-4);
}

async function shortHash(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value || "")));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

async function merchantLoginLog(event, fields = {}) {
  const safe = { event, at: new Date().toISOString() };
  for (const [key, value] of Object.entries(fields || {})) {
    if (value === undefined || value === null || value === "") continue;
    if (["account", "phone", "email", "line_user_id", "password", "cookie"].includes(key)) safe[`${key}_hash`] = await shortHash(value);
    else safe[key] = value;
  }
  console.log(JSON.stringify({ scope: "merchant_login", ...safe }));
}

function merchantAdminMatchesAccount(admin, account, { allowName = false } = {}) {
  if (account.phone && normalizeMerchantPhone(admin.phone) === account.phone) return true;
  if (account.email && normalizeMerchantEmail(admin.email) === account.email) return true;
  if (allowName && account.name && String(admin.name || "").trim().replace(/\s+/g, " ") === account.name) return true;
  return false;
}

async function findMerchantAdminMatches(env, account, explicitTenantId = "") {
  if (!env.DB) return [];
  const allowName = Boolean(explicitTenantId);
  if (!explicitTenantId && !account.phone && !account.email) return [];
  const sql = `
    SELECT a.id, a.tenant_id, a.name, a.phone, a.email, a.line_user_id, a.role, a.status, a.identity_id, t.name AS tenant_name
    FROM tenant_admins a
    LEFT JOIN tenants t ON t.id = a.tenant_id
    WHERE (a.status IS NULL OR a.status = 'active') ${explicitTenantId ? "AND a.tenant_id = ?" : ""}
  `;
  const query = explicitTenantId ? env.DB.prepare(sql).bind(explicitTenantId) : env.DB.prepare(sql);
  const rows = (await query.all()).results || [];
  return rows.filter((admin) => merchantAdminMatchesAccount(admin, account, { allowName }));
}

function classifyMerchantAdminMatches(matches) {
  const byTenant = new Map();
  for (const match of matches) {
    const tenantId = String(match.tenant_id || "").trim();
    if (!tenantId) continue;
    if (!byTenant.has(tenantId)) byTenant.set(tenantId, []);
    byTenant.get(tenantId).push(match);
  }
  const tenants = Array.from(byTenant.entries()).map(([tenantId, rows]) => ({ tenantId, rows }));
  const conflict = tenants.find((entry) => entry.rows.length > 1);
  if (conflict) return { status: "conflict", tenantId: conflict.tenantId, rows: conflict.rows };
  if (tenants.length === 0) return { status: "none", rows: [] };
  if (tenants.length > 1) return { status: "tenant_selection", tenants };
  return { status: "single", admin: tenants[0].rows[0] };
}

async function findScopedLineIdentity(env, admin) {
  const lineUserId = String(admin.line_user_id || "").trim();
  const tenantId = String(admin.tenant_id || "").trim();
  if (!lineUserId || !tenantId) return null;
  const providerUid = `tenant:${tenantId}:${lineUserId}`;
  const row = await env.DB.prepare(`
    SELECT ia.identity_id, i.status
    FROM identity_auth ia
    JOIN identities i ON i.id = ia.identity_id
    WHERE ia.provider = 'LINE' AND ia.provider_uid = ?
  `).bind(providerUid).first();
  if (!row?.identity_id || String(row.status || "active") !== "active") return null;
  return String(row.identity_id || "").trim() || null;
}

async function resolveMerchantIdentity(env, admin) {
  const adminId = String(admin.id || "").trim();
  const role = String(admin.role || "admin").trim().toLowerCase() || "admin";
  if (!adminId) return { ok: false, code: "MERCHANT_ADMIN_INVALID", message: "店家管理員資料不完整，請聯絡平台管理員。" };
  if (!isAllowedMerchantRole(role)) return { ok: false, code: "MERCHANT_ROLE_INVALID", message: "店家管理員角色設定錯誤，請聯絡平台管理員。" };
  if (String(admin.status || "active") !== "active") return { ok: false, code: "MERCHANT_ADMIN_DISABLED", message: "店家管理員已停用。" };

  const existingIdentityId = String(admin.identity_id || "").trim();
  if (existingIdentityId) {
    const identity = await env.DB.prepare("SELECT id, status FROM identities WHERE id = ?").bind(existingIdentityId).first();
    if (!identity?.id || String(identity.status || "active") !== "active") {
      await merchantLoginLog("broken_identity_reference", { tenant_id: admin.tenant_id, admin_id: adminId, identity_id: existingIdentityId });
      return { ok: false, code: "BROKEN_IDENTITY_REFERENCE", message: "店家身份設定異常，請聯絡平台管理員。" };
    }
    return { ok: true, identityId: existingIdentityId, created: false, linked: false };
  }

  const scopedLineIdentity = await findScopedLineIdentity(env, admin);
  if (scopedLineIdentity) {
    await env.DB.prepare("UPDATE tenant_admins SET identity_id = ?, updated_at = datetime('now') WHERE id = ? AND identity_id IS NULL").bind(scopedLineIdentity, adminId).run();
    const linked = await env.DB.prepare("SELECT identity_id FROM tenant_admins WHERE id = ?").bind(adminId).first();
    const identityId = String(linked?.identity_id || "").trim();
    if (identityId) {
      await merchantLoginLog("identity_linked", { tenant_id: admin.tenant_id, admin_id: adminId, identity_id: identityId });
      return { ok: true, identityId, created: false, linked: true };
    }
  }

  const suffix = await shortHash(`tenant_admin:${adminId}`);
  const identityId = `idn_admin_${suffix}`;
  const insertIdentity = env.DB.prepare("INSERT OR IGNORE INTO identities (id, status, created_at, updated_at) VALUES (?, 'active', datetime('now'), datetime('now'))").bind(identityId);
  const linkAdmin = env.DB.prepare("UPDATE tenant_admins SET identity_id = ?, updated_at = datetime('now') WHERE id = ? AND identity_id IS NULL").bind(identityId, adminId);
  if (typeof env.DB.batch === "function") await env.DB.batch([insertIdentity, linkAdmin]);
  else {
    await insertIdentity.run();
    await linkAdmin.run();
  }
  const verified = await env.DB.prepare("SELECT a.identity_id, i.status FROM tenant_admins a LEFT JOIN identities i ON i.id = a.identity_id WHERE a.id = ?").bind(adminId).first();
  const finalIdentityId = String(verified?.identity_id || "").trim();
  if (!finalIdentityId || String(verified?.status || "") !== "active") {
    await merchantLoginLog("identity_create_failed", { tenant_id: admin.tenant_id, admin_id: adminId, identity_id: identityId });
    return { ok: false, code: "IDENTITY_RESOLUTION_FAILED", message: "店家身份建立失敗，請稍後再試。" };
  }
  await merchantLoginLog(finalIdentityId === identityId ? "identity_created" : "identity_race_reused", { tenant_id: admin.tenant_id, admin_id: adminId, identity_id: finalIdentityId });
  return { ok: true, identityId: finalIdentityId, created: finalIdentityId === identityId, linked: false };
}


async function resolveMerchantSelectionIdentity(env, tenantEntries) {
  const admins = (tenantEntries || []).map((entry) => entry.rows?.[0]).filter(Boolean);
  const adminIdentityIds = admins.map((admin) => String(admin.identity_id || "").trim());
  const identityIds = Array.from(new Set(adminIdentityIds.filter(Boolean)));
  if (admins.length < 2 || adminIdentityIds.some((id) => !id) || identityIds.length !== 1) {
    return merchantAuthError("TENANT_SELECTION_PRINCIPAL_INVALID", "Tenant selection requires linked identity records", 403);
  }
  const identityId = identityIds[0];
  const identity = await env.DB.prepare("SELECT id, status FROM identities WHERE id = ?").bind(identityId).first();
  if (!identity?.id || String(identity.status || "active") !== "active") return merchantAuthError("TENANT_SELECTION_PRINCIPAL_INVALID", "Merchant identity is not active", 403);
  return { ok: true, identityId };
}

async function buildMerchantTenantSelection(env, tenantEntries, options = {}) {
  const identity = await resolveMerchantSelectionIdentity(env, tenantEntries);
  if (!identity.ok) return identity;
  const tenants = [];
  for (const entry of tenantEntries || []) {
    const tenantId = String(entry.tenantId || entry.rows?.[0]?.tenant_id || "").trim();
    const principal = await loadMerchantPrincipal(env, identity.identityId, tenantId);
    if (!principal.ok) return merchantAuthError("TENANT_SELECTION_PRINCIPAL_INVALID", "Merchant tenant permission is not active", principal.status || 403);
    tenants.push({ tenant_id: tenantId, tenant_name: principal.principal.tenantName || tenantId, role: principal.principal.role });
  }
  if (tenants.length < 2) return merchantAuthError("TENANT_SELECTION_NOT_ALLOWED", "Tenant selection requires at least two active tenants", 403);
  const selectionToken = await createMerchantTenantSelectionToken(env, { identityId: identity.identityId, tenantIds: tenants.map((tenant) => tenant.tenant_id), authProvider: options.authProvider || "" });
  return { ok: true, identityId: identity.identityId, selectionToken, expiresIn: merchantTenantSelectionTtlSeconds(env), tenants };
}

async function handleMerchantSelectTenant(request, env) {
  if (!env.DB) return Response.json({ ok: false, success: false, error: { code: "DATABASE_NOT_CONFIGURED", message: "Database is not configured" } }, { status: 503, headers: jsonHeaders });
  if (!merchantSessionSecret(env)) return Response.json({ ok: false, success: false, error: { code: "SESSION_CONFIG_INVALID", message: "Merchant session secret is not configured." } }, { status: 503, headers: jsonHeaders });
  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    return tenantSelectionFailureResponse(merchantAuthError("TENANT_SELECTION_TOKEN_INVALID", "Tenant selection request is invalid"));
  }
  const token = String(payload?.selection_token || "").trim();
  const requestedTenantId = String(payload?.tenant_id || "").trim();
  const next = String(payload?.next || "/merchant").trim() || "/merchant";
  const verified = await verifyMerchantTenantSelectionToken(env, token);
  if (!verified.ok) return tenantSelectionFailureResponse(verified);
  if (!requestedTenantId || !verified.payload.tenant_ids.includes(requestedTenantId)) return tenantSelectionFailureResponse(merchantAuthError("TENANT_SELECTION_NOT_ALLOWED", "Selected tenant is not allowed", 403));
  const principal = await loadMerchantPrincipal(env, verified.payload.sub, requestedTenantId);
  if (!principal.ok) return tenantSelectionFailureResponse(merchantAuthError("TENANT_SELECTION_PRINCIPAL_INVALID", "Merchant tenant permission is not active", principal.status || 403));
  const redirect = next.startsWith("/") ? next + (next.includes("?") ? "&" : "?") + "tenant=" + encodeURIComponent(requestedTenantId) : "/merchant?tenant=" + encodeURIComponent(requestedTenantId);
  const sessionCookie = await setMerchantSessionCookie(env, { identityId: verified.payload.sub, tenantId: requestedTenantId, role: principal.principal.role });
  await merchantLoginLog("tenant_selection_success", { tenant_id: requestedTenantId, identity_id: verified.payload.sub, admin_id: principal.principal.adminId });
  return Response.json({ ok: true, success: true, data: { redirect, tenant_id: requestedTenantId, role: principal.principal.role } }, { headers: { ...jsonHeaders, "set-cookie": sessionCookie } });
}

async function handleMerchantLogin(request, env) {
  const form = await request.formData();
  const explicitTenantId = String(form.get("tenant") || "").trim();
  const hasExplicitTenant = Boolean(explicitTenantId);
  const requestedTenantId = explicitTenantId || defaultTenantId(env);
  const next = String(form.get("next") || "/merchant").trim() || "/merchant";
  const account = normalizeMerchantAccount(form.get("account"));
  const password = String(form.get("password") || "").trim();
  const failUrl = () => merchantLoginFailureUrl(request, { tenantId: requestedTenantId, explicitTenant: hasExplicitTenant, next, error: "1" });

  const expectedMerchantPassword = merchantAdminPassword(env);
  if (!env.DB || !expectedMerchantPassword || !account.raw || !(await secureCompare(password, expectedMerchantPassword))) {
    await merchantLoginLog("login_failed", { reason: "invalid_credentials", tenant_id: hasExplicitTenant ? requestedTenantId : "", account: account.raw });
    return Response.redirect(failUrl(), 302);
  }

  await ensurePlatformSchema(env);
  const matches = await findMerchantAdminMatches(env, account, hasExplicitTenant ? requestedTenantId : "");
  const classified = classifyMerchantAdminMatches(matches);

  if (classified.status === "none") {
    await merchantLoginLog("login_failed", { reason: "no_admin_match", tenant_id: hasExplicitTenant ? requestedTenantId : "", account: account.raw });
    return Response.redirect(failUrl(), 302);
  }

  if (classified.status === "conflict") {
    await merchantLoginLog("merchant_account_conflict", { tenant_id: classified.tenantId, account: account.raw, count: classified.rows.length });
    return merchantLoginJsonError("MERCHANT_ACCOUNT_CONFLICT", "此店家中存在重複管理者帳號，請聯絡平台管理員。", 409);
  }

  if (classified.status === "tenant_selection") {
    if (!merchantSessionSecret(env)) return merchantLoginJsonError("SESSION_CONFIG_INVALID", "Merchant session secret is not configured.", 503);
    const selection = await buildMerchantTenantSelection(env, classified.tenants);
    if (!selection.ok) {
      await merchantLoginLog("tenant_selection_failed", { reason: selection.code, account: account.raw, count: classified.tenants.length });
      return merchantLoginJsonError(selection.code || "TENANT_SELECTION_PRINCIPAL_INVALID", selection.message || "Unable to create tenant selection flow. Please contact platform admin.", selection.status || 403);
    }
    await merchantLoginLog("tenant_selection_required", { account: account.raw, count: selection.tenants.length, identity_id: selection.identityId });
    return merchantLoginJsonError("TENANT_SELECTION_REQUIRED", "Please choose a store to manage.", 409, { selection_token: selection.selectionToken, expires_in: selection.expiresIn, tenants: selection.tenants });
  }

  const admin = classified.admin;
  let identityResult = { ok: true, identityId: String(admin.identity_id || "").trim(), disabled: true };
  if (merchantIdentityResolutionEnabled(env)) identityResult = await resolveMerchantIdentity(env, admin);
  if (!identityResult.ok) {
    await merchantLoginLog("login_failed", { reason: identityResult.code, tenant_id: admin.tenant_id, admin_id: admin.id });
    return merchantLoginJsonError(identityResult.code, identityResult.message, 500);
  }

  const loginTenantId = String(admin.tenant_id || "").trim();
  if (!merchantSessionSecret(env)) return merchantLoginJsonError("SESSION_CONFIG_INVALID", "Merchant session secret is not configured.", 503);
  const principal = await loadMerchantPrincipal(env, identityResult.identityId, loginTenantId);
  if (!principal.ok) {
    await merchantLoginLog("login_failed", { reason: principal.code, tenant_id: loginTenantId, admin_id: admin.id, identity_id: identityResult.identityId || "" });
    return merchantLoginJsonError(principal.code, principal.message, principal.status || 500);
  }
  const redirectTarget = next.startsWith("/") ? next + (next.includes("?") ? "&" : "?") + "tenant=" + encodeURIComponent(loginTenantId) : "/merchant?tenant=" + encodeURIComponent(loginTenantId);
  await merchantLoginLog("login_success", { tenant_id: loginTenantId, admin_id: admin.id, identity_id: identityResult.identityId || "", identity_mode: identityResult.disabled ? "disabled" : identityResult.created ? "created" : identityResult.linked ? "linked" : "existing" });
  const sessionCookie = await setMerchantSessionCookie(env, { identityId: identityResult.identityId, tenantId: loginTenantId, role: principal.principal.role });
  return redirectWithCookie(redirectTarget, sessionCookie);
}
async function merchantLoginLiffId(env) {
  const envLiffId = envValue(env, "MERCHANT_LIFF_ID");
  if (envLiffId) return envLiffId;
  if (!env.DB) return "";
  try {
    const row = await env.DB.prepare("SELECT login_liff_id FROM platform_line_oa_settings WHERE id = 'platform' LIMIT 1").first();
    return String(row?.login_liff_id || "").trim();
  } catch (error) {
    return "";
  }
}

function merchantLiffJsonError(code, message, status = 400, data = {}) {
  return Response.json({ ok: false, success: false, error: { code, message }, data }, { status, headers: jsonHeaders });
}

function lineProviderScope(channelId) {
  const scopedChannelId = String(channelId || "").trim();
  return scopedChannelId ? `LINE:${scopedChannelId}` : "";
}

async function verifyLineIdToken(idToken, channelId) {
  const token = String(idToken || "").trim();
  const clientId = String(channelId || "").trim();
  if (!token) return merchantAuthError("LIFF_TOKEN_REQUIRED", "LINE ID token is required", 401);
  if (!clientId) return merchantAuthError("LIFF_PROVIDER_SCOPE_INVALID", "LINE Login Channel ID is not configured", 503);
  const body = new URLSearchParams({ id_token: token, client_id: clientId });
  let response;
  try {
    response = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body
    });
  } catch (error) {
    return merchantAuthError("LIFF_TOKEN_INVALID", "LINE token verification failed", 401);
  }
  let data = {};
  try { data = await response.json(); } catch (error) {}
  if (!response.ok) {
    const message = String(data?.error_description || data?.error || "LINE token is invalid");
    const code = message.toLowerCase().includes("expired") ? "LIFF_TOKEN_EXPIRED" : "LIFF_TOKEN_INVALID";
    return merchantAuthError(code, "LINE token is invalid", 401);
  }
  if (String(data?.aud || "") !== clientId) return merchantAuthError("LIFF_AUDIENCE_INVALID", "LINE token audience is invalid", 401);
  if (String(data?.iss || "") && String(data.iss) !== "https://access.line.me") return merchantAuthError("LIFF_TOKEN_INVALID", "LINE token issuer is invalid", 401);
  if (Number(data?.exp || 0) && Number(data.exp) <= Math.floor(Date.now() / 1000)) return merchantAuthError("LIFF_TOKEN_EXPIRED", "LINE token has expired", 401);
  const subject = String(data?.sub || "").trim();
  if (!subject) return merchantAuthError("LIFF_TOKEN_INVALID", "LINE token has no subject", 401);
  return { ok: true, lineUserId: subject, profile: { displayName: data?.name || "", pictureUrl: data?.picture || "" } };
}

async function verifyLineAccessToken(accessToken, channelId) {
  const token = String(accessToken || "").trim();
  const clientId = String(channelId || "").trim();
  if (!token) return merchantAuthError("LIFF_TOKEN_REQUIRED", "LINE access token is required", 401);
  if (!clientId) return merchantAuthError("LIFF_PROVIDER_SCOPE_INVALID", "LINE Login Channel ID is not configured", 503);
  let verifyResponse;
  try {
    verifyResponse = await fetch("https://api.line.me/oauth2/v2.1/verify?access_token=" + encodeURIComponent(token));
  } catch (error) {
    return merchantAuthError("LIFF_TOKEN_INVALID", "LINE access token verification failed", 401);
  }
  let verifyData = {};
  try { verifyData = await verifyResponse.json(); } catch (error) {}
  if (!verifyResponse.ok || String(verifyData?.client_id || "") !== clientId || Number(verifyData?.expires_in || 0) <= 0) {
    return merchantAuthError("LIFF_TOKEN_INVALID", "LINE access token is invalid", 401);
  }
  let profileResponse;
  try {
    profileResponse = await fetch("https://api.line.me/v2/profile", { headers: { authorization: "Bearer " + token } });
  } catch (error) {
    return merchantAuthError("LIFF_TOKEN_INVALID", "LINE profile lookup failed", 401);
  }
  let profile = {};
  try { profile = await profileResponse.json(); } catch (error) {}
  if (!profileResponse.ok || !profile?.userId) return merchantAuthError("LIFF_TOKEN_INVALID", "LINE profile lookup failed", 401);
  return { ok: true, lineUserId: String(profile.userId || "").trim(), profile: { displayName: profile.displayName || "", pictureUrl: profile.pictureUrl || "" } };
}

async function verifyMerchantLiffLineSubject(env, payload) {
  const settings = await platformLineSettings(env);
  const channelId = String(settings?.channel_id || "").trim();
  const idToken = String(payload?.id_token || payload?.idToken || "").trim();
  if (idToken) return verifyLineIdToken(idToken, channelId);
  const accessToken = String(payload?.access_token || payload?.accessToken || "").trim();
  return verifyLineAccessToken(accessToken, channelId);
}

async function resolveLineIdentityAuth(env, verifiedLine, channelId) {
  const lineUserId = String(verifiedLine?.lineUserId || "").trim();
  const provider = lineProviderScope(channelId);
  if (!lineUserId || !provider) return merchantAuthError("LIFF_PROVIDER_SCOPE_INVALID", "LINE provider scope is invalid", 403);
  const existing = await env.DB.prepare(`
    SELECT ia.id, ia.identity_id, i.status
    FROM identity_auth ia
    JOIN identities i ON i.id = ia.identity_id
    WHERE ia.provider = ? AND ia.provider_uid = ?
  `).bind(provider, lineUserId).all();
  const authRows = existing.results || [];
  if (authRows.length > 1) return merchantAuthError("LIFF_IDENTITY_INVALID", "LINE identity is duplicated", 403);
  if (authRows.length === 1) {
    const row = authRows[0];
    if (!row.identity_id || String(row.status || "active") !== "active") return merchantAuthError("LIFF_IDENTITY_INVALID", "LINE identity is not active", 403);
    await env.DB.prepare("UPDATE identity_auth SET verified = 1, verified_at = datetime('now'), last_login_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").bind(row.id).run();
    return { ok: true, identityId: String(row.identity_id), provider, linked: false, created: false };
  }

  const legacyRows = (await env.DB.prepare(`
    SELECT a.id, a.identity_id
    FROM tenant_admins a
    JOIN tenants t ON t.id = a.tenant_id
    WHERE a.line_user_id = ? AND (a.status IS NULL OR a.status = 'active') AND (t.status IS NULL OR t.status IN ('active','trial'))
  `).bind(lineUserId).all()).results || [];
  if (!legacyRows.length) return merchantAuthError("LIFF_IDENTITY_LINK_REQUIRED", "LINE account is not linked to a merchant admin", 403);
  const identityIds = Array.from(new Set(legacyRows.map((row) => String(row.identity_id || "").trim()).filter(Boolean)));
  if (identityIds.length > 1) return merchantAuthError("LIFF_IDENTITY_INVALID", "LINE account points to conflicting identities", 403);
  const identityId = identityIds[0] || `idn_line_${await shortHash(provider + ":" + lineUserId)}`;
  const metadata = JSON.stringify({ line_channel_id: channelId, line_user_id_hash: await shortHash(lineUserId), display_name: verifiedLine?.profile?.displayName || "", picture_url: verifiedLine?.profile?.pictureUrl || "" });
  await env.DB.prepare("INSERT OR IGNORE INTO identities (id, status, created_at, updated_at) VALUES (?, 'active', datetime('now'), datetime('now'))").bind(identityId).run();
  const identity = await env.DB.prepare("SELECT id, status FROM identities WHERE id = ?").bind(identityId).first();
  if (!identity?.id || String(identity.status || "active") !== "active") return merchantAuthError("LIFF_IDENTITY_INVALID", "LINE identity is not active", 403);
  await env.DB.prepare("INSERT OR IGNORE INTO identity_auth (id, identity_id, provider, provider_uid, verified, verified_at, last_login_at, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'), ?, datetime('now'), datetime('now'))").bind(`auth_line_${await shortHash(provider + ":" + lineUserId)}`, identityId, provider, lineUserId, metadata).run();
  for (const row of legacyRows) {
    if (!String(row.identity_id || "").trim()) await env.DB.prepare("UPDATE tenant_admins SET identity_id = ?, updated_at = datetime('now') WHERE id = ? AND identity_id IS NULL").bind(identityId, row.id).run();
  }
  await merchantLoginLog("liff_identity_linked", { identity_id: identityId, provider });
  return { ok: true, identityId, provider, linked: true, created: !identityIds.length };
}

async function merchantTenantEntriesForIdentity(env, identityId, requestedTenantId = "") {
  const tenantFilter = requestedTenantId ? "AND a.tenant_id = ?" : "";
  const sql = `
    SELECT a.id, a.identity_id, a.tenant_id, a.role, a.status, t.name AS tenant_name, t.status AS tenant_status
    FROM tenant_admins a
    JOIN tenants t ON t.id = a.tenant_id
    WHERE a.identity_id = ? ${tenantFilter}
      AND (a.status IS NULL OR a.status = 'active')
      AND (t.status IS NULL OR t.status IN ('active','trial'))
    ORDER BY t.name, a.tenant_id
  `;
  const query = requestedTenantId ? env.DB.prepare(sql).bind(identityId, requestedTenantId) : env.DB.prepare(sql).bind(identityId);
  const rows = (await query.all()).results || [];
  const byTenant = new Map();
  for (const row of rows) {
    const tenantId = String(row.tenant_id || "").trim();
    if (!tenantId) continue;
    if (!byTenant.has(tenantId)) byTenant.set(tenantId, []);
    byTenant.get(tenantId).push(row);
  }
  return Array.from(byTenant.entries()).map(([tenantId, rows]) => ({ tenantId, rows }));
}

async function completeMerchantLiffIdentityLogin(env, identityId, requestedTenantId, next) {
  const tenantEntries = await merchantTenantEntriesForIdentity(env, identityId, requestedTenantId);
  if (requestedTenantId && tenantEntries.length === 0) return merchantAuthError("TENANT_SELECTION_NOT_ALLOWED", "Requested tenant is not allowed for this LINE identity", 403);
  if (tenantEntries.length === 0) return merchantAuthError("LIFF_MERCHANT_ACCESS_DENIED", "LINE identity has no merchant access", 403);
  if (tenantEntries.length > 1) {
    const selection = await buildMerchantTenantSelection(env, tenantEntries, { authProvider: "LINE" });
    if (!selection.ok) return selection;
    return { ok: false, selectionRequired: true, status: 409, code: "TENANT_SELECTION_REQUIRED", message: "Please choose a store to manage.", data: { selection_token: selection.selectionToken, expires_in: selection.expiresIn, tenants: selection.tenants } };
  }
  const tenantId = String(tenantEntries[0].tenantId || "").trim();
  const principal = await loadMerchantPrincipal(env, identityId, tenantId);
  if (!principal.ok) return merchantAuthError("LIFF_MERCHANT_ACCESS_DENIED", "Merchant tenant permission is not active", principal.status || 403);
  const redirect = next.startsWith("/") ? next + (next.includes("?") ? "&" : "?") + "tenant=" + encodeURIComponent(tenantId) : "/merchant?tenant=" + encodeURIComponent(tenantId);
  const sessionCookie = await setMerchantSessionCookie(env, { identityId, tenantId, role: principal.principal.role });
  return { ok: true, tenantId, redirect, role: principal.principal.role, sessionCookie };
}
async function handleMerchantLiffLogin(request, env) {
  if (!env.DB) return merchantLiffJsonError("DATABASE_NOT_CONFIGURED", "Database is not configured", 503);
  if (!merchantLiffIdentityLoginEnabled(env)) return merchantLiffJsonError("MERCHANT_LIFF_IDENTITY_LOGIN_DISABLED", "Merchant LINE login is disabled", 403);
  if (!merchantSessionSecret(env)) return merchantLiffJsonError("SESSION_CONFIG_INVALID", "Merchant session secret is not configured", 503);
  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    return merchantLiffJsonError("LIFF_TOKEN_REQUIRED", "LINE token is required", 400);
  }
  const next = String(payload?.next || "/merchant").trim() || "/merchant";
  const requestedTenantId = String(payload?.tenant || payload?.tenant_id || payload?.tenantId || "").trim();
  await ensurePlatformSchema(env);
  const settings = await platformLineSettings(env);
  const channelId = String(settings?.channel_id || "").trim();
  const verified = await verifyMerchantLiffLineSubject(env, payload);
  if (!verified.ok) {
    await merchantLoginLog("liff_token_failed", { reason: verified.code, tenant_id: requestedTenantId });
    return merchantLiffJsonError(verified.code || "LIFF_TOKEN_INVALID", verified.message || "LINE token is invalid", verified.status || 401);
  }
  const identity = await resolveLineIdentityAuth(env, verified, channelId);
  if (!identity.ok) {
    await merchantLoginLog("liff_identity_failed", { reason: identity.code, tenant_id: requestedTenantId, line_user_id: verified.lineUserId });
    return merchantLiffJsonError(identity.code || "LIFF_IDENTITY_NOT_FOUND", identity.message || "LINE identity is not linked", identity.status || 403);
  }
  const login = await completeMerchantLiffIdentityLogin(env, identity.identityId, requestedTenantId, next);
  if (login.selectionRequired) {
    await merchantLoginLog("liff_tenant_selection_required", { identity_id: identity.identityId, count: login.data?.tenants?.length || 0 });
    return merchantLiffJsonError(login.code, login.message, login.status || 409, login.data || {});
  }
  if (!login.ok) {
    await merchantLoginLog("liff_login_failed", { reason: login.code, tenant_id: requestedTenantId, identity_id: identity.identityId });
    return merchantLiffJsonError(login.code || "LIFF_MERCHANT_ACCESS_DENIED", login.message || "LINE identity has no merchant access", login.status || 403);
  }
  await merchantLoginLog("liff_login_success", { tenant_id: login.tenantId, identity_id: identity.identityId, provider: identity.provider });
  return Response.json({ ok: true, success: true, tenantId: login.tenantId, redirect: login.redirect, data: { tenant_id: login.tenantId, role: login.role, redirect: login.redirect } }, { headers: { ...jsonHeaders, "set-cookie": login.sessionCookie } });
}
async function customerLiffConfig(env, tenantId) {
  if (env.DB) await ensurePlatformSchema(env);
  const platformSetting = await platformLineSettings(env);
  const platformChannelId = String(platformSetting?.channel_id || "").trim();
  const envCustomerLiffId = envValue(env, "CUSTOMER_LIFF_ID");
  if (envCustomerLiffId && platformChannelId) return { liffId: envCustomerLiffId, channelId: platformChannelId, source: "env-customer" };

  const platformRegistrationLiffId = String(platformSetting?.registration_liff_id || "").trim();
  if (platformRegistrationLiffId && platformChannelId) return { liffId: platformRegistrationLiffId, channelId: platformChannelId, source: "platform-registration" };

  return { liffId: "", channelId: platformChannelId, source: "not-configured" };
}

async function customerLoginLiffId(env, tenantId) {
  const config = await customerLiffConfig(env, tenantId);
  return config.liffId || "";
}

async function verifyCustomerLiffLineSubject(env, tenantId, payload) {
  const config = await customerLiffConfig(env, tenantId);
  const idToken = String(payload?.id_token || payload?.idToken || "").trim();
  const accessToken = String(payload?.access_token || payload?.accessToken || "").trim();
  const result = idToken ? await verifyLineIdToken(idToken, config.channelId) : await verifyLineAccessToken(accessToken, config.channelId);
  console.log(JSON.stringify({ scope: "customer_liff", page_type: "customer", liff_source: config.source, liff_id: maskPublicId(config.liffId), id_token_exists: !!idToken, access_token_exists: !!accessToken, verify_status: result.ok ? "ok" : result.code, expected_channel_id: maskPublicId(config.channelId) }));
  if (!result.ok) {
    const map = { LIFF_TOKEN_REQUIRED: "CUSTOMER_LIFF_TOKEN_REQUIRED", LIFF_TOKEN_INVALID: "CUSTOMER_LIFF_TOKEN_INVALID", LIFF_TOKEN_EXPIRED: "CUSTOMER_LIFF_TOKEN_EXPIRED", LIFF_AUDIENCE_INVALID: "CUSTOMER_LIFF_AUDIENCE_INVALID", LIFF_PROVIDER_SCOPE_INVALID: "CUSTOMER_LIFF_TOKEN_INVALID" };
    return customerAuthError(map[result.code] || "CUSTOMER_LIFF_TOKEN_INVALID", result.message || "LINE token is invalid", result.status || 401);
  }
  return { ...result, channelId: config.channelId, provider: lineProviderScope(config.channelId), liffSource: config.source };
}

async function resolveCustomerLineIdentityAuth(env, verifiedLine) {
  const lineUserId = String(verifiedLine?.lineUserId || "").trim();
  const provider = String(verifiedLine?.provider || "").trim();
  if (!lineUserId || !provider) return customerAuthError("CUSTOMER_LIFF_TOKEN_INVALID", "LINE provider scope is invalid", 401);
  const rows = (await env.DB.prepare(`
    SELECT ia.id, ia.identity_id, i.status
    FROM identity_auth ia
    JOIN identities i ON i.id = ia.identity_id
    WHERE ia.provider = ? AND ia.provider_uid = ?
  `).bind(provider, lineUserId).all()).results || [];
  if (rows.length > 1) return customerAuthError("CUSTOMER_IDENTITY_CONFLICT", "LINE identity is duplicated", 409);
  const metadata = JSON.stringify({ line_channel_id: verifiedLine.channelId || "", line_user_id_hash: await shortHash(lineUserId), display_name: verifiedLine?.profile?.displayName || "", picture_url: verifiedLine?.profile?.pictureUrl || "", scope: "customer_liff" });
  if (rows.length === 1) {
    const row = rows[0];
    if (!row.identity_id || String(row.status || "active") !== "active") return customerAuthError("CUSTOMER_IDENTITY_INVALID", "Identity is not active", 403);
    await env.DB.prepare("UPDATE identity_auth SET verified = 1, verified_at = datetime('now'), last_login_at = datetime('now'), metadata_json = ?, updated_at = datetime('now') WHERE id = ?").bind(metadata, row.id).run();
    return { ok: true, identityId: String(row.identity_id), provider, created: false };
  }
  const identityId = `idn_line_${await shortHash(provider + ":" + lineUserId)}`;
  await env.DB.prepare("INSERT OR IGNORE INTO identities (id, status, created_at, updated_at) VALUES (?, 'active', datetime('now'), datetime('now'))").bind(identityId).run();
  const identity = await env.DB.prepare("SELECT id, status FROM identities WHERE id = ?").bind(identityId).first();
  if (!identity?.id || String(identity.status || "active") !== "active") return customerAuthError("CUSTOMER_IDENTITY_INVALID", "Identity is not active", 403);
  await env.DB.prepare("INSERT OR IGNORE INTO identity_auth (id, identity_id, provider, provider_uid, verified, verified_at, last_login_at, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'), ?, datetime('now'), datetime('now'))").bind(`auth_line_${await shortHash(provider + ":" + lineUserId)}`, identityId, provider, lineUserId, metadata).run();
  return { ok: true, identityId, provider, created: true };
}

function makeCustomerNo() {
  return "C" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

async function resolveCustomerForIdentity(env, tenantId, identityId) {
  const tenant = await env.DB.prepare("SELECT id, status FROM tenants WHERE id = ?").bind(tenantId).first();
  if (!tenant?.id || !isActiveTenantStatus(tenant.status)) return customerAuthError("CUSTOMER_ACCESS_DENIED", "Tenant is not active", 403);
  const rows = (await env.DB.prepare("SELECT id, tenant_id, identity_id, name, phone, email, status FROM customers WHERE tenant_id = ? AND identity_id = ?").bind(tenantId, identityId).all()).results || [];
  if (rows.length > 1) return customerAuthError("CUSTOMER_PROFILE_CONFLICT", "Customer profile is duplicated", 409);
  if (rows.length === 0) return { ok: true, registrationRequired: true, reason: "missing" };
  const customer = rows[0];
  if (String(customer.status || "active") !== "active") return customerAuthError("CUSTOMER_ACCESS_DENIED", "Customer is not active", 403);
  if (!customerIsRegistrationComplete(customer)) return { ok: true, registrationRequired: true, reason: "incomplete", customerId: String(customer.id) };
  return { ok: true, registrationRequired: false, customerId: String(customer.id), customer };
}

async function ensureCustomerPhoneIdentity(env, phone) {
  const normalizedPhone = normalizeCustomerPhone(phone);
  if (!normalizedPhone) return customerAuthError("CUSTOMER_PHONE_INVALID", "請輸入正確手機號碼", 400);
  await ensurePlatformSchema(env);
  const existing = await env.DB.prepare("SELECT a.identity_id, i.status FROM identity_auth a JOIN identities i ON i.id = a.identity_id WHERE a.provider = 'PHONE' AND a.normalized_phone = ?").bind(normalizedPhone).first();
  if (existing?.identity_id) {
    if (String(existing.status || "active") !== "active") return customerAuthError("CUSTOMER_IDENTITY_INVALID", "會員身份已停用", 403);
    await env.DB.prepare("UPDATE identity_auth SET verified = 1, verified_at = COALESCE(verified_at, datetime('now')), last_login_at = datetime('now'), updated_at = datetime('now') WHERE provider = 'PHONE' AND normalized_phone = ?").bind(normalizedPhone).run();
    return { ok: true, identityId: String(existing.identity_id), normalizedPhone, created: false };
  }
  const identityId = `idn_phone_${await shortHash("PHONE:" + normalizedPhone)}`;
  const authId = `auth_phone_${await shortHash("PHONE:" + normalizedPhone)}`;
  await env.DB.prepare("INSERT OR IGNORE INTO identities (id, status, created_at, updated_at) VALUES (?, 'active', datetime('now'), datetime('now'))").bind(identityId).run();
  const identity = await env.DB.prepare("SELECT id, status FROM identities WHERE id = ?").bind(identityId).first();
  if (!identity?.id || String(identity.status || "active") !== "active") return customerAuthError("CUSTOMER_IDENTITY_INVALID", "會員身份已停用", 403);
  await env.DB.prepare("INSERT OR IGNORE INTO identity_auth (id, identity_id, provider, normalized_phone, verified, verified_at, last_login_at, metadata_json, created_at, updated_at) VALUES (?, ?, 'PHONE', ?, 1, datetime('now'), datetime('now'), '{}', datetime('now'), datetime('now'))").bind(authId, identityId, normalizedPhone).run();
  return { ok: true, identityId, normalizedPhone, created: true };
}

async function findPhoneIdentity(env, phone) {
  const normalizedPhone = normalizeCustomerPhone(phone);
  if (!normalizedPhone) return customerAuthError("CUSTOMER_PHONE_INVALID", "請輸入正確手機號碼", 400);
  await ensurePlatformSchema(env);
  const row = await env.DB.prepare("SELECT a.identity_id, i.status FROM identity_auth a JOIN identities i ON i.id = a.identity_id WHERE a.provider = 'PHONE' AND a.normalized_phone = ?").bind(normalizedPhone).first();
  if (!row?.identity_id) return customerAuthError("CUSTOMER_NOT_REGISTERED", "尚未註冊，請先建立會員", 404);
  if (String(row.status || "active") !== "active") return customerAuthError("CUSTOMER_IDENTITY_INVALID", "會員身份已停用", 403);
  await env.DB.prepare("UPDATE identity_auth SET last_login_at = datetime('now'), updated_at = datetime('now') WHERE provider = 'PHONE' AND normalized_phone = ?").bind(normalizedPhone).run();
  return { ok: true, identityId: String(row.identity_id), normalizedPhone };
}

async function resolveCustomerByPhoneCredential(env, tenantId, identityId, normalizedPhone, birthday) {
  const tenant = await env.DB.prepare("SELECT id, status FROM tenants WHERE id = ?").bind(tenantId).first();
  if (!tenant?.id || !isActiveTenantStatus(tenant.status)) return customerAuthError("CUSTOMER_ACCESS_DENIED", "店家目前無法登入會員", 403);
  const rows = (await env.DB.prepare("SELECT id, tenant_id, identity_id, name, phone, birthday, status FROM customers WHERE tenant_id = ? AND identity_id = ?").bind(tenantId, identityId).all()).results || [];
  if (rows.length > 1) return customerAuthError("CUSTOMER_PROFILE_CONFLICT", "會員資料重複，請洽店家", 409);
  let customer = rows[0] || null;
  if (!customer) {
    const legacyRows = (await env.DB.prepare("SELECT id, tenant_id, identity_id, name, phone, birthday, status FROM customers WHERE tenant_id = ? AND phone = ?").bind(tenantId, normalizedPhone).all()).results || [];
    if (legacyRows.length > 1) return customerAuthError("CUSTOMER_PROFILE_CONFLICT", "手機會員資料重複，請洽店家", 409);
    const legacy = legacyRows[0] || null;
    if (legacy && !String(legacy.identity_id || "").trim() && customerBirthdayMatches(legacy.birthday, birthday)) {
      await env.DB.prepare("UPDATE customers SET identity_id = ?, phone = ?, updated_at = datetime('now') WHERE tenant_id = ? AND id = ? AND identity_id IS NULL").bind(identityId, normalizedPhone, tenantId, legacy.id).run();
      customer = { ...legacy, identity_id: identityId, phone: normalizedPhone };
    }
  }
  if (!customer) return customerAuthError("CUSTOMER_NOT_REGISTERED", "這家店尚未建立會員，請先註冊", 404);
  if (String(customer.status || "active") !== "active") return customerAuthError("CUSTOMER_ACCESS_DENIED", "會員資料已停用", 403);
  if (!customerBirthdayMatches(customer.birthday, birthday)) return customerAuthError("CUSTOMER_BIRTHDAY_INVALID", "生日不符合", 401);
  return { ok: true, customerId: String(customer.id), customer };
}

async function handleCustomerPhoneLogin(request, env, tenantId = TENANT_ID) {
  if (!env.DB) return customerJsonError("DATABASE_NOT_CONFIGURED", "Database is not configured", 503);
  if (!customerSessionSecret(env)) return customerJsonError("CUSTOMER_SESSION_CONFIG_INVALID", "Customer session secret is not configured", 503);
  let payload;
  try { payload = await request.json(); } catch (error) { return customerJsonError("CUSTOMER_LOGIN_INVALID", "登入資料格式錯誤", 400); }
  const phone = normalizeCustomerPhone(payload?.phone);
  const birthday = normalizeCustomerBirthdayCredential(payload?.birthday);
  const next = safeCustomerNext(payload?.next || "/member", "/member");
  if (!phone || !birthday) return customerJsonError("CUSTOMER_LOGIN_REQUIRED", "請輸入手機與生日 YYYYMMDD", 400);
  const identity = await findPhoneIdentity(env, phone);
  if (!identity.ok) return customerJsonError(identity.code, identity.message, identity.status || 401);
  const customer = await resolveCustomerByPhoneCredential(env, tenantId, identity.identityId, phone, birthday);
  if (!customer.ok) return customerJsonError(customer.code, customer.message, customer.status || 401);
  const sessionCookie = await setCustomerSessionCookie(env, { identityId: identity.identityId, tenantId, customerId: customer.customerId });
  const redirect = next + (next.includes("?") ? "&" : "?") + "tenant=" + encodeURIComponent(tenantId);
  return Response.json({ ok: true, success: true, redirect, data: { tenant_id: tenantId, customer_id: customer.customerId, redirect } }, { headers: { ...jsonHeaders, "set-cookie": sessionCookie } });
}

async function handleCustomerPhoneRegister(request, env, tenantId = TENANT_ID) {
  if (!env.DB) return customerJsonError("DATABASE_NOT_CONFIGURED", "Database is not configured", 503);
  if (!customerSessionSecret(env)) return customerJsonError("CUSTOMER_SESSION_CONFIG_INVALID", "Customer session secret is not configured", 503);
  let payload;
  try { payload = await request.json(); } catch (error) { return customerJsonError("CUSTOMER_REGISTER_INVALID", "註冊資料格式錯誤", 400); }
  const name = limitText(payload?.name, 80);
  const phone = normalizeCustomerPhone(payload?.phone);
  const birthday = normalizeCustomerBirthdayCredential(payload?.birthday);
  const email = limitText(payload?.email, 120);
  const next = safeCustomerNext(payload?.next || "/member", "/member");
  if (!name || !phone || !birthday) return customerJsonError("CUSTOMER_REGISTER_REQUIRED", "請輸入姓名、手機與生日 YYYYMMDD", 400);
  const tenant = await env.DB.prepare("SELECT id, status FROM tenants WHERE id = ?").bind(tenantId).first();
  if (!tenant?.id || !isActiveTenantStatus(tenant.status)) return customerJsonError("CUSTOMER_ACCESS_DENIED", "店家目前無法註冊會員", 403);
  const identity = await ensureCustomerPhoneIdentity(env, phone);
  if (!identity.ok) return customerJsonError(identity.code, identity.message, identity.status || 400);
  const rows = (await env.DB.prepare("SELECT id, identity_id FROM customers WHERE tenant_id = ? AND identity_id = ?").bind(tenantId, identity.identityId).all()).results || [];
  if (rows.length > 1) return customerJsonError("CUSTOMER_PROFILE_CONFLICT", "會員資料重複，請洽店家", 409);
  const phoneRows = (await env.DB.prepare("SELECT id, identity_id FROM customers WHERE tenant_id = ? AND phone = ?").bind(tenantId, phone).all()).results || [];
  const currentId = rows[0]?.id ? String(rows[0].id) : "";
  const phoneConflict = phoneRows.find((row) => String(row.id) !== currentId && String(row.identity_id || "") && String(row.identity_id || "") !== identity.identityId);
  if (phoneConflict) return customerJsonError("CUSTOMER_PHONE_CONFLICT", "此手機已被其他會員使用", 409);
  let customerId = currentId || String(phoneRows.find((row) => !String(row.identity_id || "").trim())?.id || "");
  if (customerId) {
    await env.DB.prepare("UPDATE customers SET identity_id = ?, name = ?, phone = ?, birthday = ?, email = COALESCE(NULLIF(?, ''), email), status = 'active', updated_at = datetime('now') WHERE tenant_id = ? AND id = ?").bind(identity.identityId, name, phone, birthday, email || "", tenantId, customerId).run();
  } else {
    customerId = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO customers (id, tenant_id, identity_id, customer_no, name, phone, birthday, email, referral_code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))").bind(customerId, tenantId, identity.identityId, makeCustomerNo(), name, phone, birthday, email || null, makeReferralCode(phone)).run();
  }
  const sessionCookie = await setCustomerSessionCookie(env, { identityId: identity.identityId, tenantId, customerId });
  const redirect = next + (next.includes("?") ? "&" : "?") + "tenant=" + encodeURIComponent(tenantId);
  return Response.json({ ok: true, success: true, redirect, data: { tenant_id: tenantId, customer_id: customerId, redirect } }, { headers: { ...jsonHeaders, "set-cookie": sessionCookie } });
}
async function handleCustomerLiffLogin(request, env) {
  return customerJsonError("CUSTOMER_LIFF_LOGIN_DISABLED", "顧客 LINE 登入已暫停，請改用手機與生日登入", 503);
  if (!env.DB) return customerJsonError("DATABASE_NOT_CONFIGURED", "Database is not configured", 503);
  if (!customerLiffIdentityLoginEnabled(env)) return customerJsonError("CUSTOMER_LIFF_LOGIN_DISABLED", "Customer LINE login is temporarily disabled", 503);
  if (!customerSessionSecret(env)) return customerJsonError("CUSTOMER_SESSION_CONFIG_INVALID", "Customer session secret is not configured", 503);
  let payload;
  try { payload = await request.json(); } catch (error) { return customerJsonError("CUSTOMER_LIFF_TOKEN_REQUIRED", "LINE token is required", 401); }
  const tenantId = String(payload?.tenant || payload?.tenant_id || payload?.tenantId || "").trim();
  const next = String(payload?.next || "/member").trim() || "/member";
  const mode = String(payload?.mode || payload?.intent || "login").trim().toLowerCase() === "register" ? "register" : "login";
  if (!tenantId) return customerJsonError("CUSTOMER_TENANT_SCOPE_MISMATCH", "Tenant is required", 400);
  await ensurePlatformSchema(env);
  const verified = await verifyCustomerLiffLineSubject(env, tenantId, payload);
  if (!verified.ok) return customerJsonError(verified.code || "CUSTOMER_LIFF_TOKEN_INVALID", verified.message || "LINE token is invalid", verified.status || 401);
  const identity = await resolveCustomerLineIdentityAuth(env, verified);
  if (!identity.ok) return customerJsonError(identity.code || "CUSTOMER_IDENTITY_INVALID", identity.message || "Identity is invalid", identity.status || 403);
  if (mode === "register") {
    const registrationToken = await createCustomerRegistrationToken(env, { identityId: identity.identityId, tenantId });
    const redirect = "/member-register?tenant=" + encodeURIComponent(tenantId);
    return Response.json({ ok: true, success: true, registration_required: true, redirect, data: { tenant_id: tenantId, registration_required: true, reason: "register", redirect } }, { headers: { ...jsonHeaders, "set-cookie": setCustomerRegistrationCookie(env, registrationToken) } });
  }
  const customer = await resolveCustomerForIdentity(env, tenantId, identity.identityId);
  if (!customer.ok) return customerJsonError(customer.code || "CUSTOMER_ACCESS_DENIED", customer.message || "Customer access denied", customer.status || 403);
  if (customer.registrationRequired) {
    const registrationToken = await createCustomerRegistrationToken(env, { identityId: identity.identityId, tenantId });
    const redirect = "/member-register?tenant=" + encodeURIComponent(tenantId);
    return Response.json({ ok: true, success: true, registration_required: true, redirect, data: { tenant_id: tenantId, registration_required: true, reason: customer.reason, redirect } }, { headers: { ...jsonHeaders, "set-cookie": setCustomerRegistrationCookie(env, registrationToken) } });
  }
  const sessionCookie = await setCustomerSessionCookie(env, { identityId: identity.identityId, tenantId, customerId: customer.customerId });
  const safeNext = safeCustomerNext(next, "/member");
  const redirect = safeNext + (safeNext.includes("?") ? "&" : "?") + "tenant=" + encodeURIComponent(tenantId);
  return Response.json({ ok: true, success: true, redirect, data: { tenant_id: tenantId, customer_id: customer.customerId, identity_created: !!identity.created, customer_created: false, redirect } }, { headers: { ...jsonHeaders, "set-cookie": sessionCookie } });
}
async function handleCustomerRegister(request, env) {
  if (!env.DB) return customerJsonError("DATABASE_NOT_CONFIGURED", "Database is not configured", 503);
  if (!customerSessionSecret(env)) return customerJsonError("CUSTOMER_SESSION_CONFIG_INVALID", "Customer session secret is not configured", 503);
  let payload;
  try { payload = await request.json(); } catch (error) { return customerJsonError("CUSTOMER_REGISTER_INVALID", "Registration data is invalid", 400); }
  const token = readCookie(request, CUSTOMER_REGISTRATION_COOKIE) || String(payload?.registration_token || "");
  const verified = await verifyCustomerRegistrationToken(env, decodeURIComponent(token));
  if (!verified.ok) return customerJsonError(verified.code || "CUSTOMER_REGISTRATION_TOKEN_INVALID", verified.message || "Registration token is invalid", verified.status || 401);
  const tenantId = String(verified.payload.tenant_id || "");
  const identityId = String(verified.payload.sub || "");
  const name = String(payload?.name || "").trim();
  const phone = String(payload?.phone || "").trim();
  const email = String(payload?.email || "").trim();
  const agree = payload?.agree === true || payload?.agree === "true" || payload?.agree === "on" || payload?.agree === "1";
  if (!name || !phone) return customerJsonError("CUSTOMER_REGISTER_REQUIRED", "Name and phone are required", 400);
  if (!agree) return customerJsonError("CUSTOMER_REGISTER_CONSENT_REQUIRED", "Consent is required", 400);
  const tenant = await env.DB.prepare("SELECT id, status FROM tenants WHERE id = ?").bind(tenantId).first();
  if (!tenant?.id || !isActiveTenantStatus(tenant.status)) return customerJsonError("CUSTOMER_ACCESS_DENIED", "Tenant is not active", 403);
  const rows = (await env.DB.prepare("SELECT id, tenant_id, identity_id, status FROM customers WHERE tenant_id = ? AND identity_id = ?").bind(tenantId, identityId).all()).results || [];
  if (rows.length > 1) return customerJsonError("CUSTOMER_PROFILE_CONFLICT", "Customer profile is duplicated", 409);
  const phoneRows = (await env.DB.prepare("SELECT id, identity_id FROM customers WHERE tenant_id = ? AND phone = ?").bind(tenantId, phone).all()).results || [];
  const currentId = rows[0]?.id ? String(rows[0].id) : "";
  const phoneConflict = phoneRows.find((row) => String(row.id) !== currentId && String(row.identity_id || "") !== identityId);
  if (phoneConflict) return customerJsonError("CUSTOMER_PHONE_CONFLICT", "Phone already belongs to another member", 409);
  let customerId = currentId;
  if (customerId) {
    await env.DB.prepare("UPDATE customers SET name = ?, phone = ?, email = ?, identity_id = ?, status = 'active', updated_at = datetime('now') WHERE tenant_id = ? AND id = ?").bind(name.slice(0, 80), phone.slice(0, 40), email.slice(0, 120) || null, identityId, tenantId, customerId).run();
  } else {
    customerId = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO customers (id, tenant_id, identity_id, customer_no, name, phone, email, referral_code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))").bind(customerId, tenantId, identityId, makeCustomerNo(), name.slice(0, 80), phone.slice(0, 40), email.slice(0, 120) || null, makeReferralCode(identityId)).run();
  }
  const sessionCookie = await setCustomerSessionCookie(env, { identityId, tenantId, customerId });
  const headers = new Headers(jsonHeaders);
  headers.append("set-cookie", sessionCookie);
  headers.append("set-cookie", clearCustomerRegistrationCookie());
  const redirect = "/member?tenant=" + encodeURIComponent(tenantId);
  return Response.json({ ok: true, success: true, redirect, data: { tenant_id: tenantId, customer_id: customerId, redirect } }, { headers });
}


function renderMerchantLoginPage(tenantId = TENANT_ID, next = "/merchant", error = "", liffId = "") {
  const message = error ? `<div class="error">帳號或密碼錯誤</div>` : "";
  const safeTenant = escapeAttrValue(tenantId || "");
  const safeNext = escapeAttrValue(next || "/merchant");
  const safeLiffId = String(liffId || "").trim();
  const lineLoginBlock = safeLiffId ? `<button class="line-login" type="button" id="line-login">使用 LINE 綁定登入</button><div class="divider">或使用帳密登入</div><div class="line-status" id="line-status"></div>` : "";
  const tenantPickerScript = `<script>
(function(){
  const form=document.querySelector("#merchant-login-form");
  const picker=document.querySelector("#tenant-picker");
  const pickerList=document.querySelector("#tenant-picker-list");
  const pickerStatus=document.querySelector("#tenant-picker-status");
  const backBtn=document.querySelector("#tenant-picker-back");
  let selectionToken="";
  let expiresAt=0;
  const roleLabel={TenantOwner:"Owner",TenantManager:"Manager",Staff:"Staff",owner:"Owner",admin:"Manager",manager:"Manager",staff:"Staff",viewer:"Viewer"};
  function setPickerStatus(text){if(pickerStatus)pickerStatus.textContent=text||"";}
  function resetPicker(){selectionToken="";expiresAt=0;if(picker)picker.hidden=true;if(form)form.hidden=false;setPickerStatus("");}
  function escapeText(value){return String(value||"").replace(/[&<>\"']/g,function(ch){return {"&":"&amp;","<":"&lt;",">":"&gt;","\\\"":"&quot;","'":"&#39;"}[ch]||ch;});}
  function tenantCard(tenant,idx){const tenantId=escapeText(tenant.tenant_id||"");const name=escapeText(tenant.tenant_name||tenant.tenant_id||"Store");const role=escapeText(roleLabel[tenant.role]||tenant.role||"Manager");return '<div class="tenant-option"><div><b>'+name+'</b><small>Role: '+role+'</small></div><button type="button" data-tenant="'+tenantId+'" data-idx="'+idx+'">Enter</button></div>';}
  function renderTenantPicker(data){
    selectionToken=String(data.selection_token||"");
    expiresAt=Date.now()+Number(data.expires_in||300)*1000;
    const tenants=Array.isArray(data.tenants)?data.tenants:[];
    if(!selectionToken||tenants.length===0){setPickerStatus("Unable to load stores. Please login again.");return;}
    pickerList.innerHTML=tenants.map(tenantCard).join("");
    form.hidden=true;
    picker.hidden=false;
    setPickerStatus("Please choose within 5 minutes.");
  }
  window.bookingosRenderTenantPicker=renderTenantPicker;
  form?.addEventListener("submit",async function(event){
    event.preventDefault();
    const button=form.querySelector("button[type=submit]");
    button.disabled=true;
    setPickerStatus("");
    try{
      const res=await fetch(form.action,{method:"POST",body:new FormData(form),credentials:"same-origin"});
      const type=res.headers.get("content-type")||"";
      if(res.redirected){location.href=res.url;return;}
      if(type.includes("application/json")){
        const data=await res.json();
        if(data?.error?.code==="TENANT_SELECTION_REQUIRED"){renderTenantPicker(data.data||{});return;}
        setPickerStatus(data?.error?.message||"Login failed.");
        return;
      }
      if(res.ok){location.href="/merchant";return;}
      setPickerStatus("Login failed.");
    }catch(error){setPickerStatus("Network error. Please try again.");}
    finally{button.disabled=false;}
  });
  pickerList?.addEventListener("click",async function(event){
    const button=event.target.closest("button[data-tenant]");
    if(!button)return;
    if(!selectionToken||Date.now()>expiresAt){setPickerStatus("Selection token expired. Please login again.");return;}
    const tenantId=button.getAttribute("data-tenant")||"";
    Array.from(pickerList.querySelectorAll("button")).forEach(function(btn){btn.disabled=true;});
    button.textContent="Entering...";
    try{
      const next=form?.querySelector("input[name=next]")?.value||"/merchant";
      const res=await fetch("/merchant-select-tenant",{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify({selection_token:selectionToken,tenant_id:tenantId,next})});
      const data=await res.json();
      if(!res.ok||!data.ok){setPickerStatus(data?.error?.message||"Store selection failed. Please login again.");return;}
      location.href=data.data?.redirect||"/merchant";
    }catch(error){setPickerStatus("Store selection failed. Please try again.");}
    finally{Array.from(pickerList.querySelectorAll("button")).forEach(function(btn){btn.disabled=false;});}
  });
  backBtn?.addEventListener("click",resetPicker);
})();
</script>`;
  const liffScript = safeLiffId ? `<script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script><script>
const liffId=${JSON.stringify(safeLiffId)};
const next=${JSON.stringify(next || "/merchant")};
const statusBox=document.querySelector("#line-status");
let liffReady=null;
function setLineStatus(text){if(statusBox)statusBox.textContent=text||"";}
async function initLiff(){if(!liffReady)liffReady=liff.init({liffId});return liffReady;}
async function completeLineLogin(){
  setLineStatus("正在確認 LINE 身分...");
  await initLiff();
  if(!liff.isLoggedIn()){return false;}
  const idToken=liff.getIDToken();
  const tenant=document.querySelector("input[name=tenant]")?.value||"";
  if(!idToken){setLineStatus("LINE 登入憑證取得失敗，請重新登入");return true;}
  const res=await fetch("/api/merchant/liff-login",{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify({id_token:idToken,next,tenant})});
  const data=await res.json();
  if(data?.error?.code==="TENANT_SELECTION_REQUIRED"&&window.bookingosRenderTenantPicker){window.bookingosRenderTenantPicker(data.data||{});setLineStatus("");return true;}
  if(!data.ok){setLineStatus(data?.error?.message||data.error||"LINE 尚未綁定店家");return true;}
  location.href=data.redirect||data.data?.redirect||"/merchant";
  return true;
}
document.querySelector("#line-login")?.addEventListener("click",async()=>{try{setLineStatus("正在開啟 LINE 登入...");await initLiff();if(!liff.isLoggedIn()){liff.login({redirectUri:location.href});return;}await completeLineLogin();}catch(e){setLineStatus("LINE 登入失敗，請改用帳密登入");}});
window.addEventListener("load",async()=>{try{await initLiff();if(liff.isLoggedIn())await completeLineLogin();}catch(e){setLineStatus("");}});
</script>` : "";
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BookingOS 店家登入</title><style>:root{--bg:#eef2ed;--panel:#fff;--line:#dfe5dd;--ink:#17211d;--muted:#68746d;--green:#176b5b;--rail:#10231d}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.card{width:min(420px,calc(100vw - 32px));background:white;border:1px solid var(--line);border-radius:10px;padding:24px;box-shadow:0 18px 50px rgba(16,35,29,.08)}.brand{display:flex;align-items:center;gap:12px;margin-bottom:22px}.mark{width:44px;height:44px;border-radius:10px;background:var(--green);display:grid;place-items:center;font-weight:950;color:white}.brand b{font-size:22px}.brand small{display:block;color:var(--muted);margin-top:2px}h1{font-size:24px;margin:0 0 6px}p{margin:0 0 18px;color:var(--muted);line-height:1.5}form{display:grid;gap:12px}label{display:grid;gap:6px;color:var(--muted);font-size:13px;font-weight:850}input{width:100%;min-height:46px;border:1px solid var(--line);border-radius:8px;padding:10px 12px;font:inherit}button{min-height:46px;border:0;border-radius:8px;background:var(--rail);color:white;font-weight:950;font:inherit;cursor:pointer}.line-login{width:100%;background:#06c755;color:#062216;margin:0 0 12px}.divider{text-align:center;color:var(--muted);font-size:12px;margin:2px 0 12px}.line-status{min-height:18px;color:#0f513f;font-size:12px;font-weight:850;margin:0 0 10px}.error{background:#fde2e2;color:#9b1c1c;border:1px solid #f2b8b8;border-radius:8px;padding:10px 12px;margin-bottom:12px;font-weight:850}.hint{font-size:12px;color:var(--muted);margin-top:12px}.tenant-picker{display:grid;gap:12px}.tenant-picker[hidden]{display:none}.tenant-option{border:1px solid var(--line);border-radius:8px;padding:12px;display:flex;justify-content:space-between;gap:12px;align-items:center}.tenant-option b{display:block;font-size:16px}.tenant-option small{display:block;color:var(--muted);margin-top:4px}.tenant-option button{min-height:40px;padding:0 12px;background:var(--green);white-space:nowrap}.picker-actions{display:flex;gap:8px}.secondary{background:white;color:var(--ink);border:1px solid var(--line)}</style></head><body><main class="card"><div class="brand"><div class="mark">B</div><div><b>BookingOS</b><small>Merchant Console</small></div></div><h1>店家後台登入</h1><p>可使用已綁定的 LINE 登入，或使用店家 Admin 帳密登入。</p>${message}${lineLoginBlock}<form method="post" action="/merchant-login" id="merchant-login-form"><input type="hidden" name="tenant" value="${safeTenant}"><input type="hidden" name="next" value="${safeNext}"><label>帳號<input name="account" autocomplete="username" autofocus required></label><label>密碼<input name="password" type="password" autocomplete="current-password" required></label><button type="submit">登入</button></form><section class="tenant-picker" id="tenant-picker" hidden><h2>Select store</h2><p>Choose the store to manage. You do not need to re-enter your password.</p><div id="tenant-picker-list"></div><div class="line-status" id="tenant-picker-status"></div><div class="picker-actions"><button type="button" class="secondary" id="tenant-picker-back">Back to login</button></div></section><div class="hint">帳密登入可使用店家 Admin 手機、Email；指定店家登入時可相容姓名登入。密碼為 V1 全域店家後台密碼，由平台安全設定管理</div></main>${liffScript}${tenantPickerScript}</body></html>`;
}
function html(body) {
  return new Response(body, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
  });
}

function liffStateSearchParams(url) {
  const raw = String(url.searchParams.get("liff.state") || "").trim();
  if (!raw) return new URLSearchParams();
  try {
    const decoded = decodeURIComponent(raw);
    const search = decoded.startsWith("?") ? decoded.slice(1) : decoded.startsWith("/") ? (decoded.split("?")[1] || "") : decoded;
    return new URLSearchParams(search);
  } catch (error) {
    return new URLSearchParams();
  }
}
function tenantIdFromUrl(url, env = {}) {
  return String(url.searchParams.get("tenant") || defaultTenantId(env)).trim() || defaultTenantId(env);
}
function availabilityResponse(url, data = { businessHours, bookings, staffMembers, services, resourceTypes }) {
  const duration = Number(url.searchParams.get("duration") || "90");
  const staffId = url.searchParams.get("staffId") || "any";
  const serviceId = url.searchParams.get("serviceId") || data.services?.[0]?.id || services[0].id;
  const date = url.searchParams.get("date") || todayInTaipei();

  if (!Number.isInteger(duration) || duration < 15 || duration > 240) {
    return Response.json({ ok: false, error: "duration must be between 15 and 240 minutes" }, { status: 400, headers: jsonHeaders });
  }

  const serviceList = data.services || services;
  const resourceList = data.resourceTypes || resourceTypes;
  const activeStaff = data.staffMembers || staffMembers;
  const selectedService = serviceList.find((service) => service.id === serviceId) || serviceList[0];
  const capableStaff = filterStaffByService(activeStaff, selectedService?.id || serviceId);
  const selectedResource = resourceList.find((resource) => resource.id === selectedService?.resourceTypeId);
  const resourceCapacity = Math.max(1, Number(selectedResource?.quantity || 1));
  const slots = findAvailableSlots({
    businessHours: data.businessHours,
    bookings: data.bookings,
    staffMembers: capableStaff,
    staffId,
    resourceTypeId: selectedService?.resourceTypeId || "",
    resourceCapacity,
    durationMinutes: duration,
    stepMinutes: 30
  });

  const staff = staffId === "any" ? { id: "any", name: "系統安排" } : capableStaff.find((item) => item.id === staffId) || { id: staffId, name: staffId };
  return Response.json({ ok: true, tenantId: data.store?.tenantId || TENANT_ID, staffId, staffName: staff.name, serviceId, resourceTypeId: selectedService?.resourceTypeId || "", resourceCapacity, date, duration, slots }, { headers: jsonHeaders });
}

function findAvailableSlots({ businessHours, bookings, staffMembers = [], staffId = "any", resourceTypeId = "", resourceCapacity = 1, durationMinutes, stepMinutes }) {
  const open = toMinutes(businessHours.open);
  const close = toMinutes(businessHours.close);
  const slots = [];

  for (let start = open; start + durationMinutes <= close; start += stepMinutes) {
    const end = start + durationMinutes;
    if (isSlotAvailable({ start, end, businessHours, bookings, staffMembers, staffId, resourceTypeId, resourceCapacity })) {
      slots.push(toTime(start));
    }
  }

  return slots;
}

function toRange(value) {
  return { start: toMinutes(value.start), end: toMinutes(value.end) };
}

function rangesOverlap(left, right) {
  return left.start < right.end && right.start < left.end;
}

function staffCanProvideService(staff, serviceId) {
  if (!serviceId) return true;
  if (!Array.isArray(staff.serviceIds) || staff.serviceIds.length === 0) return true;
  return staff.serviceIds.includes(serviceId);
}

function filterStaffByService(staffMembers = [], serviceId = "") {
  return staffMembers.filter((staff) => staffCanProvideService(staff, serviceId));
}

function isSlotAvailable({ start, end, businessHours, bookings, staffMembers = [], staffId = "any", resourceTypeId = "", resourceCapacity = 1 }) {
  const range = { start, end };
  if (businessHours.breaks.map(toRange).some((blocked) => rangesOverlap(range, blocked))) return false;
  const overlaps = bookings.filter((booking) => rangesOverlap(range, toRange(booking)));
  const resourceUsed = resourceTypeId ? overlaps.filter((booking) => booking.resourceTypeId === resourceTypeId).length : 0;
  if (resourceUsed >= resourceCapacity) return false;
  if (staffId !== "any") return staffMembers.some((staff) => staff.id === staffId) && !overlaps.some((booking) => booking.staffId === staffId);
  return staffMembers.some((staff) => !overlaps.some((booking) => booking.staffId === staff.id));
}

function pickAvailableStaffId({ start, end, bookings, staffMembers = [], serviceId = "" }) {
  const range = { start: toMinutes(start), end: toMinutes(end) };
  const overlaps = bookings.filter((booking) => rangesOverlap(range, toRange(booking)));
  return staffMembers.find((staff) => staffCanProvideService(staff, serviceId) && !overlaps.some((booking) => booking.staffId === staff.id))?.id || "";
}

function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function toTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function addDays(dateText, days) {
  const date = new Date(String(dateText || todayInTaipei()) + "T00:00:00+08:00");
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}
function daysBetween(startText, endText) {
  const start = new Date(String(startText || todayInTaipei()) + "T00:00:00+08:00");
  const end = new Date(String(endText || todayInTaipei()) + "T00:00:00+08:00");
  return Math.ceil((end.getTime() - start.getTime()) / 86400000);
}
function todayInTaipei() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function escapeHtmlValue(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function escapeAttrValue(value) {
  return escapeHtmlValue(value);
}

function appShell({ title, modeLabel, body, nav, store: shellStore = store }) {
  const logoMarkup = shellStore.logoUrl ? `<img src="${escapeAttrValue(shellStore.logoUrl)}" alt="${escapeAttrValue(shellStore.name || "店家")} Logo">` : "B";
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${title}</title>
  <style>
    :root{--bg:#eef2ed;--surface:#fff;--soft:#f8faf6;--ink:#202124;--muted:#667067;--line:#dfe5dd;--brand:#176b5b;--brand2:#0f463e;--amber:#b86434;--amber-soft:#f4e6db;--blue:#3d6f9f;--blue-soft:#e7eef6;--ok:#e4f2eb}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:var(--bg);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:inherit;text-decoration:none}button,input,select,textarea{font:inherit}.page{width:100%;max-width:480px;min-height:100vh;margin:0 auto;background:#f7f8f4;padding-bottom:92px}.hero{background:var(--brand2);color:white;padding:18px 16px 16px;border-bottom-left-radius:8px;border-bottom-right-radius:8px}.topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.mark{display:flex;align-items:center;gap:10px;min-width:0}.logo{width:38px;height:38px;border-radius:8px;background:white;color:var(--brand2);display:grid;place-items:center;font-weight:900;overflow:hidden}.logo img{width:100%;height:100%;object-fit:cover;display:block}.product{font-size:15px;font-weight:900}.version{color:rgba(255,255,255,.7);font-size:12px;margin-top:2px}.mode{white-space:nowrap;border:1px solid rgba(255,255,255,.24);background:rgba(255,255,255,.1);border-radius:999px;padding:7px 10px;font-size:12px;font-weight:850}h1,h2,h3,p{margin:0}h1{font-size:25px;line-height:1.2;letter-spacing:0}.store-meta{margin-top:7px;color:rgba(255,255,255,.76);font-size:13px;line-height:1.45}.hero-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}.hero-stat{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:12px;min-height:78px}.stat-label{color:rgba(255,255,255,.72);font-size:12px}.stat-value{font-size:25px;font-weight:900;margin-top:5px}.stat-note{color:rgba(255,255,255,.68);font-size:12px;margin-top:3px}.content{padding:14px}.quick-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}.action-btn{min-height:52px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);display:flex;align-items:center;justify-content:center;gap:8px;font-weight:900;box-shadow:0 10px 22px rgba(32,33,36,.05)}.action-btn.primary{background:var(--brand);color:white;border-color:var(--brand)}section,details.panel{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:14px;margin-bottom:12px;box-shadow:0 10px 24px rgba(32,33,36,.055)}details.panel>summary{list-style:none;cursor:pointer}details.panel>summary::-webkit-details-marker{display:none}.section-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px}details.panel>summary.section-head{margin-bottom:0}details.panel[open]>summary.section-head{margin-bottom:12px}.collapse-indicator{color:var(--brand);font-size:13px;font-weight:900;white-space:nowrap}.collapse-indicator::after{content:"展開"}details.panel[open] .collapse-indicator::after{content:"收合"}.step-bar{display:flex;align-items:center;gap:10px;background:var(--brand2);color:white;border-radius:8px;padding:12px 13px;margin-bottom:12px}.step-bar span{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:5px 8px;font-size:12px;font-weight:950}.step-bar strong{font-size:20px;line-height:1.15}h2{font-size:17px;letter-spacing:0}.link{color:var(--brand);font-size:13px;font-weight:900;white-space:nowrap}.timeline,.service-list{display:grid;gap:10px}.booking{display:grid;grid-template-columns:58px 1fr;gap:10px;align-items:stretch;padding:11px;border:1px solid var(--line);border-radius:8px;background:var(--soft)}.timebox{border-radius:8px;background:var(--ok);color:var(--brand2);display:grid;place-items:center;font-weight:900;min-height:58px;font-size:15px}.booking-main{min-width:0}.row{display:flex;align-items:center;justify-content:space-between;gap:8px}.name,.service-name{font-weight:900}.pill,.tag{border-radius:999px;padding:5px 8px;font-size:12px;font-weight:900;white-space:nowrap}.pill{background:var(--ok);color:var(--brand2);border:1px solid transparent}.pill.confirmed{background:#d7f0e2;color:#07513f;border-color:#9cd7bd}.pill.cancelled{background:#fde2e2;color:#a52828;border-color:#f3a6a6}.pill.pending{background:#fff0c7;color:#8a4a00;border-color:#f0c36d}.tag{background:var(--blue-soft);color:var(--blue)}.meta{color:var(--muted);font-size:13px;margin-top:5px;line-height:1.35}.service{border:1px solid var(--line);border-radius:8px;padding:11px;background:var(--soft)}.staff-card{position:relative;overflow:hidden;border-width:1px 1px 1px 6px}.staff-card.green{background:#f1faf4;border-color:#b9ddc7;border-left-color:#1b7a5f}.staff-card.yellow{background:#fff9e8;border-color:#ead78b;border-left-color:#d6a019}.staff-card .service-title{padding-left:1px}.store-switch{display:inline;color:inherit;text-decoration:none}.choice-service{width:100%;text-align:left;color:inherit;cursor:pointer}.choice-service.active{border-color:var(--brand);background:#eef8f3;box-shadow:0 0 0 2px rgba(23,107,91,.12)}.choice-service.active .tag{background:var(--brand);color:white}.service-title{display:flex;justify-content:space-between;gap:8px;align-items:center}.price-row,.choice-row{display:flex;gap:7px;overflow-x:auto;padding-top:9px;scrollbar-width:none}.price-row::-webkit-scrollbar,.choice-row::-webkit-scrollbar{display:none}.price,.choice{flex:0 0 auto;border-radius:999px;background:var(--amber-soft);color:#7b3e20;padding:6px 9px;font-size:12px;font-weight:850;border:1px solid transparent}.choice{background:white;color:var(--ink);border-color:var(--line);min-height:36px}.choice.active{background:var(--brand);border-color:var(--brand);color:white}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}form{display:grid;gap:10px}label{display:grid;gap:6px;color:var(--muted);font-size:13px}input,select{width:100%;min-height:44px;border-radius:8px;border:1px solid var(--line);background:white;color:var(--ink);padding:9px 10px}.submit{width:100%;min-height:46px;border:1px solid var(--brand);border-radius:8px;background:var(--brand);color:white;font-weight:900}.slots{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}.slot{min-height:42px;border-radius:8px;background:#f2faf6;border:1px solid #cddbd4;color:var(--brand2);display:grid;place-items:center;font-weight:900}.slot.active{background:var(--brand);border-color:var(--brand);color:white}.empty{grid-column:1/-1;border:1px dashed var(--line);border-radius:8px;padding:12px;color:var(--muted);text-align:center;font-size:13px}.rules{display:grid;grid-template-columns:1fr 1fr;gap:9px}.rule{border-radius:8px;background:var(--soft);border:1px solid var(--line);padding:10px}.rule-label{color:var(--muted);font-size:12px}.rule-value{margin-top:5px;font-weight:900;font-size:14px;line-height:1.35}.notice{border-radius:8px;background:var(--ok);color:var(--brand2);padding:11px;font-size:13px;font-weight:850;line-height:1.45}.confirm-overlay{position:fixed;inset:0;z-index:20;display:grid;place-items:end center;background:rgba(0,0,0,.54);padding:18px}.confirm-overlay[hidden]{display:none}.confirm-sheet{width:100%;max-width:430px;background:white;border-radius:8px;padding:18px;box-shadow:0 24px 60px rgba(0,0,0,.3)}.confirm-kicker{color:var(--brand);font-size:13px;font-weight:900;margin-bottom:4px}.confirm-sheet h2{font-size:24px;margin-bottom:12px}.confirm-rows{display:grid;gap:9px;margin:12px 0 16px}.confirm-row{display:grid;grid-template-columns:82px 1fr;gap:10px;padding:10px;border-radius:8px;background:var(--soft);border:1px solid var(--line)}.confirm-label{color:var(--muted);font-size:13px;font-weight:850}.confirm-value{font-size:18px;font-weight:950;line-height:1.25;color:var(--brand2);word-break:break-word}.confirm-value.strong{font-size:24px;color:var(--brand)}.confirm-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}.bottom-nav{position:fixed;left:50%;bottom:0;transform:translateX(-50%);width:100%;max-width:480px;display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:8px 10px calc(8px + env(safe-area-inset-bottom));background:rgba(255,255,255,.96);border-top:1px solid var(--line);backdrop-filter:blur(14px)}.nav-item{min-height:48px;border-radius:8px;display:grid;place-items:center;color:var(--muted);font-size:12px;font-weight:900}.nav-item.active{background:var(--ok);color:var(--brand2)}@media(min-width:760px){body{padding:18px 0}.page{min-height:calc(100vh - 36px);border:1px solid var(--line);border-radius:8px;overflow:hidden}.bottom-nav{border:1px solid var(--line);border-bottom:0;border-top-left-radius:8px;border-top-right-radius:8px}}
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <div class="topbar"><div class="mark"><div class="logo">${logoMarkup}</div><div><div class="product">BookingOS</div><div class="version">${modeLabel}</div></div></div><div class="mode">${modeLabel.includes("客戶") ? "預約中" : "營業中"}</div></div>
      <h1><a class="store-switch" href="${modeLabel.includes("客戶") ? "/merchant" : "/book"}" aria-label="切換前後台">${shellStore.name}</a></h1>
      <p class="store-meta">${shellStore.address}<br>${shellStore.phone}</p>
    </section>
    ${body}
  </main>
  ${nav}
</body>
</html>`;
}

function pageShell(title, body, active = "merchant", tenantId = TENANT_ID) {
  const navLinks = [
    ["merchant", "/merchant", "總覽"],
    ["settings", "/settings", "設定"],
    ["schedule", "/schedule", "排班"],
    ["customers", "/customers", "CRM"],
    ["book", "/book", "客戶端"]
  ].map(([key, href, label]) => { const joiner = href.includes("?") ? "&" : "?"; const nextHref = href + joiner + "tenant=" + encodeURIComponent(tenantId); return `<a class="${active === key ? "active" : ""}" href="${nextHref}">${label}</a>`; }).join("");
  const bookingUrl = "/book?tenant=" + encodeURIComponent(tenantId);
  const nav = `${navLinks}<button class="copy-booking-url" type="button" data-booking-url="${escapeAttrValue(bookingUrl)}">複製預約網址</button>`;
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtmlValue(title)}</title><style>
    :root{--green:#0f766e;--bg:#eef2ed;--panel:#fff;--line:#dfe5dd;--ink:#14221d;--muted:#68746d;--blue:#3d6f9f}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{text-decoration:none;color:inherit}button{font:inherit}.wrap{max-width:1040px;margin:0 auto;padding:18px}.hero{background:#0f4f43;color:white;border-radius:10px;padding:20px;margin-bottom:14px}.hero h1{margin:0;font-size:28px}.hero p{margin:7px 0 0;color:rgba(255,255,255,.76);line-height:1.5}.nav{display:flex;gap:8px;overflow:auto;margin-bottom:14px}.nav a,.nav button{background:white;border:1px solid var(--line);border-radius:999px;padding:10px 16px;font-weight:900;white-space:nowrap;color:var(--ink);cursor:pointer}.nav a.active{background:var(--green);border-color:var(--green);color:white}.nav button{background:#e7f1ff;border-color:#c7d9f4;color:#234f7c}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.panel{background:white;border:1px solid var(--line);border-radius:8px;padding:16px}.panel h2{margin:0 0 10px;font-size:18px}.muted{color:var(--muted);line-height:1.55}.stat{font-size:30px;font-weight:950;margin-top:6px}.table{width:100%;border-collapse:collapse;font-size:14px}.table th,.table td{border-bottom:1px solid #edf1ec;padding:10px;text-align:left;vertical-align:top}.badge{display:inline-block;border-radius:999px;background:#e7f7ee;color:#0f513f;padding:4px 9px;font-size:12px;font-weight:900}.btn{display:inline-grid;place-items:center;min-height:40px;border-radius:8px;border:1px solid var(--line);background:white;padding:0 14px;font-weight:900}.primary{background:var(--blue);border-color:var(--blue);color:white}@media(max-width:760px){.grid{grid-template-columns:1fr}.wrap{padding:12px}.hero h1{font-size:24px}}
  </style></head><body><main class="wrap"><section class="hero"><h1>${escapeHtmlValue(title)}</h1><p>BookingOS 店家後台</p></section><nav class="nav">${nav}</nav>${body}</main><script>document.querySelectorAll("[data-booking-url]").forEach((button)=>{button.addEventListener("click",async()=>{const url=new URL(button.dataset.bookingUrl,location.origin).href;try{await navigator.clipboard.writeText(url);}catch(error){const input=document.createElement("input");input.value=url;document.body.appendChild(input);input.select();document.execCommand("copy");input.remove();}const original=button.textContent;button.textContent="已複製";setTimeout(()=>{button.textContent=original;},1400);});});</script></body></html>`;
}


function customerMemberShell(title, body, active = "member", tenantId = TENANT_ID) {
  const nav = [
    ["book", "/book", "\u9810\u7d04"],
    ["member", "/member", "\u6703\u54e1"],
    ["points", "/points", "\u9ede\u6578"],
    ["history", "/history", "\u7d00\u9304"]
  ].map(([key, href, label]) => {
    const nextHref = href + "?tenant=" + encodeURIComponent(tenantId);
    return `<a class="nav-item ${active === key ? "active" : ""}" href="${nextHref}">${label}</a>`;
  }).join("");
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${escapeHtmlValue(title)}</title><style>
  :root{--bg:#eef2ed;--surface:#fff;--soft:#f8faf6;--ink:#202124;--muted:#667067;--line:#dfe5dd;--brand:#176b5b;--brand2:#0f463e;--blue:#3d6f9f;--ok:#e4f2eb}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:var(--bg);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{text-decoration:none;color:inherit}button,input,select{font:inherit}.page{width:100%;max-width:480px;min-height:100vh;margin:0 auto;background:#f7f8f4;padding-bottom:92px}.hero{background:var(--brand2);color:white;padding:18px 16px 16px;border-bottom-left-radius:8px;border-bottom-right-radius:8px}.topbar{display:flex;align-items:center;gap:10px;margin-bottom:12px}.logo{width:38px;height:38px;border-radius:8px;background:white;color:var(--brand2);display:grid;place-items:center;font-weight:950}.product{font-size:15px;font-weight:950}.version{color:rgba(255,255,255,.72);font-size:12px;margin-top:2px}.hero h1{margin:0;font-size:25px;line-height:1.2}.content{padding:14px}.panel{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:14px;margin-bottom:12px;box-shadow:0 10px 24px rgba(32,33,36,.055)}.panel h2{font-size:20px}.muted,.muted-small{color:var(--muted);line-height:1.55}.btn{display:inline-grid;place-items:center;min-height:40px;border-radius:8px;border:1px solid var(--line);background:white;padding:0 14px;font-weight:900}.primary,.save-btn{background:var(--blue);border-color:var(--blue);color:white}.bottom-nav{position:fixed;left:50%;bottom:0;transform:translateX(-50%);width:100%;max-width:480px;display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:8px 10px calc(8px + env(safe-area-inset-bottom));background:rgba(255,255,255,.96);border-top:1px solid var(--line);backdrop-filter:blur(14px)}.nav-item{min-height:48px;border-radius:8px;display:grid;place-items:center;color:var(--muted);font-size:12px;font-weight:900}.nav-item.active{background:var(--ok);color:var(--brand2)}@media(min-width:760px){body{padding:18px 0}.page{min-height:calc(100vh - 36px);border:1px solid var(--line);border-radius:8px;overflow:hidden}.bottom-nav{border:1px solid var(--line);border-bottom:0;border-top-left-radius:8px;border-top-right-radius:8px}}
  </style></head><body><main class="page"><section class="hero"><div class="topbar"><div class="logo">B</div><div><div class="product">BookingOS Book</div><div class="version">&#23458;&#25142;&#26371;&#21729;&#31471;</div></div></div><h1>${escapeHtmlValue(title)}</h1></section><div class="content">${body}</div></main><nav class="bottom-nav">${nav}</nav></body></html>`;
}

function renderMerchantPage(data = { store, bookings, services, staffMembers, resourceTypes }, customers = []) {
  const bookingRows = (data.bookings || []).slice(0, 8).map((booking) => `<tr><td>${escapeHtmlValue(booking.start || "-")}</td><td>${escapeHtmlValue(booking.customer || "-")}</td><td>${escapeHtmlValue(booking.service || "-")}</td><td>${escapeHtmlValue(booking.staffName || booking.staffId || "-")}</td><td><span class="badge">${escapeHtmlValue(booking.status || "-")}</span></td></tr>`).join("");
  const trialNotice = data.store?.status === "trial" ? `<section class="panel" style="margin-bottom:12px"><h2>免費試用中</h2><p class="muted">試用期限至 ${escapeHtmlValue(data.store.contractEnd || "-")}。期間內或到期後，可提出正式付費申請。</p><p><a class="btn primary" href="/apply">申請正式使用</a></p></section>` : "";
  const body = `${trialNotice}<section class="grid"><div class="panel"><h2>今日預約</h2><div class="stat">${(data.bookings || []).length}</div><p class="muted">目前載入的預約筆數</p></div><div class="panel"><h2>會員</h2><div class="stat">${customers.length}</div><p class="muted">CRM 客戶資料</p><p style="margin-top:10px"><a class="btn" href="/api/customers/export?tenant=${encodeURIComponent(data.store?.tenantId || TENANT_ID)}">下載名單</a></p></div><div class="panel"><h2>服務項目</h2><div class="stat">${(data.services || []).length}</div><p class="muted">店家可預約服務</p></div></section><section class="panel" style="margin-top:12px"><h2>預約列表</h2><table class="table"><thead><tr><th>時間</th><th>客戶</th><th>服務</th><th>人員</th><th>狀態</th></tr></thead><tbody>${bookingRows || `<tr><td colspan="5">目前沒有預約資料</td></tr>`}</tbody></table></section>${data.dataError ? `<section class="panel" style="margin-top:12px"><h2>資料提醒</h2><p class="muted">${escapeHtmlValue(data.dataError)}</p></section>` : ""}`;
  return pageShell(data.store?.name || store.name, body, "merchant", data.store?.tenantId || TENANT_ID);
}

function customerLiffEntryUrl(liffId, tenantId, nextPath) {
  const safeLiffId = String(liffId || "").trim();
  const safeTenant = encodeURIComponent(tenantId || TENANT_ID);
  const safeNext = encodeURIComponent(nextPath || `/member?tenant=${safeTenant}`);
  return safeLiffId ? `https://liff.line.me/${encodeURIComponent(safeLiffId)}?tenant=${safeTenant}&next=${safeNext}` : "/member-entry?tenant=" + safeTenant + "&next=" + safeNext;
}

function compactInlineStore(storeData = store) {
  const logoUrl = String(storeData.logoUrl || "");
  return {
    ...storeData,
    logoUrl: logoUrl.length > 4096 ? "" : logoUrl
  };
}

function renderCustomerPage(data = { store, services, businessHours, staffMembers, resourceTypes }) {
  const tenantId = data.store?.tenantId || TENANT_ID;
const payload = JSON.stringify({ tenantId, store: compactInlineStore(data.store || store), services: data.services || services, staffMembers: data.staffMembers || staffMembers, today: todayInTaipei() }).replace(/</g, "\\u003c");
  const memberHref = "/member?tenant=" + encodeURIComponent(tenantId);
  const pointsHref = "/points?tenant=" + encodeURIComponent(tenantId);
  const historyHref = "/history?tenant=" + encodeURIComponent(tenantId);  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>BookingOS Book</title><style>
  :root{--bg:#eef2ed;--surface:#fff;--soft:#f8faf6;--ink:#202124;--muted:#667067;--line:#dfe5dd;--brand:#176b5b;--brand2:#0f463e;--amber-soft:#f4e6db;--blue:#3d6f9f;--ok:#e4f2eb}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:var(--bg);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}button,input,select,textarea{font:inherit}.page{width:100%;max-width:480px;min-height:100vh;margin:0 auto;background:#f7f8f4;padding-bottom:92px}.hero{background:var(--brand2);color:white;padding:18px 16px 16px;border-bottom-left-radius:8px;border-bottom-right-radius:8px}.topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.mark{display:flex;align-items:center;gap:10px}.logo{width:38px;height:38px;border-radius:8px;background:white;color:var(--brand2);display:grid;place-items:center;font-weight:900;overflow:hidden}.logo img{width:100%;height:100%;object-fit:cover}.product{font-size:15px;font-weight:900}.version{color:rgba(255,255,255,.7);font-size:12px;margin-top:2px}.mode{white-space:nowrap;border:1px solid rgba(255,255,255,.24);background:rgba(255,255,255,.1);border-radius:999px;padding:7px 10px;font-size:12px;font-weight:850}h1,h2,p{margin:0}h1{font-size:25px;line-height:1.2}.store-meta{margin-top:7px;color:rgba(255,255,255,.76);font-size:13px;line-height:1.45}.content{padding:14px}section{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:14px;margin-bottom:12px;box-shadow:0 10px 24px rgba(32,33,36,.055)}.step-bar{display:flex;align-items:center;gap:10px;background:var(--brand2);color:white;border-radius:8px;padding:12px 13px;margin-bottom:12px}.step-bar span{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:5px 8px;font-size:12px;font-weight:950}.step-bar strong{font-size:20px}.field{display:grid;gap:6px;color:var(--muted);font-size:13px;font-weight:850}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}input,select{width:100%;min-height:44px;border-radius:8px;border:1px solid var(--line);background:white;color:var(--ink);padding:9px 10px}.service-select{color:#1f5f9b;font-weight:900}.price-row,.staff-row{display:flex;gap:7px;overflow-x:auto;padding-top:10px;scrollbar-width:none}.choice{flex:0 0 auto;border-radius:999px;background:white;color:var(--ink);border:1px solid var(--line);min-height:36px;padding:7px 10px;font-weight:900}.choice.active{background:var(--brand);border-color:var(--brand);color:white}.price{flex:0 0 auto;border-radius:999px;background:var(--amber-soft);color:#7b3e20;padding:6px 9px;font-size:12px;font-weight:850}.slots{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}.slot{min-height:42px;border-radius:8px;background:#f2faf6;border:1px solid #cddbd4;color:var(--brand2);display:grid;place-items:center;font-weight:900}.slot.active{background:var(--brand);border-color:var(--brand);color:white}.empty{grid-column:1/-1;border:1px dashed var(--line);border-radius:8px;padding:12px;color:var(--muted);text-align:center;font-size:13px}.notice{border-radius:8px;background:var(--ok);color:var(--brand2);padding:11px;font-size:13px;font-weight:850;line-height:1.45}.pay-card{border:1px solid var(--line);border-radius:8px;background:var(--soft);padding:12px;display:grid;gap:10px}.money-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.money{border:1px solid var(--line);border-radius:8px;background:white;padding:10px}.money span{display:block;color:var(--muted);font-size:12px}.money b{display:block;margin-top:5px;font-size:18px}.submit{width:100%;min-height:52px;border:1px solid var(--blue);border-radius:8px;background:var(--blue);color:white;font-weight:950}.submit:disabled{opacity:.45}.bottom-nav{position:fixed;left:50%;bottom:0;transform:translateX(-50%);width:100%;max-width:480px;display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:8px 10px calc(8px + env(safe-area-inset-bottom));background:rgba(255,255,255,.96);border-top:1px solid var(--line);backdrop-filter:blur(14px)}.nav-item{min-height:48px;border-radius:8px;display:grid;place-items:center;color:var(--muted);font-size:12px;font-weight:900;text-decoration:none}.nav-item.active{background:var(--ok);color:var(--brand2)}@media(min-width:760px){body{padding:18px 0}.page{min-height:calc(100vh - 36px);border:1px solid var(--line);border-radius:8px;overflow:hidden}.bottom-nav{border:1px solid var(--line);border-bottom:0;border-top-left-radius:8px;border-top-right-radius:8px}}
  </style></head><body><main class="page"><section class="hero"><div class="topbar"><div class="mark"><div class="logo" id="logo-box">B</div><div><div class="product">BookingOS Book</div><div class="version">客戶預約端 V0.1</div></div></div><div class="mode">預約中</div></div><h1 id="store-name"></h1><p class="store-meta" id="store-meta"></p></section><div class="content"><section><div class="step-bar"><span>STEP 1</span><strong>選擇服務</strong></div><label class="field">服務項目<select id="service" class="service-select"></select></label><div class="price-row" id="price-row"></div></section><section><div class="step-bar"><span>STEP 2</span><strong>選擇日期與時長</strong></div><div class="grid"><label class="field">日期<input id="date" type="date"></label><label class="field">時長<select id="duration"></select></label></div></section><section><div class="step-bar"><span>STEP 3</span><strong>選擇服務人員</strong></div><div class="staff-row" id="staff-row"></div><div class="slots" id="slots"><div class="empty">請先選擇服務與日期</div></div></section><section><h2 style="margin-bottom:12px">送出預約</h2><div class="grid"><label class="field">姓名<input id="customer-name" autocomplete="name"></label><label class="field">手機<input id="customer-phone" autocomplete="tel"></label></div><div class="pay-card" style="margin-top:12px"><div class="notice" id="pay-note">選擇時間後會顯示金額與可折抵點數。</div><label class="field">使用點數折抵<input id="redeem" type="number" min="0" value="0"></label><div class="money-grid"><div class="money"><span>原價</span><b id="original-price">NT$0</b></div><div class="money"><span>應付金額</span><b id="payable-price">NT$0</b></div></div></div><div class="notice" id="status" style="margin-top:12px">請依序選擇服務、日期、服務人員與時間。</div><button class="submit" id="submit" type="button" disabled>送出預約</button></section></div></main><nav class="bottom-nav"><a class="nav-item active" href="/book?tenant=${encodeURIComponent(tenantId)}">預約</a><a class="nav-item" href="${escapeAttrValue(memberHref)}">會員</a><a class="nav-item" href="${escapeAttrValue(pointsHref)}">點數</a><a class="nav-item" href="${escapeAttrValue(historyHref)}">紀錄</a></nav><script>
  const state=${payload}; let selectedServiceId=""; let selectedDuration=0; let selectedStaffId="any"; let selectedTime=""; let selectedPrice=0; let maxRedeem=0; let memberPoints=0;
  const $=(id)=>document.getElementById(id); const money=(n)=>"NT$"+Number(n||0).toLocaleString("zh-TW");
  function service(){return state.services.find(s=>s.id===selectedServiceId)||state.services[0];}
  function durationItem(){const s=service(); return (s.prices||[]).find(p=>Number(p.minutes)===Number(selectedDuration))||(s.prices||[])[0]||{minutes:0,price:0};}
  function capableStaff(){const s=service(); return (state.staffMembers||[]).filter(st=>!Array.isArray(st.serviceIds)||st.serviceIds.length===0||st.serviceIds.includes(s.id));}
  function init(){const st=state.store||{}; $("store-name").textContent=st.name||"BookingOS"; $("store-meta").innerHTML=(st.address||"")+"<br>"+(st.phone||""); if(st.logoUrl){$("logo-box").innerHTML='<img src="'+st.logoUrl+'" alt="Logo">';} $("date").value=state.today; $("service").innerHTML=(state.services||[]).map(s=>'<option value="'+s.id+'">'+s.name+'｜'+(s.category||'')+'</option>').join(''); selectedServiceId=$("service").value || (state.services[0]&&state.services[0].id)||""; $("service").onchange=()=>{selectedServiceId=$("service").value; selectedTime=""; renderDurations(); renderStaff(); updatePay(); loadSlots(); loadMemberSession();}; $("date").onchange=()=>{selectedTime=""; loadSlots();}; $("duration").onchange=()=>{selectedDuration=Number($("duration").value); selectedTime=""; updatePay(); loadSlots();}; $("redeem").oninput=updatePay; $("submit").onclick=submitBooking; $("customer-name").oninput=updateReady; $("customer-phone").oninput=updateReady; renderDurations(); renderStaff(); updatePay(); loadSlots(); loadMemberSession();}
  function renderDurations(){const prices=service().prices||[]; selectedDuration=Number((prices[0]||{}).minutes||0); $("duration").innerHTML=prices.map(p=>'<option value="'+p.minutes+'">'+p.minutes+' 分鐘 · '+money(p.price)+'</option>').join(''); $("price-row").innerHTML=prices.map(p=>'<span class="price">'+p.minutes+' 分 · '+money(p.price)+'</span>').join('');}
  function renderStaff(){const rows=['<button class="choice active" data-staff="any" type="button">系統安排</button>'].concat(capableStaff().map(st=>'<button class="choice" data-staff="'+st.id+'" type="button">'+st.name+'</button>')); $("staff-row").innerHTML=rows.join(''); document.querySelectorAll('[data-staff]').forEach(btn=>btn.onclick=()=>{selectedStaffId=btn.dataset.staff; selectedTime=""; document.querySelectorAll('[data-staff]').forEach(x=>x.classList.toggle('active',x===btn)); loadSlots();}); selectedStaffId="any";}
  async function loadSlots(){const s=service(); if(!s||!selectedDuration)return; $("slots").innerHTML='<div class="empty">載入可預約時間...</div>'; const params=new URLSearchParams({tenant:state.tenantId,date:$("date").value,serviceId:s.id,duration:String(selectedDuration),staffId:selectedStaffId}); const res=await fetch('/api/availability?'+params.toString()); const data=await res.json(); if(!data.ok||!data.slots||!data.slots.length){$("slots").innerHTML='<div class="empty">目前沒有可預約時間</div>'; $("submit").disabled=true; return;} $("slots").innerHTML=data.slots.map(t=>'<button class="slot" data-time="'+t+'" type="button">'+t+'</button>').join(''); document.querySelectorAll('[data-time]').forEach(btn=>btn.onclick=()=>{selectedTime=btn.dataset.time; document.querySelectorAll('[data-time]').forEach(x=>x.classList.toggle('active',x===btn)); updateReady();}); updateReady();}
  function updatePay(){const item=durationItem(); selectedPrice=Number(item.price||0); const limit=Number(service().pointRedeemLimit||0); const serviceMax=limit===0?selectedPrice:Math.min(limit,selectedPrice); maxRedeem=memberPoints>0?Math.min(memberPoints,serviceMax):serviceMax; let redeem=Math.max(0,Math.floor(Number($("redeem").value||0))); if(redeem>maxRedeem){redeem=maxRedeem; $("redeem").value=redeem;} $("pay-note").textContent=memberPoints>0?'可用 '+memberPoints+' 點，本服務最多可折抵 '+maxRedeem+' 點。':'本服務最多可折抵 '+maxRedeem+' 點，登入會員後會帶入實際可用點數。'; $("original-price").textContent=money(selectedPrice); $("payable-price").textContent=money(Math.max(0,selectedPrice-redeem)); updateReady();}
  function updateReady(){const ready=!!selectedTime && !!$("customer-name").value.trim() && !!$("customer-phone").value.trim(); $("submit").disabled=!ready; if(selectedTime) $("status").textContent='已選擇 '+$("date").value+' '+selectedTime+'，送出前請確認服務時長與金額。';}
  async function loadMemberSession(){try{const res=await fetch('/api/customer/session?optional=1&tenant='+encodeURIComponent(state.tenantId),{credentials:'same-origin'}); if(!res.ok)return; const data=await res.json(); const c=data.profile&&data.profile.customer; if(!c)return; memberPoints=Number(c.points_balance||0); if(!$('customer-name').value)$('customer-name').value=c.name||''; if(!$('customer-phone').value)$('customer-phone').value=c.phone||''; updatePay(); updateReady();}catch(e){}}
  async function submitBooking(){const item=durationItem(); if(!selectedTime){$("status").textContent='請先選擇預約時間'; return;} $("status").textContent='送出中...'; const body={serviceId:selectedServiceId,duration:item.minutes,date:$("date").value,startTime:selectedTime,staffId:selectedStaffId,customerName:$("customer-name").value.trim(),customerPhone:$("customer-phone").value.trim(),redeemPoints:Number($("redeem").value||0)}; const res=await fetch('/api/bookings?tenant='+encodeURIComponent(state.tenantId),{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify(body)}); const data=await res.json(); if(!data.ok){$("status").textContent='預約失敗：'+(data.error||'請重新選擇時間'); return;} $("status").textContent='預約完成：'+data.booking.date+' '+data.booking.start+'，'+data.booking.service+'，'+data.booking.duration+' 分鐘。'; loadSlots();}
  init();
  </script></body></html>`;
}

function renderCustomerLoginPage(data = { store }, next = "/member", error = "") {
  const tenantId = data.store?.tenantId || TENANT_ID;
  const storeName = data.store?.name || "BookingOS";
  const safeNext = next && String(next).startsWith("/") ? String(next) : "/member";
  const errorBox = error ? `<div class="error">登入失效，請重新登入</div>` : "";
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtmlValue(storeName)} 會員登入</title><style>:root{--bg:#eef2ed;--panel:#fff;--line:#dfe5dd;--ink:#17211d;--muted:#68746d;--green:#176b5b;--blue:#3b76ad;--soft:#f2faf6}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.card{width:min(420px,calc(100vw - 28px));background:white;border:1px solid var(--line);border-radius:10px;padding:24px;box-shadow:0 18px 50px rgba(16,35,29,.08)}.brand{display:flex;align-items:center;gap:12px;margin-bottom:20px}.mark{width:44px;height:44px;border-radius:10px;background:var(--green);color:white;display:grid;place-items:center;font-weight:950}h1{font-size:24px;margin:0 0 4px}p{color:var(--muted);line-height:1.55;margin:0}.mode{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:18px 0 14px}.mode button{min-height:42px;border:1px solid var(--line);border-radius:8px;background:white;font-weight:950}.mode button.active{background:var(--green);border-color:var(--green);color:white}.field{display:grid;gap:6px;margin-top:12px;color:var(--muted);font-weight:850}.field input{width:100%;min-height:48px;border:1px solid var(--line);border-radius:8px;padding:10px 12px;font:inherit}.hint{font-size:12px;color:var(--muted);margin-top:6px;line-height:1.45}.submit{width:100%;min-height:50px;border:0;border-radius:8px;background:var(--blue);color:white;font-weight:950;font-size:17px;margin-top:14px}.submit.login{background:var(--green);color:white}.error{background:#fde2e2;color:#9b1c1c;border:1px solid #f2b8b8;border-radius:8px;padding:10px 12px;margin-bottom:12px;font-weight:850}.status{min-height:22px;margin-top:12px;color:#0f513f;font-weight:850}.secondary{display:grid;place-items:center;margin-top:10px;min-height:44px;border:1px solid var(--line);border-radius:8px;color:var(--ink);text-decoration:none;font-weight:900}.register-only{display:none}.is-register .register-only{display:grid}.notice{border-radius:8px;background:var(--soft);border:1px solid var(--line);padding:11px;margin-top:12px;color:var(--muted);line-height:1.5}</style></head><body><main class="card"><div class="brand"><div class="mark">B</div><div><h1>${escapeHtmlValue(storeName)}</h1><p>會員登入</p></div></div>${errorBox}<div class="mode"><button class="active" id="mode-login" type="button">登入</button><button id="mode-register" type="button">註冊</button></div><form id="phone-member-form"><input type="hidden" name="tenant" value="${escapeAttrValue(tenantId)}"><input type="hidden" name="next" value="${escapeAttrValue(safeNext)}"><label class="field register-only">姓名<input name="name" autocomplete="name" placeholder="首次註冊必填"></label><label class="field">手機<input name="phone" autocomplete="tel" inputmode="tel" placeholder="0912345678" required></label><label class="field">生日<input name="birthday" inputmode="numeric" placeholder="YYYYMMDD" maxlength="8" required></label><div class="hint">第一版會員登入使用手機作為帳號，生日 YYYYMMDD 作為登入憑證。LINE 綁定稍後再開。</div><button class="submit login" id="submit-member" type="submit">登入</button><div class="status" id="login-status"></div></form><a class="secondary" href="/book?tenant=${encodeURIComponent(tenantId)}">先回預約頁</a></main><script>let mode="login";const form=document.querySelector("#phone-member-form");const card=document.querySelector(".card");const statusBox=document.querySelector("#login-status");const submit=document.querySelector("#submit-member");const loginBtn=document.querySelector("#mode-login");const registerBtn=document.querySelector("#mode-register");function setMode(next){mode=next==="register"?"register":"login";card.classList.toggle("is-register",mode==="register");loginBtn.classList.toggle("active",mode==="login");registerBtn.classList.toggle("active",mode==="register");submit.textContent=mode==="register"?"建立會員並登入":"登入";submit.classList.toggle("login",mode==="login");statusBox.textContent="";}loginBtn.onclick=()=>setMode("login");registerBtn.onclick=()=>setMode("register");form.addEventListener("submit",async(e)=>{e.preventDefault();statusBox.textContent=mode==="register"?"建立會員中...":"登入中...";const fd=new FormData(form);const payload=Object.fromEntries(fd.entries());payload.next=${JSON.stringify(safeNext)};const endpoint=mode==="register"?"/api/customer/phone-register":"/api/customer/phone-login";try{const res=await fetch(endpoint+"?tenant="+encodeURIComponent(payload.tenant),{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify(payload)});const data=await res.json();if(!res.ok||!data.ok){statusBox.textContent=data?.error?.message||"操作失敗";return;}location.href=data.redirect||payload.next;}catch(error){statusBox.textContent="操作失敗，請稍後再試";}});</script></body></html>`;
}
async function renderCustomerRegisterPage(request, env, tenantId = TENANT_ID, error = "") {
  const token = readCookie(request, CUSTOMER_REGISTRATION_COOKIE);
  const verified = await verifyCustomerRegistrationToken(env, decodeURIComponent(token));
  const storeData = await loadStore(env, tenantId);
  const storeName = storeData?.name || "BookingOS";
  const safeTenant = escapeAttrValue(tenantId);
  const tokenValue = verified.ok ? escapeAttrValue(token) : "";
  const errorText = error || (!verified.ok ? (verified.message || "請重新使用 LINE 登入 / 註冊") : "");
  const errorBox = errorText ? "<div class=\"error\">" + escapeHtmlValue(errorText) + "</div>" : "";
  const page = [];
  page.push("<!doctype html><html lang=\"zh-Hant\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>" + escapeHtmlValue(storeName) + " 會員註冊</title>");
  page.push("<style>:root{--bg:#eef2ed;--line:#dfe5dd;--ink:#17211d;--muted:#68746d;--green:#176b5b;--blue:#3b76ad}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif}.card{width:min(420px,calc(100vw - 28px));background:white;border:1px solid var(--line);border-radius:10px;padding:24px;box-shadow:0 18px 50px rgba(16,35,29,.08)}.brand{display:flex;align-items:center;gap:12px;margin-bottom:20px}.mark{width:44px;height:44px;border-radius:10px;background:var(--green);color:white;display:grid;place-items:center;font-weight:950}h1{font-size:24px;margin:0 0 6px}p{color:var(--muted);line-height:1.55}.field{display:grid;gap:6px;margin-top:12px;color:var(--muted);font-weight:850}.field input{width:100%;min-height:48px;border:1px solid var(--line);border-radius:8px;padding:10px 12px;font:inherit}.check{display:flex;gap:8px;align-items:flex-start;margin:14px 0;color:var(--muted);line-height:1.45}.submit{width:100%;min-height:50px;border:0;border-radius:8px;background:var(--blue);color:white;font-weight:950;font-size:17px}.error{background:#fde2e2;color:#9b1c1c;border:1px solid #f2b8b8;border-radius:8px;padding:10px 12px;margin-bottom:12px;font-weight:850}.status{min-height:22px;margin-top:12px;color:#0f513f;font-weight:850}.secondary{display:grid;place-items:center;margin-top:10px;min-height:44px;border:1px solid var(--line);border-radius:8px;color:var(--ink);text-decoration:none;font-weight:900}</style></head><body>");
  page.push("<main class=\"card\"><div class=\"brand\"><div class=\"mark\">B</div><div><h1>" + escapeHtmlValue(storeName) + "</h1><p style=\"margin:2px 0 0\">會員註冊</p></div></div>" + errorBox);
  page.push("<form id=\"register-form\"><input type=\"hidden\" name=\"registration_token\" value=\"" + tokenValue + "\"><label class=\"field\">姓名<input name=\"name\" autocomplete=\"name\" required></label><label class=\"field\">手機<input name=\"phone\" autocomplete=\"tel\" required></label><label class=\"field\">Email（可不填）<input name=\"email\" autocomplete=\"email\"></label><label class=\"check\"><input name=\"agree\" type=\"checkbox\" required><span>我同意建立 " + escapeHtmlValue(storeName) + " 的會員資料，供預約、點數與消費紀錄使用。</span></label><button class=\"submit\" type=\"submit\">完成註冊</button><div class=\"status\" id=\"register-status\"></div></form><a class=\"secondary\" href=\"/member-entry?tenant=" + safeTenant + "\">返回會員登入</a></main>");
  page.push("<script>const form=document.querySelector(\"#register-form\");const statusBox=document.querySelector(\"#register-status\");form.addEventListener(\"submit\",async(e)=>{e.preventDefault();statusBox.textContent=\"送出中...\";const fd=new FormData(form);const payload=Object.fromEntries(fd.entries());payload.agree=form.elements.agree.checked;try{const res=await fetch(\"/api/customer/register\",{method:\"POST\",headers:{\"content-type\":\"application/json\"},credentials:\"same-origin\",body:JSON.stringify(payload)});const data=await res.json();if(!res.ok||!data.ok){statusBox.textContent=data?.error?.message||\"註冊失敗\";return;}location.href=data.redirect||\"/member?tenant=" + encodeURIComponent(tenantId) + "\";}catch(error){statusBox.textContent=\"註冊失敗，請稍後再試\";}});</script></body></html>");
  return page.join("");
}

function renderMemberPage(data = { store }, active = "member") {
  const title = active === "points" ? "會員點數" : active === "history" ? "預約紀錄" : "會員資料";
  const tenantId = data.store?.tenantId || TENANT_ID;
  const payload = JSON.stringify({ tenantId, active, title, store: data.store || store }).replace(/</g, "\\u003c");
  const body = `<style>.member-tools{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px}.member-card{background:#f7fbf8;border:1px solid var(--line);border-radius:8px;padding:14px}.member-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.item-list{display:grid;gap:10px}.item-row{border:1px solid var(--line);border-radius:8px;padding:12px;background:white}.muted-small{color:var(--muted);font-size:13px}.field{display:grid;gap:6px;color:var(--muted);font-size:13px;font-weight:850}.field input,.field select{width:100%;min-height:44px;border:1px solid var(--line);border-radius:8px;padding:9px 11px;font:inherit}.save-btn{min-height:44px;border:0;border-radius:8px;background:var(--blue);color:white;padding:0 18px;font-weight:950}.danger-btn{min-height:38px;border:1px solid #f2b8b8;border-radius:8px;background:#fff;color:#9b1c1c;font-weight:900}@media(max-width:640px){.member-grid{grid-template-columns:1fr}}</style><section class="panel"><div class="member-tools"><h2 style="margin:0">${escapeHtmlValue(title)}</h2><form method="post" action="/customer-logout?tenant=${encodeURIComponent(tenantId)}"><button class="btn" type="submit">登出</button></form></div><div id="member-content" class="member-card">載入會員資料中...</div></section><script>
const memberState=${payload};
const content=document.querySelector("#member-content");
const esc=(v)=>String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
function money(n){return "NT$"+Number(n||0).toLocaleString("zh-TW");}
async function api(path,options={}){const res=await fetch(path+(path.includes("?")?"&":"?")+"tenant="+encodeURIComponent(memberState.tenantId),{credentials:"same-origin",...options});const data=await res.json().catch(()=>({ok:false,error:{message:"回應格式錯誤"}}));if(!res.ok||!data.ok)throw new Error(data?.error?.message||data?.error||"讀取失敗");return data;}
function profileView(profile){const c=profile.customer||{};content.innerHTML='<form id="profile-form" class="item-list"><div class="member-grid"><label class="field">姓名<input name="name" value="'+esc(c.name||'')+'"></label><label class="field">手機<input name="phone" value="'+esc(c.phone||'')+'"></label><label class="field">Email<input name="email" value="'+esc(c.email||'')+'"></label><label class="field">生日<input name="birthday" inputmode="numeric" maxlength="8" placeholder="YYYYMMDD" value="'+esc(c.birthday||'')+'"></label><label class="field">性別<input name="gender" value="'+esc(c.gender||'')+'"></label><label class="field">聯絡偏好<select name="contactPreference"><option value="phone">電話</option><option value="line">LINE</option><option value="email">Email</option></select></label></div><label class="field">地址<input name="address" value="'+esc(c.address||'')+'"></label><label class="field">偏好服務<input name="preferredService" value="'+esc(c.preferred_service||'')+'"></label><label class="field">過敏或提醒<input name="allergyNote" value="'+esc(c.allergy_note||'')+'"></label><button class="save-btn" type="submit">儲存會員資料</button><div class="muted-small" id="save-status">點數餘額：'+Number(c.points_balance||0)+' 點</div></form>';const pref=content.querySelector('[name="contactPreference"]');if(pref)pref.value=c.contact_preference||'phone';document.querySelector('#profile-form').addEventListener('submit',async(e)=>{e.preventDefault();const fd=new FormData(e.target);document.querySelector('#save-status').textContent='儲存中...';try{await api('/api/member',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.fromEntries(fd.entries()))});document.querySelector('#save-status').textContent='已儲存';}catch(err){document.querySelector('#save-status').textContent='儲存失敗：'+err.message;}});}
function pointsView(profile){const c=profile.customer||{};const rows=(profile.points||[]).map(p=>'<div class="item-row"><b>'+Number(p.points||0)+' 點</b><div class="muted-small">'+esc(p.type||'')+' · '+esc(p.reason||'')+'</div><div class="muted-small">'+esc(p.created_at||'')+'</div></div>').join('');content.innerHTML='<div class="item-list"><div class="item-row"><b>可用點數 '+Number(c.points_balance||0)+' 點</b><div class="muted-small">累積取得 '+Number(c.total_points_earned||0)+'，累積使用 '+Number(c.total_points_used||0)+'</div></div>'+(rows||'<div class="item-row">尚無點數紀錄</div>')+'</div>';}
function historyView(profile){const rows=(profile.bookings||[]).map(b=>'<div class="item-row"><b>'+esc(b.service_name||'預約')+'</b><div class="muted-small">'+esc(b.booking_date||'')+' '+esc(b.start_time||'')+' · '+Number(b.duration_minutes||0)+' 分鐘 · '+money(b.price||0)+'</div><div class="muted-small">狀態：'+esc(b.status||'')+'</div>'+(b.status==='cancelled'?'':'<button class="danger-btn" data-cancel="'+esc(b.id)+'" type="button">取消預約</button>')+'</div>').join('');content.innerHTML='<div class="item-list">'+(rows||'<div class="item-row">尚無預約紀錄</div>')+'</div>';content.querySelectorAll('[data-cancel]').forEach(btn=>btn.onclick=async()=>{btn.disabled=true;try{await api('/api/bookings/cancel',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({bookingId:btn.dataset.cancel})});await load();}catch(err){btn.textContent='取消失敗';}});}
async function load(){try{const data=await api('/api/member');const profile=data.profile||{};if(memberState.active==='points')pointsView(profile);else if(memberState.active==='history')historyView(profile);else profileView(profile);}catch(err){content.textContent='會員登入已失效，請重新登入';setTimeout(()=>{location.href='/member-login?tenant='+encodeURIComponent(memberState.tenantId)+'&next='+encodeURIComponent(location.pathname+location.search);},700);}}
load();
</script>`;
  return customerMemberShell(title, body, active === "points" ? "points" : active === "history" ? "history" : "member", tenantId);
}
function renderSchedulePage(data = { staffMembers, resourceTypes }) {
  const staffRows = (data.staffMembers || staffMembers).map((staff) => `<tr><td>${escapeHtmlValue(staff.name)}</td><td>${escapeHtmlValue(staff.role || "-")}</td></tr>`).join("");
  return pageShell("排班", `<section class="panel"><h2>服務人員</h2><table class="table"><tbody>${staffRows || `<tr><td>尚未設定服務人員</td></tr>`}</tbody></table></section>`, "schedule", data.store?.tenantId || TENANT_ID);
}

function renderSettingsPage(data = { store, businessHours, services, staffMembers, resourceTypes }) {
  const tenantId = data.store?.tenantId || TENANT_ID;
  const payload = JSON.stringify({
    store: data.store || store,
    businessHours: data.businessHours || businessHours,
    services: data.services || services,
    staffMembers: data.staffMembers || staffMembers,
    resourceTypes: data.resourceTypes || resourceTypes,
    staffLimit: tenantStaffLimitFromRow(data.store || store),
    tenantId
  }).replace(/</g, "\\u003c");
  const trialNotice = data.store?.status === "trial" ? `<section class="panel" style="margin-bottom:12px"><h2>免費試用中</h2><p class="muted">試用期限至 ${escapeHtmlValue(data.store.contractEnd || "-")}。期間內或到期後，可提出正式付費申請。</p><p><a class="btn primary" href="/apply">申請正式使用</a></p></section>` : "";
  const body = `<style>
    .settings-stack{display:grid;gap:12px}.settings-section{background:white;border:1px solid var(--line);border-radius:8px;overflow:hidden}.settings-section:nth-child(even){background:#fffaf0}.settings-section summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:16px 18px;font-size:19px;font-weight:950}.settings-section summary::-webkit-details-marker{display:none}.settings-section summary span{color:var(--green);font-size:13px}.settings-body{border-top:1px solid var(--line);padding:16px 18px}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.form-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}.field{display:grid;gap:6px;color:var(--muted);font-size:13px;font-weight:850}.settings-body input,.settings-body select,.settings-body textarea{width:100%;min-height:44px;border:1px solid var(--line);border-radius:8px;padding:9px 11px;font:inherit;background:white;color:var(--ink)}.settings-body textarea{min-height:82px;resize:vertical}.check-row{display:flex;align-items:center;gap:8px;font-weight:850;color:var(--ink)}.check-row input{width:auto;min-height:auto}.item-list{display:grid;gap:10px;margin-top:12px}.edit-item{border:1px solid var(--line);border-radius:8px;padding:12px;background:rgba(255,255,255,.72)}.edit-item:nth-child(odd){background:#f2fbf6}.edit-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px}.edit-head b{font-size:17px}.mini-actions{display:flex;gap:8px;flex-wrap:wrap}.small-btn{min-height:34px;border:1px solid var(--line);border-radius:8px;background:white;padding:0 10px;font-weight:900;cursor:pointer}.danger{color:#9b1c1c}.save-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:14px}.save-btn{min-height:44px;border:0;border-radius:8px;background:var(--blue);color:white;padding:0 18px;font-weight:950;cursor:pointer}.notice-box{background:#e7f7ee;color:#0f513f;border:1px solid #bfe8d0;border-radius:8px;padding:11px 12px;font-weight:850;line-height:1.5}.hint-box{background:#fff7df;border:1px solid #f1d58a;color:#5f4500;border-radius:8px;padding:11px 12px;line-height:1.5}.price-lines{display:grid;gap:8px}.price-line{display:grid;grid-template-columns:1fr 1fr auto;gap:8px}.service-checks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.logo-preview{width:64px;height:64px;border-radius:10px;border:1px solid var(--line);object-fit:cover;background:#f6f8f5}@media(max-width:760px){.form-grid,.form-grid.three,.service-checks{grid-template-columns:1fr}.settings-body{padding:14px}.price-line{grid-template-columns:1fr 1fr}.price-line button{grid-column:1/-1}}
  </style>${trialNotice}<div class="settings-stack">
    <details class="settings-section" open><summary>店家資料 <span>名稱、電話、地址、LOGO</span></summary><div class="settings-body"><div class="form-grid"><label class="field">店家名稱<input id="store-name"></label><label class="field">電話<input id="store-phone"></label></div><label class="field" style="margin-top:12px">地址<input id="store-address"></label><div class="form-grid" style="margin-top:12px"><label class="field">上傳 LOGO<input id="store-logo-file" type="file" accept="image/*"></label><label class="field">目前 LOGO<img id="store-logo-preview" class="logo-preview" alt="LOGO 預覽"></label></div><input id="store-logo-data" type="hidden"><div class="save-row"><button class="save-btn" id="save-store" type="button">儲存店家資料</button><span class="muted" id="store-status"></span></div></div></details>
    <details class="settings-section"><summary>營業規則 <span>營業時間、打烊規則、贈點比例</span></summary><div class="settings-body"><div class="form-grid"><label class="field">開始營業<input id="open-time" type="time"></label><label class="field">結束營業<input id="close-time" type="time"></label><label class="field">休息開始<input id="break-start" type="time"></label><label class="field">休息結束<input id="break-end" type="time"></label></div><label class="field" style="margin-top:12px">公休日，以逗號分隔<input id="closed-days" placeholder="例如 星期三,星期日"></label><div class="form-grid" style="margin-top:12px"><label class="field">消費金額<input id="point-spend" type="number" min="1"></label><label class="field">贈送點數<input id="point-reward" type="number" min="0"></label></div><label class="check-row" style="margin-top:12px"><input id="allow-overtime" type="checkbox">允許預約時長超過打烊時間</label><div class="hint-box" style="margin-top:12px">關閉時，客戶選擇的時長若超過打烊時間，前台只會保留可完成的 60 或 90 分鐘等選項。</div><div class="save-row"><button class="save-btn" id="save-rules" type="button">儲存營業規則</button><span class="muted" id="rules-status"></span></div></div></details>
    <details class="settings-section"><summary>場地資源 <span>床位、座位、房間數</span></summary><div class="settings-body"><div class="notice-box">同時段可接幾組，會先看這裡的數量，再看師傅是否有空。</div><div class="item-list" id="resource-list"></div><div class="save-row"><button class="small-btn" id="add-resource" type="button">複製新增場地</button><button class="save-btn" id="save-resources" type="button">儲存場地資源</button><span class="muted" id="resources-status"></span></div></div></details>
    <details class="settings-section"><summary>服務項目 <span>名稱、時長價格、點數折抵上限</span></summary><div class="settings-body"><div class="hint-box">點數折抵上限：填 0 代表可全額折抵；填數字代表本服務最多可折抵該點數。</div><div class="item-list" id="service-list"></div><div class="save-row"><button class="small-btn" id="add-service" type="button">複製新增服務</button><button class="save-btn" id="save-services" type="button">儲存服務項目</button><span class="muted" id="services-status"></span></div></div></details>
    <details class="settings-section"><summary>服務人員 <span>可服務項目與 CRM 權限</span></summary><div class="settings-body"><div class="notice-box">取消勾選的服務代表該師傅不會此服務；客戶選「系統安排」時，系統會從可做該服務且有空的人員中挑選。目前方案最多可啟用 <b id="staff-limit-label"></b> 位服務人員。</div><div class="item-list" id="staff-list"></div><div class="save-row"><button class="small-btn" id="add-staff" type="button">複製新增人員</button><button class="save-btn" id="save-staff" type="button">儲存服務人員</button><span class="muted" id="staff-status"></span></div></div></details>
  </div><script>
  const settingsState=${payload};
  const tenantParam="?tenant="+encodeURIComponent(settingsState.tenantId||"");
  const $=(id)=>document.getElementById(id);
  const esc=(v)=>String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const slug=(v)=>String(v||"").trim().toLowerCase().replace(/[^a-z0-9_-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,48)||("item-"+Date.now().toString(36));
  let logoData=settingsState.store.logoUrl||"";
  function postJson(url,payload,statusId){const el=$(statusId); if(el) el.textContent="儲存中..."; return fetch(url+tenantParam,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)}).then(async(r)=>{const d=await r.json().catch(()=>({ok:false,error:"回應格式錯誤"})); if(!d.ok) throw new Error(d.error||"儲存失敗"); if(el) el.textContent="已儲存"; return d;}).catch((err)=>{if(el) el.textContent="儲存失敗："+err.message;});}
  function initStore(){$("store-name").value=settingsState.store.name||"";$("store-phone").value=settingsState.store.phone||"";$("store-address").value=settingsState.store.address||"";$("store-logo-data").value=logoData; if(logoData) $("store-logo-preview").src=logoData; $("store-logo-file").addEventListener("change",()=>{const file=$("store-logo-file").files[0]; if(!file) return; const reader=new FileReader(); reader.onload=()=>{logoData=String(reader.result||"");$("store-logo-data").value=logoData;$("store-logo-preview").src=logoData;}; reader.readAsDataURL(file);}); $("save-store").addEventListener("click",()=>postJson("/api/store",{name:$("store-name").value,phone:$("store-phone").value,address:$("store-address").value,logoDataUrl:$("store-logo-data").value},"store-status"));}
  function initRules(){const h=settingsState.businessHours||{};$("open-time").value=h.open||"09:00";$("close-time").value=h.close||"18:00";$("break-start").value=(h.breaks&&h.breaks[0]&&h.breaks[0].start)||"12:00";$("break-end").value=(h.breaks&&h.breaks[0]&&h.breaks[0].end)||"13:00";$("closed-days").value=(h.closedDays||[]).join(",");$("allow-overtime").checked=!!h.allowOvertimeBooking;$("point-spend").value=(h.pointReward&&h.pointReward.spendAmount)||100;$("point-reward").value=(h.pointReward&&h.pointReward.rewardPoints)||1;$("save-rules").addEventListener("click",()=>postJson("/api/settings",{open:$("open-time").value,close:$("close-time").value,breakStart:$("break-start").value,breakEnd:$("break-end").value,closedDays:$("closed-days").value.split(/[,，]/).map(s=>s.trim()).filter(Boolean),allowOvertimeBooking:$("allow-overtime").checked,pointSpendAmount:$("point-spend").value,pointRewardPoints:$("point-reward").value},"rules-status"));}
  function resourceCard(resource,i){return '<div class="edit-item" data-resource-index="'+i+'"><div class="edit-head"><b>'+esc(resource.name||"場地")+'</b><button class="small-btn danger" type="button" data-remove-resource="'+i+'">停用</button></div><div class="form-grid"><label class="field">場地名稱<input data-resource-name value="'+esc(resource.name||"")+'"></label><label class="field">數量<input data-resource-qty type="number" min="1" value="'+Number(resource.quantity||1)+'"></label></div><input data-resource-id type="hidden" value="'+esc(resource.id||slug(resource.name))+'"></div>';}
  function renderResources(){const list=$("resource-list"); list.innerHTML=(settingsState.resourceTypes||[]).map(resourceCard).join(""); list.querySelectorAll("[data-remove-resource]").forEach(btn=>btn.onclick=()=>{settingsState.resourceTypes.splice(Number(btn.dataset.removeResource),1);renderResources();});}
  function collectResources(){return Array.from(document.querySelectorAll("[data-resource-index]")).map((el,i)=>({id:el.querySelector("[data-resource-id]").value||slug(el.querySelector("[data-resource-name]").value),name:el.querySelector("[data-resource-name]").value,quantity:Number(el.querySelector("[data-resource-qty]").value||1),sortOrder:i}));}
  function priceLines(prices){return '<div class="price-lines">'+(prices||[]).map((p)=>'<div class="price-line"><input data-price-min type="number" min="1" value="'+Number(p.minutes||60)+'" placeholder="分鐘"><input data-price-value type="number" min="0" value="'+Number(p.price||0)+'" placeholder="價格"><button class="small-btn danger" data-remove-price type="button">刪除</button></div>').join("")+'</div><button class="small-btn" data-add-price type="button" style="margin-top:8px">增加時長價格</button>';}
  function serviceCard(service,i){const resourceOptions=(settingsState.resourceTypes||[]).map(r=>'<option value="'+esc(r.id)+'" '+(r.id===service.resourceTypeId?'selected':'')+'>'+esc(r.name)+'</option>').join("");return '<div class="edit-item" data-service-index="'+i+'"><div class="edit-head"><b>'+esc(service.name||"服務")+'</b><button class="small-btn danger" type="button" data-remove-service="'+i+'">停用</button></div><div class="form-grid"><label class="field">服務名稱<input data-service-name value="'+esc(service.name||"")+'"></label><label class="field">分類<input data-service-category value="'+esc(service.category||"")+'"></label><label class="field">使用場地<select data-service-resource>'+resourceOptions+'</select></label><label class="field">點數折抵上限<input data-service-redeem type="number" min="0" value="'+Number(service.pointRedeemLimit||0)+'"></label></div><input data-service-id type="hidden" value="'+esc(service.id||slug(service.name))+'"><div style="margin-top:10px">'+priceLines(service.prices||[])+'</div></div>';}
  function renderServices(){const list=$("service-list"); list.innerHTML=(settingsState.services||[]).map(serviceCard).join(""); list.querySelectorAll("[data-remove-service]").forEach(btn=>btn.onclick=()=>{settingsState.services.splice(Number(btn.dataset.removeService),1);renderServices();renderStaff();}); list.querySelectorAll("[data-add-price]").forEach(btn=>btn.onclick=()=>{btn.previousElementSibling.insertAdjacentHTML("beforeend",'<div class="price-line"><input data-price-min type="number" min="1" value="60" placeholder="分鐘"><input data-price-value type="number" min="0" value="1200" placeholder="價格"><button class="small-btn danger" data-remove-price type="button">刪除</button></div>'); bindPriceRemove();}); bindPriceRemove();}
  function bindPriceRemove(){document.querySelectorAll("[data-remove-price]").forEach(btn=>btn.onclick=()=>btn.closest(".price-line").remove());}
  function collectServices(){return Array.from(document.querySelectorAll("[data-service-index]")).map((el,i)=>({id:el.querySelector("[data-service-id]").value||slug(el.querySelector("[data-service-name]").value),name:el.querySelector("[data-service-name]").value,category:el.querySelector("[data-service-category]").value,resourceTypeId:el.querySelector("[data-service-resource]").value,pointRedeemLimit:Number(el.querySelector("[data-service-redeem]").value||0),prices:Array.from(el.querySelectorAll(".price-line")).map(row=>({minutes:Number(row.querySelector("[data-price-min]").value||0),price:Number(row.querySelector("[data-price-value]").value||0)})).filter(p=>p.minutes>0),sortOrder:i}));}
  function staffCard(staff,i){const serviceIds=Array.isArray(staff.serviceIds)?staff.serviceIds:null;const checks=(settingsState.services||[]).map(s=>'<label class="check-row"><input data-staff-service value="'+esc(s.id)+'" type="checkbox" '+(!serviceIds||serviceIds.includes(s.id)?'checked':'')+'>'+esc(s.name)+'</label>').join("");const perms=staff.crmPermissions||[];return '<div class="edit-item" data-staff-index="'+i+'"><div class="edit-head"><b>'+esc(staff.name||"服務人員")+'</b><button class="small-btn danger" type="button" data-remove-staff="'+i+'">停用</button></div><div class="form-grid"><label class="field">姓名<input data-staff-name value="'+esc(staff.name||"")+'"></label><label class="field">職稱<input data-staff-role value="'+esc(staff.role||"")+'"></label></div><input data-staff-id type="hidden" value="'+esc(staff.id||slug(staff.name))+'"><p class="muted" style="margin:12px 0 8px">可服務項目，取消代表不會此服務</p><div class="service-checks">'+checks+'</div><p class="muted" style="margin:12px 0 8px">CRM 權限</p><div class="service-checks"><label class="check-row"><input data-staff-perm value="staff" type="checkbox" '+(perms.includes("staff")?'checked':'')+'>師傅可看自己的客戶</label><label class="check-row"><input data-staff-perm value="store" type="checkbox" '+(perms.includes("store")?'checked':'')+'>店家可看全店客戶</label></div></div>';}
  function renderStaff(){const list=$("staff-list"); const limit=Math.max(1,Number(settingsState.staffLimit||1)); const label=$("staff-limit-label"); if(label) label.textContent=String(limit); list.innerHTML=(settingsState.staffMembers||[]).map(staffCard).join(""); list.querySelectorAll("[data-remove-staff]").forEach(btn=>btn.onclick=()=>{settingsState.staffMembers.splice(Number(btn.dataset.removeStaff),1);renderStaff();}); const status=$("staff-status"); if(status && (settingsState.staffMembers||[]).length>limit) status.textContent="目前已超過方案上限，請刪除多餘人員或升級方案。";}
  function collectStaff(){return Array.from(document.querySelectorAll("[data-staff-index]")).map((el,i)=>({id:el.querySelector("[data-staff-id]").value||slug(el.querySelector("[data-staff-name]").value),name:el.querySelector("[data-staff-name]").value,role:el.querySelector("[data-staff-role]").value,serviceIds:Array.from(el.querySelectorAll("[data-staff-service]:checked")).map(x=>x.value),crmPermissions:Array.from(el.querySelectorAll("[data-staff-perm]:checked")).map(x=>x.value),sortOrder:i}));}
  initStore();initRules();renderResources();renderServices();renderStaff();
  $("add-resource").onclick=()=>{const base=(settingsState.resourceTypes||[])[0]||{name:"新場地",quantity:1};settingsState.resourceTypes.push({...base,id:"resource-"+Date.now().toString(36),name:(base.name||"場地")+" 複製"});renderResources();};
  $("save-resources").onclick=()=>{settingsState.resourceTypes=collectResources();postJson("/api/resources",{resourceTypes:settingsState.resourceTypes},"resources-status").then(()=>renderServices());};
  $("add-service").onclick=()=>{const base=(settingsState.services||[])[0]||{name:"新服務",category:"未分類",pointRedeemLimit:0,prices:[{minutes:60,price:1200}]};settingsState.services.push({...base,id:"service-"+Date.now().toString(36),name:(base.name||"服務")+" 複製"});renderServices();renderStaff();};
  $("save-services").onclick=()=>{settingsState.services=collectServices();postJson("/api/services",{services:settingsState.services},"services-status").then(()=>renderStaff());};
  $("add-staff").onclick=()=>{const limit=Math.max(1,Number(settingsState.staffLimit||1)); if((settingsState.staffMembers||[]).length>=limit){$("staff-status").textContent="目前方案最多只能建立 "+limit+" 位服務人員，請先升級方案再新增。";return;}const base=(settingsState.staffMembers||[])[0]||{name:"新服務人員",role:"服務人員",serviceIds:null,crmPermissions:[]};settingsState.staffMembers.push({...base,id:"staff-"+Date.now().toString(36),name:(base.name||"服務人員")+" 複製"});renderStaff();};
  $("save-staff").onclick=()=>{settingsState.staffMembers=collectStaff();const limit=Math.max(1,Number(settingsState.staffLimit||1));if(settingsState.staffMembers.length>limit){$("staff-status").textContent="目前方案最多只能儲存 "+limit+" 位服務人員，請刪除多餘人員或升級方案。";return;}postJson("/api/staff",{staffMembers:settingsState.staffMembers},"staff-status");};
  </script>`;
  return pageShell("店家設定", body, "settings", tenantId);
}
function renderCustomersPage(data = { store }, customers = []) {
  const rows = customers.map((customer) => `<tr><td><b>${escapeHtmlValue(customer.name || "未命名")}</b><div class="muted">${escapeHtmlValue(customer.phone || "-")}</div></td><td>${Number(customer.points_balance || 0)} 點</td><td>${escapeHtmlValue(customer.referral_code || "-")}</td><td>${Number(customer.total_bookings || 0)}</td></tr>`).join("");
  return pageShell("客戶 CRM", `<section class="panel"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px"><h2 style="margin:0">客戶列表</h2><a class="btn primary" href="/api/customers/export?tenant=${encodeURIComponent(data.store?.tenantId || TENANT_ID)}">下載客戶名單</a></div><p class="muted" style="margin:0 0 12px">Excel 內含：通訊錄、消費歷史表、點數進出表。</p><table class="table"><thead><tr><th>客戶</th><th>點數</th><th>介紹碼</th><th>預約</th></tr></thead><tbody>${rows || `<tr><td colspan="4">尚無客戶資料</td></tr>`}</tbody></table></section>`, "customers", data.store?.tenantId || TENANT_ID);
}
function planById(planId) {
  return billingPlans.find((plan) => plan.id === planId) || billingPlans[0];
}

function renderPlanOptions(selectedId = "solo") {
  return billingPlans.map((plan) => `<option value="${escapeAttrValue(plan.id)}" ${plan.id === selectedId ? "selected" : ""}>${escapeHtmlValue(plan.name)}｜年繳 NT$${Number(plan.annualPrice).toLocaleString("zh-TW")}｜含 ${plan.staffLimit} 位師傅</option>`).join("");
}

function planSummary(planId) {
  const plan = planById(planId);
  return `${plan.name}｜年繳 NT$${Number(plan.annualPrice).toLocaleString("zh-TW")}｜含 ${plan.staffLimit} 位師傅`;
}

function planFromPayload(payload) {
  return planById(String(payload.planId || payload.billingPlanId || "solo").trim());
}
function tenantStaffLimitFromRow(row = {}) {
  const plan = planById(row.billing_plan_id || row.billingPlanId || "solo");
  return Math.max(1, Number(row.staff_limit || row.staffLimit || plan.staffLimit || 1));
}

async function tenantStaffLimit(env, tenantId = TENANT_ID) {
  if (!env.DB) return 1;
  const row = await env.DB.prepare("SELECT billing_plan_id, staff_limit FROM tenants WHERE id = ? LIMIT 1").bind(tenantId).first();
  return tenantStaffLimitFromRow(row || { billing_plan_id: "solo", staff_limit: 1 });
}
function renderPricingPage() {
  const planCards = billingPlans.map((plan) => `<article class="plan"><div><h2>${escapeHtmlValue(plan.name)}</h2><p>${escapeHtmlValue(plan.description)}</p></div><div class="price"><b>NT$${Number(plan.annualPrice).toLocaleString("zh-TW")}</b><span>/ 年繳</span></div><dl><div><dt>月費概念</dt><dd>NT$${Number(plan.monthlyPrice).toLocaleString("zh-TW")} / 月</dd></div><div><dt>平均月成本</dt><dd>約 NT$${Math.round(plan.annualPrice / 12).toLocaleString("zh-TW")} / 月</dd></div><div><dt>內含師傅</dt><dd>${plan.staffLimit} 位</dd></div><div><dt>超額師傅</dt><dd>${plan.extraStaffAnnualPrice ? `NT$${Number(plan.extraStaffAnnualPrice).toLocaleString("zh-TW")} / 人 / 年` : "請升級下一方案"}</dd></div></dl><div class="actions" style="margin-top:12px"><a class="btn primary" href="/apply?plan=${encodeURIComponent(plan.id)}">正式購買</a><a class="btn" href="/trial?plan=${encodeURIComponent(plan.id)}">先試用</a></div></article>`).join("");
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BookingOS 費用說明</title><style>:root{--green:#0f766e;--bg:#eef2ed;--panel:#fff;--line:#dfe5dd;--ink:#17211d;--muted:#68746d;--blue:#3d6f9f;--yellow:#fff7df}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{max-width:1080px;margin:0 auto;padding:28px 18px}.hero{background:#10231d;color:white;border-radius:10px;padding:26px;margin-bottom:16px}.hero h1{margin:0;font-size:30px}.hero p{margin:8px 0 0;color:rgba(255,255,255,.75);line-height:1.6}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.btn{display:inline-grid;place-items:center;min-height:40px;border-radius:8px;border:1px solid var(--line);background:white;color:#10231d;text-decoration:none;padding:0 14px;font-weight:900}.primary{background:#06c755;border-color:#06c755}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.plan,.panel{background:white;border:1px solid var(--line);border-radius:10px;padding:16px}.plan h2,.panel h2{margin:0 0 8px;font-size:18px}.plan p,.panel p,.panel li{color:var(--muted);line-height:1.6}.price{margin:12px 0;padding:12px;border-radius:8px;background:#e7f7ee;color:#0f513f}.price b{display:block;font-size:28px}.price span{font-weight:850}dl{display:grid;gap:8px;margin:0}dl div{display:flex;justify-content:space-between;gap:12px;border-top:1px solid #edf1ec;padding-top:8px}dt{color:var(--muted)}dd{margin:0;font-weight:900;text-align:right}.bands{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}.flow{counter-reset:step;display:grid;gap:10px;margin:0;padding:0;list-style:none}.flow li{position:relative;background:white;border:1px solid var(--line);border-radius:8px;padding:13px 13px 13px 44px}.flow li:before{counter-increment:step;content:counter(step);position:absolute;left:13px;top:13px;width:22px;height:22px;border-radius:999px;background:var(--green);color:white;display:grid;place-items:center;font-size:12px;font-weight:950}.note{background:var(--yellow);border-color:#f1d58a}.table{width:100%;border-collapse:collapse}.table th,.table td{text-align:left;border-bottom:1px solid #edf1ec;padding:10px;vertical-align:top}.table th{color:var(--muted);font-size:13px}@media(max-width:900px){.grid,.bands{grid-template-columns:1fr 1fr}}@media(max-width:620px){.grid,.bands{grid-template-columns:1fr}.hero h1{font-size:25px}}</style></head><body><main class="wrap"><section class="hero"><h1>BookingOS 費用說明</h1><p>對外用月費讓店家容易理解，實際採年繳收款。年繳等於約送 2 個月，降低你每月催款與對帳成本。</p><div class="actions"><a class="btn primary" href="/trial">申請 60 天試用</a><a class="btn" href="/apply">正式申請</a><a class="btn" href="/platform">平台後台</a></div></section><section class="grid">${planCards}</section><section class="bands"><div class="panel note"><h2>計費原則</h2><table class="table"><tr><th>對外說法</th><td>月費 300 元起</td></tr><tr><th>實際收款</th><td>採年繳制，不提供月繳作為第一版主流程</td></tr><tr><th>優惠邏輯</th><td>年繳約等於送 2 個月</td></tr><tr><th>人員規則</th><td>1、2、4 位以內請升級對應方案；超過團隊版 8 位後，才以每位每年 +1,000 元加購。</td></tr></table></div><div class="panel"><h2>店家如何下單</h2><ol class="flow"><li>店家先到 /trial 申請 60 天免費試用，或直接到 /apply 正式申請。</li><li>正式申請時選擇年繳方案，系統建立待收款訂單。</li><li>你收到匯款或人工確認付款後，在平台後台標記已收款。</li><li>確認後核准申請或把試用店家轉正式，正式合約起算一年。</li></ol></div></section><section class="bands"><div class="panel"><h2>後台如何呈現</h2><ul><li>店家管理：顯示每家店的方案、年費、合約期限。</li><li>試用列表：顯示試用到期日、預計正式方案、轉正式按鈕。</li><li>收款訂單：顯示待收款/已收款、店家、業主、方案與金額。</li><li>申請審核：付款確認後再核准開通正式店家。</li></ul></div><div class="panel"><h2>建議銷售話術</h2><p>「系統月費 300 元起，採年繳，等於送 2 個月。先免費試用 60 天，覺得適合再轉正式。」</p><p>對小店強調不用每月處理付款；對你來說可以先收全年費，現金流更穩。</p></div></section></main></body></html>`;
}
function renderApplicationPage(selectedPlanId = "solo") {
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BookingOS 店家申請</title><style>:root{--green:#06c755;--bg:#eef2ed;--panel:#fff;--line:#dfe5dd;--ink:#17211d;--muted:#68746d}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:var(--bg);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{max-width:760px;margin:0 auto;padding:30px 18px}.hero{background:#10231d;color:white;border-radius:10px;padding:24px;margin-bottom:16px}.hero h1{margin:0;font-size:28px}.hero p{margin:8px 0 0;color:rgba(255,255,255,.72)}.panel{background:white;border:1px solid var(--line);border-radius:10px;padding:18px}form{display:grid;gap:14px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}label{display:grid;gap:6px;color:var(--muted);font-size:13px;font-weight:850}input,select,textarea{width:100%;min-height:44px;border:1px solid var(--line);border-radius:8px;padding:9px 11px;font:inherit}textarea{min-height:90px;resize:vertical}.submit{min-height:46px;border:0;border-radius:8px;background:var(--green);font-weight:950;color:#062216}.price-note{background:#fff7df;border:1px solid #f1d58a;color:#5f4500;border-radius:8px;padding:12px;font-weight:850;line-height:1.45}.notice{background:#e7f7ee;border:1px solid #bfe8d0;color:#0f513f;border-radius:8px;padding:12px;font-weight:850;line-height:1.45}@media(max-width:640px){.grid{grid-template-columns:1fr}}</style></head><body><main class="wrap"><section class="hero"><h1>BookingOS 店家申請</h1><p>請由業主填寫店家與負責人資料，平台審核通過後會開通後台。</p></section><section class="panel"><form id="apply-form"><label>店家名稱<input id="store-name" required placeholder="例如 安和整復調理"></label><div class="grid"><label>店家電話<input id="store-phone" placeholder="02-xxxx-xxxx"></label><label>業態<input id="business-type" placeholder="整復推拿 / 美甲 / 美睫"></label></div><label>店家地址<input id="store-address" placeholder="店家地址"></label><div class="grid"><label>負責人姓名<input id="owner-name" required placeholder="業主姓名"></label><label>負責人手機<input id="owner-phone" required placeholder="09xx"></label></div><label>Email<input id="owner-email" type="email" placeholder="合約與通知使用，可不填"></label><label>年繳方案<select id="plan-id">${renderPlanOptions(selectedPlanId)}</select></label><div class="price-note">採年繳制：單人版 NT$3,000/年，小店版 NT$5,000/年，成長版 NT$8,000/年，團隊版 NT$12,000/年。人員不足時升級方案，超過 8 位後才加購。</div><label>備註<textarea id="note" placeholder="想補充的需求、分店數、服務類型"></textarea></label><button class="submit" type="submit">送出申請</button><div class="notice" id="notice">送出後請等待平台審核。想先體驗可改用 60 天免費試用：/trial。費用說明：/pricing</div></form></section></main><script>const form=document.querySelector("#apply-form");const notice=document.querySelector("#notice");const lineUserId=new URLSearchParams(location.search).get("lineUserId")||new URLSearchParams(location.search).get("uid")||"";form.addEventListener("submit",async(e)=>{e.preventDefault();notice.textContent="送出中...";const payload={storeName:document.querySelector("#store-name").value.trim(),storePhone:document.querySelector("#store-phone").value.trim(),storeAddress:document.querySelector("#store-address").value.trim(),businessType:document.querySelector("#business-type").value.trim(),ownerName:document.querySelector("#owner-name").value.trim(),ownerPhone:document.querySelector("#owner-phone").value.trim(),ownerEmail:document.querySelector("#owner-email").value.trim(),planId:document.querySelector("#plan-id").value,note:document.querySelector("#note").value.trim(),lineUserId};const res=await fetch("/api/applications",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});const data=await res.json();if(!data.ok){notice.textContent="送出失敗："+(data.error||"請稍後再試");return;}form.reset();notice.textContent="已送出申請，平台審核後會通知開通。申請編號："+data.application.id;});document.querySelectorAll("[data-approve-application]").forEach((btn)=>btn.addEventListener("click",async()=>{notice.textContent="核准申請中...";const r=await fetch("/api/platform/applications/approve",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({applicationId:btn.dataset.approveApplication})});const d=await r.json();if(!d.ok){notice.textContent="核准失敗："+(d.error||"請稍後再試");return;}location.reload();}));document.querySelectorAll("[data-convert-trial]").forEach((btn)=>btn.addEventListener("click",async()=>{notice.textContent="轉正式中...";const r=await fetch("/api/platform/trials/convert",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({tenantId:btn.dataset.convertTrial})});const d=await r.json();if(!d.ok){notice.textContent="轉正式失敗："+(d.error||"請稍後再試");return;}location.reload();}));document.querySelectorAll("[data-order-plan]").forEach((select)=>select.addEventListener("change",async()=>{notice.textContent="更新方案中...";const r=await fetch("/api/platform/orders/plan",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({orderId:select.dataset.orderPlan,planId:select.value})});const d=await r.json();if(!d.ok){notice.textContent="更新方案失敗："+(d.error||"請稍後再試");return;}location.reload();}));document.querySelectorAll("[data-tenant-plan]").forEach((select)=>select.addEventListener("change",async()=>{notice.textContent="更新方案中...";const r=await fetch("/api/platform/orders/plan",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({tenantId:select.dataset.tenantPlan,planId:select.value})});const d=await r.json();if(!d.ok){notice.textContent="更新方案失敗："+(d.error||"請稍後再試");return;}location.reload();}));document.querySelectorAll("[data-mark-paid]").forEach((btn)=>btn.addEventListener("click",async()=>{notice.textContent="標記收款中...";const r=await fetch("/api/platform/orders/mark-paid",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({orderId:btn.dataset.markPaid})});const d=await r.json();if(!d.ok){notice.textContent="標記失敗："+(d.error||"請稍後再試");return;}location.reload();}));document.querySelectorAll("[data-platform-line-form]").forEach((form)=>form.addEventListener("submit",async(e)=>{e.preventDefault();notice.textContent="儲存平台 LINE OA 參數中...";const fd=new FormData(form);const payload={basicId:fd.get("basicId"),channelId:fd.get("channelId"),channelSecret:fd.get("channelSecret"),channelAccessToken:fd.get("channelAccessToken"),loginLiffId:fd.get("loginLiffId"),registrationLiffId:fd.get("registrationLiffId"),friendAddUrl:fd.get("friendAddUrl"),richMenuId:fd.get("richMenuId"),notes:fd.get("notes"),webhookEnabled:fd.has("webhookEnabled"),ownerLoginEnabled:fd.has("ownerLoginEnabled"),ownerRegistrationEnabled:fd.has("ownerRegistrationEnabled")};const r=await fetch("/api/platform/platform-line-oa",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});const d=await r.json();if(!d.ok){notice.textContent="儲存失敗："+(d.error||"請稍後再試");return;}notice.textContent="平台 LINE OA 參數已儲存。Webhook："+d.webhookUrl;}));document.querySelectorAll("[data-line-form]").forEach((form)=>form.addEventListener("submit",async(e)=>{e.preventDefault();notice.textContent="儲存 LINE OA 參數中...";const fd=new FormData(form);const payload={tenantId:fd.get("tenantId"),basicId:fd.get("basicId"),channelId:fd.get("channelId"),channelSecret:fd.get("channelSecret"),channelAccessToken:fd.get("channelAccessToken"),liffId:fd.get("liffId"),loginLiffId:fd.get("loginLiffId"),richMenuId:fd.get("richMenuId"),notes:fd.get("notes"),webhookEnabled:fd.has("webhookEnabled"),loginEnabled:fd.has("loginEnabled"),registrationEnabled:fd.has("registrationEnabled")};const r=await fetch("/api/platform/line-oa",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});const d=await r.json();if(!d.ok){notice.textContent="儲存失敗："+(d.error||"請稍後再試");return;}notice.textContent="LINE OA 參數已儲存。Webhook："+d.webhookUrl;}));</script></body></html>`;
}
function renderTrialPage(selectedPlanId = "solo") {
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BookingOS 免費試用</title><style>:root{--green:#06c755;--blue:#3d6f9f;--bg:#eef2ed;--panel:#fff;--line:#dfe5dd;--ink:#17211d;--muted:#68746d}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:var(--bg);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{max-width:760px;margin:0 auto;padding:30px 18px}.hero{background:#123a57;color:white;border-radius:10px;padding:24px;margin-bottom:16px}.hero h1{margin:0;font-size:28px}.hero p{margin:8px 0 0;color:rgba(255,255,255,.78);line-height:1.55}.panel{background:white;border:1px solid var(--line);border-radius:10px;padding:18px}form{display:grid;gap:14px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}label{display:grid;gap:6px;color:var(--muted);font-size:13px;font-weight:850}input,select,textarea{width:100%;min-height:44px;border:1px solid var(--line);border-radius:8px;padding:9px 11px;font:inherit}textarea{min-height:90px;resize:vertical}.submit{min-height:46px;border:0;border-radius:8px;background:var(--blue);font-weight:950;color:white}.price-note{background:#fff7df;border:1px solid #f1d58a;color:#5f4500;border-radius:8px;padding:12px;font-weight:850;line-height:1.45}.notice{background:#e8f1ff;border:1px solid #c8dbff;color:#244f7c;border-radius:8px;padding:12px;font-weight:850;line-height:1.45}.link{color:#0f513f;font-weight:900}@media(max-width:640px){.grid{grid-template-columns:1fr}}</style></head><body><main class="wrap"><section class="hero"><h1>BookingOS 免費試用</h1><p>無須審核，送出後立即開通 60 天試用。試用期間內或到期後，可由平台轉為付費正式使用。</p></section><section class="panel"><form id="trial-form"><label>店家名稱<input id="store-name" required placeholder="例如 安和整復調理"></label><div class="grid"><label>店家電話<input id="store-phone" placeholder="02-xxxx-xxxx"></label><label>業態<input id="business-type" placeholder="整復推拿 / 美甲 / 美睫"></label></div><label>店家地址<input id="store-address" placeholder="店家地址"></label><div class="grid"><label>負責人姓名<input id="owner-name" required placeholder="業主姓名"></label><label>負責人手機<input id="owner-phone" required placeholder="09xx"></label></div><label>Email<input id="owner-email" type="email" placeholder="通知使用，可不填"></label><label>預計正式方案<select id="plan-id">${renderPlanOptions(selectedPlanId)}</select></label><div class="price-note">免費試用 60 天；轉正式時採年繳，依此方案建立合約。</div><label>備註<textarea id="note" placeholder="想補充的需求、分店數、服務類型"></textarea></label><button class="submit" type="submit">開通 60 天免費試用</button><div class="notice" id="notice">需要正式付費帳號？也可改填 <a class="link" href="/apply">正式申請</a>，或查看 <a class="link" href="/pricing">費用說明</a>。</div></form></section></main><script>const form=document.querySelector("#trial-form");const notice=document.querySelector("#notice");const lineUserId=new URLSearchParams(location.search).get("lineUserId")||new URLSearchParams(location.search).get("uid")||"";form.addEventListener("submit",async(e)=>{e.preventDefault();notice.textContent="開通試用中...";const payload={storeName:document.querySelector("#store-name").value.trim(),storePhone:document.querySelector("#store-phone").value.trim(),storeAddress:document.querySelector("#store-address").value.trim(),businessType:document.querySelector("#business-type").value.trim(),ownerName:document.querySelector("#owner-name").value.trim(),ownerPhone:document.querySelector("#owner-phone").value.trim(),ownerEmail:document.querySelector("#owner-email").value.trim(),planId:document.querySelector("#plan-id").value,note:document.querySelector("#note").value.trim(),lineUserId};const res=await fetch("/api/trials",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});const data=await res.json();if(!data.ok){notice.textContent="開通失敗："+(data.error||"請稍後再試");return;}form.reset();notice.innerHTML="已開通 60 天免費試用，試用到期日："+data.trialEnd+"。店家後台：<a class='link' href='/merchant?tenant="+encodeURIComponent(data.tenantId)+"'>立即進入</a>；客戶端：<a class='link' href='/book?tenant="+encodeURIComponent(data.tenantId)+"'>預約網址</a>";});</script></body></html>`;
}
function tenantUrlLinks(tenantId) {
  const encoded = encodeURIComponent(tenantId || TENANT_ID);
  return `<div style="display:flex;gap:6px;flex-wrap:wrap"><a class="mini" href="/book?tenant=${encoded}" target="_blank">客戶端</a><a class="mini" href="/merchant?tenant=${encoded}" target="_blank">店家端</a><a class="mini" href="/settings?tenant=${encoded}" target="_blank">設定</a><a class="mini" href="/customers?tenant=${encoded}" target="_blank">CRM</a></div><small>/book?tenant=${escapeHtmlValue(tenantId || TENANT_ID)}</small>`;
}

function lineWebhookUrl(tenantId, env = {}, requestOrUrl = null) {
  return `${publicBaseUrl(env, requestOrUrl)}/line-webhook?tenant=${encodeURIComponent(tenantId || defaultTenantId(env))}`;
}

function platformLineWebhookUrl(env = {}, requestOrUrl = null) {
  return `${publicBaseUrl(env, requestOrUrl)}/platform-line-webhook`;
}
function renderPlatformPage(platform = { tenants: [], admins: [] }, currentData = { store }, env = {}, requestOrUrl = null) {
  const tenantOptions = platform.tenants.map((tenant) => `<option value="${escapeAttrValue(tenant.id)}">${escapeHtmlValue(tenant.name)}｜${escapeHtmlValue(tenant.id)}</option>`).join("");
  const tenantRows = platform.tenants.map((tenant) => {
    const admins = platform.admins.filter((admin) => admin.tenant_id === tenant.id);
    return `<tr><td><b>${escapeHtmlValue(tenant.name)}</b><small>${escapeHtmlValue(tenant.id)}</small></td><td>${escapeHtmlValue(tenant.phone || "-")}</td><td><span class="badge">${escapeHtmlValue(tenant.status || "active")}</span></td><td>${escapeHtmlValue(tenant.contract_start || "-")} 至 ${escapeHtmlValue(tenant.contract_end || "-")}</td><td>${Number(tenant.active_staff_count || 0)} / ${Number(tenant.staff_limit || planById(tenant.billing_plan_id || "solo").staffLimit)}</td><td>${Number(tenant.customer_count || 0)}</td><td>${Number(tenant.booking_count || 0)}</td><td>${admins.length}</td><td>${tenantUrlLinks(tenant.id)}</td><td><a class="mini" href="/merchant?tenant=${encodeURIComponent(tenant.id)}">進入</a></td></tr>`;
  }).join("");
  const adminRows = platform.admins.map((admin) => `<tr><td><b>${escapeHtmlValue(admin.name || "未命名")}</b><small>${escapeHtmlValue(admin.tenant_id || "-")}</small></td><td><span class="badge blue">${escapeHtmlValue(admin.role || "admin")}</span></td><td>${escapeHtmlValue(admin.phone || "-")}</td><td>${escapeHtmlValue(admin.email || "-")}</td><td>${escapeHtmlValue(admin.status || "active")}</td></tr>`).join("");
  const pendingApplications = (platform.applications || []).filter((app) => app.status === "pending");
  const trialTenants = (platform.tenants || []).filter((tenant) => (tenant.status || "") === "trial");
  const trialRows = trialTenants.map((tenant) => {
    const daysLeft = daysBetween(todayInTaipei(), tenant.contract_end || todayInTaipei());
    const dueText = daysLeft < 0 ? `已到期 ${Math.abs(daysLeft)} 天` : `剩 ${daysLeft} 天`;
    return `<tr><td><b>${escapeHtmlValue(tenant.name || "未命名")}</b><small>${escapeHtmlValue(tenant.id)}</small></td><td>${escapeHtmlValue(tenant.phone || "-")}</td><td>${escapeHtmlValue(tenant.contract_start || "-")} 至 ${escapeHtmlValue(tenant.contract_end || "-")}<small>${escapeHtmlValue(dueText)}</small></td><td>${escapeHtmlValue(planSummary(tenant.billing_plan_id || "solo"))}</td><td>${Number(tenant.customer_count || 0)}</td><td>${Number(tenant.booking_count || 0)}</td><td>${tenantUrlLinks(tenant.id)}</td><td><button class="mini" type="button" data-convert-trial="${escapeAttrValue(tenant.id)}">轉正式</button> <a class="mini" href="/merchant?tenant=${encodeURIComponent(tenant.id)}">進入</a></td></tr>`;
  }).join("");
  const applicationRows = (platform.applications || []).map((app) => `<tr><td><b>${escapeHtmlValue(app.store_name || "未命名")}</b><small>${escapeHtmlValue(app.business_type || "-")}</small></td><td>${escapeHtmlValue(app.owner_name || "-")}<small>${escapeHtmlValue(app.owner_phone || "-")}</small></td><td>${app.status === "pending" ? "核准日起算一年" : escapeHtmlValue(app.contract_start || "-") + " 至 " + escapeHtmlValue(app.contract_end || "-")}</td><td>${escapeHtmlValue(planSummary(app.billing_plan_id || "solo"))}<small>年費 NT$${Number(app.annual_price || planById(app.billing_plan_id || "solo").annualPrice).toLocaleString("zh-TW")}</small></td><td><span class="badge ${app.status === "pending" ? "yellow" : "blue"}">${escapeHtmlValue(app.status || "pending")}</span></td><td>${app.status === "pending" ? `<button class="mini" type="button" data-approve-application="${escapeAttrValue(app.id)}">核准</button>` : escapeHtmlValue(app.tenant_id || "-")}</td></tr>`).join("");
    const billedTenantIds = new Set((platform.orders || []).map((order) => order.tenant_id).filter(Boolean));
  const explicitOrderRows = (platform.orders || []).map((order) => `<tr><td><b>${escapeHtmlValue(order.store_name || "未命名")}</b><small>${escapeHtmlValue(order.id)}</small></td><td>${escapeHtmlValue(order.owner_name || "-")}<small>${escapeHtmlValue(order.owner_phone || "-")}</small></td><td><select data-order-plan="${escapeAttrValue(order.id)}">${renderPlanOptions(order.billing_plan_id || "solo")}</select><small>含 ${Number(order.staff_limit || planById(order.billing_plan_id || "solo").staffLimit)} 位師傅</small></td><td><b>NT$${Number(order.amount || 0).toLocaleString("zh-TW")}</b><small>年繳費用</small></td><td><span class="badge ${order.status === "paid" ? "blue" : "yellow"}">${order.status === "paid" ? "已收款" : "待收款"}</span><small>${escapeHtmlValue(order.due_date || "")}</small></td><td>${order.status === "paid" ? escapeHtmlValue(order.paid_at || "-") : `<button class="mini" type="button" data-mark-paid="${escapeAttrValue(order.id)}">標記已收款</button>`}</td></tr>`).join("");
  const tenantContractRows = platform.tenants.filter((tenant) => tenant.status !== "trial" && !billedTenantIds.has(tenant.id)).map((tenant) => `<tr><td><b>${escapeHtmlValue(tenant.name || "未命名")}</b><small>${escapeHtmlValue(tenant.id)}</small></td><td>既有店家<small>${escapeHtmlValue(tenant.phone || "-")}</small></td><td><select data-tenant-plan="${escapeAttrValue(tenant.id)}">${renderPlanOptions(tenant.billing_plan_id || "solo")}</select><small>含 ${Number(tenant.staff_limit || planById(tenant.billing_plan_id || "solo").staffLimit)} 位師傅，已啟用 ${Number(tenant.active_staff_count || 0)} 位</small></td><td><b>NT$${Number(tenant.annual_price || planById(tenant.billing_plan_id || "solo").annualPrice).toLocaleString("zh-TW")}</b><small>年繳費用</small></td><td><span class="badge blue">既有合約</span><small>${escapeHtmlValue(tenant.contract_start || "-")} 至 ${escapeHtmlValue(tenant.contract_end || "-")}</small></td><td><a class="mini" href="/merchant?tenant=${encodeURIComponent(tenant.id)}">進入</a></td></tr>`).join("");
  const orderRows = explicitOrderRows + tenantContractRows;
  const lineSettingsByTenant = new Map((platform.lineSettings || []).map((setting) => [setting.tenant_id, setting]));
  const lineRows = platform.tenants.map((tenant) => {
    const setting = lineSettingsByTenant.get(tenant.id) || {};
    const webhook = lineWebhookUrl(tenant.id, env, requestOrUrl);
    return `<div class="form-card line-card"><div class="head" style="margin:-16px -16px 14px"><h2>${escapeHtmlValue(tenant.name || "未命名")}</h2><span>${escapeHtmlValue(tenant.id)}</span></div><form class="form line-form" data-line-form><input type="hidden" name="tenantId" value="${escapeAttrValue(tenant.id)}"><label>Webhook URL<input readonly value="${escapeAttrValue(webhook)}" onclick="this.select()"></label><div class="form-grid"><label>LINE 官方帳號 Basic ID<input name="basicId" placeholder="@xxxxx" value="${escapeAttrValue(setting.basic_id || "")}"></label><label>LINE Login Channel ID<input name="channelId" value="${escapeAttrValue(setting.channel_id || "")}"></label></div><div class="form-grid"><label>Channel Secret<input name="channelSecret" type="password" value="${escapeAttrValue(setting.channel_secret || "")}"></label><label>Messaging API Access Token<input name="channelAccessToken" type="password" value="${escapeAttrValue(setting.channel_access_token || "")}"></label></div><div class="form-grid"><label>LIFF ID<input name="liffId" placeholder="客戶或店家使用" value="${escapeAttrValue(setting.liff_id || "")}"></label><label>登入 LIFF ID<input name="loginLiffId" placeholder="店家登入註冊用" value="${escapeAttrValue(setting.login_liff_id || "")}"></label></div><label>Rich Menu ID<input name="richMenuId" value="${escapeAttrValue(setting.rich_menu_id || "")}"></label><div class="check-grid"><label><input type="checkbox" name="webhookEnabled" ${Number(setting.webhook_enabled ?? 1) ? "checked" : ""}>啟用 Webhook</label><label><input type="checkbox" name="loginEnabled" ${Number(setting.login_enabled || 0) ? "checked" : ""}>啟用店家 LINE 登入</label><label><input type="checkbox" name="registrationEnabled" ${Number(setting.registration_enabled || 0) ? "checked" : ""}>啟用店家註冊管理</label></div><label>備註<textarea name="notes" placeholder="例如：此 OA 負責店家登入、審核通知、試用轉正式提醒">${escapeHtmlValue(setting.notes || "")}</textarea></label><button class="primary" type="submit">儲存 LINE OA 參數</button></form></div>`;
  }).join("");
  const platformContacts = platform.platformContacts || [];
  const tenantById = new Map((platform.tenants || []).map((tenant) => [tenant.id, tenant]));
  const platformContactRows = platformContacts.map((contact) => {
    const tenant = tenantById.get(contact.tenant_id || "") || null;
    const title = contact.display_name || contact.phone || contact.email || "未命名店家";
    const phone = contact.phone || "-";
    const createdAt = contact.followed_at || contact.created_at || "-";
    let statusText = "一般好友";
    let badgeClass = "";
    if (contact.lead_status === "blocked") { statusText = "已封鎖"; badgeClass = "yellow"; }
    else if (tenant && tenant.status === "trial") { statusText = "試用用戶"; badgeClass = "blue"; }
    else if (tenant && tenant.status === "active") { statusText = `${planSummary(tenant.billing_plan_id || "solo")}用戶`; badgeClass = "blue"; }
    else if (tenant) { statusText = `${escapeHtmlValue(tenant.status || "店家")}用戶`; badgeClass = "yellow"; }
    else if (contact.lead_status === "applied") { statusText = "正式申請中"; badgeClass = "yellow"; }
    else if (contact.lead_status === "trial") { statusText = "試用用戶"; badgeClass = "blue"; }
    else if (contact.lead_status === "registered") { statusText = "已註冊用戶"; }
    const avatar = contact.picture_url ? `<img src="${escapeAttrValue(contact.picture_url)}" alt="" class="crm-avatar">` : `<span class="crm-avatar fallback">B</span>`;
    const tenantText = tenant ? tenant.name : (contact.tenant_id || "-");
    const refText = contact.referrer_line_user_id ? "介紹人：" + (contact.referrer_display_name || contact.referrer_line_user_id) : tenantText;
    return `<tr class="crm-row"><td><div class="crm-person">${avatar}<div><b>${escapeHtmlValue(title)}</b><small>${escapeHtmlValue(contact.line_user_id || "-")}</small></div></div></td><td>${escapeHtmlValue(phone)}</td><td><span class="badge ${badgeClass}">${escapeHtmlValue(statusText)}</span><small>${escapeHtmlValue(refText)}</small></td><td>${escapeHtmlValue(createdAt)}</td><td><a class="mini blue-action" href="/merchant?tenant=${encodeURIComponent(contact.tenant_id || TENANT_ID)}">CRM 檔案</a></td></tr>`;
  }).join("");
  const webhookLogs = platform.platformWebhookLogs || [];
  const webhookLogRows = webhookLogs.map((log) => {
    const ok = !log.error && Number(log.saved_contacts || 0) > 0;
    const status = log.error ? "錯誤" : ok ? "已寫入 CRM" : "已收到";
    const badgeClass = log.error ? "yellow" : ok ? "blue" : "";
    return `<tr><td>${escapeHtmlValue(log.created_at || "-")}</td><td><span class="badge ${badgeClass}">${escapeHtmlValue(status)}</span><small>${escapeHtmlValue(log.method || "POST")}｜簽章 ${Number(log.signature_present || 0) ? "有" : "無"}</small></td><td>${Number(log.event_count || 0)}<small>${escapeHtmlValue(log.first_event_type || "-")}</small></td><td>${escapeHtmlValue(log.first_user_id || "-")}<small>${escapeHtmlValue(log.first_message || "-")}</small></td><td>${Number(log.saved_contacts || 0)}</td><td>${escapeHtmlValue(log.error || "-")}<small>${escapeHtmlValue(log.body_preview || "")}</small></td></tr>`;
  }).join("");
  const platformLineOA = platform.platformLineOA || {};
  const platformWebhook = platformLineWebhookUrl(env, requestOrUrl);
  const platformFriendUrl = platformLineOA.friend_add_url || (platformLineOA.basic_id ? `https://line.me/R/ti/p/${encodeURIComponent(platformLineOA.basic_id)}` : "");
  const baseUrl = publicBaseUrl(env, requestOrUrl);
  const platformApplyUrl = `${baseUrl}/apply`;
  const platformTrialUrl = `${baseUrl}/trial`;
  const platformLineSection = `<div class="form-card"><div class="head" style="margin:-16px -16px 14px"><h2>平台官方帳號</h2><span>業主加入、註冊、登入</span></div><form class="form" data-platform-line-form><label>Webhook URL<input readonly value="${escapeAttrValue(platformWebhook)}" onclick="this.select()"></label><div class="form-grid"><label>LINE 官方帳號 Basic ID<input name="basicId" placeholder="@xxxxx" value="${escapeAttrValue(platformLineOA.basic_id || "")}"></label><label>LINE Login Channel ID<input name="channelId" value="${escapeAttrValue(platformLineOA.channel_id || "")}"></label></div><div class="form-grid"><label>Channel Secret<input name="channelSecret" type="password" value="${escapeAttrValue(platformLineOA.channel_secret || "")}"></label><label>Messaging API Access Token<input name="channelAccessToken" type="password" value="${escapeAttrValue(platformLineOA.channel_access_token || "")}"></label></div><div class="form-grid"><label>登入 LIFF ID<input name="loginLiffId" placeholder="店家登入用 LIFF" value="${escapeAttrValue(platformLineOA.login_liff_id || "")}"></label><label>註冊 LIFF ID<input name="registrationLiffId" placeholder="店家註冊用 LIFF" value="${escapeAttrValue(platformLineOA.registration_liff_id || "")}"></label></div><div class="form-grid"><label>加入好友網址<input name="friendAddUrl" placeholder="https://line.me/R/ti/p/@xxxxx" value="${escapeAttrValue(platformFriendUrl)}"></label><label>Rich Menu ID<input name="richMenuId" value="${escapeAttrValue(platformLineOA.rich_menu_id || "")}"></label></div><div class="form-grid"><label>正式申請網址<input readonly value="${escapeAttrValue(platformApplyUrl)}" onclick="this.select()"></label><label>試用申請網址<input readonly value="${escapeAttrValue(platformTrialUrl)}" onclick="this.select()"></label></div><div class="check-grid"><label><input type="checkbox" name="webhookEnabled" ${Number(platformLineOA.webhook_enabled ?? 1) ? "checked" : ""}>啟用平台 Webhook</label><label><input type="checkbox" name="ownerLoginEnabled" ${Number(platformLineOA.owner_login_enabled || 0) ? "checked" : ""}>啟用業主 LINE 登入</label><label><input type="checkbox" name="ownerRegistrationEnabled" ${Number(platformLineOA.owner_registration_enabled ?? 1) ? "checked" : ""}>啟用業主註冊管理</label></div><label>備註<textarea name="notes" placeholder="此 OA 負責：業主加入好友、店家註冊、試用申請、登入與審核通知。">${escapeHtmlValue(platformLineOA.notes || "")}</textarea></label><button class="primary" type="submit">儲存平台官方帳號參數</button></form></div>`;
  const pendingOrders = (platform.orders || []).filter((order) => order.status === "pending");  const activeTenants = platform.tenants.filter((tenant) => (tenant.status || "active") === "active").length;
  const totalBookings = platform.tenants.reduce((sum, tenant) => sum + Number(tenant.booking_count || 0), 0);
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BookingOS Platform</title><style>
  :root{--green:#06c755;--rail:#10231d;--rail2:#19382f;--bg:#eef2ed;--panel:#fff;--line:#dfe5dd;--ink:#18231f;--muted:#68746d;--blue:#3d6f9f;--yellow:#fff4cf}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{text-decoration:none;color:inherit}button,input,select,textarea{font:inherit}.shell{min-height:100vh;display:grid;grid-template-columns:240px minmax(0,1fr)}.rail{background:linear-gradient(180deg,var(--rail),var(--rail2));color:white;padding:18px 14px;display:flex;flex-direction:column}.brand{display:flex;gap:10px;align-items:center;padding:8px 8px 18px}.mark{width:40px;height:40px;border-radius:10px;background:var(--green);color:#062216;display:grid;place-items:center;font-weight:950}.brand b{font-size:18px}.brand small{display:block;color:rgba(255,255,255,.62);margin-top:2px}.nav{display:grid;gap:6px}.nav button,.nav a{width:100%;border:0;background:transparent;text-align:left;padding:11px 12px;border-radius:8px;color:rgba(255,255,255,.78);font-weight:850;cursor:pointer}.nav button.active,.nav button:hover,.nav a:hover{background:rgba(255,255,255,.1);color:white}.rail-foot{margin-top:auto;color:rgba(255,255,255,.62);font-size:12px;line-height:1.55;padding:12px 8px;border-top:1px solid rgba(255,255,255,.12)}.main{padding:24px 28px;min-width:0}.top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px}.top h1{margin:0;font-size:26px}.top p{margin:5px 0 0;color:var(--muted);font-size:13px}.actions{display:flex;gap:10px;flex-wrap:wrap}.btn,.primary,.mini{border:1px solid var(--line);background:white;border-radius:8px;min-height:38px;padding:0 14px;display:inline-grid;place-items:center;font-weight:900;cursor:pointer}.primary{background:var(--green);border-color:var(--green);color:#062216}.mini{min-height:30px;padding:0 10px;color:#0f513f}.stats{display:grid;grid-template-columns:repeat(4,minmax(140px,1fr));gap:12px;margin-bottom:16px}.stat{background:white;border:1px solid var(--line);border-radius:8px;padding:14px}.stat span{color:var(--muted);font-size:12px}.stat b{display:block;font-size:28px;margin-top:6px}.tabs{display:flex;gap:8px;margin-bottom:14px;overflow:auto}.tab{border:1px solid var(--line);background:white;border-radius:999px;min-height:38px;padding:0 16px;font-weight:900;color:#365047;white-space:nowrap;cursor:pointer}.tab.active{background:#10231d;border-color:#10231d;color:white}.section{display:none}.section.active{display:block}.panel{background:white;border:1px solid var(--line);border-radius:8px;overflow:hidden}.head{padding:14px 16px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center}.head h2{margin:0;font-size:17px}.head span{color:#00483f;font-weight:850}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;color:var(--muted);font-size:12px;border-bottom:1px solid var(--line);padding:10px 12px;white-space:nowrap}td{border-bottom:1px solid #edf1ec;padding:12px;white-space:nowrap;vertical-align:middle}td small{display:block;color:var(--muted);margin-top:3px}.badge{border-radius:999px;background:#e7f7ee;color:#0f513f;padding:4px 8px;font-size:12px;font-weight:900}.badge.blue{background:#e8f1ff;color:#24517c}.badge.yellow{background:var(--yellow);color:#755100}.split{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:16px}.form-card{background:white;border:1px solid var(--line);border-radius:8px;padding:16px}.stack{display:grid;gap:14px;align-content:start}.form-card h2{margin:0 0 12px;font-size:17px}.form{display:grid;gap:10px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}label{display:grid;gap:6px;color:var(--muted);font-size:12px;font-weight:850}input,select,textarea{width:100%;min-height:40px;border:1px solid var(--line);border-radius:8px;background:white;padding:8px 10px}textarea{min-height:86px;resize:vertical}.check-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.check-grid label{display:flex;align-items:center;gap:8px;background:#f8faf8;border:1px solid var(--line);border-radius:8px;padding:9px 10px;color:var(--ink);font-size:13px}.check-grid input{width:auto;min-height:auto}.line-card{margin-bottom:14px}.price-note{background:#fff7df;border:1px solid #f1d58a;color:#5f4500;border-radius:8px;padding:12px;font-weight:850;line-height:1.45}.notice{background:#e7f7ee;border:1px solid #bfe8d0;color:#0f513f;border-radius:8px;padding:11px;font-size:13px;font-weight:850;line-height:1.45}.quick{display:grid;grid-template-columns:1fr 1fr;gap:14px}.quick-card{background:white;border:1px solid var(--line);border-radius:8px;padding:16px}.quick-card h2{margin:0 0 10px;font-size:17px}.quick-card p{margin:0;color:var(--muted);line-height:1.55;font-size:13px}.crm-tools{padding:14px 20px;display:flex;gap:12px;align-items:center;border-bottom:1px solid var(--line);flex-wrap:wrap}.crm-search{min-width:320px;max-width:520px;flex:1;background:white}.crm-person{display:flex;align-items:center;gap:14px}.crm-avatar{width:42px;height:42px;border-radius:999px;object-fit:cover;display:inline-grid;place-items:center;background:#e7f7ee;color:#0f513f;font-weight:950}.crm-row td{padding:18px 16px}.blue-action{background:#eef5ff;color:#1155cc;border-color:#eef5ff}.excel-action{background:#e7f7ee;border-color:#bfe8d0;color:#008c51}@media(max-width:1120px){.shell{grid-template-columns:210px 1fr}.stats{grid-template-columns:repeat(2,1fr)}.split,.quick{grid-template-columns:1fr}}@media(max-width:760px){.shell{display:block}.rail{position:static}.main{padding:18px 14px}.top{display:block}.actions{margin-top:12px}.stats{grid-template-columns:1fr 1fr}.nav{grid-template-columns:1fr 1fr}}
  </style></head><body><div class="shell"><aside class="rail"><div class="brand"><div class="mark">B</div><div><b>BookingOS</b><small>Platform Console</small></div></div><nav class="nav"><button class="active" type="button" data-tab="overview">總覽</button><button type="button" data-tab="tenants">店家管理</button><button type="button" data-tab="trials">試用列表</button><a href="/pricing" target="_blank">費用方案</a><button type="button" data-tab="orders">收款訂單</button><button type="button" data-tab="applications">申請審核</button><button type="button" data-tab="lineoa">LINE OA</button><button type="button" data-tab="linecrm">好友 CRM</button><button type="button" data-tab="webhooklog">Webhook 紀錄</button><a href="/merchant">店家後台</a></nav><div class="rail-foot">LINE OA 網頁版工作台規格<br>桌面優先，分區管理多店與權限。</div></aside><main class="main"><section class="section active" data-section="overview"><div class="quick"><div class="quick-card"><h2>費用說明</h2><p>查看月費概念、年繳金額、下單與收款流程。</p><p style="margin-top:10px"><a class="mini" href="/pricing" target="_blank">開啟 /pricing</a></p></div><div class="quick-card"><h2>試用網址</h2><p>提供給業主自行開通 60 天免費試用，無須審核。</p><p style="margin-top:10px"><a class="mini" href="/trial" target="_blank">開啟 /trial</a></p></div><div class="quick-card"><h2>正式申請網址</h2><p>提供給準備付費的業主填寫，平台核准後建立正式帳號。</p><p style="margin-top:10px"><a class="mini" href="/apply" target="_blank">開啟 /apply</a></p></div><div class="quick-card"><h2>工作提醒</h2><p>試用店家：${trialTenants.length} 家；待收款：${pendingOrders.length} 筆；待審申請：${pendingApplications.length} 筆。</p><p style="margin-top:10px"><button class="mini" type="button" data-tab="trials">查看試用</button> <button class="mini" type="button" data-tab="orders">查看訂單</button> <button class="mini" type="button" data-tab="applications">前往審核</button></p></div></div></section><section class="section" data-section="tenants"><div class="split"><section class="panel"><div class="head"><h2>店家列表</h2><span>${platform.tenants.length} 家</span></div><div class="table-wrap"><table><thead><tr><th>店家</th><th>電話</th><th>狀態</th><th>合約期限</th><th>師傅</th><th>會員</th><th>預約</th><th>Admin</th><th>網址</th><th>操作</th></tr></thead><tbody>${tenantRows || `<tr><td colspan="10">尚未建立店家</td></tr>`}</tbody></table></div></section><aside class="stack"><div class="form-card"><h2>手動建立店家</h2><form id="tenant-form" class="form"><label>店家名稱<input id="tenant-name" placeholder="例如 安和整復調理"></label><div class="form-grid"><label>電話<input id="tenant-phone" placeholder="02-xxxx-xxxx"></label><label>狀態<select id="tenant-status"><option value="active">啟用</option><option value="trial">試用</option><option value="paused">停用</option></select></label></div><label>地址<input id="tenant-address" placeholder="店家地址"></label><label>年繳方案<select id="tenant-plan">${renderPlanOptions("solo")}</select></label><div class="form-grid"><label>合約開始<input id="tenant-contract-start" type="date"></label><label>合約結束<input id="tenant-contract-end" type="date"></label></div><button class="primary" type="submit">建立店家</button></form></div><div class="form-card"><h2>店家 Admin</h2><form id="admin-form" class="form"><label>所屬店家<select id="admin-tenant">${tenantOptions}</select></label><div class="form-grid"><label>姓名<input id="admin-name" placeholder="管理員姓名"></label><label>角色<select id="admin-role"><option value="owner">店主 owner</option><option value="admin">管理員 admin</option><option value="staff">師傅 staff</option><option value="viewer">查看 viewer</option></select></label></div><div class="form-grid"><label>手機<input id="admin-phone" placeholder="09xx"></label><label>Email<input id="admin-email" placeholder="可不填"></label></div><button class="primary" type="submit">建立店家 Admin</button></form></div></aside></div></section><section class="section" data-section="trials"><section class="panel"><div class="head"><h2>試用列表</h2><span>${trialTenants.length} 家</span></div><div class="table-wrap"><table><thead><tr><th>店家</th><th>電話</th><th>試用期限</th><th>方案</th><th>會員</th><th>預約</th><th>網址</th><th>操作</th></tr></thead><tbody>${trialRows || `<tr><td colspan="8">尚無試用店家</td></tr>`}</tbody></table></div></section><div class="notice" style="margin-top:12px">試用帳號無須審核，可免費使用 60 天；確認付費後可在此轉為正式店家。</div></section><section class="section" data-section="orders"><section class="panel"><div class="head"><h2>收款訂單</h2><span>${pendingOrders.length} 待收</span></div><div class="table-wrap"><table><thead><tr><th>店家</th><th>業主</th><th>方案</th><th>金額</th><th>狀態</th><th>操作</th></tr></thead><tbody>${orderRows || `<tr><td colspan="6">尚無訂單</td></tr>`}</tbody></table></div></section><div class="notice" style="margin-top:12px">方案變更會同步年費與師傅名額；升級會補足服務人員，降級會停用超出名額的服務人員。收到年費後可標記已收款，再核准開通。</div></section><section class="section" data-section="applications"><section class="panel"><div class="head"><h2>申請審核</h2><span>${pendingApplications.length} 待審</span></div><div class="table-wrap"><table><thead><tr><th>店家</th><th>業主</th><th>合約期限</th><th>方案</th><th>狀態</th><th>操作</th></tr></thead><tbody>${applicationRows || `<tr><td colspan="6">尚無申請</td></tr>`}</tbody></table></div></section><div class="notice" style="margin-top:12px">核准後會自動建立店家與 owner/admin；合約由核准日開始起算一年。</div></section><section class="section" data-section="lineoa"><section class="panel"><div class="head"><h2>平台 LINE OA 串接</h2><span>單一總帳號</span></div><div style="padding:16px"><div class="notice" style="margin-bottom:14px">這一組是 BookingOS 平台自己的官方帳號，不是各店家的 OA。業主加入你的帳號後，後續會從這裡做註冊、試用申請、登入與審核通知。</div>${platformLineSection}</div></section></section><section class="section" data-section="linecrm"><section class="panel"><div class="head"><h2>店家 CRM</h2><span>${platformContacts.length} 位</span></div><div class="crm-tools"><input class="crm-search" placeholder="搜尋姓名、電話、LINE ID..." data-crm-search><button class="mini" type="button">隱藏名單</button><button class="mini excel-action" type="button">會員 Excel 下載</button></div><div class="table-wrap"><table><thead><tr><th>姓名</th><th>聯絡電話</th><th>目前狀態</th><th>加入 / 註冊日期</th><th>操作</th></tr></thead><tbody>${platformContactRows || `<tr><td colspan="5">尚無店家 CRM 資料</td></tr>`}</tbody></table></div></section></section><section class="section" data-section="webhooklog"><section class="panel"><div class="head"><h2>Webhook 收件紀錄</h2><span>${webhookLogs.length} 筆</span></div><div class="notice" style="margin:14px">只要 LINE 有打到 BookingOS，這裡就會出現紀錄。若傳訊息後沒有新列，代表 LINE 沒有送事件到 webhook。</div><div class="table-wrap"><table><thead><tr><th>時間</th><th>狀態</th><th>事件</th><th>LINE 使用者 / 訊息</th><th>寫入 CRM</th><th>錯誤 / 原始內容</th></tr></thead><tbody>${webhookLogRows || `<tr><td colspan="6">尚無 webhook 收件紀錄</td></tr>`}</tbody></table></div></section></section><div class="notice" id="platform-notice" style="margin-top:14px">請先選擇店家管理、申請審核或 LINE OA，再進行管理。</div></main></div><script>const notice=document.querySelector("#platform-notice");function openTab(name){document.querySelectorAll("[data-tab]").forEach((el)=>el.classList.toggle("active",el.dataset.tab===name));document.querySelectorAll("[data-section]").forEach((el)=>el.classList.toggle("active",el.dataset.section===name));}document.querySelectorAll("[data-tab]").forEach((el)=>el.addEventListener("click",()=>openTab(el.dataset.tab)));document.querySelector("#tenant-form").addEventListener("submit",async(e)=>{e.preventDefault();notice.textContent="建立店家中...";const payload={name:document.querySelector("#tenant-name").value.trim(),phone:document.querySelector("#tenant-phone").value.trim(),address:document.querySelector("#tenant-address").value.trim(),status:document.querySelector("#tenant-status").value,contractStart:document.querySelector("#tenant-contract-start").value,contractEnd:document.querySelector("#tenant-contract-end").value,planId:document.querySelector("#tenant-plan").value};const r=await fetch("/api/platform/tenants",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});const d=await r.json();if(!d.ok){notice.textContent="建立失敗："+(d.error||"請稍後再試");return;}location.reload();});document.querySelector("#admin-form").addEventListener("submit",async(e)=>{e.preventDefault();notice.textContent="建立 Admin 中...";const payload={tenantId:document.querySelector("#admin-tenant").value,name:document.querySelector("#admin-name").value.trim(),role:document.querySelector("#admin-role").value,phone:document.querySelector("#admin-phone").value.trim(),email:document.querySelector("#admin-email").value.trim()};const r=await fetch("/api/platform/admins",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});const d=await r.json();if(!d.ok){notice.textContent="建立失敗："+(d.error||"請稍後再試");return;}location.reload();});document.querySelectorAll("[data-approve-application]").forEach((btn)=>btn.addEventListener("click",async()=>{notice.textContent="核准申請中...";const r=await fetch("/api/platform/applications/approve",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({applicationId:btn.dataset.approveApplication})});const d=await r.json();if(!d.ok){notice.textContent="核准失敗："+(d.error||"請稍後再試");return;}location.reload();}));document.querySelectorAll("[data-convert-trial]").forEach((btn)=>btn.addEventListener("click",async()=>{notice.textContent="轉正式中...";const r=await fetch("/api/platform/trials/convert",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({tenantId:btn.dataset.convertTrial})});const d=await r.json();if(!d.ok){notice.textContent="轉正式失敗："+(d.error||"請稍後再試");return;}location.reload();}));document.querySelectorAll("[data-order-plan]").forEach((select)=>select.addEventListener("change",async()=>{notice.textContent="更新方案中...";const r=await fetch("/api/platform/orders/plan",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({orderId:select.dataset.orderPlan,planId:select.value})});const d=await r.json();if(!d.ok){notice.textContent="更新方案失敗："+(d.error||"請稍後再試");return;}location.reload();}));document.querySelectorAll("[data-tenant-plan]").forEach((select)=>select.addEventListener("change",async()=>{notice.textContent="更新方案中...";const r=await fetch("/api/platform/orders/plan",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({tenantId:select.dataset.tenantPlan,planId:select.value})});const d=await r.json();if(!d.ok){notice.textContent="更新方案失敗："+(d.error||"請稍後再試");return;}location.reload();}));document.querySelectorAll("[data-mark-paid]").forEach((btn)=>btn.addEventListener("click",async()=>{notice.textContent="標記收款中...";const r=await fetch("/api/platform/orders/mark-paid",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({orderId:btn.dataset.markPaid})});const d=await r.json();if(!d.ok){notice.textContent="標記失敗："+(d.error||"請稍後再試");return;}location.reload();}));document.querySelectorAll("[data-platform-line-form]").forEach((form)=>form.addEventListener("submit",async(e)=>{e.preventDefault();notice.textContent="儲存平台 LINE OA 參數中...";const fd=new FormData(form);const payload={basicId:fd.get("basicId"),channelId:fd.get("channelId"),channelSecret:fd.get("channelSecret"),channelAccessToken:fd.get("channelAccessToken"),loginLiffId:fd.get("loginLiffId"),registrationLiffId:fd.get("registrationLiffId"),friendAddUrl:fd.get("friendAddUrl"),richMenuId:fd.get("richMenuId"),notes:fd.get("notes"),webhookEnabled:fd.has("webhookEnabled"),ownerLoginEnabled:fd.has("ownerLoginEnabled"),ownerRegistrationEnabled:fd.has("ownerRegistrationEnabled")};const r=await fetch("/api/platform/platform-line-oa",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});const d=await r.json();if(!d.ok){notice.textContent="儲存失敗："+(d.error||"請稍後再試");return;}notice.textContent="平台 LINE OA 參數已儲存。Webhook："+d.webhookUrl;}));document.querySelectorAll("[data-line-form]").forEach((form)=>form.addEventListener("submit",async(e)=>{e.preventDefault();notice.textContent="儲存 LINE OA 參數中...";const fd=new FormData(form);const payload={tenantId:fd.get("tenantId"),basicId:fd.get("basicId"),channelId:fd.get("channelId"),channelSecret:fd.get("channelSecret"),channelAccessToken:fd.get("channelAccessToken"),liffId:fd.get("liffId"),loginLiffId:fd.get("loginLiffId"),richMenuId:fd.get("richMenuId"),notes:fd.get("notes"),webhookEnabled:fd.has("webhookEnabled"),loginEnabled:fd.has("loginEnabled"),registrationEnabled:fd.has("registrationEnabled")};const r=await fetch("/api/platform/line-oa",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});const d=await r.json();if(!d.ok){notice.textContent="儲存失敗："+(d.error||"請稍後再試");return;}notice.textContent="LINE OA 參數已儲存。Webhook："+d.webhookUrl;}));</script></body></html>`;
}
async function ensurePlatformSchema(env) {
  if (!env.DB) return;
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS tenant_admins (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      line_user_id TEXT,
      role TEXT NOT NULL DEFAULT 'admin',
      permissions_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'active',
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    )
  `).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_tenant_admins_tenant ON tenant_admins(tenant_id, status)").run();
  try { await env.DB.prepare("ALTER TABLE tenant_admins ADD COLUMN identity_id TEXT").run(); } catch (error) {}
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS identities (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS identity_auth (
      id TEXT PRIMARY KEY,
      identity_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_uid TEXT,
      normalized_phone TEXT,
      normalized_email TEXT,
      verified INTEGER NOT NULL DEFAULT 0,
      verified_at TEXT,
      last_login_at TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (identity_id) REFERENCES identities(id)
    )
  `).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_identity_auth_identity ON identity_auth(identity_id)").run();
  await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_identity_auth_provider_uid ON identity_auth(provider, provider_uid) WHERE provider_uid IS NOT NULL").run();
  await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_identity_auth_phone ON identity_auth(provider, normalized_phone) WHERE provider = 'PHONE' AND normalized_phone IS NOT NULL").run();
  await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_identity_auth_email ON identity_auth(provider, normalized_email) WHERE provider = 'EMAIL' AND normalized_email IS NOT NULL").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_tenant_admins_identity ON tenant_admins(identity_id)").run();
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS tenant_applications (
      id TEXT PRIMARY KEY,
      store_name TEXT NOT NULL,
      store_phone TEXT,
      store_address TEXT,
      business_type TEXT,
      owner_name TEXT NOT NULL,
      owner_phone TEXT NOT NULL,
      owner_email TEXT,
      contract_start TEXT,
      contract_end TEXT,
      billing_plan_id TEXT,
      billing_cycle TEXT,
      annual_price INTEGER,
      staff_limit INTEGER,
      extra_staff_annual_price INTEGER,
      owner_line_user_id TEXT,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      tenant_id TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_tenant_applications_status ON tenant_applications(status, created_at)").run();
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS billing_orders (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      application_id TEXT,
      source TEXT NOT NULL,
      store_name TEXT NOT NULL,
      owner_name TEXT,
      owner_phone TEXT,
      billing_plan_id TEXT NOT NULL,
      billing_cycle TEXT NOT NULL DEFAULT 'annual',
      amount INTEGER NOT NULL,
      staff_limit INTEGER,
      extra_staff_annual_price INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      due_date TEXT,
      paid_at TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_billing_orders_status ON billing_orders(status, created_at)").run();
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS line_oa_settings (
      tenant_id TEXT PRIMARY KEY,
      channel_id TEXT,
      channel_secret TEXT,
      channel_access_token TEXT,
      basic_id TEXT,
      liff_id TEXT,
      login_liff_id TEXT,
      rich_menu_id TEXT,
      webhook_path TEXT,
      webhook_enabled INTEGER NOT NULL DEFAULT 1,
      login_enabled INTEGER NOT NULL DEFAULT 0,
      registration_enabled INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    )
  `).run();
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS platform_line_oa_settings (
      id TEXT PRIMARY KEY,
      channel_id TEXT,
      channel_secret TEXT,
      channel_access_token TEXT,
      basic_id TEXT,
      login_liff_id TEXT,
      registration_liff_id TEXT,
      rich_menu_id TEXT,
      friend_add_url TEXT,
      webhook_path TEXT,
      webhook_enabled INTEGER NOT NULL DEFAULT 1,
      owner_login_enabled INTEGER NOT NULL DEFAULT 0,
      owner_registration_enabled INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS platform_line_contacts (
      line_user_id TEXT PRIMARY KEY,
      display_name TEXT,
      picture_url TEXT,
      phone TEXT,
      email TEXT,
      role TEXT NOT NULL DEFAULT 'owner_lead',
      lead_status TEXT NOT NULL DEFAULT 'new_friend',
      source TEXT NOT NULL DEFAULT 'line_oa',
      tenant_id TEXT,
      tags_json TEXT NOT NULL DEFAULT '[]',
      note TEXT,
      followed_at TEXT,
      unfollowed_at TEXT,
      last_event_type TEXT,
      last_message TEXT,
      last_interaction_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();
  try { await env.DB.prepare("ALTER TABLE platform_line_contacts ADD COLUMN referrer_line_user_id TEXT").run(); } catch (error) {}
  try { await env.DB.prepare("ALTER TABLE platform_line_contacts ADD COLUMN identity_id TEXT").run(); } catch (error) {}
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_platform_line_contacts_identity ON platform_line_contacts(identity_id)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_platform_line_contacts_status ON platform_line_contacts(lead_status, last_interaction_at)").run();
  try { await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_platform_line_contacts_referrer ON platform_line_contacts(referrer_line_user_id)").run(); } catch (error) {}
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS platform_referrals (
      id TEXT PRIMARY KEY,
      referrer_line_user_id TEXT NOT NULL,
      referred_line_user_id TEXT,
      status TEXT NOT NULL DEFAULT 'clicked',
      source TEXT NOT NULL DEFAULT 'qr',
      landing_url TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_platform_referrals_referrer ON platform_referrals(referrer_line_user_id, created_at)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_platform_referrals_referred ON platform_referrals(referred_line_user_id)").run();
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS platform_line_webhook_logs (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL DEFAULT 'platform',
      method TEXT,
      signature_present INTEGER NOT NULL DEFAULT 0,
      event_count INTEGER NOT NULL DEFAULT 0,
      first_event_type TEXT,
      first_user_id TEXT,
      first_message TEXT,
      saved_contacts INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      body_preview TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_platform_line_webhook_logs_created ON platform_line_webhook_logs(created_at)").run();
  try { await env.DB.prepare("ALTER TABLE tenants ADD COLUMN contract_start TEXT").run(); } catch (error) {}
  try { await env.DB.prepare("ALTER TABLE tenants ADD COLUMN contract_end TEXT").run(); } catch (error) {}
  try { await env.DB.prepare("ALTER TABLE tenants ADD COLUMN billing_plan_id TEXT").run(); } catch (error) {}
  try { await env.DB.prepare("ALTER TABLE tenants ADD COLUMN billing_cycle TEXT").run(); } catch (error) {}
  try { await env.DB.prepare("ALTER TABLE tenants ADD COLUMN annual_price INTEGER").run(); } catch (error) {}
  try { await env.DB.prepare("ALTER TABLE tenants ADD COLUMN staff_limit INTEGER").run(); } catch (error) {}
  try { await env.DB.prepare("ALTER TABLE tenants ADD COLUMN extra_staff_annual_price INTEGER").run(); } catch (error) {}
  try { await env.DB.prepare("ALTER TABLE tenant_applications ADD COLUMN billing_plan_id TEXT").run(); } catch (error) {}
  try { await env.DB.prepare("ALTER TABLE tenant_applications ADD COLUMN billing_cycle TEXT").run(); } catch (error) {}
  try { await env.DB.prepare("ALTER TABLE tenant_applications ADD COLUMN annual_price INTEGER").run(); } catch (error) {}
  try { await env.DB.prepare("ALTER TABLE tenant_applications ADD COLUMN staff_limit INTEGER").run(); } catch (error) {}
  try { await env.DB.prepare("ALTER TABLE tenant_applications ADD COLUMN extra_staff_annual_price INTEGER").run(); } catch (error) {}
  try { await env.DB.prepare("ALTER TABLE tenant_applications ADD COLUMN owner_line_user_id TEXT").run(); } catch (error) {}
  try { await env.DB.prepare("ALTER TABLE platform_line_contacts ADD COLUMN referrer_line_user_id TEXT").run(); } catch (error) {}
  try { await env.DB.prepare("ALTER TABLE platform_line_contacts ADD COLUMN identity_id TEXT").run(); } catch (error) {}
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_platform_line_contacts_identity ON platform_line_contacts(identity_id)").run();
  await env.DB.prepare(`
    INSERT INTO tenant_admins (id, tenant_id, name, phone, role, status, created_at, updated_at)
    SELECT 'demo-owner', ?, '平台示範店主', ?, 'owner', 'active', datetime('now'), datetime('now')
    WHERE NOT EXISTS (SELECT 1 FROM tenant_admins WHERE tenant_id = ? AND role = 'owner')
  `).bind(TENANT_ID, store.phone || null, TENANT_ID).run();
}

async function platformData(env) {
  if (!env.DB) return { tenants: [{ id: TENANT_ID, name: store.name, phone: store.phone, address: store.address, status: "active", customer_count: 0, booking_count: 0, updated_at: "" }], admins: [], applications: [], orders: [], lineSettings: [], platformLineOA: {}, platformContacts: [], platformWebhookLogs: [] };
  await ensurePlatformSchema(env);
  const tenants = await env.DB.prepare(`
    SELECT t.id, t.name, t.phone, t.address, t.timezone, t.status, t.contract_start, t.contract_end, t.billing_plan_id, t.billing_cycle, t.annual_price, t.staff_limit, t.extra_staff_annual_price, t.created_at, t.updated_at,
      (SELECT COUNT(*) FROM customers c WHERE c.tenant_id = t.id) AS customer_count,
      (SELECT COUNT(*) FROM bookings b WHERE b.tenant_id = t.id) AS booking_count,
      (SELECT COUNT(*) FROM staff_members sm WHERE sm.tenant_id = t.id AND sm.enabled = 1) AS active_staff_count
    FROM tenants t
    ORDER BY t.created_at DESC
  `).all();
  const admins = await env.DB.prepare(`
    SELECT id, tenant_id, name, phone, email, line_user_id, role, permissions_json, status, last_login_at, created_at, updated_at
    FROM tenant_admins
    ORDER BY tenant_id, CASE role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'staff' THEN 3 ELSE 4 END, created_at DESC
  `).all();
  const applications = await env.DB.prepare(`
    SELECT id, store_name, store_phone, store_address, business_type, owner_name, owner_phone, owner_email, owner_line_user_id, contract_start, contract_end, billing_plan_id, billing_cycle, annual_price, staff_limit, extra_staff_annual_price, note, status, tenant_id, created_at
    FROM tenant_applications
    ORDER BY CASE status WHEN 'pending' THEN 1 WHEN 'approved' THEN 2 ELSE 3 END, created_at DESC
  `).all();
  const orders = await env.DB.prepare(`
    SELECT id, tenant_id, application_id, source, store_name, owner_name, owner_phone, billing_plan_id, billing_cycle, amount, staff_limit, extra_staff_annual_price, status, due_date, paid_at, note, created_at
    FROM billing_orders
    ORDER BY CASE status WHEN 'pending' THEN 1 WHEN 'paid' THEN 2 ELSE 3 END, created_at DESC
    LIMIT 100
  `).all();
  const lineSettings = await env.DB.prepare(`
    SELECT tenant_id, channel_id, channel_secret, channel_access_token, basic_id, liff_id, login_liff_id, rich_menu_id, webhook_path, webhook_enabled, login_enabled, registration_enabled, notes, updated_at
    FROM line_oa_settings
  `).all();
  const platformLineOA = await env.DB.prepare(`
    SELECT id, channel_id, channel_secret, channel_access_token, basic_id, login_liff_id, registration_liff_id, rich_menu_id, friend_add_url, webhook_path, webhook_enabled, owner_login_enabled, owner_registration_enabled, notes, updated_at
    FROM platform_line_oa_settings
    WHERE id = 'platform'
  `).first();
  const platformContacts = await env.DB.prepare(`
    SELECT c.line_user_id, c.display_name, c.picture_url, c.phone, c.email, c.role, c.lead_status, c.source, c.tenant_id, c.referrer_line_user_id, r.display_name AS referrer_display_name, c.tags_json, c.note, c.followed_at, c.unfollowed_at, c.last_event_type, c.last_message, c.last_interaction_at, c.created_at, c.updated_at
    FROM platform_line_contacts c
    LEFT JOIN platform_line_contacts r ON r.line_user_id = c.referrer_line_user_id
    ORDER BY COALESCE(c.last_interaction_at, c.created_at) DESC
    LIMIT 300
  `).all();
  return { tenants: tenants.results || [], admins: admins.results || [], applications: applications.results || [], orders: orders.results || [], lineSettings: lineSettings.results || [], platformLineOA: platformLineOA || {}, platformContacts: platformContacts.results || [] };
}
async function createBillingOrder(env, { tenantId = null, applicationId = null, source = "application", storeName, ownerName = "", ownerPhone = "", plan, status = "pending", dueDate = null, note = "" }) {
  const id = "ord-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
  await env.DB.prepare(`
    INSERT INTO billing_orders (id, tenant_id, application_id, source, store_name, owner_name, owner_phone, billing_plan_id, billing_cycle, amount, staff_limit, extra_staff_annual_price, status, due_date, note, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'annual', ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(id, tenantId, applicationId, source, storeName, ownerName || null, ownerPhone || null, plan.id, plan.annualPrice, plan.staffLimit, plan.extraStaffAnnualPrice, status, dueDate, note || null).run();
  return { id, amount: plan.annualPrice, status };
}

async function markBillingOrderPaid(request, env) {
  if (!env.DB) return Response.json({ ok: false, error: "Database is not configured" }, { status: 503, headers: jsonHeaders });
  try {
    await ensurePlatformSchema(env);
    const payload = await request.json();
    const orderId = String(payload.orderId || "").trim();
    if (!orderId) return Response.json({ ok: false, error: "orderId is required" }, { status: 400, headers: jsonHeaders });
    const order = await env.DB.prepare("SELECT id FROM billing_orders WHERE id = ?").bind(orderId).first();
    if (!order) return Response.json({ ok: false, error: "order not found" }, { status: 404, headers: jsonHeaders });
    await env.DB.prepare("UPDATE billing_orders SET status = 'paid', paid_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").bind(orderId).run();
    return Response.json({ ok: true, orderId, status: "paid" }, { headers: jsonHeaders });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: jsonHeaders });
  }
}


async function reconcileTenantStaffLimit(env, tenantId, plan) {
  if (!env.DB || !tenantId || !plan) return { limit: 0, active: 0 };
  const limit = Math.max(1, Number(plan.staffLimit || 1));
  const rows = await env.DB.prepare("SELECT id, enabled FROM staff_members WHERE tenant_id = ? ORDER BY enabled DESC, sort_order, created_at, name").bind(tenantId).all();
  const staffRows = rows.results || [];

  for (let index = 0; index < staffRows.length; index += 1) {
    const enabled = index < limit ? 1 : 0;
    await env.DB.prepare("UPDATE staff_members SET enabled = ?, sort_order = ?, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?").bind(enabled, index, tenantId, staffRows[index].id).run();
  }

  const safeTenant = String(tenantId).replace(/[^a-zA-Z0-9_-]/g, "-");
  for (let index = staffRows.length; index < limit; index += 1) {
    const staffId = `${safeTenant}-staff-${index + 1}`;
    await env.DB.prepare("INSERT INTO staff_members (id, tenant_id, name, role, service_ids, crm_permissions, enabled, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, '[]', '[]', 1, ?, datetime('now'), datetime('now')) ON CONFLICT(id) DO UPDATE SET tenant_id = excluded.tenant_id, enabled = 1, sort_order = excluded.sort_order, updated_at = datetime('now')").bind(staffId, tenantId, `師傅 ${index + 1}`, "服務人員", index).run();
  }

  return { limit, active: limit };
}async function updateBillingPlan(request, env) {
  if (!env.DB) return Response.json({ ok: false, error: "Database is not configured" }, { status: 503, headers: jsonHeaders });
  try {
    await ensurePlatformSchema(env);
    const payload = await request.json();
    const orderId = String(payload.orderId || "").trim();
    const tenantId = String(payload.tenantId || "").trim();
    const plan = planById(payload.planId || "solo");
    if (!orderId && !tenantId) return Response.json({ ok: false, error: "orderId or tenantId is required" }, { status: 400, headers: jsonHeaders });

    if (orderId) {
      const order = await env.DB.prepare("SELECT id, tenant_id, application_id FROM billing_orders WHERE id = ?").bind(orderId).first();
      if (!order) return Response.json({ ok: false, error: "order not found" }, { status: 404, headers: jsonHeaders });
      await env.DB.prepare("UPDATE billing_orders SET billing_plan_id = ?, amount = ?, staff_limit = ?, extra_staff_annual_price = ?, updated_at = datetime('now') WHERE id = ?").bind(plan.id, plan.annualPrice, plan.staffLimit, plan.extraStaffAnnualPrice, orderId).run();
      if (order.application_id) {
        await env.DB.prepare("UPDATE tenant_applications SET billing_plan_id = ?, annual_price = ?, staff_limit = ?, extra_staff_annual_price = ?, updated_at = datetime('now') WHERE id = ?").bind(plan.id, plan.annualPrice, plan.staffLimit, plan.extraStaffAnnualPrice, order.application_id).run();
      }
      if (order.tenant_id) {
        await env.DB.prepare("UPDATE tenants SET billing_plan_id = ?, annual_price = ?, staff_limit = ?, extra_staff_annual_price = ?, updated_at = datetime('now') WHERE id = ?").bind(plan.id, plan.annualPrice, plan.staffLimit, plan.extraStaffAnnualPrice, order.tenant_id).run();
        await reconcileTenantStaffLimit(env, order.tenant_id, plan);
      }
      return Response.json({ ok: true, target: "order", orderId, plan }, { headers: jsonHeaders });
    }

    const tenant = await env.DB.prepare("SELECT id FROM tenants WHERE id = ?").bind(tenantId).first();
    if (!tenant) return Response.json({ ok: false, error: "tenant not found" }, { status: 404, headers: jsonHeaders });
    await env.DB.prepare("UPDATE tenants SET billing_plan_id = ?, annual_price = ?, staff_limit = ?, extra_staff_annual_price = ?, updated_at = datetime('now') WHERE id = ?").bind(plan.id, plan.annualPrice, plan.staffLimit, plan.extraStaffAnnualPrice, tenantId).run();
    await reconcileTenantStaffLimit(env, tenantId, plan);
    return Response.json({ ok: true, target: "tenant", tenantId, plan }, { headers: jsonHeaders });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: jsonHeaders });
  }
}async function submitTenantApplication(request, env) {
  if (!env.DB) return Response.json({ ok: false, error: "Database is not configured" }, { status: 503, headers: jsonHeaders });
  try {
    await ensurePlatformSchema(env);
    const payload = await request.json();
    const storeName = String(payload.storeName || "").trim();
    const ownerName = String(payload.ownerName || "").trim();
    const ownerPhone = String(payload.ownerPhone || "").trim();
    const lineUserId = String(payload.lineUserId || payload.line_user_id || "").trim();
    if (!storeName || !ownerName || !ownerPhone) return Response.json({ ok: false, error: "storeName, ownerName and ownerPhone are required" }, { status: 400, headers: jsonHeaders });
    const plan = planFromPayload(payload);
    const id = "app-" + Date.now().toString(36);
    await env.DB.prepare(`
      INSERT INTO tenant_applications (id, store_name, store_phone, store_address, business_type, owner_name, owner_phone, owner_email, contract_start, contract_end, billing_plan_id, billing_cycle, annual_price, staff_limit, extra_staff_annual_price, owner_line_user_id, note, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'annual', ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
    `).bind(id, storeName, String(payload.storePhone || "").trim() || null, String(payload.storeAddress || "").trim() || null, String(payload.businessType || "").trim() || null, ownerName, ownerPhone, String(payload.ownerEmail || "").trim() || null, String(payload.contractStart || "").trim() || null, String(payload.contractEnd || "").trim() || null, plan.id, plan.annualPrice, plan.staffLimit, plan.extraStaffAnnualPrice, lineUserId || null, String(payload.note || "").trim() || null).run();
    const order = await createBillingOrder(env, { applicationId: id, source: "application", storeName, ownerName, ownerPhone, plan, status: "pending", dueDate: addDays(todayInTaipei(), 7), note: "正式申請年費訂單" });
    await syncPlatformLineLead(env, { lineUserId, displayName: ownerName, phone: ownerPhone, email: String(payload.ownerEmail || "").trim(), leadStatus: "applied", source: "application", note: "正式申請：" + storeName, lastEventType: "application_submit" });
    return Response.json({ ok: true, application: { id, status: "pending" }, order }, { headers: jsonHeaders });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: jsonHeaders });
  }
}

async function submitTrialTenant(request, env) {
  if (!env.DB) return Response.json({ ok: false, error: "Database is not configured" }, { status: 503, headers: jsonHeaders });
  try {
    await ensurePlatformSchema(env);
    const payload = await request.json();
    const storeName = String(payload.storeName || "").trim();
    const ownerName = String(payload.ownerName || "").trim();
    const ownerPhone = String(payload.ownerPhone || "").trim();
    const lineUserId = String(payload.lineUserId || payload.line_user_id || "").trim();
    if (!storeName || !ownerName || !ownerPhone) return Response.json({ ok: false, error: "storeName, ownerName and ownerPhone are required" }, { status: 400, headers: jsonHeaders });
    const plan = planFromPayload(payload);
    const tenantId = "trial-" + Date.now().toString(36);
    const today = todayInTaipei();
    const trialEnd = addDays(today, 60);
    await env.DB.prepare("INSERT INTO tenants (id, name, phone, address, timezone, status, contract_start, contract_end, billing_plan_id, billing_cycle, annual_price, staff_limit, extra_staff_annual_price, created_at, updated_at) VALUES (?, ?, ?, ?, 'Asia/Taipei', 'trial', ?, ?, ?, 'annual', ?, ?, ?, datetime('now'), datetime('now'))").bind(tenantId, storeName, String(payload.storePhone || "").trim() || null, String(payload.storeAddress || "").trim() || null, today, trialEnd, plan.id, plan.annualPrice, plan.staffLimit, plan.extraStaffAnnualPrice).run();
    await reconcileTenantStaffLimit(env, tenantId, plan);
    await env.DB.prepare("INSERT OR IGNORE INTO business_settings (tenant_id, open_time, close_time, break_start, break_end, closed_days_json, allow_overtime_booking, slot_step_minutes) VALUES (?, '09:00', '18:00', '12:00', '13:00', '[\"星期三\"]', 0, 30)").bind(tenantId).run();
    await env.DB.prepare(`
      INSERT INTO tenant_admins (id, tenant_id, name, phone, email, role, permissions_json, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'owner', '{}', 'active', datetime('now'), datetime('now'))
    `).bind(crypto.randomUUID(), tenantId, ownerName, ownerPhone, String(payload.ownerEmail || "").trim() || null).run();
    await syncPlatformLineLead(env, { lineUserId, displayName: ownerName, phone: ownerPhone, email: String(payload.ownerEmail || "").trim(), leadStatus: "trial", source: "trial", tenantId, note: "免費試用：" + storeName, lastEventType: "trial_submit" });
    return Response.json({ ok: true, tenantId, trialStart: today, trialEnd, status: "trial", plan: { id: plan.id, name: plan.name, annualPrice: plan.annualPrice, staffLimit: plan.staffLimit } }, { headers: jsonHeaders });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: jsonHeaders });
  }
}

async function convertTrialTenant(request, env) {
  if (!env.DB) return Response.json({ ok: false, error: "Database is not configured" }, { status: 503, headers: jsonHeaders });
  try {
    await ensurePlatformSchema(env);
    const payload = await request.json();
    const tenantId = String(payload.tenantId || "").trim();
    if (!tenantId) return Response.json({ ok: false, error: "tenantId is required" }, { status: 400, headers: jsonHeaders });
    const tenant = await env.DB.prepare("SELECT id, status, billing_plan_id FROM tenants WHERE id = ?").bind(tenantId).first();
    if (!tenant) return Response.json({ ok: false, error: "tenant not found" }, { status: 404, headers: jsonHeaders });
    const plan = planById(payload.planId || tenant.billing_plan_id || "solo");
    const today = todayInTaipei();
    const contractEnd = addDays(today, 365);
    await env.DB.prepare("UPDATE tenants SET status = 'active', contract_start = ?, contract_end = ?, billing_plan_id = ?, billing_cycle = 'annual', annual_price = ?, staff_limit = ?, extra_staff_annual_price = ?, updated_at = datetime('now') WHERE id = ?").bind(today, contractEnd, plan.id, plan.annualPrice, plan.staffLimit, plan.extraStaffAnnualPrice, tenantId).run();
    await reconcileTenantStaffLimit(env, tenantId, plan);
    const order = await createBillingOrder(env, { tenantId, source: "trial_convert", storeName: tenantId, plan, status: "paid", dueDate: today, note: "試用轉正式年費訂單" });
    await env.DB.prepare("UPDATE billing_orders SET paid_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").bind(order.id).run();
    return Response.json({ ok: true, tenantId, contractStart: today, contractEnd, order, plan: { id: plan.id, name: plan.name, annualPrice: plan.annualPrice, staffLimit: plan.staffLimit } }, { headers: jsonHeaders });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: jsonHeaders });
  }
}async function approveTenantApplication(request, env) {
  if (!env.DB) return Response.json({ ok: false, error: "Database is not configured" }, { status: 503, headers: jsonHeaders });
  try {
    await ensurePlatformSchema(env);
    const payload = await request.json();
    const applicationId = String(payload.applicationId || "").trim();
    if (!applicationId) return Response.json({ ok: false, error: "applicationId is required" }, { status: 400, headers: jsonHeaders });
    const app = await env.DB.prepare("SELECT * FROM tenant_applications WHERE id = ?").bind(applicationId).first();
    if (!app) return Response.json({ ok: false, error: "application not found" }, { status: 404, headers: jsonHeaders });
    if (app.status === "approved" && app.tenant_id) return Response.json({ ok: true, tenantId: app.tenant_id, alreadyApproved: true }, { headers: jsonHeaders });
    const tenantId = "tenant-" + Date.now().toString(36);
    const today = todayInTaipei();
    const contractStart = app.contract_start || today;
    const contractEnd = app.contract_end || addDays(today, 365);
    const plan = planById(app.billing_plan_id || "solo");
    await env.DB.prepare("INSERT INTO tenants (id, name, phone, address, timezone, status, contract_start, contract_end, billing_plan_id, billing_cycle, annual_price, staff_limit, extra_staff_annual_price, created_at, updated_at) VALUES (?, ?, ?, ?, 'Asia/Taipei', 'active', ?, ?, ?, 'annual', ?, ?, ?, datetime('now'), datetime('now'))").bind(tenantId, app.store_name, app.store_phone || null, app.store_address || null, contractStart, contractEnd, plan.id, plan.annualPrice, plan.staffLimit, plan.extraStaffAnnualPrice).run();
    await reconcileTenantStaffLimit(env, tenantId, plan);
    await env.DB.prepare("INSERT OR IGNORE INTO business_settings (tenant_id, open_time, close_time, break_start, break_end, closed_days_json, allow_overtime_booking, slot_step_minutes) VALUES (?, '09:00', '18:00', '12:00', '13:00', '[\"星期三\"]', 0, 30)").bind(tenantId).run();
    await env.DB.prepare(`
      INSERT INTO tenant_admins (id, tenant_id, name, phone, email, role, permissions_json, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'owner', '{}', 'active', datetime('now'), datetime('now'))
    `).bind(crypto.randomUUID(), tenantId, app.owner_name, app.owner_phone, app.owner_email || null).run();
    await env.DB.prepare("UPDATE tenant_applications SET status = 'approved', tenant_id = ?, reviewed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").bind(tenantId, applicationId).run();
    await syncPlatformLineLead(env, { lineUserId: app.owner_line_user_id, displayName: app.owner_name, phone: app.owner_phone, email: app.owner_email || "", leadStatus: "registered", source: "application", tenantId, note: "已核准：" + app.store_name, lastEventType: "application_approved" });
    return Response.json({ ok: true, tenantId, plan: { id: plan.id, name: plan.name, annualPrice: plan.annualPrice, staffLimit: plan.staffLimit } }, { headers: jsonHeaders });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: jsonHeaders });
  }
}async function savePlatformTenant(request, env) {
  if (!env.DB) return Response.json({ ok: false, error: "Database is not configured" }, { status: 503, headers: jsonHeaders });
  try {
    await ensurePlatformSchema(env);
    const payload = await request.json();
    const name = String(payload.name || "").trim();
    const phone = String(payload.phone || "").trim();
    const address = String(payload.address || "").trim();
    const status = ["active", "trial", "paused"].includes(payload.status) ? payload.status : "active";
    const contractStart = String(payload.contractStart || "").trim() || null;
    const contractEnd = String(payload.contractEnd || "").trim() || null;
    const plan = planFromPayload(payload);
    if (!name) return Response.json({ ok: false, error: "tenant name is required" }, { status: 400, headers: jsonHeaders });
    const id = "tenant-" + Date.now().toString(36);
    await env.DB.prepare("INSERT INTO tenants (id, name, phone, address, timezone, status, contract_start, contract_end, billing_plan_id, billing_cycle, annual_price, staff_limit, extra_staff_annual_price, created_at, updated_at) VALUES (?, ?, ?, ?, 'Asia/Taipei', ?, ?, ?, ?, 'annual', ?, ?, ?, datetime('now'), datetime('now'))").bind(id, name, phone || null, address || null, status, contractStart, contractEnd, plan.id, plan.annualPrice, plan.staffLimit, plan.extraStaffAnnualPrice).run();
    await reconcileTenantStaffLimit(env, id, plan);
    await env.DB.prepare("INSERT OR IGNORE INTO business_settings (tenant_id, open_time, close_time, break_start, break_end, closed_days_json, allow_overtime_booking, slot_step_minutes) VALUES (?, '09:00', '18:00', '12:00', '13:00', '[\"星期三\"]', 0, 30)").bind(id).run();
    return Response.json({ ok: true, tenant: { id, name, status, plan: { id: plan.id, name: plan.name, annualPrice: plan.annualPrice, staffLimit: plan.staffLimit } } }, { headers: jsonHeaders });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: jsonHeaders });
  }
}async function savePlatformAdmin(request, env) {
  if (!env.DB) return Response.json({ ok: false, error: "Database is not configured" }, { status: 503, headers: jsonHeaders });
  try {
    await ensurePlatformSchema(env);
    const payload = await request.json();
    const tenantId = String(payload.tenantId || "").trim();
    const name = String(payload.name || "").trim();
    const phone = String(payload.phone || "").trim();
    const email = String(payload.email || "").trim();
    const role = ["owner", "admin", "staff", "viewer"].includes(payload.role) ? payload.role : "admin";
    if (!tenantId || !name) return Response.json({ ok: false, error: "tenantId and name are required" }, { status: 400, headers: jsonHeaders });
    const tenant = await env.DB.prepare("SELECT id FROM tenants WHERE id = ?").bind(tenantId).first();
    if (!tenant) return Response.json({ ok: false, error: "tenant not found" }, { status: 404, headers: jsonHeaders });
    const id = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO tenant_admins (id, tenant_id, name, phone, email, role, permissions_json, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, '{}', 'active', datetime('now'), datetime('now'))
    `).bind(id, tenantId, name, phone || null, email || null, role).run();
    return Response.json({ ok: true, admin: { id, tenantId, name, phone, email, role } }, { headers: jsonHeaders });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: jsonHeaders });
  }
}
async function savePlatformLineOASettings(request, env) {
  if (!env.DB) return Response.json({ ok: false, error: "Database is not configured" }, { status: 503, headers: jsonHeaders });
  try {
    await ensurePlatformSchema(env);
    const payload = await request.json();
    const webhookPath = "/platform-line-webhook";
    await env.DB.prepare(`
      INSERT INTO platform_line_oa_settings (id, channel_id, channel_secret, channel_access_token, basic_id, login_liff_id, registration_liff_id, rich_menu_id, friend_add_url, webhook_path, webhook_enabled, owner_login_enabled, owner_registration_enabled, notes, created_at, updated_at)
      VALUES ('platform', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        channel_id = excluded.channel_id,
        channel_secret = excluded.channel_secret,
        channel_access_token = excluded.channel_access_token,
        basic_id = excluded.basic_id,
        login_liff_id = excluded.login_liff_id,
        registration_liff_id = excluded.registration_liff_id,
        rich_menu_id = excluded.rich_menu_id,
        friend_add_url = excluded.friend_add_url,
        webhook_path = excluded.webhook_path,
        webhook_enabled = excluded.webhook_enabled,
        owner_login_enabled = excluded.owner_login_enabled,
        owner_registration_enabled = excluded.owner_registration_enabled,
        notes = excluded.notes,
        updated_at = datetime('now')
    `).bind(
      String(payload.channelId || "").trim() || null,
      String(payload.channelSecret || "").trim() || null,
      String(payload.channelAccessToken || "").trim() || null,
      String(payload.basicId || "").trim() || null,
      String(payload.loginLiffId || "").trim() || null,
      String(payload.registrationLiffId || "").trim() || null,
      String(payload.richMenuId || "").trim() || null,
      String(payload.friendAddUrl || "").trim() || null,
      webhookPath,
      payload.webhookEnabled ? 1 : 0,
      payload.ownerLoginEnabled ? 1 : 0,
      payload.ownerRegistrationEnabled ? 1 : 0,
      String(payload.notes || "").trim() || null
    ).run();
    return Response.json({ ok: true, webhookUrl: platformLineWebhookUrl(env, request) }, { headers: jsonHeaders });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: jsonHeaders });
  }
}
async function savePlatformLineOA(request, env) {
  if (!env.DB) return Response.json({ ok: false, error: "Database is not configured" }, { status: 503, headers: jsonHeaders });
  try {
    await ensurePlatformSchema(env);
    const payload = await request.json();
    const tenantId = String(payload.tenantId || "").trim();
    if (!tenantId) return Response.json({ ok: false, error: "tenantId is required" }, { status: 400, headers: jsonHeaders });
    const tenant = await env.DB.prepare("SELECT id FROM tenants WHERE id = ?").bind(tenantId).first();
    if (!tenant) return Response.json({ ok: false, error: "tenant not found" }, { status: 404, headers: jsonHeaders });
    const webhookPath = `/line-webhook?tenant=${encodeURIComponent(tenantId)}`;
    await env.DB.prepare(`
      INSERT INTO line_oa_settings (tenant_id, channel_id, channel_secret, channel_access_token, basic_id, liff_id, login_liff_id, rich_menu_id, webhook_path, webhook_enabled, login_enabled, registration_enabled, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(tenant_id) DO UPDATE SET
        channel_id = excluded.channel_id,
        channel_secret = excluded.channel_secret,
        channel_access_token = excluded.channel_access_token,
        basic_id = excluded.basic_id,
        liff_id = excluded.liff_id,
        login_liff_id = excluded.login_liff_id,
        rich_menu_id = excluded.rich_menu_id,
        webhook_path = excluded.webhook_path,
        webhook_enabled = excluded.webhook_enabled,
        login_enabled = excluded.login_enabled,
        registration_enabled = excluded.registration_enabled,
        notes = excluded.notes,
        updated_at = datetime('now')
    `).bind(
      tenantId,
      String(payload.channelId || "").trim() || null,
      String(payload.channelSecret || "").trim() || null,
      String(payload.channelAccessToken || "").trim() || null,
      String(payload.basicId || "").trim() || null,
      String(payload.liffId || "").trim() || null,
      String(payload.loginLiffId || "").trim() || null,
      String(payload.richMenuId || "").trim() || null,
      webhookPath,
      payload.webhookEnabled ? 1 : 0,
      payload.loginEnabled ? 1 : 0,
      payload.registrationEnabled ? 1 : 0,
      String(payload.notes || "").trim() || null
    ).run();
    return Response.json({ ok: true, tenantId, webhookUrl: lineWebhookUrl(tenantId, env, request) }, { headers: jsonHeaders });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: jsonHeaders });
  }
}

async function fetchPlatformLineProfile(env, userId) {
  if (!env.DB || !userId) return {};
  try {
    const settings = await platformLineSettings(env);
    const token = String(settings?.channel_access_token || "").trim();
    if (!token) return {};
    const res = await fetch("https://api.line.me/v2/bot/profile/" + encodeURIComponent(userId), { headers: { authorization: "Bearer " + token } });
    if (!res.ok) return {};
    const profile = await res.json();
    return { displayName: profile.displayName || "", pictureUrl: profile.pictureUrl || "" };
  } catch (error) {
    return {};
  }
}

function referralLinkFor(lineUserId, env = {}, requestOrUrl = null) {
  return `${publicBaseUrl(env, requestOrUrl)}/refer?ref=${encodeURIComponent(lineUserId)}`;
}
function referralLiffUrlFor(lineUserId, setting = {}, env = {}, requestOrUrl = null) {
  const liffId = String(setting.registration_liff_id || setting.login_liff_id || "").trim();
  return liffId ? `https://liff.line.me/${encodeURIComponent(liffId)}?ref=${encodeURIComponent(lineUserId)}` : referralLinkFor(lineUserId, env, requestOrUrl);
}
function referralRefFromUrl(url) {
  const direct = String(url.searchParams.get("ref") || "").trim();
  if (direct) return direct;
  const state = String(url.searchParams.get("liff.state") || url.searchParams.get("state") || "").trim();
  if (!state) return "";
  const candidates = [state];
  try { candidates.push(decodeURIComponent(state)); } catch (error) {}
  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate, publicBaseUrl({}, "https://bookingos.local"));
      const ref = String(parsed.searchParams.get("ref") || "").trim();
      if (ref) return ref;
    } catch (error) {}
    const match = candidate.match(/(?:^|[?&])ref=([^&]+)/);
    if (match) {
      try { return decodeURIComponent(match[1]).trim(); } catch (error) { return match[1].trim(); }
    }
  }
  return "";
}
function referralQrUrl(referralUrl) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=12&data=${encodeURIComponent(referralUrl)}`;
}
function lineShareUrl(text) {
  return `https://line.me/R/share?text=${encodeURIComponent(text)}`;
}
function isShareReferralKeyword(text) {
  return ["會員分享", "分享朋友", "分享好友", "推薦朋友", "推薦好友"].includes(String(text || "").trim());
}
async function platformLineSettings(env) {
  if (!env.DB) return mergePlatformLineEnv(env, {});
  const setting = await env.DB.prepare("SELECT basic_id, friend_add_url, channel_id, channel_secret, channel_access_token, login_liff_id, registration_liff_id FROM platform_line_oa_settings WHERE id = 'platform' LIMIT 1").first() || {};
  return mergePlatformLineEnv(env, setting);
}

async function tenantLineSettings(env, tenantId) {
  if (!env.DB || !tenantId) return mergeTenantLineEnv(env, { tenant_id: tenantId || "" });
  const setting = await env.DB.prepare("SELECT tenant_id, channel_id, channel_secret, channel_access_token, basic_id, liff_id, login_liff_id FROM line_oa_settings WHERE tenant_id = ? LIMIT 1").bind(tenantId).first() || { tenant_id: tenantId };
  return mergeTenantLineEnv(env, setting);
}
function platformFriendAddUrl(setting = {}) {
  return setting.friend_add_url || (setting.basic_id ? `https://line.me/R/ti/p/${encodeURIComponent(setting.basic_id)}` : "");
}
async function replyPlatformLineMessages(env, replyToken, messages = [], setting = null) {
  const token = String((setting || await platformLineSettings(env)).channel_access_token || "").trim();
  if (!token || !replyToken || !messages.length) return false;
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + token },
    body: JSON.stringify({ replyToken, messages })
  });
  return res.ok;
}
async function replyPlatformLineText(env, replyToken, text) {
  return replyPlatformLineMessages(env, replyToken, [{ type: "text", text: String(text || "").slice(0, 4800) }]);
}
async function replyReferralShare(env, event) {
  const userId = String(event?.source?.userId || "").trim();
  if (!userId) return false;
  const setting = await platformLineSettings(env);
  const referralUrl = referralLiffUrlFor(userId, setting, env);
  const qrUrl = referralQrUrl(referralUrl);
  const shareUrl = lineShareUrl(`掃碼加入 BookingOS 會員` + "\n" + referralUrl);
  const flex = {
    type: "flex",
    altText: "掃碼加入會員",
    contents: {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: "掃碼加入會員", weight: "bold", size: "lg", align: "center", color: "#17211d" },
          { type: "image", url: qrUrl, size: "full", aspectRatio: "1:1", aspectMode: "fit" }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "button", style: "primary", color: "#2b78c2", height: "sm", action: { type: "uri", label: "分享給好友", uri: shareUrl } }
        ]
      }
    }
  };
  return replyPlatformLineMessages(env, event.replyToken, [flex], setting);
}
async function recordReferralClick(env, request, referrerLineUserId, referredLineUserId = "") {
  if (!env.DB || !referrerLineUserId) return "";
  await ensurePlatformSchema(env);
  const id = "ref-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  const url = request ? new URL(request.url).toString() : referralLinkFor(referrerLineUserId, env);
  const userAgent = request ? String(request.headers.get("user-agent") || "").slice(0, 500) : "";
  await env.DB.prepare(`
    INSERT INTO platform_referrals (id, referrer_line_user_id, referred_line_user_id, status, source, landing_url, user_agent, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'qr', ?, ?, datetime('now'), datetime('now'))
  `).bind(id, referrerLineUserId, referredLineUserId || null, referredLineUserId ? "claimed" : "clicked", url, userAgent || null).run();
  return id;
}
async function claimRecentReferralForLineUser(env, lineUserId) {
  if (!env.DB || !lineUserId) return "";
  const pending = await env.DB.prepare(`
    SELECT id, referrer_line_user_id
    FROM platform_referrals
    WHERE referred_line_user_id IS NULL
      AND status = 'clicked'
      AND referrer_line_user_id <> ?
      AND created_at >= datetime('now', '-30 minutes')
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(lineUserId).first();
  if (!pending?.id || !pending.referrer_line_user_id) return "";
  await env.DB.prepare(`
    UPDATE platform_referrals
    SET referred_line_user_id = ?, status = 'claimed', updated_at = datetime('now')
    WHERE id = ?
  `).bind(lineUserId, pending.id).run();
  return String(pending.referrer_line_user_id || "").trim();
}
async function syncPlatformLineLead(env, lead = {}) {
  if (!env.DB) return false;
  const lineUserId = String(lead.lineUserId || lead.line_user_id || "").trim();
  if (!lineUserId) return false;
  await ensurePlatformSchema(env);
  const tagsJson = Array.isArray(lead.tags) ? JSON.stringify(lead.tags) : null;
  const sql = "INSERT INTO platform_line_contacts (line_user_id, display_name, picture_url, phone, email, lead_status, source, tenant_id, referrer_line_user_id, tags_json, note, last_event_type, last_interaction_at, created_at, updated_at) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, '[]'), ?, ?, datetime('now'), datetime('now'), datetime('now')) " +
    "ON CONFLICT(line_user_id) DO UPDATE SET " +
    "display_name = COALESCE(NULLIF(excluded.display_name, ''), platform_line_contacts.display_name), " +
    "picture_url = COALESCE(NULLIF(excluded.picture_url, ''), platform_line_contacts.picture_url), " +
    "phone = COALESCE(NULLIF(excluded.phone, ''), platform_line_contacts.phone), " +
    "email = COALESCE(NULLIF(excluded.email, ''), platform_line_contacts.email), " +
    "lead_status = COALESCE(NULLIF(excluded.lead_status, ''), platform_line_contacts.lead_status), " +
    "source = COALESCE(NULLIF(excluded.source, ''), platform_line_contacts.source), " +
    "tenant_id = COALESCE(NULLIF(excluded.tenant_id, ''), platform_line_contacts.tenant_id), " +
    "referrer_line_user_id = COALESCE(NULLIF(excluded.referrer_line_user_id, ''), platform_line_contacts.referrer_line_user_id), " +
    "tags_json = CASE WHEN excluded.tags_json IS NOT NULL AND excluded.tags_json <> '[]' THEN excluded.tags_json ELSE platform_line_contacts.tags_json END, " +
    "note = COALESCE(NULLIF(excluded.note, ''), platform_line_contacts.note), " +
    "last_event_type = excluded.last_event_type, last_interaction_at = datetime('now'), updated_at = datetime('now')";  await env.DB.prepare(sql).bind(lineUserId, lead.displayName || null, lead.pictureUrl || null, lead.phone || null, lead.email || null, lead.leadStatus || "new_friend", lead.source || "line_oa", lead.tenantId || null, lead.referrerLineUserId || lead.referrer_line_user_id || null, tagsJson, lead.note || null, lead.lastEventType || "lead_update").run();
  return true;
}
async function upsertPlatformLineContact(env, event) {
  if (!env.DB || !event || !event.source || !event.source.userId) return false;
  await ensurePlatformSchema(env);
  const userId = String(event.source.userId || "").trim();
  if (!userId) return false;
  const eventType = String(event.type || "event");
  const messageText = event.message && event.message.type === "text" ? String(event.message.text || "").slice(0, 500) : "";
  const profile = eventType === "unfollow" ? {} : await fetchPlatformLineProfile(env, userId);
  const leadStatus = eventType === "unfollow" ? "blocked" : "new_friend";
  const followedAt = eventType === "follow" ? new Date().toISOString() : null;
  const unfollowedAt = eventType === "unfollow" ? new Date().toISOString() : null;
  const claimedReferrerLineUserId = eventType === "unfollow" ? "" : await claimRecentReferralForLineUser(env, userId).catch(() => "");
  await env.DB.prepare(`
    INSERT INTO platform_line_contacts (line_user_id, display_name, picture_url, lead_status, source, referrer_line_user_id, followed_at, unfollowed_at, last_event_type, last_message, last_interaction_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'line_oa', ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
    ON CONFLICT(line_user_id) DO UPDATE SET
      display_name = COALESCE(NULLIF(excluded.display_name, ''), platform_line_contacts.display_name),
      picture_url = COALESCE(NULLIF(excluded.picture_url, ''), platform_line_contacts.picture_url),
      lead_status = CASE WHEN excluded.lead_status = 'blocked' THEN 'blocked' WHEN platform_line_contacts.lead_status = 'blocked' AND excluded.lead_status <> 'blocked' THEN 'new_friend' ELSE platform_line_contacts.lead_status END,
      referrer_line_user_id = COALESCE(platform_line_contacts.referrer_line_user_id, excluded.referrer_line_user_id),
      followed_at = COALESCE(platform_line_contacts.followed_at, excluded.followed_at),
      unfollowed_at = CASE WHEN excluded.unfollowed_at IS NOT NULL THEN excluded.unfollowed_at ELSE platform_line_contacts.unfollowed_at END,
      last_event_type = excluded.last_event_type,
      last_message = CASE WHEN excluded.last_message IS NOT NULL AND excluded.last_message <> '' THEN excluded.last_message ELSE platform_line_contacts.last_message END,
      last_interaction_at = datetime('now'),
      updated_at = datetime('now')
  `).bind(userId, profile.displayName || null, profile.pictureUrl || null, leadStatus, claimedReferrerLineUserId || null, followedAt, unfollowedAt, eventType, messageText || null).run();
  return true;
}
async function recordPlatformWebhookLog(env, { method = "POST", signature = "", bodyText = "" } = {}) {
  if (!env.DB) return "";
  await ensurePlatformSchema(env);
  let eventCount = 0;
  let firstEventType = "";
  let firstUserId = "";
  let firstMessage = "";
  try {
    const payload = JSON.parse(bodyText || "{}");
    const events = Array.isArray(payload.events) ? payload.events : [];
    eventCount = events.length;
    const first = events[0] || {};
    firstEventType = String(first.type || "");
    firstUserId = String(first.source?.userId || "");
    firstMessage = first.message && first.message.type === "text" ? String(first.message.text || "").slice(0, 200) : "";
  } catch (error) {
    firstEventType = "parse_error";
    firstMessage = String(error && error.message ? error.message : error).slice(0, 200);
  }
  const id = "wh-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  await env.DB.prepare(`
    INSERT INTO platform_line_webhook_logs (id, method, signature_present, event_count, first_event_type, first_user_id, first_message, body_preview, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(id, method, signature ? 1 : 0, eventCount, firstEventType || null, firstUserId || null, firstMessage || null, String(bodyText || "").slice(0, 1000)).run();
  return id;
}

async function finishPlatformWebhookLog(env, id, { savedContacts = 0, error = "" } = {}) {
  if (!env.DB || !id) return;
  await env.DB.prepare("UPDATE platform_line_webhook_logs SET saved_contacts = ?, error = ?, updated_at = datetime('now') WHERE id = ?").bind(Number(savedContacts || 0), error || null, id).run();
}
async function processPlatformLineWebhook(env, { method = "POST", signature = "", bodyText = "" } = {}) {
  let webhookLogId = "";
  let savedContacts = 0;
  let webhookError = "";
  try {
    const payload = JSON.parse(bodyText || "{}");
    const events = Array.isArray(payload.events) ? payload.events : [];

    for (const event of events) {
      const text = event.message && event.message.type === "text" ? String(event.message.text || "").trim() : "";
      if (isShareReferralKeyword(text)) await replyReferralShare(env, event).catch(() => false);
    }

    webhookLogId = await recordPlatformWebhookLog(env, { method, signature, bodyText });
    for (const event of events) {
      if (await upsertPlatformLineContact(env, event)) savedContacts += 1;
    }
  } catch (error) {
    webhookError = String(error && error.message ? error.message : error);
  }
  try {
    await finishPlatformWebhookLog(env, webhookLogId, { savedContacts, error: webhookError });
  } catch (error) {}
}
async function handlePlatformLineWebhook(request, env, ctx) {
  try {
    const webhookUrl = platformLineWebhookUrl(env, request);
    if (request.method === "GET") {
      return new Response(JSON.stringify({ ok: true, service: "BookingOS platform LINE OA webhook", scope: "platform", webhookUrl, purpose: "owner-registration-login", accepts: ["POST"] }), { headers: jsonHeaders });
    }
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "method not allowed" }), { status: 405, headers: jsonHeaders });
    }
    const signature = request.headers.get("x-line-signature") || "";
    const bodyText = await request.text();
    const lineSetting = await platformLineSettings(env);
    if (!String(lineSetting.channel_secret || "").trim()) {
      return new Response(JSON.stringify({ ok: false, error: "platform LINE channel secret is not configured" }), { status: 503, headers: jsonHeaders });
    }
    if (!(await verifyLineWebhookSignature(bodyText, signature, lineSetting.channel_secret))) {
      return new Response(JSON.stringify({ ok: false, error: "invalid LINE signature" }), { status: 401, headers: jsonHeaders });
    }
    let eventCount = 0;
    try {
      const payload = JSON.parse(bodyText || "{}");
      eventCount = Array.isArray(payload.events) ? payload.events.length : 0;
    } catch (error) {}
    const job = processPlatformLineWebhook(env, { method: request.method, signature, bodyText });
    if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(job);
    else await job;
    return new Response(JSON.stringify({ ok: true, scope: "platform", received: true, queued: true, signaturePresent: Boolean(signature), eventCount }), { headers: jsonHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error && error.message ? error.message : error) }), { status: 500, headers: jsonHeaders });
  }
}

async function handleLineWebhook(request, env) {
  try {
    const url = new URL(request.url);
    const tenantFromPath = url.pathname.startsWith("/line-webhook/") ? decodeURIComponent(url.pathname.replace("/line-webhook/", "").split("/")[0] || "") : "";
    const tenantId = String(url.searchParams.get("tenant") || tenantFromPath || TENANT_ID).trim() || TENANT_ID;
    const webhookUrl = lineWebhookUrl(tenantId, env, request);
    if (request.method === "GET") {
      return new Response(JSON.stringify({ ok: true, service: "BookingOS LINE OA webhook", tenantId, webhookUrl, accepts: ["POST"] }), { headers: jsonHeaders });
    }
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "method not allowed" }), { status: 405, headers: jsonHeaders });
    }
    const signature = request.headers.get("x-line-signature") || "";
    const bodyText = await request.text();
    const lineSetting = await tenantLineSettings(env, tenantId);
    if (!String(lineSetting.channel_secret || "").trim()) {
      return new Response(JSON.stringify({ ok: false, error: "tenant LINE channel secret is not configured" }), { status: 503, headers: jsonHeaders });
    }
    if (!(await verifyLineWebhookSignature(bodyText, signature, lineSetting.channel_secret))) {
      return new Response(JSON.stringify({ ok: false, error: "invalid LINE signature" }), { status: 401, headers: jsonHeaders });
    }
    let eventCount = 0;
    try {
      const payload = JSON.parse(bodyText || "{}");
      eventCount = Array.isArray(payload.events) ? payload.events.length : 0;
    } catch (error) {}
    return new Response(JSON.stringify({ ok: true, tenantId, received: true, signaturePresent: Boolean(signature), eventCount }), { headers: jsonHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error && error.message ? error.message : error) }), { status: 500, headers: jsonHeaders });
  }
}
async function renderReferralLanding(url, env) {
  const referrer = referralRefFromUrl(url);
  if (env.DB && referrer) await recordReferralClick(env, { url: url.toString(), headers: new Headers() }, referrer).catch(() => "");
  const setting = env.DB ? await platformLineSettings(env) : {};
  const addUrl = platformFriendAddUrl(setting);
  const liffId = String(setting.registration_liff_id || setting.login_liff_id || "").trim();
  const referralUrl = referralLiffUrlFor(referrer, setting, env, url);
  const qrUrl = referralQrUrl(referralUrl);
  const canonicalUrl = referralLinkFor(referrer, env, url);
  const liffScript = liffId ? `<script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script><script>
const ref=${JSON.stringify(referrer)};
const liffId=${JSON.stringify(liffId)};
const addUrl=${JSON.stringify(addUrl)};
const canonicalUrl=${JSON.stringify(canonicalUrl)};
async function claim(){try{await liff.init({liffId});if(!liff.isLoggedIn()){liff.login({redirectUri:canonicalUrl});return;}const profile=await liff.getProfile();if(ref){await fetch('/api/referrals/claim',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({referrerLineUserId:ref,referredLineUserId:profile.userId,displayName:profile.displayName,pictureUrl:profile.pictureUrl})});}document.querySelector('#claim-status').textContent='已完成授權，正在開啟加入好友';setTimeout(()=>{location.href=addUrl;},350);}catch(e){document.querySelector('#claim-status').textContent='已開啟推薦頁，請按下方按鈕加入官方帳號';}}
claim();
</script>` : `<script>document.addEventListener('DOMContentLoaded',()=>{document.querySelector('#claim-status').textContent='尚未設定 LIFF，已先記錄掃碼來源';});</script>`;
  return html(`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BookingOS 好友推薦</title><style>:root{--green:#06c755;--rail:#10231d;--bg:#eef2ed;--line:#dfe5dd;--ink:#17211d;--muted:#68746d}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink)}.card{width:min(440px,calc(100vw - 28px));background:white;border:1px solid var(--line);border-radius:12px;padding:22px;text-align:center;box-shadow:0 18px 50px rgba(16,35,29,.08)}h1{font-size:24px;margin:0 0 8px}p{color:var(--muted);line-height:1.55}.qr{width:220px;height:220px;border:1px solid var(--line);border-radius:10px;margin:12px auto;padding:10px;background:white}.btn{display:grid;place-items:center;min-height:48px;border-radius:9px;background:var(--green);color:#062216;font-weight:950;text-decoration:none;margin-top:12px}.sub{font-size:12px;word-break:break-all;background:#f6faf7;border:1px solid var(--line);border-radius:8px;padding:10px}</style></head><body><main class="card"><h1>加入 BookingOS</h1><p id="claim-status">正在開啟 LINE Login...</p><img class="qr" src="${escapeAttrValue(qrUrl)}" alt="推薦 QR"><a class="btn" href="${escapeAttrValue(addUrl)}">加入官方帳號</a></main>${liffScript}</body></html>`);
}
async function claimPlatformReferral(request, env) {
  if (!env.DB) return Response.json({ ok: false, error: "Database is not configured" }, { status: 503, headers: jsonHeaders });
  try {
    const payload = await request.json();
    const referrerLineUserId = String(payload.referrerLineUserId || "").trim();
    const referredLineUserId = String(payload.referredLineUserId || "").trim();
    if (!referrerLineUserId || !referredLineUserId) return Response.json({ ok: false, error: "referrer and referred LINE UID are required" }, { status: 400, headers: jsonHeaders });
    const referralId = "ref-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
    await env.DB.prepare(`
      INSERT INTO platform_referrals (id, referrer_line_user_id, referred_line_user_id, status, source, landing_url, user_agent, created_at, updated_at)
      VALUES (?, ?, ?, 'claimed', 'qr', ?, ?, datetime('now'), datetime('now'))
    `).bind(referralId, referrerLineUserId, referredLineUserId, request.url, String(request.headers.get("user-agent") || "").slice(0, 500) || null).run();
    await env.DB.prepare(`
      INSERT INTO platform_line_contacts (line_user_id, display_name, picture_url, lead_status, source, referrer_line_user_id, note, last_event_type, last_interaction_at, created_at, updated_at)
      VALUES (?, ?, ?, 'referred', 'referral', ?, '由好友分享加入', 'referral_claim', datetime('now'), datetime('now'), datetime('now'))
      ON CONFLICT(line_user_id) DO UPDATE SET
        display_name = COALESCE(NULLIF(excluded.display_name, ''), platform_line_contacts.display_name),
        picture_url = COALESCE(NULLIF(excluded.picture_url, ''), platform_line_contacts.picture_url),
        lead_status = CASE WHEN platform_line_contacts.lead_status = 'new_friend' THEN 'referred' ELSE platform_line_contacts.lead_status END,
        source = COALESCE(NULLIF(platform_line_contacts.source, ''), excluded.source),
        referrer_line_user_id = COALESCE(platform_line_contacts.referrer_line_user_id, excluded.referrer_line_user_id),
        note = COALESCE(platform_line_contacts.note, excluded.note),
        last_event_type = excluded.last_event_type,
        last_interaction_at = datetime('now'),
        updated_at = datetime('now')
    `).bind(referredLineUserId, String(payload.displayName || "").trim() || null, String(payload.pictureUrl || "").trim() || null, referrerLineUserId).run();
    return Response.json({ ok: true, referralId }, { headers: jsonHeaders });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: jsonHeaders });
  }
}async function dashboardData(env, date, tenantId = TENANT_ID) {
  if (!env.DB) return { store, businessHours, services, staffMembers, resourceTypes, bookings };
  try {
    const [loadedStore, loadedBusinessHours, loadedServices, loadedStaffMembers, loadedResourceTypes, loadedBookings] = await Promise.all([
      loadStore(env, tenantId),
      loadBusinessHours(env, tenantId),
      loadServices(env, tenantId),
      loadStaffMembers(env, tenantId),
      loadResourceTypes(env, tenantId),
      loadBookings(env, date, tenantId)
    ]);
    return { store: loadedStore, businessHours: loadedBusinessHours, services: loadedServices, staffMembers: loadedStaffMembers, resourceTypes: loadedResourceTypes, bookings: loadedBookings };
  } catch (error) {
    return { store, businessHours, services, staffMembers, resourceTypes, bookings, dataError: error.message };
  }
}

async function loadStore(env, tenantId = TENANT_ID) {
  const row = await env.DB.prepare("SELECT name, phone, address, logo_url, status, contract_start, contract_end, billing_plan_id, staff_limit FROM tenants WHERE id = ?").bind(tenantId).first();
  return row ? { name: row.name, phone: row.phone, address: row.address, logoUrl: row.logo_url || "", status: row.status || "active", contractStart: row.contract_start || "", contractEnd: row.contract_end || "", billingPlanId: row.billing_plan_id || "solo", staffLimit: Number(row.staff_limit || planById(row.billing_plan_id || "solo").staffLimit), tenantId } : { ...store, tenantId };
}

async function loadBusinessHours(env, tenantId = TENANT_ID) {
  const row = await env.DB.prepare("SELECT open_time, close_time, break_start, break_end, closed_days_json, allow_overtime_booking, point_spend_amount, point_reward_points FROM business_settings WHERE tenant_id = ?").bind(tenantId).first();
  if (!row) return businessHours;
  return {
    open: row.open_time,
    close: row.close_time,
    breaks: row.break_start && row.break_end ? [{ start: row.break_start, end: row.break_end, label: "午休" }] : [],
    closedDays: safeJson(row.closed_days_json, []),
    allowOvertimeBooking: Boolean(row.allow_overtime_booking),
    pointReward: { spendAmount: Number(row.point_spend_amount || 100), rewardPoints: Number(row.point_reward_points || 1) }
  };
}

async function loadServices(env, tenantId = TENANT_ID) {
  const rows = await env.DB.prepare(`
    SELECT s.id, s.name, s.category, s.resource_type_id, rt.name AS resource_type_name, s.point_redeem_limit, d.minutes, d.price
    FROM services s
    JOIN service_durations d ON d.service_id = s.id AND d.enabled = 1
    LEFT JOIN resource_types rt ON rt.id = s.resource_type_id AND rt.tenant_id = s.tenant_id
    WHERE s.tenant_id = ? AND s.enabled = 1
    ORDER BY s.sort_order, d.minutes
  `).bind(tenantId).all();
  const grouped = new Map();
  for (const row of rows.results || []) {
    if (!grouped.has(row.id)) grouped.set(row.id, { id: row.id, name: row.name, category: row.category, resourceTypeId: row.resource_type_id || "", resourceTypeName: row.resource_type_name || "未指定資源", pointRedeemLimit: Number(row.point_redeem_limit || 0), prices: [] });
    grouped.get(row.id).prices.push({ minutes: row.minutes, price: row.price });
  }
  return grouped.size ? Array.from(grouped.values()) : services;
}

async function loadResourceTypes(env, tenantId = TENANT_ID) {
  const rows = await env.DB.prepare("SELECT id, name, quantity FROM resource_types WHERE tenant_id = ? AND enabled = 1 ORDER BY sort_order, name").bind(tenantId).all();
  return (rows.results || []).length ? rows.results.map((row) => ({ id: row.id, name: row.name, quantity: Number(row.quantity || 1) })) : resourceTypes;
}

async function loadStaffMembers(env, tenantId = TENANT_ID) {
  const rows = await env.DB.prepare("SELECT id, name, role, service_ids, crm_permissions FROM staff_members WHERE tenant_id = ? AND enabled = 1 ORDER BY sort_order, name").bind(tenantId).all();
  return (rows.results || []).length ? rows.results.map((row) => ({ id: row.id, name: row.name, role: row.role || "", serviceIds: parseServiceIds(row.service_ids), crmPermissions: parseServiceIds(row.crm_permissions) || [] })) : staffMembers;
}

async function loadBookings(env, date, tenantId) {
  const rows = await env.DB.prepare(`
    SELECT b.id, b.staff_id, COALESCE(sm.name, b.staff_id) AS staff_name, b.service_id, COALESCE(s.resource_type_id, '') AS resource_type_id, b.customer_name, b.customer_phone, b.service_name, b.duration_minutes, b.start_time, b.end_time, b.status
    FROM bookings b
    LEFT JOIN staff_members sm ON sm.id = b.staff_id AND sm.tenant_id = b.tenant_id
    LEFT JOIN services s ON s.id = b.service_id AND s.tenant_id = b.tenant_id
    WHERE b.tenant_id = ? AND b.booking_date = ? AND b.status != 'cancelled'
    ORDER BY b.start_time
  `).bind(tenantId, date).all();
  const statusMap = { confirmed: "已確認", pending: "待確認", cancelled: "已取消" };
  return (rows.results || []).map((row) => ({
    id: row.id,
    staffId: row.staff_id,
    staffName: row.staff_name,
    serviceId: row.service_id,
    resourceTypeId: row.resource_type_id,
    customer: row.customer_name,
    phone: row.customer_phone,
    service: row.service_name,
    duration: row.duration_minutes,
    start: row.start_time,
    end: row.end_time,
    status: statusMap[row.status] || row.status
  }));
}

async function saveMemberProfile(request, env, tenantId, session = null) {
  if (!env.DB) return Response.json({ ok: false, error: "Database is not configured" }, { status: 503, headers: jsonHeaders });
  if (!session?.ok || session.tenantId !== tenantId) return customerAuthFailureResponse(request, customerAuthError("CUSTOMER_SESSION_REQUIRED", "Customer session is required"), tenantId);
  try {
    const payload = await request.json();
    const name = limitText(payload.name, 80);
    const phone = limitText(payload.phone, 32);
    if (!name) return customerJsonError("CUSTOMER_UPDATE_FORBIDDEN", "name is required", 400);
    await env.DB.prepare(`
      UPDATE customers SET
        name = ?, phone = ?, email = ?, gender = ?, address = ?, birthday = ?, preferred_service = ?, allergy_note = ?, contact_preference = ?, marketing_opt_in = ?, updated_at = datetime('now')
      WHERE tenant_id = ? AND id = ? AND identity_id = ?
    `).bind(
      name,
      phone || null,
      limitText(payload.email, 120) || null,
      limitText(payload.gender, 24) || null,
      limitText(payload.address, 180) || null,
      normalizeCustomerBirthdayCredential(payload.birthday) || null,
      limitText(payload.preferredService || payload.preferred_service, 120) || null,
      limitText(payload.allergyNote || payload.allergy_note, 180) || null,
      limitText(payload.contactPreference || payload.contact_preference, 32) || "phone",
      payload.marketingOptIn === false ? 0 : 1,
      session.tenantId,
      session.customerId,
      session.identityId
    ).run();
    return Response.json({ ok: true, profile: await loadCustomerProfileById(env, session.tenantId, session.customerId) }, { headers: jsonHeaders });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: jsonHeaders });
  }
}

function limitText(value, maxLength) {
  const text = String(value || "").trim();
  return text.slice(0, Math.max(1, Number(maxLength || 120)));
}
function parseServiceIds(value) {
  if (value === null || value === undefined || value === "") return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : null;
  } catch (_error) {
    return null;
  }
}

function clean(value) {
  const text = String(value || "").trim();
  return text || null;
}
function xmlEscape(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function excelCell(value) {
  return `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
}

function excelRow(values = []) {
  return `<Row>${values.map(excelCell).join("")}</Row>`;
}

function excelSheet(name, headers, rows) {
  const body = [excelRow(headers), ...rows.map((row) => excelRow(row))].join("");
  return `<Worksheet ss:Name="${xmlEscape(name)}"><Table>${body}</Table></Worksheet>`;
}

function excelWorkbook(sheets = []) {
  return `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">${sheets.join("")}</Workbook>`;
}

async function exportCustomerWorkbook(request, env, tenantId = TENANT_ID) {
  if (!env.DB) return Response.json({ ok: false, error: "Database is not configured" }, { status: 503, headers: jsonHeaders });
  const exportTenantId = tenantId || tenantIdFromUrl(new URL(request.url), env);
  const [contacts, history, points] = await Promise.all([
    env.DB.prepare(`
      SELECT c.id, c.name, c.phone, c.email, c.gender, c.birthday, c.address, c.preferred_service, c.contact_preference, c.marketing_opt_in, c.points_balance, c.total_points_earned, c.total_points_used, c.referral_code, c.referred_by_code, r.name AS referrer_name, c.total_bookings, c.last_booking_at, c.note, c.created_at
      FROM customers c
      LEFT JOIN customers r ON r.id = c.referred_by_customer_id AND r.tenant_id = c.tenant_id
      WHERE c.tenant_id = ?
      ORDER BY c.updated_at DESC, c.created_at DESC
    `).bind(exportTenantId).all(),
    env.DB.prepare(`
      SELECT b.id, b.booking_date, b.start_time, b.end_time, b.customer_name, b.customer_phone, c.name AS member_name, b.service_name, b.duration_minutes, b.price, b.status, b.source, sm.name AS staff_name, b.note
      FROM bookings b
      LEFT JOIN customers c ON c.id = b.customer_id AND c.tenant_id = b.tenant_id
      LEFT JOIN staff_members sm ON sm.id = b.staff_id AND sm.tenant_id = b.tenant_id
      WHERE b.tenant_id = ?
      ORDER BY b.booking_date DESC, b.start_time DESC
    `).bind(exportTenantId).all(),
    env.DB.prepare(`
      SELECT pt.created_at, c.name AS customer_name, c.phone AS customer_phone, pt.type, pt.points, pt.reason, pt.booking_id, pt.expires_at
      FROM point_transactions pt
      LEFT JOIN customers c ON c.id = pt.customer_id AND c.tenant_id = pt.tenant_id
      WHERE pt.tenant_id = ?
      ORDER BY pt.created_at DESC
    `).bind(exportTenantId).all()
  ]);

  const contactRows = (contacts.results || []).map((row) => [
    row.name || "", row.phone || "", row.email || "", row.gender || "", row.birthday || "", row.address || "", row.preferred_service || "", row.contact_preference || "", row.marketing_opt_in ? "是" : "否", row.points_balance || 0, row.total_points_earned || 0, row.total_points_used || 0, row.referral_code || "", row.referred_by_code || "", row.referrer_name || "", row.total_bookings || 0, row.last_booking_at || "", row.note || "", row.created_at || ""
  ]);
  const historyRows = (history.results || []).map((row) => [
    row.booking_date || "", row.start_time || "", row.end_time || "", row.customer_name || row.member_name || "", row.customer_phone || "", row.service_name || "", row.duration_minutes || "", row.price || 0, row.staff_name || "", row.status || "", row.source || "", row.note || "", row.id || ""
  ]);
  const pointRows = (points.results || []).map((row) => [
    row.created_at || "", row.customer_name || "", row.customer_phone || "", row.type === "earn" ? "取得" : row.type === "redeem" ? "折抵" : row.type === "refund" ? "退回" : row.type === "revoke" ? "扣回" : row.type || "", row.points || 0, row.reason || "", row.booking_id || "", row.expires_at || ""
  ]);

  const workbook = excelWorkbook([
    excelSheet("通訊錄", ["姓名", "手機", "Email", "性別", "生日", "地址", "偏好服務", "聯絡偏好", "行銷同意", "點數餘額", "累積取得", "累積使用", "介紹碼", "被介紹碼", "介紹人", "預約次數", "最後預約", "備註", "建立時間"], contactRows),
    excelSheet("消費歷史表", ["日期", "開始", "結束", "客戶", "手機", "服務", "分鐘", "金額", "服務人員", "狀態", "來源", "備註", "預約編號"], historyRows),
    excelSheet("點數進出表", ["時間", "客戶", "手機", "類型", "點數", "原因", "預約編號", "到期日"], pointRows)
  ]);
  const filename = `bookingos-customers-${exportTenantId}-${todayInTaipei()}.xls`.replace(/[^a-zA-Z0-9._-]/g, "-");
  return new Response(workbook, {
    headers: {
      "content-type": "application/vnd.ms-excel; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store"
    }
  });
}
async function loadCustomerProfile(env, tenantId, phone) {
  if (!env.DB || !phone) return null;
  const customer = await env.DB.prepare(`
    SELECT c.id, c.name, c.phone, c.email, c.gender, c.address, c.birthday, c.note, c.marketing_opt_in, c.preferred_service, c.allergy_note, c.contact_preference, c.points_balance, c.total_points_earned, c.total_points_used, c.referral_code, c.referred_by_code, r.name AS referrer_name, c.total_bookings, c.last_booking_at, c.created_at
    FROM customers c
    LEFT JOIN customers r ON r.id = c.referred_by_customer_id AND r.tenant_id = c.tenant_id
    WHERE c.tenant_id = ? AND c.phone = ?
  `).bind(tenantId, phone).first();
  if (!customer) return null;
  return loadCustomerProfileBundle(env, tenantId, customer);
}

async function loadCustomerProfileById(env, tenantId, customerId) {
  if (!env.DB || !tenantId || !customerId) return null;
  const customer = await env.DB.prepare(`
    SELECT c.id, c.tenant_id, c.identity_id, c.customer_no, c.name, c.phone, c.email, c.gender, c.address, c.birthday, c.marketing_opt_in, c.preferred_service, c.allergy_note, c.contact_preference, c.points_balance, c.total_points_earned, c.total_points_used, c.referral_code, c.referred_by_code, r.name AS referrer_name, c.total_bookings, c.last_booking_at, c.status, c.created_at
    FROM customers c
    LEFT JOIN customers r ON r.id = c.referred_by_customer_id AND r.tenant_id = c.tenant_id
    WHERE c.tenant_id = ? AND c.id = ?
  `).bind(tenantId, customerId).first();
  if (!customer) return null;
  return loadCustomerProfileBundle(env, tenantId, customer);
}

async function loadCustomerProfileBundle(env, tenantId, customer) {
  const [points, bookingRows] = await Promise.all([
    loadCustomerPointTransactions(env, tenantId, customer.id),
    loadCustomerBookings(env, tenantId, customer.id)
  ]);
  return { customer, points, bookings: bookingRows };
}

async function loadCustomerPointTransactions(env, tenantId, customerId) {
  if (!env.DB || !tenantId || !customerId) return [];
  const rows = await env.DB.prepare(`
    SELECT type, points, reason, booking_id, expires_at, created_at
    FROM point_transactions
    WHERE tenant_id = ? AND customer_id = ?
    ORDER BY created_at DESC
    LIMIT 30
  `).bind(tenantId, customerId).all();
  return rows.results || [];
}

async function loadCustomerBookings(env, tenantId, customerId) {
  if (!env.DB || !tenantId || !customerId) return [];
  const rows = await env.DB.prepare(`
    SELECT id, booking_date, start_time, end_time, service_name, duration_minutes, price, status
    FROM bookings
    WHERE tenant_id = ? AND customer_id = ?
    ORDER BY booking_date DESC, start_time DESC
    LIMIT 30
  `).bind(tenantId, customerId).all();
  return rows.results || [];
}
async function loadCustomers(env, tenantId = TENANT_ID) {
  if (!env.DB) return [];
  try {
    const rows = await env.DB.prepare(`
      SELECT c.id, c.name, c.phone, c.points_balance, c.referral_code, c.referred_by_code, r.name AS referrer_name, c.total_bookings, c.last_booking_at
      FROM customers c
      LEFT JOIN customers r ON r.id = c.referred_by_customer_id AND r.tenant_id = c.tenant_id
      WHERE c.tenant_id = ?
      ORDER BY c.updated_at DESC
      LIMIT 50
    `).bind(tenantId).all();
    return rows.results || [];
  } catch (error) {
    console.warn("loadCustomers failed", error && error.message ? error.message : error);
    return [];
  }
}
async function saveResourceTypes(request, env, tenantId = TENANT_ID) {
  if (!env.DB) return Response.json({ ok: false, error: "Database is not configured" }, { status: 503, headers: jsonHeaders });
  try {
    const payload = await request.json();
    const incoming = Array.isArray(payload.resourceTypes) ? payload.resourceTypes : [];
    const cleaned = incoming.map((resource, index) => {
      const name = String(resource.name || "").trim();
      const id = safeServiceId(resource.id || name || crypto.randomUUID());
      const quantity = normalizePositiveInt(resource.quantity, 1);
      return { id, name, quantity, sortOrder: Number(resource.sortOrder ?? index) };
    }).filter((resource) => resource.name);
    if (!cleaned.length) return Response.json({ ok: false, error: "at least one resource type is required" }, { status: 400, headers: jsonHeaders });
    await env.DB.prepare("UPDATE resource_types SET enabled = 0, updated_at = datetime('now') WHERE tenant_id = ?").bind(tenantId).run();
    for (const resource of cleaned) {
      await env.DB.prepare("INSERT INTO resource_types (id, tenant_id, name, quantity, enabled, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, datetime('now'), datetime('now')) ON CONFLICT(id) DO UPDATE SET name = excluded.name, quantity = excluded.quantity, enabled = 1, sort_order = excluded.sort_order, updated_at = datetime('now')").bind(resource.id, tenantId, resource.name, resource.quantity, resource.sortOrder).run();
    }
    return Response.json({ ok: true, resourceTypes: await loadResourceTypes(env, tenantId) }, { headers: jsonHeaders });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: jsonHeaders });
  }
}

async function saveStaffMembers(request, env, tenantId = TENANT_ID) {
  if (!env.DB) return Response.json({ ok: false, error: "Database is not configured" }, { status: 503, headers: jsonHeaders });
  try {
    const payload = await request.json();
    const incoming = Array.isArray(payload.staffMembers) ? payload.staffMembers : [];
    const cleaned = incoming.map((staff, index) => {
      const name = String(staff.name || "").trim();
      const id = safeServiceId(staff.id || name || crypto.randomUUID());
      const serviceIds = Array.isArray(staff.serviceIds) ? staff.serviceIds.map((id) => safeServiceId(id)).filter(Boolean) : null;
      const crmPermissions = Array.isArray(staff.crmPermissions) ? staff.crmPermissions.map((item) => String(item || "").trim()).filter((item) => item === "staff" || item === "store") : [];
      return { id, name, role: clean(staff.role), serviceIds, crmPermissions, sortOrder: Number(staff.sortOrder ?? index) };
    }).filter((staff) => staff.name);
    if (!cleaned.length) return Response.json({ ok: false, error: "at least one staff member is required" }, { status: 400, headers: jsonHeaders });
    const limit = await tenantStaffLimit(env, tenantId);
    if (cleaned.length > limit) return Response.json({ ok: false, error: `目前方案最多只能建立 ${limit} 位服務人員，請先升級方案再新增。`, staffLimit: limit, requested: cleaned.length }, { status: 400, headers: jsonHeaders });
    await env.DB.prepare("UPDATE staff_members SET enabled = 0, updated_at = datetime('now') WHERE tenant_id = ?").bind(tenantId).run();
    for (const staff of cleaned) {
      await env.DB.prepare("INSERT INTO staff_members (id, tenant_id, name, role, service_ids, crm_permissions, enabled, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now')) ON CONFLICT(id) DO UPDATE SET name = excluded.name, role = excluded.role, service_ids = excluded.service_ids, crm_permissions = excluded.crm_permissions, enabled = 1, sort_order = excluded.sort_order, updated_at = datetime('now')").bind(staff.id, tenantId, staff.name, staff.role, JSON.stringify(staff.serviceIds || []), JSON.stringify(staff.crmPermissions || []), staff.sortOrder).run();
    }
    return Response.json({ ok: true, staffMembers: await loadStaffMembers(env, tenantId) }, { headers: jsonHeaders });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: jsonHeaders });
  }
}

async function saveServices(request, env, tenantId = TENANT_ID) {
  if (!env.DB) return Response.json({ ok: false, error: "Database is not configured" }, { status: 503, headers: jsonHeaders });
  try {
    const payload = await request.json();
    const incoming = Array.isArray(payload.services) ? payload.services : [];
    const cleaned = incoming.map((service, index) => {
      const name = String(service.name || "").trim();
      const category = clean(service.category);
      const id = safeServiceId(service.id || name || crypto.randomUUID());
      const prices = Array.isArray(service.prices) ? service.prices.map((item) => ({ minutes: Number(item.minutes), price: Number(item.price) })).filter((item) => item.minutes > 0 && item.price >= 0) : [];
      const pointRedeemLimit = normalizeNonNegativeInt(service.pointRedeemLimit, 0);
      const resourceTypeId = clean(service.resourceTypeId);
      return { id, name, category, resourceTypeId, pointRedeemLimit, sortOrder: Number(service.sortOrder ?? index), prices };
    }).filter((service) => service.name && service.prices.length);
    if (!cleaned.length) return Response.json({ ok: false, error: "at least one service is required" }, { status: 400, headers: jsonHeaders });
    await env.DB.prepare("UPDATE services SET enabled = 0, updated_at = datetime('now') WHERE tenant_id = ?").bind(tenantId).run();
    await env.DB.prepare("UPDATE service_durations SET enabled = 0, updated_at = datetime('now') WHERE tenant_id = ?").bind(tenantId).run();
    for (const service of cleaned) {
      await env.DB.prepare("INSERT INTO services (id, tenant_id, name, category, resource_type_id, point_redeem_limit, enabled, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now')) ON CONFLICT(id) DO UPDATE SET name = excluded.name, category = excluded.category, resource_type_id = excluded.resource_type_id, point_redeem_limit = excluded.point_redeem_limit, enabled = 1, sort_order = excluded.sort_order, updated_at = datetime('now')").bind(service.id, tenantId, service.name, service.category, service.resourceTypeId, service.pointRedeemLimit, service.sortOrder).run();
      for (const price of service.prices) {
        await env.DB.prepare("INSERT INTO service_durations (id, tenant_id, service_id, minutes, price, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now')) ON CONFLICT(service_id, minutes) DO UPDATE SET price = excluded.price, enabled = 1, updated_at = datetime('now')").bind(`${service.id}-${price.minutes}`, tenantId, service.id, price.minutes, price.price).run();
      }
    }
    return Response.json({ ok: true, services: await loadServices(env, tenantId) }, { headers: jsonHeaders });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: jsonHeaders });
  }
}

function safeServiceId(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || crypto.randomUUID();
}
async function saveStoreProfile(request, env, tenantId = TENANT_ID) {
  if (!env.DB) return Response.json({ ok: false, error: "Database is not configured" }, { status: 503, headers: jsonHeaders });
  try {
    const payload = await request.json();
    const name = clean(payload.name);
    const phone = clean(payload.phone);
    const address = clean(payload.address);
    const logoDataUrl = clean(payload.logoDataUrl);
    if (!name) return Response.json({ ok: false, error: "store name is required" }, { status: 400, headers: jsonHeaders });
    if (logoDataUrl && (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(logoDataUrl) || logoDataUrl.length > 400000)) return Response.json({ ok: false, error: "logo image is invalid or too large" }, { status: 400, headers: jsonHeaders });
    await env.DB.prepare("UPDATE tenants SET name = ?, phone = ?, address = ?, logo_url = ?, updated_at = datetime('now') WHERE id = ?").bind(name, phone, address, logoDataUrl, tenantId).run();
    return Response.json({ ok: true, store: await loadStore(env, tenantId) }, { headers: jsonHeaders });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: jsonHeaders });
  }
}

async function saveSettings(request, env, tenantId = TENANT_ID) {
  if (!env.DB) return Response.json({ ok: false, error: "Database is not configured" }, { status: 503, headers: jsonHeaders });
  try {
    const payload = await request.json();
    const open = normalizeTime(payload.open || "09:00");
    const close = normalizeTime(payload.close || "18:00");
    const breakStart = normalizeTime(payload.breakStart || "12:00");
    const breakEnd = normalizeTime(payload.breakEnd || "13:00");
    const closedDays = Array.isArray(payload.closedDays) ? payload.closedDays : [payload.closedDay || "星期三"];
    const allowOvertime = payload.allowOvertimeBooking || payload.overtimeMode === "yes" ? 1 : 0;
    const pointSpendAmount = normalizePositiveInt(payload.pointSpendAmount, 100);
    const pointRewardPoints = normalizeNonNegativeInt(payload.pointRewardPoints, 1);

    await env.DB.prepare(`
      UPDATE business_settings
      SET open_time = ?, close_time = ?, break_start = ?, break_end = ?, closed_days_json = ?, allow_overtime_booking = ?, point_spend_amount = ?, point_reward_points = ?, updated_at = datetime('now')
      WHERE tenant_id = ?
    `).bind(open, close, breakStart, breakEnd, JSON.stringify(closedDays), allowOvertime, pointSpendAmount, pointRewardPoints, tenantId).run();

    return Response.json({ ok: true }, { headers: jsonHeaders });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: jsonHeaders });
  }
}

async function cancelBooking(request, env, tenantId) {
  if (!env.DB) return Response.json({ ok: false, error: "Database is not configured" }, { status: 503, headers: jsonHeaders });
  try {
    const payload = await request.json();
    const bookingId = String(payload.bookingId || "").trim();
    if (!bookingId) return Response.json({ ok: false, error: "bookingId is required" }, { status: 400, headers: jsonHeaders });
    const customerSession = await readCustomerSession(request, env);
    const booking = await env.DB.prepare("SELECT b.id, b.customer_id, b.customer_phone, b.status, c.phone AS member_phone FROM bookings b LEFT JOIN customers c ON c.id = b.customer_id AND c.tenant_id = b.tenant_id WHERE b.tenant_id = ? AND b.id = ?").bind(tenantId, bookingId).first();
    if (!booking) return Response.json({ ok: false, error: "booking not found" }, { status: 404, headers: jsonHeaders });
    let authorizedCustomerId = "";
    let responseProfilePhone = "";
    if (customerSession.ok && customerSession.tenantId === tenantId) {
      if (String(booking.customer_id || "") !== customerSession.customerId) return customerJsonError("CUSTOMER_ACCESS_DENIED", "not allowed", 403);
      authorizedCustomerId = customerSession.customerId;
    } else {
      const phone = String(payload.phone || "").trim();
      if (!phone) return Response.json({ ok: false, error: "bookingId and phone are required" }, { status: 400, headers: jsonHeaders });
      if (booking.member_phone !== phone && booking.customer_phone !== phone) return Response.json({ ok: false, error: "not allowed" }, { status: 403, headers: jsonHeaders });
      authorizedCustomerId = booking.customer_id || "";
      responseProfilePhone = phone;
    }
    if (booking.status !== "cancelled") {
      await env.DB.prepare("UPDATE bookings SET status = 'cancelled', updated_at = datetime('now') WHERE tenant_id = ? AND id = ?").bind(tenantId, bookingId).run();
      if (booking.customer_id) {
        const earned = await env.DB.prepare("SELECT COALESCE(SUM(points), 0) AS points FROM point_transactions WHERE tenant_id = ? AND customer_id = ? AND booking_id = ? AND type = 'earn'").bind(tenantId, booking.customer_id, bookingId).first();
        const revokePoints = Math.max(0, Number(earned?.points || 0));
        await env.DB.prepare("UPDATE customers SET total_bookings = CASE WHEN total_bookings > 0 THEN total_bookings - 1 ELSE 0 END, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?").bind(tenantId, booking.customer_id).run();
        if (revokePoints > 0) {
          await env.DB.prepare(`
            INSERT INTO point_transactions (id, tenant_id, customer_id, booking_id, type, points, reason, created_at)
            VALUES (?, ?, ?, ?, 'revoke', ?, '取消預約扣回贈點', datetime('now'))
          `).bind(crypto.randomUUID(), tenantId, booking.customer_id, bookingId, -revokePoints).run();
          await env.DB.prepare("UPDATE customers SET points_balance = points_balance - ?, total_points_earned = CASE WHEN total_points_earned >= ? THEN total_points_earned - ? ELSE 0 END, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?").bind(revokePoints, revokePoints, revokePoints, tenantId, booking.customer_id).run();
        }
        const redeemed = await env.DB.prepare("SELECT COALESCE(SUM(points), 0) AS points FROM point_transactions WHERE tenant_id = ? AND customer_id = ? AND booking_id = ? AND type = 'redeem'").bind(tenantId, booking.customer_id, bookingId).first();
        const refundPoints = Math.max(0, Math.abs(Number(redeemed?.points || 0)));
        if (refundPoints > 0) {
          await env.DB.prepare(`
            INSERT INTO point_transactions (id, tenant_id, customer_id, booking_id, type, points, reason, created_at)
            VALUES (?, ?, ?, ?, 'refund', ?, '取消預約退回折抵點數', datetime('now'))
          `).bind(crypto.randomUUID(), tenantId, booking.customer_id, bookingId, refundPoints).run();
          await env.DB.prepare("UPDATE customers SET points_balance = points_balance + ?, total_points_used = CASE WHEN total_points_used >= ? THEN total_points_used - ? ELSE 0 END, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?").bind(refundPoints, refundPoints, refundPoints, tenantId, booking.customer_id).run();
        }
      }
    }
    const profile = authorizedCustomerId ? await loadCustomerProfileById(env, tenantId, authorizedCustomerId) : await loadCustomerProfile(env, tenantId, responseProfilePhone);
    return Response.json({ ok: true, profile }, { headers: jsonHeaders });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: jsonHeaders });
  }
}
async function createBooking(request, env, data) {
  const tenantId = data.store?.tenantId || TENANT_ID;
  if (!env.DB) return Response.json({ ok: false, error: "Database is not configured" }, { status: 503, headers: jsonHeaders });
  const payload = await request.json();
  const customerSession = await readCustomerSession(request, env);
  const selectedService = data.services.find((item) => item.id === payload.serviceId) || data.services[0];
  const selectedPrice = selectedService.prices.find((item) => Number(item.minutes) === Number(payload.duration)) || selectedService.prices[0];
  const date = payload.date || todayInTaipei();
  const start = normalizeTime(payload.startTime || payload.start || "09:00");
  const duration = Number(selectedPrice.minutes);
  const end = toTime(toMinutes(start) + duration);
  const source = String(payload.source || "web").trim() === "walk_in" ? "walk_in" : "web";
  let name = String(payload.customerName || payload.name || "").trim() || (source === "walk_in" ? "現場客" : "");
  let rawPhone = String(payload.customerPhone || payload.phone || "").trim();
  let phone = rawPhone || (source === "walk_in" ? `walk-in-${date}-${start}-${crypto.randomUUID().slice(0, 8)}` : "");
  const referredByCode = String(payload.referredByCode || payload.referrer || "").trim() || null;
  let sessionCustomer = null;
  if (customerSession.ok && customerSession.tenantId === tenantId) {
    const profile = await loadCustomerProfileById(env, customerSession.tenantId, customerSession.customerId);
    sessionCustomer = profile?.customer || null;
    name = name || String(sessionCustomer?.name || "").trim();
    rawPhone = rawPhone || String(sessionCustomer?.phone || "").trim();
    phone = phone || rawPhone;
  }

  if (!name || !phone) return Response.json({ ok: false, error: "name and phone are required" }, { status: 400, headers: jsonHeaders });

  const freshData = await dashboardData(env, date, tenantId);
  const requestedStaffId = String(payload.staffId || "any").trim() || "any";
  const freshService = freshData.services.find((item) => item.id === selectedService.id) || selectedService;
  const selectedResource = freshData.resourceTypes.find((resource) => resource.id === freshService.resourceTypeId);
  const resourceCapacity = Math.max(1, Number(selectedResource?.quantity || 1));
  const slots = findAvailableSlots({
    businessHours: freshData.businessHours,
    bookings: freshData.bookings,
    staffMembers: filterStaffByService(freshData.staffMembers, freshService.id),
    staffId: requestedStaffId,
    resourceTypeId: freshService.resourceTypeId || "",
    resourceCapacity,
    durationMinutes: duration,
    stepMinutes: 30
  });
  if (!slots.includes(start)) return Response.json({ ok: false, error: "selected slot is no longer available" }, { status: 409, headers: jsonHeaders });
  const selectedStaffId = requestedStaffId === "any" ? pickAvailableStaffId({ start, end, bookings: freshData.bookings, staffMembers: freshData.staffMembers, serviceId: freshService.id }) : requestedStaffId;
  if (!selectedStaffId) return Response.json({ ok: false, error: "no staff member is available for this slot" }, { status: 409, headers: jsonHeaders });
  const selectedStaff = freshData.staffMembers.find((staff) => staff.id === selectedStaffId) || { id: selectedStaffId, name: selectedStaffId };

  let existing = null;
  let customerId = sessionCustomer?.id || "";
  const referrer = referredByCode ? await env.DB.prepare("SELECT id FROM customers WHERE tenant_id = ? AND referral_code = ?").bind(tenantId, referredByCode).first() : null;

  if (customerId) {
    existing = { id: customerId };
    await env.DB.prepare("UPDATE customers SET name = COALESCE(NULLIF(?, ''), name), phone = COALESCE(NULLIF(?, ''), phone), updated_at = datetime('now') WHERE tenant_id = ? AND id = ? AND identity_id = ?").bind(name, rawPhone, tenantId, customerId, customerSession.identityId).run();
  } else {
    existing = await env.DB.prepare("SELECT id FROM customers WHERE tenant_id = ? AND phone = ?").bind(tenantId, phone).first();
    customerId = existing?.id || crypto.randomUUID();
    if (!existing) {
      await env.DB.prepare(`
        INSERT INTO customers (id, tenant_id, name, phone, referral_code, referred_by_customer_id, referred_by_code, referred_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CASE WHEN ? IS NULL THEN NULL ELSE datetime('now') END, datetime('now'), datetime('now'))
      `).bind(customerId, tenantId, name, phone, makeReferralCode(phone), referrer?.id || null, referredByCode, referredByCode).run();
    } else {
      await env.DB.prepare("UPDATE customers SET name = ?, referred_by_code = COALESCE(referred_by_code, ?), updated_at = datetime('now') WHERE tenant_id = ? AND id = ?").bind(name, referredByCode, tenantId, customerId).run();
    }
  }

  const currentCustomer = await env.DB.prepare("SELECT points_balance FROM customers WHERE tenant_id = ? AND id = ?").bind(tenantId, customerId).first();
  const originalPrice = Math.max(0, Number(selectedPrice.price || 0));
  const requestedRedeemPoints = Math.max(0, Math.floor(Number(payload.redeemPoints || 0)));
  const serviceRedeemLimit = Math.max(0, Number(freshService.pointRedeemLimit || 0));
  const customerPoints = Math.max(0, Number(currentCustomer?.points_balance || 0));
  const maxRedeemPoints = Math.min(customerPoints, serviceRedeemLimit === 0 ? originalPrice : Math.min(serviceRedeemLimit, originalPrice));
  if (requestedRedeemPoints > maxRedeemPoints) return Response.json({ ok: false, error: "redeem points exceed available limit", maxRedeemPoints }, { status: 400, headers: jsonHeaders });
  const redeemedPoints = requestedRedeemPoints;
  const payableAmount = Math.max(0, originalPrice - redeemedPoints);
  const bookingId = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO bookings (id, tenant_id, customer_id, staff_id, service_id, service_name, duration_minutes, price, booking_date, start_time, end_time, customer_name, customer_phone, status, source, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)
  `).bind(bookingId, tenantId, customerId, selectedStaffId, selectedService.id, selectedService.name, duration, payableAmount, date, start, end, name, rawPhone || '現場未留', source, payload.note || null).run();

  await env.DB.prepare("UPDATE customers SET total_bookings = total_bookings + 1, last_booking_at = ?, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?").bind(`${date} ${start}`, tenantId, customerId).run();

  if (redeemedPoints > 0) {
    await env.DB.prepare(`
      INSERT INTO point_transactions (id, tenant_id, customer_id, booking_id, type, points, reason, created_at)
      VALUES (?, ?, ?, ?, 'redeem', ?, ?, datetime('now'))
    `).bind(crypto.randomUUID(), tenantId, customerId, bookingId, -redeemedPoints, `預約點數折抵：${selectedService.name}`).run();
    await env.DB.prepare("UPDATE customers SET points_balance = points_balance - ?, total_points_used = total_points_used + ?, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?").bind(redeemedPoints, redeemedPoints, tenantId, customerId).run();
  }

  const earnedPoints = calculateRewardPoints(payableAmount, freshData.businessHours.pointReward);
  if (earnedPoints > 0) {
    await env.DB.prepare(`
      INSERT INTO point_transactions (id, tenant_id, customer_id, booking_id, type, points, reason, created_at)
      VALUES (?, ?, ?, ?, 'earn', ?, ?, datetime('now'))
    `).bind(crypto.randomUUID(), tenantId, customerId, bookingId, earnedPoints, `預約消費贈點：${selectedService.name}`).run();
    await env.DB.prepare("UPDATE customers SET points_balance = points_balance + ?, total_points_earned = total_points_earned + ?, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?").bind(earnedPoints, earnedPoints, tenantId, customerId).run();
  }

  if (referrer?.id && referrer.id !== customerId) {
    await env.DB.prepare(`
      INSERT INTO referrals (id, tenant_id, referrer_customer_id, referred_customer_id, referral_code, reward_status, reward_points, first_booking_id)
      VALUES (?, ?, ?, ?, ?, 'pending', 0, ?)
    `).bind(crypto.randomUUID(), tenantId, referrer.id, customerId, referredByCode, bookingId).run();
  }

  return Response.json({ ok: true, bookingId, customerId, booking: { date, start, end, service: selectedService.name, staffId: selectedStaff.id, staffName: selectedStaff.name, autoAssigned: requestedStaffId === "any", duration, price: payableAmount, originalPrice, redeemedPoints, payableAmount, earnedPoints, pointsBalance: customerPoints - redeemedPoints + earnedPoints } }, { headers: jsonHeaders });
}

function normalizeTime(value) {
  return String(value || "").slice(0, 5);
}

function normalizePositiveInt(value, fallback) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizeNonNegativeInt(value, fallback) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function calculateRewardPoints(price, rule) {
  const spendAmount = normalizePositiveInt(rule?.spendAmount, 100);
  const rewardPoints = normalizeNonNegativeInt(rule?.rewardPoints, 1);
  if (rewardPoints <= 0) return 0;
  return Math.floor(Number(price || 0) / spendAmount) * rewardPoints;
}

function safeJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function makeReferralCode(phone) {
  const digits = phone.replace(/\D/g, "").slice(-6) || String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
  return `B${digits}`;
}
