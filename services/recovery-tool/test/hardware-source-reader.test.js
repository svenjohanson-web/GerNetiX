const assert = require("node:assert/strict");
const test = require("node:test");
const { HardwareSourceReader, extractReadableHtml, isPublicIp } = require("../src/services/hardware-source-reader");

test("hardware source reader extracts bounded HTML from public source", async () => {
  const reader = new HardwareSourceReader({
    lookup: async () => [{ address: "93.184.216.34", family: 4 }],
    fetchImpl: async () => new Response("<html><style>x</style><body><h1>ESP32-S3 Board</h1><script>secret()</script><p>16 MB Flash</p></body></html>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
  });
  const source = await reader.read("https://example.com/board");
  assert.equal(source.kind, "text");
  assert.match(source.text, /ESP32-S3 Board/);
  assert.match(source.text, /16 MB Flash/);
  assert.doesNotMatch(source.text, /secret|style/);
});

test("hardware source reader blocks redirects to private networks", async () => {
  let calls = 0;
  const reader = new HardwareSourceReader({
    lookup: async (hostname) => hostname === "example.com"
      ? [{ address: "93.184.216.34", family: 4 }]
      : [{ address: "127.0.0.1", family: 4 }],
    fetchImpl: async () => {
      calls += 1;
      return new Response("", { status: 302, headers: { location: "http://internal.example/private" } });
    },
  });
  await assert.rejects(reader.read("https://example.com/board"), (error) => error.code === "private_hardware_source_rejected");
  assert.equal(calls, 1);
});

test("private and reserved IP ranges are rejected", () => {
  assert.equal(isPublicIp("8.8.8.8"), true);
  assert.equal(isPublicIp("10.0.0.1"), false);
  assert.equal(isPublicIp("192.168.1.2"), false);
  assert.equal(isPublicIp("::1"), false);
  assert.match(extractReadableHtml("<p>A &amp; B</p>"), /A & B/);
});
