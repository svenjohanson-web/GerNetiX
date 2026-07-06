const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");

const { createHttpApp, sendJson } = require("../src");

test("serves the context manager HMI", async (t) => {
  const app = createHttpApp({ service: {} });
  const server = http.createServer((req, res) => {
    app(req, res).catch((error) => {
      sendJson(res, error.status || 500, { error: error.code || "internal_server_error" });
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());

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
  t.after(() => server.close());

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
  t.after(() => server.close());

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/context-manager/architecture/system-process-application-uml.svg`);
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /image\/svg\+xml/);
  assert.match(body, /GerNetiX Serverprozesse/);
});

test("routes project analysis requests", async (t) => {
  const app = createHttpApp({
    service: {
      analyzeScope(input) {
        return {
          scope_id: input.scope_id,
          created_count: 1,
          summary: { requirement: 1, decision: 0, artifact: 0, runtime: 0, event: 0 },
          suggestions: [],
        };
      },
    },
  });
  const server = http.createServer((req, res) => {
    app(req, res).catch((error) => {
      sendJson(res, error.status || 500, { error: error.code || "internal_server_error" });
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/context/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope_id: "scope-1" }),
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.created_count, 1);
  assert.equal(body.summary.requirement, 1);
});
