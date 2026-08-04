const assert = require("node:assert/strict");
const test = require("node:test");
const { AiUsageClient } = require("../src/services/ai-usage-client");

test("AI Usage client performs preflight and completion bookings", async () => {
  const calls = [];
  const client = new AiUsageClient({
    baseUrl: "https://usage.test/api/ai-usage/",
    fetchImpl: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return new Response(JSON.stringify(url.endsWith("/preflight") ? { allowed: true, event_id: "event-1" } : { status: "success" }), { status: 200 });
    },
  });
  assert.equal((await client.preflight({ account_id: "demo" })).event_id, "event-1");
  assert.equal((await client.complete("event-1", { input_tokens: 4, output_tokens: 2 })).status, "success");
  assert.equal(calls[0].url, "https://usage.test/api/ai-usage/preflight");
  assert.equal(calls[1].url, "https://usage.test/api/ai-usage/events/event-1/complete");
});
