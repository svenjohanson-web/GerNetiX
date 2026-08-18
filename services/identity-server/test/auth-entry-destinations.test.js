const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const identityRoot = path.join(__dirname, "..");
const authClient = fs.readFileSync(path.join(identityRoot, "public", "app", "auth", "auth.js"), "utf8");
const authHtml = fs.readFileSync(path.join(identityRoot, "public", "app", "auth", "index.html"), "utf8");
const server = [
  path.join(identityRoot, "src", "dev-server.js"),
  path.join(identityRoot, "src", "dev", "server", "account-routes.js"),
  path.join(identityRoot, "src", "dev", "auth", "identity-auth-handlers.js"),
].map((file) => fs.readFileSync(file, "utf8")).join("\n");
const { sanitizeNextPath } = require("../src/dev/http-utils");

test("accepts internal entry destinations and rejects external redirects", () => {
  for (const destination of ["/app/community/", "/wissen/#software-basics", "/app/development-platform/", "/app/learn/?project=demo"]) {
    assert.equal(sanitizeNextPath(destination), destination);
  }
  for (const destination of ["https://example.org/", "//example.org/", "/\\example.org/", "javascript:alert(1)", "app/community/"]) {
    assert.equal(sanitizeNextPath(destination), "");
  }
});

test("keeps the requested destination through every browser auth path", () => {
  assert.match(authClient, /const nextUrl = query\.get\("next"\) \|\| "\/app\/dashboard\/"/);
  assert.match(authClient, /authentication\/verify"[\s\S]*next: nextUrl/);
  assert.match(authClient, /registration\/verify"[\s\S]*next: nextUrl/);
  assert.match(authClient, /offline\/passkey\/verify"[\s\S]*next: nextUrl/);
  assert.match(authClient, /support\/passkey\/verify"[\s\S]*next: nextUrl/);
  assert.match(authClient, /postJson\("\/api\/account\/guest", \{ next: nextUrl, locale: currentLocale\(\) \}\)/);
  assert.match(authHtml, /auth\.js\?v=20260818-support-recovery-1/);
});

test("returns only sanitized internal destinations after account creation and guest access", () => {
  assert.match(server, /path: "\/api\/account\/guest"[\s\S]*const body = await readJsonBody\(req\)[\s\S]*next: sanitizeNextPath\(body\.next\) \|\| "\/app\/dashboard\/"/);
  assert.match(server, /function next\(body\) \{ return sanitizeNextPath\(body\.next\) \|\| "\/app\/dashboard\/"; \}/);
  assert.match(server, /handlePasskeyRegistrationVerify[\s\S]*message: "Konto wurde angelegt\.", next: next\(body\)/);
});
