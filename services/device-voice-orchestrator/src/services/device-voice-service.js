const crypto = require("node:crypto");
const { DeviceVoiceError } = require("../errors");

const SAMPLE_RATE = 16000;
const BYTES_PER_SAMPLE = 2;
const CHANNELS = 1;
const INPUT_CONTENT_TYPE = "audio/L16;rate=16000;channels=1";

class DeviceVoiceService {
  constructor(options) {
    this.repository = options.repository;
    this.deviceManagementClient = options.deviceManagementClient;
    this.aiUsageClient = options.aiUsageClient;
    this.provider = options.provider;
    this.model = options.model;
    this.sessionTtlSeconds = options.sessionTtlSeconds || 120;
    this.maximumRecordingSeconds = Math.min(options.maximumRecordingSeconds || 15, 15);
    this.deviceSessionsPerMinute = options.deviceSessionsPerMinute || 6;
    this.accountSessionsPerHour = options.accountSessionsPerHour || 30;
    this.rateWindows = new Map();
  }

  capabilities() {
    return {
      service: "device-voice-orchestrator",
      available: this.provider.isAvailable(),
      input_content_type: INPUT_CONTENT_TYPE,
      sample_rate_hz: SAMPLE_RATE,
      channels: CHANNELS,
      maximum_recording_seconds: this.maximumRecordingSeconds,
      raw_audio_retention: "transient_only",
      transcript_retention: "disabled",
    };
  }

  async createSession(input = {}) {
    await this.failExpiredSessions();
    if (!this.provider.isAvailable()) {
      throw new DeviceVoiceError("voice_provider_disabled", "Der GerNetiX Voice-Provider ist nicht konfiguriert.", 503);
    }
    const deviceId = required(input.device_id, "device_id");
    const authorization = await this.deviceManagementClient.authorizeVoiceSession(deviceId, {
      challenge_id: required(input.challenge_id, "challenge_id"),
      signature: required(input.signature, "signature"),
    });
    const accountId = String(authorization.account_id || "").trim();
    if (!authorization.authorized || !accountId || authorization.device_id !== deviceId) {
      throw new DeviceVoiceError("voice_device_not_authorized", "Das Device ist fuer Voice AI nicht autorisiert.", 403);
    }
    this.enforceRateLimit(`device:${deviceId}`, this.deviceSessionsPerMinute, 60 * 1000);
    this.enforceRateLimit(`account:${accountId}`, this.accountSessionsPerHour, 60 * 60 * 1000);

    const policy = authorization.voice_ai_policy || {};
    const recordingSeconds = Math.min(
      positiveInteger(policy.max_recording_seconds || this.maximumRecordingSeconds, "max_recording_seconds"),
      this.maximumRecordingSeconds,
    );
    const preflight = await this.aiUsageClient.preflight({
      account_id: accountId,
      user_id: accountId,
      feature: "device_voice_ai",
      model: this.model,
      estimated_input_tokens: 800,
      estimated_output_tokens: 160,
      source_id: deviceId,
      system_capabilities: ["system_capability.ai_usage_audit_trail"],
    });
    if (!preflight.allowed) {
      throw new DeviceVoiceError(
        "voice_usage_not_allowed",
        "Das KI-Kontingent erlaubt derzeit keine Voice-Session.",
        402,
        { rejection_reason: preflight.rejection_reason, protection_action: preflight.protection_action },
      );
    }

    const now = Date.now();
    const sessionToken = crypto.randomBytes(32).toString("base64url");
    const session = this.repository.save({
      session_id: `voice_${crypto.randomUUID()}`,
      account_id: accountId,
      device_id: deviceId,
      account_device_id: authorization.account_device_id,
      status: "awaiting_audio",
      token_sha256: sha256(sessionToken),
      usage_event_id: preflight.event_id,
      age_band: policy.age_band || "child_6_12",
      max_recording_seconds: recordingSeconds,
      max_reply_seconds: Math.min(positiveInteger(policy.max_reply_seconds || 20, "max_reply_seconds"), 30),
      created_at: new Date(now).toISOString(),
      expires_at: new Date(now + this.sessionTtlSeconds * 1000).toISOString(),
      raw_audio_retention: "transient_only",
      transcript_retention: "disabled",
    });
    return {
      session_id: session.session_id,
      session_token: sessionToken,
      status: session.status,
      expires_at: session.expires_at,
      input_content_type: INPUT_CONTENT_TYPE,
      maximum_audio_bytes: maximumAudioBytes(recordingSeconds),
    };
  }

