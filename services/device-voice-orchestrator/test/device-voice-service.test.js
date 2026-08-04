const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DeviceVoiceService,
  DisabledVoiceProvider,
  EphemeralVoiceSessionRepository,
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
          voice_ai_policy: {
            enabled: true,
            consent_version: "parent-v1",
            age_band: "child_6_8",
            max_recording_seconds: 3,
            max_reply_seconds: 10,
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
          safety: { allowed: true },
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

test("creates an authenticated, account-bound, cost-approved ephemeral session", async () => {
  const { calls, repository, service } = fixture();
  const session = await service.createSession({
    account_id: "acct-parent",
    device_id: "device-speaker",
    challenge_id: "challenge-1",
    signature: "signature-1",
  });

  assert.match(session.session_token, /^[A-Za-z0-9_-]{40,}$/);
  assert.equal(session.maximum_audio_bytes, 96000);
  assert.equal(calls.authorize[0].payload.account_id, undefined);
  assert.equal(calls.preflight[0].feature, "device_voice_ai");
  const stored = repository.find(session.session_id);
  assert.notEqual(stored.token_sha256, session.session_token);
  assert.equal(stored.raw_audio_retention, "transient_only");
  assert.equal(stored.audio, undefined);
  assert.equal(stored.transcript, undefined);
});

test("processes bounded PCM once, bills usage and retains neither audio nor transcript", async () => {
  const { calls, repository, service } = fixture();
  const session = await service.createSession({
    account_id: "acct-parent",
    device_id: "device-speaker",
    challenge_id: "challenge-1",
    signature: "signature-1",
  });
  const inputAudio = Buffer.alloc(3200, 1);
  const result = await service.processAudio(session.session_id, session.session_token, inputAudio, INPUT_CONTENT_TYPE);

  assert.deepEqual(result.audio, Buffer.from([5, 6, 7, 8]));
  assert.equal(result.reply_text, undefined);
  assert.equal(repository.find(session.session_id), null);
  assert.equal(calls.provider[0].safety_profile, "gernetix_child_voice_v1");
  assert.equal(calls.complete[0].payload.input_tokens, 30);
  assert.equal(calls.fail.length, 0);
  await assert.rejects(
    service.processAudio(session.session_id, session.session_token, inputAudio, INPUT_CONTENT_TYPE),
    /abgelaufen/,
  );
});

test("rejects oversized, malformed and unauthenticated audio before provider processing", async () => {
  const { calls, service } = fixture();
  const first = await service.createSession({ account_id: "acct", device_id: "device", challenge_id: "c1", signature: "s1" });
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
  const session = await service.createSession({ account_id: "acct", device_id: "device", challenge_id: "c", signature: "s" });
  await assert.rejects(service.processAudio(session.session_id, session.session_token, Buffer.alloc(2), INPUT_CONTENT_TYPE), /sichere Antwort/);
  assert.equal(calls.complete.length, 0);
  assert.equal(calls.fail[0].payload.error_code, "voice_safety_response_missing");
});

test("rate-limits sessions per device before creating more AI Usage events", async () => {
  const { calls, service } = fixture({ deviceSessionsPerMinute: 2, accountSessionsPerHour: 20 });
  const input = { device_id: "device", challenge_id: "challenge", signature: "signature" };
  await service.createSession(input);
  await service.createSession(input);
  await assert.rejects(service.createSession(input), /Zu viele Voice-Sessions/);
  assert.equal(calls.preflight.length, 2);
});

test("closes the AI Usage event when an unused session expires", async () => {
  const { calls, repository, service } = fixture();
  const session = await service.createSession({ device_id: "device", challenge_id: "challenge", signature: "signature" });
  repository.save({ ...repository.find(session.session_id), expires_at: new Date(0).toISOString() });
  await assert.rejects(service.processAudio(session.session_id, session.session_token, Buffer.alloc(2), INPUT_CONTENT_TYPE), /abgelaufen/);
  assert.equal(repository.find(session.session_id), null);
  assert.equal(calls.fail[0].payload.error_code, "voice_session_expired");
});
