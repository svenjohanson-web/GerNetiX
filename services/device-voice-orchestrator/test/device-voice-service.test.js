const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DeviceVoiceService,
  DeterministicFakeVoiceProvider,
  DisabledVoiceProvider,
  EphemeralVoiceSessionRepository,
  OrchestratedVoiceProvider,
} = require("../src");
const { INPUT_CONTENT_TYPE } = require("../src/services/device-voice-service");

function fixture(overrides = {}) {
  const repository = new EphemeralVoiceSessionRepository();
  const calls = { authorize: [], preflight: [], complete: [], fail: [], provider: [] };
  const service = new DeviceVoiceService({
    repository,
    model: "voice-test-model",
    sessionTtlSeconds: 120,
    maximumRecordingSeconds: 15,
    deviceManagementClient: {
      async authorizeVoiceSession(deviceId, payload) {
        calls.authorize.push({ deviceId, payload });
        return {
          authorized: true,
          account_id: "acct-parent",
          account_device_id: "account-device-1",
          device_id: deviceId,
          assistant_context: payload.assistant_context,
          assistant_policy: {
            locale: "de-DE",
            safety_profile_id: "platform.safe.general-v1",
            maximum_recording_seconds: 3,
            maximum_reply_seconds: 10,
            allowed_tool_ids: [],
            maximum_tool_calls: 0,
          },
          assistant_runtime: {
            system_instruction: "Antworte kurz und hilfreich.",
            mode_instruction: "Beantworte eine Wissensfrage.",
            provider_inputs: {
              speech_to_text: { model_class: "fast" },
              language_model: { model_class: "small" },
              text_to_speech: { voice_id: "warm" },
            },
          },
        };
      },
    },
    aiUsageClient: {
      async preflight(payload) {
        calls.preflight.push(payload);
        return { allowed: true, event_id: "usage-1" };
      },
      async complete(eventId, payload) {
        calls.complete.push({ eventId, payload });
        return { status: "success" };
      },
      async fail(eventId, payload) {
        calls.fail.push({ eventId, payload });
        return { status: "failed" };
      },
    },
    provider: {
      isAvailable: () => true,
      async process(input) {
        calls.provider.push(input);
        return {
          audio: Buffer.from([5, 6, 7, 8]),
          content_type: INPUT_CONTENT_TYPE,
          safety: { allowed: true, profile_id: input.policy.safety_profile_id },
          usage: { input_tokens: 30, output_tokens: 12 },
          transcript: "must never be persisted",
          reply_text: "must never be returned",
        };
      },
    },
    ...overrides,
  });
  return { calls, repository, service };
}

function sessionInput(overrides = {}) {
  return {
    device_id: "device-speaker",
    challenge_id: "challenge-1",
    signature: "signature-1",
    project_id: "project-nexi",
    project_commit: "abcdef1234567890",
    assistant_definition_id: "assistant-nexi",
    assistant_instance_id: "assistant-instance-1",
    mode_id: "knowledge",
    ...overrides,
  };
}

test("creates an authenticated, account-bound, cost-approved ephemeral session", async () => {
  const { calls, repository, service } = fixture();
  const session = await service.createSession(sessionInput({
    account_id: "acct-parent",
  }));

  assert.match(session.session_token, /^[A-Za-z0-9_-]{40,}$/);
  assert.equal(session.maximum_audio_bytes, 96000);
  assert.equal(calls.authorize[0].payload.account_id, undefined);
  assert.equal(calls.authorize[0].payload.assistant_context.project_id, "project-nexi");
  assert.equal(calls.preflight[0].feature, "device_voice_ai");
  assert.equal(calls.preflight[0].assistant_definition_id, "assistant-nexi");
  assert.equal(calls.preflight[0].source_revision, "abcdef1234567890");
  assert.equal(session.assistant_context.mode_id, "knowledge");
  const stored = repository.find(session.session_id);
  assert.notEqual(stored.token_sha256, session.session_token);
  assert.equal(stored.raw_audio_retention, "transient_only");
  assert.equal(stored.audio, undefined);
  assert.equal(stored.transcript, undefined);
});

