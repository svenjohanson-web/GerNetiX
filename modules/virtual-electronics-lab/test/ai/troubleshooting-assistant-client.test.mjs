import assert from "node:assert/strict";
import test from "node:test";

import {
  createLiveTroubleshootingAssistantClient,
  TROUBLESHOOTING_ASSISTANT_ENDPOINT,
} from "../../ai/troubleshooting-assistant-client.mjs";

test("live client posts only the explicit assistant request to same origin", async () => {
  let request;
  const client = createLiveTroubleshootingAssistantClient({
    fetchImpl: async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) };
      return {
        ok: true,
        status: 200,
        json: async () => ({ proposal: { actionType: "explain-observation", content: "Kurz erklärt." } }),
      };
    },
  });
  const result = await client.request({
    scenario: "miswired",
    snapshot: { sourceFile: "source" },
    requestedAction: "explain-observation",
    message: "Beobachtung",
    account_id: "must-not-send",
  });
  assert.equal(result.ok, true);
  assert.equal(request.url, TROUBLESHOOTING_ASSISTANT_ENDPOINT);
  assert.equal(request.options.credentials, "same-origin");
  assert.equal("account_id" in request.body, false);
});

test("live client reports credits without fallback proposal", async () => {
  const client = createLiveTroubleshootingAssistantClient({
    fetchImpl: async () => ({
      ok: false,
      status: 402,
      json: async () => ({ error: "ai_usage_rejected", message: "Keine Credits." }),
    }),
  });
  const result = await client.request({});
  assert.equal(result.ok, false);
  assert.equal(result.status, 402);
  assert.equal("proposal" in result, false);
});

test("live client keeps the manual lab usable for rate limit and kill switch", async () => {
  const rateLimited = createLiveTroubleshootingAssistantClient({
    fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({ error: "electronics_lab_assistant_rate_limited" }) }),
  });
  const disabled = createLiveTroubleshootingAssistantClient({
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({ error: "electronics_lab_assistant_disabled" }) }),
  });

  assert.match((await rateLimited.request({})).message, /manuelle Labor bleibt verfügbar/);
  assert.match((await disabled.request({})).message, /manuelle Labor bleibt verfügbar/);
});

test("live client rejects invalid successful responses", async () => {
  const client = createLiveTroubleshootingAssistantClient({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ proposal: { actionType: "repair-now", content: "unsafe" } }),
    }),
  });
  const result = await client.request({});
  assert.equal(result.ok, false);
  assert.equal(result.status, 502);
});

test("live client turns transport errors into a stable result", async () => {
  const client = createLiveTroubleshootingAssistantClient({ fetchImpl: async () => { throw new Error("offline"); } });
  const result = await client.request({});
  assert.equal(result.ok, false);
  assert.equal(result.status, 0);
});
