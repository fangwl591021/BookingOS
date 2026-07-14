import assert from "node:assert/strict";
import { publicKeyResponse, subscribePush, unsubscribePush, pushStatus } from "../src/web-push.js";

function mockKv() {
  const values = new Map();
  return {
    values,
    async put(key, value) { values.set(key, value); },
    async get(key) { return values.get(key) || null; },
    async delete(key) { values.delete(key); },
    async list({ prefix = "", limit = 1000 } = {}) { return { keys: [...values.keys()].filter((key) => key.startsWith(prefix)).slice(0, limit).map((name) => ({ name })) }; }
  };
}

const kv = mockKv();
const env = { PUSH_KV: kv, VAPID_PUBLIC_KEY: "public-key", VAPID_PRIVATE_KEY: "private-key" };
const actor = { type: "merchant", id: "identity-a", tenantId: "tenant-a" };
const endpoint = "https://push.example.test/subscription-a";
const subscription = { endpoint, keys: { p256dh: "p256dh-value", auth: "auth-value" } };

assert.deepEqual(publicKeyResponse(env), { ok: true, publicKey: "public-key" });
assert.equal((await pushStatus(env, actor)).subscribed, false);
assert.equal((await subscribePush(env, actor, subscription)).subscribed, true);
assert.equal((await pushStatus(env, actor)).subscribed, true);
assert.equal([...kv.values.keys()].some((key) => key.includes(endpoint)), false);
assert.equal((await unsubscribePush(env, actor, { endpoint })).subscribed, false);
assert.equal((await pushStatus(env, actor)).subscribed, false);
console.log("web-push tests: ok");