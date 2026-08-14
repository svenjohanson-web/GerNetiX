const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");

const { createConfig, createHttpApp } = require("../src");
const { sendJson } = require("../src/http-app");
const { issueInternalToken } = require("../../shared/internal-api-auth");

const testSecret = "context-manager-contract-test-secret";

function serviceToken(tokenScopes, options = {}) {
  return issueInternalToken({
    iss: "context-manager-test-client",
    sub: "context-manager-test-client",
    aud: options.audience || "context-manager",
    scopes: tokenScopes,
  }, options.secret || testSecret, options.tokenOptions);
}

async function startServer(t, service, internalApiSigningKey = testSecret) {
  const app = createHttpApp({ service, internalApiSigningKey });
  const server = http.createServer((req, res) => {
    app(req, res).catch((error) => {
      sendJson(res, error.status || 500, { error: error.code || "internal_server_error" });
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  return `http://127.0.0.1:${server.address().port}`;
}

test("serves the context manager HMI", async (t) => {
  const app = createHttpApp({ service: {} });
  const server = http.createServer((req, res) => {
    app(req, res).catch((error) => {
      sendJson(res, error.status || 500, { error: error.code || "internal_server_error" });
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/context-manager/`);
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.match(body, /Context Manager/);
  assert.match(body, /\/context-manager\/styles\.css/);
});

test("serves HMI assets", async (t) => {
  const app = createHttpApp({ service: {} });
  const server = http.createServer((req, res) => {
    app(req, res).catch((error) => {
      sendJson(res, error.status || 500, { error: error.code || "internal_server_error" });
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/context-manager/styles.css`);
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/css/);
  assert.match(body, /app-shell/);
});

test("serves the architecture SVG artifact", async (t) => {
  const app = createHttpApp({ service: {} });
  const server = http.createServer((req, res) => {
    app(req, res).catch((error) => {
      sendJson(res, error.status || 500, { error: error.code || "internal_server_error" });
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/context-manager/architecture/system-process-application-uml.svg`);
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /image\/svg\+xml/);
  assert.match(body, /GerNetiX Serverprozesse/);
});

test("routes project analysis requests", async (t) => {
  const baseUrl = await startServer(t, {
      analyzeScope(input) {
        return {
          scope_id: input.scope_id,
          created_count: 1,
          summary: { requirement: 1, decision: 0, artifact: 0, runtime: 0, event: 0 },
          suggestions: [],
        };
      },
  });
  const response = await fetch(`${baseUrl}/api/context/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceToken(["context_manager.analyze"])}`,
    },
    body: JSON.stringify({ scope_id: "scope-1" }),
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.created_count, 1);
  assert.equal(body.summary.requirement, 1);
});

test("rejects every context fachroute without a bearer token before service execution", async (t) => {
  let callCount = 0;
  const service = new Proxy({}, {
    get() {
      return () => {
        callCount += 1;
        return {};
      };
    },
  });
  const baseUrl = await startServer(t, service);
  const routes = [
    ["GET", "/api/context/current"],
    ["PUT", "/api/context/current"],
    ["POST", "/api/context/requirement-slices"],
    ["POST", "/api/context/artifact-references"],
    ["POST", "/api/context/runtime-references"],
    ["POST", "/api/context/decisions"],
    ["POST", "/api/context/events"],
    ["POST", "/api/context/analyze"],
    ["GET", "/api/context/suggestions"],
    ["PATCH", "/api/context/suggestions/suggestion-1"],
    ["POST", "/api/context/suggestions/suggestion-1/accept"],
    ["POST", "/api/context/suggestions/suggestion-1/reject"],
    ["POST", "/api/context/packs"],
    ["GET", "/api/context/packs/pack-1"],
    ["POST", "/api/context/redact"],
  ];

  for (const [method, route] of routes) {
    const response = await fetch(`${baseUrl}${route}`, {
      method,
      ...(method === "GET" ? {} : { headers: { "Content-Type": "application/json" }, body: "{}" }),
    });
    assert.equal(response.status, 403, `${method} ${route}`);
    assert.equal((await response.json()).error, "internal_token_invalid", `${method} ${route}`);
  }
  assert.equal(callCount, 0);
});

test("enforces audience, expiry, signature and exact read scope", async (t) => {
  let callCount = 0;
  const baseUrl = await startServer(t, {
    currentContext() {
      callCount += 1;
      return { scope_id: "scope-1" };
    },
  });
  const attempts = [
    serviceToken(["context_manager.write"]),
    serviceToken(["context_manager.read"], { audience: "project-server" }),
    serviceToken(["context_manager.read"], { tokenOptions: { now: Date.now() - 120_000, ttlSeconds: 60 } }),
    `${serviceToken(["context_manager.read"])}tampered`,
  ];

  for (const token of attempts) {
    const response = await fetch(`${baseUrl}/api/context/current`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal([401, 403].includes(response.status), true);
  }
  assert.equal(callCount, 0);

  const allowed = await fetch(`${baseUrl}/api/context/current`, {
    headers: { Authorization: `Bearer ${serviceToken(["context_manager.read"])}` },
  });
  assert.equal(allowed.status, 200);
  assert.equal((await allowed.json()).scope_id, "scope-1");
  assert.equal(callCount, 1);
});

test("separates write and analyze scopes", async (t) => {
  let writeCalls = 0;
  let analyzeCalls = 0;
  let packCalls = 0;
  const baseUrl = await startServer(t, {
    upsertScope(input) {
      writeCalls += 1;
      return input;
    },
    analyzeScope(input) {
      analyzeCalls += 1;
      return input;
    },
    createContextPack(input) {
      packCalls += 1;
      return input;
    },
  });

  const deniedWrite = await fetch(`${baseUrl}/api/context/current`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceToken(["context_manager.analyze"])}` },
    body: "{}",
  });
  const deniedAnalyze = await fetch(`${baseUrl}/api/context/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceToken(["context_manager.write"])}` },
    body: "{}",
  });
  const deniedPack = await fetch(`${baseUrl}/api/context/packs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceToken(["context_manager.write"])}` },
    body: "{}",
  });
  assert.equal(deniedWrite.status, 403);
  assert.equal(deniedAnalyze.status, 403);
  assert.equal(deniedPack.status, 403);
  assert.equal(writeCalls, 0);
  assert.equal(analyzeCalls, 0);
  assert.equal(packCalls, 0);

  const allowedWrite = await fetch(`${baseUrl}/api/context/current`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceToken(["context_manager.write"])}` },
    body: JSON.stringify({ scope_id: "scope-1" }),
  });
  const allowedAnalyze = await fetch(`${baseUrl}/api/context/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceToken(["context_manager.analyze"])}` },
    body: JSON.stringify({ scope_id: "scope-1" }),
  });
  const allowedPack = await fetch(`${baseUrl}/api/context/packs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceToken(["context_manager.analyze"])}` },
    body: JSON.stringify({ scope_id: "scope-1" }),
  });
  assert.equal(allowedWrite.status, 200);
  assert.equal(allowedAnalyze.status, 201);
  assert.equal(allowedPack.status, 201);
  assert.equal(writeCalls, 1);
  assert.equal(analyzeCalls, 1);
  assert.equal(packCalls, 1);
});

test("fails closed when signing configuration is missing", async (t) => {
  let called = false;
  const baseUrl = await startServer(t, {
    currentContext() {
      called = true;
      return {};
    },
  }, "");
  const response = await fetch(`${baseUrl}/api/context/current`, {
    headers: { Authorization: `Bearer ${serviceToken(["context_manager.read"])}` },
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "internal_auth_not_configured");
  assert.equal(called, false);
});

test("denies the operator HMI to non-loopback clients", async () => {
  const app = createHttpApp({ service: {}, internalApiSigningKey: testSecret });
  await assert.rejects(
    app({
      method: "GET",
      url: "/context-manager/",
      headers: { host: "context-manager" },
      socket: { remoteAddress: "192.0.2.10" },
    }, {}),
    (error) => error.code === "operator_access_denied" && error.status === 403,
  );
});

test("allows the operator HMI through a read-scoped internal BFF token", async () => {
  const app = createHttpApp({ service: {}, internalApiSigningKey: testSecret });
  const response = {
    status: 0,
    body: Buffer.alloc(0),
    writeHead(status) { this.status = status; },
    end(body) { this.body = Buffer.from(body || ""); },
  };
  await app({
    method: "GET",
    url: "/context-manager/",
    headers: { host: "context-manager", authorization: `Bearer ${serviceToken(["context_manager.read"])}` },
    socket: { remoteAddress: "192.0.2.10" },
  }, response);
  assert.equal(response.status, 200);
  assert.match(response.body.toString("utf8"), /GerNetiX Context Manager/);
});

test("leaves internal auth unconfigured when trusted keys are absent", () => {
  assert.equal(createConfig({}).internalApiSigningKey, "");
});