test("processes bounded PCM once, bills usage and retains neither audio nor transcript", async () => {
  const { calls, repository, service } = fixture();
  const session = await service.createSession(sessionInput({ account_id: "acct-parent" }));
  const inputAudio = Buffer.alloc(3200, 1);
  const result = await service.processAudio(session.session_id, session.session_token, inputAudio, INPUT_CONTENT_TYPE);

  assert.deepEqual(result.audio, Buffer.from([5, 6, 7, 8]));
  assert.equal(result.reply_text, undefined);
  assert.equal(repository.find(session.session_id), null);
  assert.equal(calls.provider[0].policy.safety_profile_id, "platform.safe.general-v1");
  assert.equal(calls.provider[0].assistant.project_id, "project-nexi");
  assert.equal(calls.provider[0].assistant.mode_instruction, "Beantworte eine Wissensfrage.");
  assert.equal(calls.complete[0].payload.input_tokens, 30);
  assert.equal(calls.fail.length, 0);
  await assert.rejects(
    service.processAudio(session.session_id, session.session_token, inputAudio, INPUT_CONTENT_TYPE),
    /abgelaufen/,
  );
});

test("rejects oversized, malformed and unauthenticated audio before provider processing", async () => {
  const { calls, service } = fixture();
  const first = await service.createSession(sessionInput());
  await assert.rejects(service.processAudio(first.session_id, "wrong", Buffer.alloc(2), INPUT_CONTENT_TYPE), /ungueltig/);
  await assert.rejects(service.processAudio(first.session_id, first.session_token, Buffer.alloc(2), "audio/wav"), /Erwartet/);
  await assert.rejects(service.processAudio(first.session_id, first.session_token, Buffer.alloc(96001), INPUT_CONTENT_TYPE), /laenger/);
  assert.equal(calls.provider.length, 0);
});

test("reports a disabled provider without contacting device or AI Usage services", async () => {
  const { calls, service } = fixture({ provider: new DisabledVoiceProvider() });
  assert.equal(service.capabilities().available, false);
  await assert.rejects(service.createSession({}), /nicht konfiguriert/);
  assert.equal(calls.authorize.length, 0);
  assert.equal(calls.preflight.length, 0);
});

test("fails closed when the provider omits its safety decision", async () => {
  const { calls, service } = fixture({
    provider: {
      isAvailable: () => true,
      async process() { return { audio: Buffer.from([1]), usage: {} }; },
    },
  });
  const session = await service.createSession(sessionInput());
  await assert.rejects(service.processAudio(session.session_id, session.session_token, Buffer.alloc(2), INPUT_CONTENT_TYPE), /sichere Antwort/);
  assert.equal(calls.complete.length, 0);
  assert.equal(calls.fail[0].payload.error_code, "voice_safety_response_missing");
});

test("rate-limits sessions per device before creating more AI Usage events", async () => {
  const { calls, service } = fixture({ deviceSessionsPerMinute: 2, accountSessionsPerHour: 20 });
  const input = sessionInput();
  await service.createSession(input);
  await service.createSession(input);
  await assert.rejects(service.createSession(input), /Zu viele Voice-Sessions/);
  assert.equal(calls.preflight.length, 2);
});

test("closes the AI Usage event when an unused session expires", async () => {
  const { calls, repository, service } = fixture();
  const session = await service.createSession(sessionInput());
  repository.save({ ...repository.find(session.session_id), expires_at: new Date(0).toISOString() });
  await assert.rejects(service.processAudio(session.session_id, session.session_token, Buffer.alloc(2), INPUT_CONTENT_TYPE), /abgelaufen/);
  assert.equal(repository.find(session.session_id), null);
  assert.equal(calls.fail[0].payload.error_code, "voice_session_expired");
});

