const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const { createHttpApp } = require("../src/http-app");
const { issueInternalToken } = require("../../shared/internal-api-auth");

const secret = "persistence-http-auth-test-key";

function token(scopes, audience = "persistence-server") {
  return issueInternalToken({
    iss: "persistence-test-client",
    sub: "persistence-test-client",
    aud: audience,
    scopes,
  }, secret);
}

async function withServer(run) {
  const calls = [];
  const service = {
    getState(key) { calls.push(["get", key]); return { key }; },
    putState(key, value) { calls.push(["put", key, value]); return { key }; },
    exportDatabase() { calls.push(["export"]); return { service_documents: [] }; },
    backupDatabase(target) { calls.push(["backup", target]); return { backup_path: target }; },
  };
  const app = createHttpApp({ service, internalApiSigningKey: secret });
  const server = http.createServer((req, res) => app(req, res).catch((error) => {
    res.writeHead(error.status || 500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error.code || "internal_server_error" }));
  }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`, calls); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test("persistence routes are fail-closed and use exact service scopes", async () => {
  await withServer(async (baseUrl, calls) => {
    const denied = await fetch(`${baseUrl}/api/persistence/state/project-server`);
    assert.equal(denied.status, 403);
    assert.deepEqual(calls, []);

    const wrongAudience = await fetch(`${baseUrl}/api/persistence/state/project-server`, {
      headers: { Authorization: `Bearer ${token(["persistence.state.read"], "other-service")}` },
    });
    assert.equal(wrongAudience.status, 403);

    const wrongScope = await fetch(`${baseUrl}/api/persistence/state/project-server`, {
      headers: { Authorization: `Bearer ${token(["persistence.state.write"])}` },
    });
    assert.equal(wrongScope.status, 403);

    const read = await fetch(`${baseUrl}/api/persistence/state/project-server`, {
      headers: { Authorization: `Bearer ${token(["persistence.state.read"])}` },
    });
    assert.equal(read.status, 200);

    const write = await fetch(`${baseUrl}/api/persistence/state/project-server`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token(["persistence.state.write"])}` },
      body: JSON.stringify({ state: { ok: true } }),
    });
    assert.equal(write.status, 200);

    const exported = await fetch(`${baseUrl}/api/persistence/export`, {
      headers: { Authorization: `Bearer ${token(["persistence.export"])}` },
    });
    assert.equal(exported.status, 200);

    const backup = await fetch(`${baseUrl}/api/persistence/backup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token(["persistence.backup.run"])}` },
      body: JSON.stringify({ target_path: "test-backup.sqlite" }),
    });
    assert.equal(backup.status, 200);
    assert.deepEqual(calls.map((call) => call[0]), ["get", "put", "export", "backup"]);
  });
});

test("persistence fails closed without a signing key", async () => {
  const service = { getState() { throw new Error("must not be called"); } };
  const app = createHttpApp({ service });
  const server = http.createServer((req, res) => app(req, res).catch((error) => {
    res.writeHead(error.status || 500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error.code }));
  }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/persistence/state/test`, {
      headers: { Authorization: `Bearer ${token(["persistence.state.read"])}` },
    });
    assert.equal(response.status, 503);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
