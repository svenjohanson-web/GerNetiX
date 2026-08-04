const assert = require("node:assert/strict");
const test = require("node:test");

const { sendJson } = require("../src/dev/http-utils");

test("dynamic JSON responses are never cached by the browser", () => {
  const response = {
    body: "",
    headers: null,
    status: null,
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body) {
      this.body = body;
    },
  };

  sendJson(response, 404, { error: "not_found" });

  assert.equal(response.status, 404);
  assert.equal(response.headers["Cache-Control"], "no-store");
  assert.equal(response.headers["Content-Type"], "application/json; charset=utf-8");
  assert.equal(response.body, '{"error":"not_found"}');
});
