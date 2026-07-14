import webpush from "web-push";

const MAX_ENDPOINT_LENGTH = 2048;
const MAX_KEY_LENGTH = 512;

function text(value) {
  return String(value || "").trim();
}

function pushError(code, message, status = 400) {
  return { ok: false, error: { code, message }, status };
}

function configured(env) {
  return Boolean(env?.PUSH_KV && text(env?.VAPID_PUBLIC_KEY) && text(env?.VAPID_PRIVATE_KEY));
}

function normalizeEndpoint(value) {
  const endpoint = text(value);
  if (!endpoint || endpoint.length > MAX_ENDPOINT_LENGTH) return "";
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" ? url.toString() : "";
  } catch (_error) {
    return "";
  }
}

function normalizeSubscription(value) {
  const input = value && typeof value === "object" ? value : {};
  const endpoint = normalizeEndpoint(input.endpoint);
  const keys = input.keys && typeof input.keys === "object" ? input.keys : {};
  const p256dh = text(keys.p256dh);
  const auth = text(keys.auth);
  if (!endpoint || !p256dh || !auth || p256dh.length > MAX_KEY_LENGTH || auth.length > MAX_KEY_LENGTH) return null;
  return {
    endpoint,
    expirationTime: input.expirationTime == null ? null : Number(input.expirationTime) || null,
    keys: { p256dh, auth }
  };
}

async function digest(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function actorPart(actor) {
  const type = actor?.type === "merchant" ? "merchant" : actor?.type === "customer" ? "customer" : "";
  const id = text(actor?.id);
  const tenantId = text(actor?.tenantId);
  return type && id && tenantId ? { type, id, tenantId } : null;
}

async function keyFor(actor, endpoint) {
  const safeActor = actorPart(actor);
  return safeActor ? `push:${safeActor.tenantId}:${safeActor.type}:${safeActor.id}:${await digest(endpoint)}` : "";
}

function prefixFor(actor) {
  const safeActor = actorPart(actor);
  return safeActor ? `push:${safeActor.tenantId}:${safeActor.type}:${safeActor.id}:` : "";
}

function unavailable() {
  return pushError("PUSH_NOT_CONFIGURED", "瀏覽器通知尚未完成平台設定", 503);
}

export function publicKeyResponse(env) {
  if (!text(env?.VAPID_PUBLIC_KEY)) return unavailable();
  return { ok: true, publicKey: text(env.VAPID_PUBLIC_KEY) };
}

export async function subscribePush(env, actor, input) {
  if (!configured(env)) return unavailable();
  const subscription = normalizeSubscription(input?.subscription || input);
  if (!subscription) return pushError("INVALID_PUSH_SUBSCRIPTION", "通知訂閱資料格式不正確");
  const key = await keyFor(actor, subscription.endpoint);
  if (!key) return pushError("PUSH_ACTOR_REQUIRED", "通知訂閱需要有效登入狀態", 401);
  const now = new Date().toISOString();
  await env.PUSH_KV.put(key, JSON.stringify({
    tenantId: actor.tenantId,
    actorType: actor.type,
    actorId: actor.id,
    subscription,
    createdAt: now,
    updatedAt: now
  }));
  return { ok: true, subscribed: true };
}

export async function unsubscribePush(env, actor, input) {
  if (!configured(env)) return unavailable();
  const endpoint = normalizeEndpoint(input?.endpoint || input?.subscription?.endpoint);
  const key = endpoint ? await keyFor(actor, endpoint) : "";
  if (!key) return pushError("INVALID_PUSH_SUBSCRIPTION", "通知訂閱資料格式不正確");
  await env.PUSH_KV.delete(key);
  return { ok: true, subscribed: false };
}

export async function pushStatus(env, actor) {
  if (!configured(env)) return { ok: true, configured: false, subscribed: false };
  const prefix = prefixFor(actor);
  if (!prefix) return pushError("PUSH_ACTOR_REQUIRED", "通知訂閱需要有效登入狀態", 401);
  const listed = await env.PUSH_KV.list({ prefix, limit: 1 });
  return { ok: true, configured: true, subscribed: listed.keys.length > 0 };
}

function payloadFor(input = {}) {
  return {
    title: text(input.title).slice(0, 120) || "預約服務通",
    body: text(input.body).slice(0, 500) || "您有一則新的活動通知",
    url: text(input.url).startsWith("/") ? text(input.url).slice(0, 500) : "/"
  };
}

export async function sendWebPushToActor(env, actor, input) {
  if (!configured(env)) return { status: "skipped", reason: "PUSH_NOT_CONFIGURED" };
  const safeActor = actorPart(actor);
  if (!safeActor) return { status: "skipped", reason: "PUSH_ACTOR_REQUIRED" };
  const prefix = prefixFor(safeActor);
  const listed = await env.PUSH_KV.list({ prefix });
  if (!listed.keys.length) return { status: "skipped", reason: "NO_SUBSCRIPTION" };
  webpush.setVapidDetails(text(env.VAPID_SUBJECT) || "mailto:notifications@bookingos.local", text(env.VAPID_PUBLIC_KEY), text(env.VAPID_PRIVATE_KEY));
  const payload = JSON.stringify(payloadFor(input));
  let sent = 0;
  let removed = 0;
  for (const item of listed.keys) {
    const raw = await env.PUSH_KV.get(item.name);
    if (!raw) continue;
    try {
      const record = JSON.parse(raw);
      await webpush.sendNotification(record.subscription, payload);
      sent += 1;
    } catch (error) {
      const statusCode = Number(error?.statusCode || 0);
      if (statusCode === 404 || statusCode === 410) {
        await env.PUSH_KV.delete(item.name);
        removed += 1;
      }
    }
  }
  return { status: sent ? "sent" : "failed", sent, removed };
}

export async function sendWebPushToTenant(env, tenantId, input, actors = []) {
  const results = await Promise.all(actors.map((actor) => sendWebPushToActor(env, { ...actor, tenantId }, input)));
  return {
    status: results.some((result) => result.status === "sent") ? "sent" : "skipped",
    sent: results.reduce((total, result) => total + Number(result.sent || 0), 0),
    subscriptions: results.length
  };
}