test("requires one immutable revision and an exact Device Management assistant binding", async () => {
  const { calls, service } = fixture();
  await assert.rejects(service.createSession(sessionInput({ project_commit: null })), /Genau eine Revision/);
  await assert.rejects(service.createSession(sessionInput({ assistant_revision: "assistant-r2" })), /Genau eine Revision/);
  assert.equal(calls.authorize.length, 0);
  const revisionSession = await service.createSession(sessionInput({ project_commit: null, assistant_revision: "assistant-r2" }));
  assert.equal(revisionSession.assistant_context.assistant_revision, "assistant-r2");
  assert.equal(revisionSession.assistant_context.project_commit, null);

  const mismatch = fixture({
    deviceManagementClient: {
      async authorizeVoiceSession(deviceId, payload) {
        return {
          authorized: true,
          account_id: "acct",
          device_id: deviceId,
          assistant_context: { ...payload.assistant_context, mode_id: "another-mode" },
          assistant_policy: {},
          assistant_runtime: {},
        };
      },
    },
  });
  await assert.rejects(mismatch.service.createSession(sessionInput()), /bindung stimmt nicht/i);
});

test("rejects missing or malformed server-side assistant policy before AI Usage", async () => {
  const missing = fixture({
    deviceManagementClient: {
      async authorizeVoiceSession(deviceId, payload) {
        return { authorized: true, account_id: "acct", device_id: deviceId, assistant_context: payload.assistant_context };
      },
    },
  });
  await assert.rejects(missing.service.createSession(sessionInput()), /Policy fehlt/);
  assert.equal(missing.calls.preflight.length, 0);
});

test("deterministic fake provider exercises the provider-neutral STT LLM TTS contract", async () => {
  const { calls, service } = fixture({ provider: new DeterministicFakeVoiceProvider() });
  assert.equal(service.capabilities().provider_contract, "stt_llm_tools_tts_v1");
  const session = await service.createSession(sessionInput());
  const result = await service.processAudio(session.session_id, session.session_token, Buffer.alloc(32), INPUT_CONTENT_TYPE);
  assert.deepEqual(result.audio, Buffer.from([0, 0, 1, 0, 0, 0, 255, 255]));
  assert.deepEqual(calls.complete[0].payload, { input_tokens: 13, output_tokens: 3 });
});

test("orchestrated provider executes only policy-allowed tools and permits one bounded tool round", async () => {
  const calls = [];
  const provider = new OrchestratedVoiceProvider({
    speechToText: { isAvailable: () => true, async transcribe() { return { text: "weather" }; } },
    languageModel: {
      isAvailable: () => true,
      async generate(input) {
        calls.push(input);
        if (input.tool_results.length === 0) {
          return { text: "pending", safety: { allowed: true, profile_id: input.policy.safety_profile_id }, usage: { input_tokens: 2, output_tokens: 1 }, tool_calls: [{ call_id: "1", tool_id: "weather", arguments: { city: "Berlin" } }] };
        }
        return { text: "sunny", safety: { allowed: true, profile_id: input.policy.safety_profile_id }, usage: { input_tokens: 3, output_tokens: 2 }, tool_calls: [] };
      },
    },
    textToSpeech: { isAvailable: () => true, async synthesize() { return { audio: Buffer.from([1]) }; } },
    tools: { weather: { async execute() { return { condition: "sunny" }; } } },
  });
  const result = await provider.process({
    audio: Buffer.from([1]),
    content_type: INPUT_CONTENT_TYPE,
    assistant: { project_id: "p" },
    policy: { locale: "de-DE", safety_profile_id: "safe-v1", maximum_reply_seconds: 10, allowed_tool_ids: ["weather"], maximum_tool_calls: 1 },
    provider_inputs: { speech_to_text: {}, language_model: {}, text_to_speech: {} },
  });
  assert.deepEqual(result.audio, Buffer.from([1]));
  assert.deepEqual(result.usage, { input_tokens: 5, output_tokens: 3 });
  assert.equal(calls[1].tool_results[0].result.condition, "sunny");

  await assert.rejects(provider.process({
    audio: Buffer.from([1]),
    content_type: INPUT_CONTENT_TYPE,
    assistant: { project_id: "p" },
    policy: { locale: "de-DE", safety_profile_id: "safe-v1", maximum_reply_seconds: 10, allowed_tool_ids: [], maximum_tool_calls: 1 },
    provider_inputs: { speech_to_text: {}, language_model: {}, text_to_speech: {} },
  }), /nicht freigegebenes Werkzeug/);
});
