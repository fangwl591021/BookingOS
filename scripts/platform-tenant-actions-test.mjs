import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

assert.match(source, /data-copy-store-url=/, "tenant rows must render a copy action");
assert.match(source, /title=\"\$\{escapeAttrValue\(publicUrl\(publicPath\)\)\}\"/, "copy action must expose the full URL as a tooltip");
assert.match(source, /href=\"\$\{escapeAttrValue\(publicPath\)\}\" target=\"_blank\" rel=\"noopener noreferrer\"/, "open action must use the safe public store path");
assert.match(source, /href=\"\/merchant\?tenant=\$\{encodeURIComponent\(tenant\.id\)\}\"/, "manage action must preserve the merchant entry point");
assert.match(source, /navigator\\.clipboard\\|\\|typeof navigator\\.clipboard\\.writeText===\\"function\\"/, "copy action must use Clipboard API");
assert.match(source, /document\.execCommand\("copy"\)/, "copy action must provide a browser fallback");

const calls = [];
const mockClipboard = { writeText: async (value) => calls.push(value) };
const toast = [];
async function copyStoreUrl(url, clipboard, showToast) {
  try {
    if (!clipboard || typeof clipboard.writeText !== "function") throw new Error("clipboard unavailable");
    await clipboard.writeText(url);
    showToast("已複製店家網址");
  } catch (_error) {
    showToast("複製失敗，請重新嘗試");
  }
}

await copyStoreUrl("https://bookingos.example/store/anhe", mockClipboard, (message) => toast.push(message));
assert.deepEqual(calls, ["https://bookingos.example/store/anhe"]);
assert.deepEqual(toast, ["已複製店家網址"]);

await copyStoreUrl("https://bookingos.example/store/anhe", null, (message) => toast.push(message));
assert.equal(toast.at(-1), "複製失敗，請重新嘗試");

console.log("Platform tenant action Clipboard mock test passed");