  enforceRateLimit(key, limit, windowMs, now = Date.now()) {
    const cutoff = now - windowMs;
    const recent = (this.rateWindows.get(key) || []).filter((timestamp) => timestamp > cutoff);
    if (recent.length >= limit) {
      this.rateWindows.set(key, recent);
      throw new DeviceVoiceError("voice_rate_limit_exceeded", "Zu viele Voice-Sessions. Bitte spaeter erneut versuchen.", 429);
    }
    recent.push(now);
    this.rateWindows.set(key, recent);
  }

  async failExpiredSessions() {
    const expired = this.repository.purgeExpired();
    await Promise.all(expired.map((session) => this.aiUsageClient.fail(session.usage_event_id, {
      error_code: "voice_session_expired",
      error_message: "Voice-Session ohne Audio abgelaufen.",
    }).catch(() => {})));
  }

  async processAudio(sessionId, token, audio, contentType) {
    const session = this.repository.find(required(sessionId, "session_id"));
    if (!session || Date.parse(session.expires_at) <= Date.now()) {
      if (session) {
        this.repository.delete(session.session_id);
        await this.aiUsageClient.fail(session.usage_event_id, {
          error_code: "voice_session_expired",
          error_message: "Voice-Session ohne Audio abgelaufen.",
        }).catch(() => {});
      }
      throw new DeviceVoiceError("voice_session_expired", "Die Voice-Session ist abgelaufen.", 410);
    }
    if (!safeEqual(session.token_sha256, sha256(required(token, "session_token")))) {
      throw new DeviceVoiceError("voice_session_token_invalid", "Der Voice-Session-Token ist ungueltig.", 403);
    }
    if (!isSupportedContentType(contentType)) {
      throw new DeviceVoiceError("voice_audio_format_unsupported", `Erwartet wird ${INPUT_CONTENT_TYPE}.`, 415);
    }
    if (!Buffer.isBuffer(audio) || audio.length === 0) {
      throw new DeviceVoiceError("voice_audio_empty", "Die Sprachaufnahme ist leer.", 400);
    }
    if (audio.length > maximumAudioBytes(session.max_recording_seconds)) {
      throw new DeviceVoiceError("voice_audio_too_large", "Die Sprachaufnahme ist laenger als erlaubt.", 413);
    }

    this.repository.delete(session.session_id);
    try {
      const result = await this.provider.process({
        audio,
        content_type: INPUT_CONTENT_TYPE,
        age_band: session.age_band,
        max_reply_seconds: session.max_reply_seconds,
        locale: "de-DE",
        safety_profile: "gernetix_child_voice_v1",
      });
      if (!result?.safety || result.safety.allowed !== true) {
        throw new DeviceVoiceError("voice_safety_response_missing", "Der Voice-Provider lieferte keine sichere Antwort.", 502);
      }
      if (!Buffer.isBuffer(result.audio) || result.audio.length === 0) {
        throw new DeviceVoiceError("voice_provider_audio_missing", "Der Voice-Provider lieferte keine Audioantwort.", 502);
      }
      await this.aiUsageClient.complete(session.usage_event_id, {
        input_tokens: Number(result.usage?.input_tokens || 0),
        output_tokens: Number(result.usage?.output_tokens || 0),
      });
      return {
        audio: result.audio,
        content_type: result.content_type || INPUT_CONTENT_TYPE,
        session_status: "completed",
      };
    } catch (error) {
      await this.aiUsageClient.fail(session.usage_event_id, {
        error_code: error.code || "voice_provider_error",
        error_message: "Voice-Verarbeitung fehlgeschlagen.",
      }).catch(() => {});
      throw error;
    }
  }
}

function maximumAudioBytes(seconds) {
  return seconds * SAMPLE_RATE * BYTES_PER_SAMPLE * CHANNELS;
}

function isSupportedContentType(value) {
  const normalized = String(value || "").toLowerCase().replace(/\s+/g, "");
  return normalized === INPUT_CONTENT_TYPE.toLowerCase();
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function positiveInteger(value, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new DeviceVoiceError("invalid_voice_limit", `Ungueltige Grenze: ${field}.`);
  return number;
}

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new DeviceVoiceError("missing_required_field", `Pflichtfeld fehlt: ${field}.`);
  return normalized;
}

module.exports = { DeviceVoiceService, INPUT_CONTENT_TYPE, maximumAudioBytes };
