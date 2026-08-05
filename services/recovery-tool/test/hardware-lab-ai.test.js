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
  assert.equal(request.text.format.schema.properties.pin_candidates.maxItems, 48);
  assert.equal(request.text.format.schema.properties.evidence.maxItems, 80);
  assert.equal(request.text.format.schema.properties.unresolved_questions.maxItems, 8);
  assert.equal(request.model, "gpt-5.6-terra");
  assert.equal(result.profile.pin_candidates[0].active_test_allowed, false);
  assert.equal(result.usage.total_tokens, 30);
  assert.equal(result.usage.event_id, "usage-1");
  assert.equal(result.usage.booking_status, "success");
  assert.equal(usageCalls[0][1].feature, "hardware_lab_board_analysis");
  assert.deepEqual(usageCalls[1].slice(0, 2), ["complete", "usage-1"]);
});

test("hardware lab chat uses a tracked OpenAI response and only proposes confirmed hardware tests", async () => {
  let request;
  let preflight;
  const profile = {
    board_name: "Example S3", manufacturer: "Example", processor_family: "esp32", mcu_variant: "ESP32-S3", module_name: "ESP32-S3-WROOM-1",
    flash_bytes: 16777216, psram_bytes: 8388608, ram_bytes: 524288,
    platformio: { platform: "espressif32", board: "esp32-s3-devkitc-1", framework: "arduino", environment: "example_s3", build_flags: [] },
    capabilities: ["wifi", "i2c"], integrated_peripherals: [],
    pin_candidates: [{ function: "i2c_sda", gpio: 8, direction: "bus", active_test_allowed: true, source_url: "https://example.com/board", confidence: "documented" }],
    evidence: [], unresolved_questions: ["I2C address"],
    discovery_expectations: { passive_checks: ["i2c address scan"], active_checks_requiring_confirmation: [], safety_notes: [] },
  };
  const ai = new HardwareLabAi({
    llmConfigStore: { resolveRoute: () => ({ provider: "api", apiProvider: "openai-responses", apiBaseUrl: "https://api.openai.test/v1", apiModel: "gpt-5.6-terra", apiKey: "test-key" }) },
    aiUsageClient: {
      preflight: async (payload) => { preflight = payload; return { allowed: true, event_id: "usage-chat" }; },
      complete: async () => ({ status: "success" }),
      fail: async () => {},
    },
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body);
      return new Response(JSON.stringify({
        id: "resp-chat", status: "completed",
        output_text: JSON.stringify({
          answer: "Ich kann einen passiven I2C-Scan vorbereiten.",
          profile_updates: { facts: [], capabilities: [], peripherals: [], pins: [{ function: "i2c_sda", gpio: 8, direction: "bus", source_url: "https://example.com/board", confidence: "documented" }], resolved_questions: ["I2C address"], open_questions: [] },
          next_step: "discovery", next_question: null, completed: true,
          suggested_actions: ["build_discovery_firmware"], proposed_tests: [{ id: "i2c-scan", title: "I2C-Scan", description: "Adressen lesen", risk: "passive", requires_confirmation: true }],
        }),
        usage: { input_tokens: 20, output_tokens: 30, total_tokens: 50 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const result = await ai.chat({ account_id: "acct-1", message: "Finde die I2C-Adresse", profile, source_urls: ["https://example.com/board"], assistant_state: { step: "pins", current_question: "Welche I2C-Pins sind dokumentiert?" } });

  assert.equal(request.store, false);
  assert.equal(request.text.format.name, "gernetix_hardware_lab_chat");
  assert.equal(request.text.format.schema.properties.profile, undefined);
  assert.equal(request.text.format.schema.properties.profile_updates.properties.pins.maxItems, 16);
  assert.equal(request.text.format.schema.properties.next_question.type.includes("null"), true);
  assert.equal(preflight.feature, "hardware_lab_conversation");
  assert.equal(result.profile_updates.pins[0].gpio, 8);
  assert.equal(result.profile_updates.pins[0].source_url, "https://example.com/board");
  assert.equal(result.completed, true);
  assert.equal(result.proposed_tests[0].requires_confirmation, true);
  assert.equal(JSON.stringify(request.input).includes("pin_candidates"), false);
  assert.equal(JSON.stringify(request.input).includes("Welche I2C-Pins sind dokumentiert?"), true);
});

test("hardware lab accepts the official OpenAI endpoint from an openai-compatible route", async () => {
  let requestUrl = "";
  const ai = new HardwareLabAi({
    llmConfigStore: { resolveRoute: () => ({ provider: "api", apiProvider: "openai-compatible", apiBaseUrl: "https://api.openai.com/v1", apiModel: "gpt-5.6-terra", apiKey: "test-key" }) },
    aiUsageClient: {
      preflight: async () => ({ allowed: true, event_id: "usage-compatible" }),
      complete: async () => ({ status: "success" }),
      fail: async () => {},
    },
    fetchImpl: async (url) => {
      requestUrl = url;
      return new Response(JSON.stringify({
        id: "resp-compatible",
        output_text: JSON.stringify({ answer: "Bereit.", profile_updates: { facts: [], capabilities: [], peripherals: [], pins: [], resolved_questions: [], open_questions: [] }, next_step: "identity", next_question: "Wie heißt das Board?", completed: false, suggested_actions: ["none"], proposed_tests: [] }),
        usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  const result = await ai.chat({ account_id: "acct-1", message: "Hallo", profile: {}, conversation: [] });
  assert.equal(requestUrl, "https://api.openai.com/v1/responses");
  assert.equal(result.answer, "Bereit.");
});

test("hardware lab chat preflight estimates exactly the compact current-step context", async () => {
  let request;
  let preflight;
  const conversation = Array.from({ length: 60 }, (_, index) => ({
    role: index % 2 ? "assistant" : "user",
    content: `${index.toString().padStart(2, "0")}:${"x".repeat(300)}`,
  }));
  const oversizedStoredProfile = {
    board_name: "Unbekanntes Testboard",
    pin_candidates: Array.from({ length: 200 }, (_, gpio) => ({ function: `candidate_${gpio}`, gpio, direction: "unknown", confidence: "inferred" })),
    evidence: Array.from({ length: 300 }, (_, index) => ({ property: `evidence_${index}`, value: `evidence-marker-${index}`, source_url: "https://example.com/board", confidence: "documented" })),
    integrated_peripherals: Array.from({ length: 100 }, (_, index) => ({ name: `Peripheral ${index}`, kind: "unknown", confidence: "inferred" })),
  };
  const ai = new HardwareLabAi({
    llmConfigStore: { resolveRoute: () => ({ provider: "api", apiProvider: "openai-responses", apiBaseUrl: "https://api.openai.test/v1", apiModel: "gpt-5.6-terra", apiKey: "test-key" }) },
    aiUsageClient: {
      preflight: async (payload) => { preflight = payload; return { allowed: true, event_id: "usage-bounded" }; },
      complete: async () => ({ status: "success" }),
      fail: async () => {},
    },
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body);
      return new Response(JSON.stringify({
        id: "resp-bounded",
        output_text: JSON.stringify({ answer: "Bereit.", profile_updates: { facts: [], capabilities: [], peripherals: [], pins: [], resolved_questions: [], open_questions: [] }, next_step: "identity", next_question: "Welches Board ist es?", completed: false, suggested_actions: ["none"], proposed_tests: [] }),
        usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  await ai.chat({ account_id: "acct-1", message: "Weiter", profile: oversizedStoredProfile, workflow: {}, conversation, assistant_state: { step: "identity", current_question: "Was steht auf dem Board?" } });

  const serializedInputLength = JSON.stringify(request.input).length;
  assert.equal(preflight.estimated_input_tokens, Math.max(500, Math.ceil(serializedInputLength / 4)));
  assert.equal(JSON.stringify(request.input).includes("00:"), false);
  assert.equal(JSON.stringify(request.input).includes("44:"), false);
  assert.equal(JSON.stringify(request.input).includes("59:"), false);
  assert.equal(JSON.stringify(request.input).includes("Was steht auf dem Board?"), true);
  assert.equal(JSON.stringify(request.input).includes("candidate_199"), false);
  assert.equal(JSON.stringify(request.input).includes("evidence-marker-299"), false);
  assert.ok(serializedInputLength < 5_000);
});
