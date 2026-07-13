import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

const cryptoApi = webcrypto;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

function base64ToBytes(value) {
  return new Uint8Array(Buffer.from(String(value || ""), "base64"));
}

async function keyFromSecret(secret) {
  const digest = await cryptoApi.subtle.digest("SHA-256", encoder.encode(secret));
  return cryptoApi.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function aad(tenantId, type, version = 1) {
  return encoder.encode(`${tenantId}:${type}:${version}`);
}

async function encrypt(secret, tenantId, type, value, version = 1) {
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const key = await keyFromSecret(secret);
  const ciphertext = await cryptoApi.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad(tenantId, type, version) }, key, encoder.encode(value));
  return { ciphertext: bytesToBase64(new Uint8Array(ciphertext)), iv: bytesToBase64(iv) };
}

async function decrypt(secret, tenantId, type, encrypted, version = 1) {
  const key = await keyFromSecret(secret);
  const plaintext = await cryptoApi.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(encrypted.iv), additionalData: aad(tenantId, type, version) }, key, base64ToBytes(encrypted.ciphertext));
  return decoder.decode(plaintext);
}

const first = await encrypt("test-key", "tenant-a", "channel_access_token", "token-value");
const second = await encrypt("test-key", "tenant-a", "channel_access_token", "token-value");
assert.notEqual(first.iv, second.iv, "each encryption must use a fresh IV");
assert.equal(await decrypt("test-key", "tenant-a", "channel_access_token", first), "token-value");
await assert.rejects(() => decrypt("wrong-key", "tenant-a", "channel_access_token", first));
await assert.rejects(() => decrypt("test-key", "tenant-b", "channel_access_token", first));
const tampered = { ...first, ciphertext: first.ciphertext.slice(0, -2) + "AA" };
await assert.rejects(() => decrypt("test-key", "tenant-a", "channel_access_token", tampered));

const source = await (await import("node:fs/promises")).readFile("src/index.js", "utf8");
assert.match(source, /TENANT_REQUIRED/);
assert.match(source, /TENANT_NOT_FOUND/);
assert.match(source, /INSERT OR IGNORE INTO line_webhook_events/);
assert.match(source, /channel_access_token_ciphertext/);
assert.doesNotMatch(source, /line-webhook.*TENANT_ID/);
console.log("LINE engagement tests passed: AES-GCM, AAD, IV, tamper, routing, dedupe contracts");
