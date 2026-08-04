const assert = require("node:assert/strict");
const test = require("node:test");
const { HardwareLabAi } = require("../src/services/hardware-lab-ai");

test("hardware lab AI uses Responses structured output and disables active pin tests", async () => {
  let request;
  const usageCalls = [];
  const profile = {
    board_name: "Example S3", manufacturer: "Example", processor_family: "esp32", mcu_variant: "ESP32-S3", module_name: "ESP32-S3-WROOM-1",
    flash_bytes: 16777216, psram_bytes: 8388608, ram_bytes: 524288,
    platformio: { platform: "espressif32", board: "esp32-s3-devkitc-1", framework: "arduino", environment: "example_s3", build_flags: [] },
    capabilities: ["wifi"], integrated_peripherals: [],
    pin_candidates: [{ function: "led", gpio: 48, direction: "output", active_test_allowed: true, source_url: "https://example.com/board", confidence: "documented" }],
    evidence: [{ property: "flash", value: "16 MB", source_url: "https://example.com/board", confidence: "documented" }],
    unresolved_questions: [], discovery_expectations: { passive_checks: ["flash"], active_checks_requiring_confirmation: ["led"], safety_notes: [] },
  };
  const ai = new HardwareLabAi({
    llmConfigStore: { resolveRoute: () => ({ provider: "api", apiProvider: "openai-responses", apiBaseUrl: "https://api.openai.test/v1", apiModel: "gpt-5.6-terra", apiKey: "test-key" }) },
    aiUsageClient: {
      preflight: async (payload) => { usageCalls.push(["preflight", payload]); return { allowed: true, event_id: "usage-1" }; },
      complete: async (eventId, payload) => { usageCalls.push(["complete", eventId, payload]); return { status: "success" }; },
      fail: async () => {},
    },
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body);
      return new Response(JSON.stringify({ id: "resp-1", status: "completed", output_text: JSON.stringify(profile), usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 } }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const result = await ai.analyze({ account_id: "acct-1", board_name: "Example S3", manufacturer: "Example", notes: "", sources: [{ source_url: "https://example.com/board", final_url: "https://example.com/board", kind: "text", text: "16 MB flash" }] });
  assert.equal(request.store, false);
  assert.equal(request.text.format.type, "json_schema");
  assert.equal(request.model, "gpt-5.6-terra");
  assert.equal(result.profile.pin_candidates[0].active_test_allowed, false);
  assert.equal(result.usage.total_tokens, 30);
  assert.equal(result.usage.event_id, "usage-1");
  assert.equal(result.usage.booking_status, "success");
  assert.equal(usageCalls[0][1].feature, "hardware_lab_board_analysis");
  assert.deepEqual(usageCalls[1].slice(0, 2), ["complete", "usage-1"]);
});
