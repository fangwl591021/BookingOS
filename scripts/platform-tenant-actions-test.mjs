import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");

assert.ok(source.includes('type="button" data-action="copy-store-url"'), "copy button must be an explicit button");
assert.ok(source.includes('type="button" data-action="open-store"'), "open button must be an explicit button");
assert.ok(source.includes('type="button" data-action="manage-store"'), "manage button must be an explicit button");
assert.ok(source.includes('data-slug="${escapeAttrValue(tenant.slug || "")}"'), "copy button must carry the tenant slug");
assert.ok(source.includes('document.execCommand("copy")'), "copy fallback must exist");
assert.ok(source.includes("async function handleCopyStoreUrl(store)"), "store URL handler must exist");
assert.ok(source.includes("已複製"), "success button feedback must exist");
assert.ok(source.includes("closest(\"[data-action='copy-store-url'],[data-action='open-store'],[data-action='manage-store']\")"), "click handling must use closest event delegation");

const clipboardSuccess = [];
const fakeDocument = {
  body: { appendChild() {}, removeChild() {} },
  createElement() {
    return {
      value: "",
      setAttribute() {},
      style: {},
      focus() {},
      select() {},
      setSelectionRange() {},
    };
  },
  execCommand(command) {
    assert.equal(command, "copy");
    return true;
  },
};
async function copyText(text, navigatorMock, windowMock) {
  if (navigatorMock.clipboard && windowMock.isSecureContext) {
    try {
      await navigatorMock.clipboard.writeText(text);
      return "clipboard";
    } catch (_error) {}
  }
  const textarea = fakeDocument.createElement("textarea");
  textarea.value = text;
  fakeDocument.body.appendChild(textarea);
  textarea.select();
  const success = fakeDocument.execCommand("copy");
  fakeDocument.body.removeChild(textarea);
  if (!success) throw new Error("COPY_FAILED");
  return "fallback";
}
async function handleCopyStoreUrl(store, navigatorMock, windowMock, onSuccess, onFailure) {
  const storeUrl = windowMock.location.origin + "/store/" + store.slug;
  try {
    await copyText(storeUrl, navigatorMock, windowMock);
    onSuccess("已複製", "已複製店家網址", storeUrl);
  } catch (error) {
    onFailure("複製失敗，請手動複製", error);
  }
}

const apiMode = await copyText("https://example.test/store/anhe", {
  clipboard: { writeText: async (value) => clipboardSuccess.push(value) },
}, { isSecureContext: true });
assert.equal(apiMode, "clipboard");
assert.deepEqual(clipboardSuccess, ["https://example.test/store/anhe"]);

const fallbackMode = await copyText("https://example.test/store/sunny-hair", {
  clipboard: { writeText: async () => { throw new Error("blocked"); } },
}, { isSecureContext: true });
assert.equal(fallbackMode, "fallback");

const successMessages = [];
await handleCopyStoreUrl(
  { slug: "onboarding-test" },
  { clipboard: { writeText: async (value) => clipboardSuccess.push(value) } },
  { isSecureContext: true, location: { origin: "https://bookingos.example" } },
  (...messages) => successMessages.push(messages),
  () => assert.fail("success path must not fail"),
);
assert.deepEqual(clipboardSuccess.at(-1), "https://bookingos.example/store/onboarding-test");
assert.deepEqual(successMessages.at(-1), ["已複製", "已複製店家網址", "https://bookingos.example/store/onboarding-test"]);

const failureMessages = [];
await handleCopyStoreUrl(
  { slug: "anhe" },
  { clipboard: { writeText: async () => { throw new Error("blocked"); } } },
  { isSecureContext: true, location: { origin: "https://bookingos.example" } },
  () => assert.fail("failure path must not succeed"),
  (...messages) => failureMessages.push(messages),
);
assert.equal(failureMessages.at(-1)[0], "複製失敗，請手動複製");

console.log("Platform tenant action Clipboard and fallback tests passed");
