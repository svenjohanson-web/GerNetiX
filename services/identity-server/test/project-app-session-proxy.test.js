const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const routes = fs.readFileSync(path.join(__dirname, "../src/dev/server/project-routes.js"), "utf8");

test("project app proxy derives account and project ownership from the Identity session", () => {
  assert.match(routes, /projects\\\/\(\[\^\/\]\+\)\\\/project-app/);
  assert.match(routes, /requireSessionProject\(session, decodeURIComponent\(match\[1\]\)\)/);
  assert.match(routes, /const accountId = projectServerUserId\(session\)/);
  assert.match(routes, /account_id: accountId/);
});

test("project app proxy forwards only the allowlisted runtime settings contract", () => {
  const start = routes.indexOf('for (const method of ["GET", "PUT"])');
  const end = routes.indexOf('registerProjectPattern("POST", /^\\/api\\/user-ide\\/projects', start);
  const projectAppBlock = routes.slice(start, end);
  assert.match(projectAppBlock, /manifest_version: body\.manifest_version/);
  assert.match(projectAppBlock, /expected_revision: body\.expected_revision/);
  assert.match(projectAppBlock, /values: body\.values/);
  assert.doesNotMatch(projectAppBlock, /\.\.\.body/);
});
