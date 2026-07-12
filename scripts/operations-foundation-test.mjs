import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const migration = await readFile(new URL("../migrations/0020_staff_profile_fields.sql", import.meta.url), "utf8");

assert.match(migration, /ALTER TABLE staff_members ADD COLUMN avatar_url TEXT;/);
assert.match(migration, /ALTER TABLE staff_members ADD COLUMN phone TEXT;/);
assert.match(migration, /ALTER TABLE staff_members ADD COLUMN email TEXT;/);

assert.match(source, /WHERE s\.tenant_id = \?/);
assert.match(source, /WHERE tenant_id = \?" \+ filter/);
assert.match(source, /minutes > 0/);
assert.match(source, /price >= 0/);
assert.match(source, /service\.enabled/);
assert.match(source, /staff\.enabled/);
assert.match(source, /avatar_url/);
assert.match(source, /normalizeMerchantEmail\(item\.email\)/);
assert.match(source, /service_ids/);
assert.match(source, /staffServiceBinding/);
assert.match(source, /data\.businessHours\?\.complete/);
assert.match(source, /data\.onboardingSetup && !data\.onboardingSetup\.readyForBooking/);
assert.match(source, /Booking Not Ready/);
assert.match(source, /include_disabled/);

console.log("operations foundation contract tests passed");