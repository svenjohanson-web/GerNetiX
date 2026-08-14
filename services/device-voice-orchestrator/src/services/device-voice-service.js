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
      provider_contract: this.provider.describe?.().contract || "voice_process_v1",
      assistant_context_binding: "device_management_authoritative",
    };
  }

  async createSession(input = {}) {
    await this.failExpiredSessions();
    if (!this.provider.isAvailable()) {
      throw new DeviceVoiceError("voice_provider_disabled", "Der GerNetiX Voice-Provider ist nicht konfiguriert.", 503);
    }
    const deviceId = identifier(input.device_id, "device_id");
    const requestedContext = requestedAssistantContext(input);
    const authorization = await this.deviceManagementClient.authorizeVoiceSession(deviceId, {
      challenge_id: required(input.challenge_id, "challenge_id"),
      signature: required(input.signature, "signature"),
      assistant_context: requestedContext,
    });
    const accountId = String(authorization.account_id || "").trim();
    if (!authorization.authorized || !accountId || authorization.device_id !== deviceId) {
      throw new DeviceVoiceError("voice_device_not_authorized", "Das Device ist fuer Voice AI nicht autorisiert.", 403);
    }
    const assistantContext = authorizedAssistantContext(authorization.assistant_context, requestedContext);
    const policy = validatedAssistantPolicy(authorization.assistant_policy, this.maximumRecordingSeconds);
    const runtime = validatedAssistantRuntime(authorization.assistant_runtime);
    const internalAuthContext = {
      account_id: accountId,
      project_ids: [assistantContext.project_id],
      entitlements: ["ai_assistant"],
    };
    this.enforceRateLimit(`device:${deviceId}`, this.deviceSessionsPerMinute, 60 * 1000);
    this.enforceRateLimit(`account:${accountId}`, this.accountSessionsPerHour, 60 * 60 * 1000);

    const preflight = await this.aiUsageClient.preflight({
      account_id: accountId,
      user_id: accountId,
      feature: "device_voice_ai",
      model: this.model,
      estimated_input_tokens: 800,
      estimated_output_tokens: 160,
      source_id: deviceId,
      project_id: assistantContext.project_id,
      assistant_definition_id: assistantContext.assistant_definition_id,
      assistant_instance_id: assistantContext.assistant_instance_id,
      mode_id: assistantContext.mode_id,
      source_revision: assistantContext.project_commit || assistantContext.assistant_revision,
      system_capabilities: ["system_capability.ai_usage_audit_trail"],
    }, internalAuthContext);
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
      internal_auth_context: internalAuthContext,
      assistant_context: assistantContext,
      assistant_policy: policy,
      assistant_runtime: runtime,
      max_recording_seconds: policy.maximum_recording_seconds,
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
      maximum_audio_bytes: maximumAudioBytes(policy.maximum_recording_seconds),
      assistant_context: assistantContext,
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
    }, session.internal_auth_context).catch(() => {})));
  }

  async processAudio(sessionId, token, audio, contentType) {
    const session = this.repository.find(required(sessionId, "session_id"));
    if (!session || Date.parse(session.expires_at) <= Date.now()) {
      if (session) {
        this.repository.delete(session.session_id);
        await this.aiUsageClient.fail(session.usage_event_id, {
          error_code: "voice_session_expired",
          error_message: "Voice-Session ohne Audio abgelaufen.",
        }, session.internal_auth_context).catch(() => {});
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
        assistant: {
          ...session.assistant_context,
          system_instruction: session.assistant_runtime.system_instruction,
          mode_instruction: session.assistant_runtime.mode_instruction,
        },
        policy: session.assistant_policy,
        provider_inputs: session.assistant_runtime.provider_inputs,
      });
      if (!result?.safety
        || result.safety.allowed !== true
        || result.safety.profile_id !== session.assistant_policy.safety_profile_id) {
        throw new DeviceVoiceError("voice_safety_response_missing", "Der Voice-Provider lieferte keine sichere Antwort.", 502);
      }
      if (!Buffer.isBuffer(result.audio) || result.audio.length === 0) {
        throw new DeviceVoiceError("voice_provider_audio_missing", "Der Voice-Provider lieferte keine Audioantwort.", 502);
      }
      if (!isSupportedContentType(result.content_type || INPUT_CONTENT_TYPE)) {
        throw new DeviceVoiceError("voice_provider_audio_format_unsupported", "Der Voice-Provider lieferte ein nicht unterstuetztes Audioformat.", 502);
      }
      if (result.audio.length > maximumAudioBytes(session.assistant_policy.maximum_reply_seconds)) {
        throw new DeviceVoiceError("voice_provider_audio_too_large", "Die Audioantwort ist laenger als erlaubt.", 502);
      }
      await this.aiUsageClient.complete(session.usage_event_id, {
        input_tokens: Number(result.usage?.input_tokens || 0),
        output_tokens: Number(result.usage?.output_tokens || 0),
      }, session.internal_auth_context);
      return {
        audio: result.audio,
        content_type: INPUT_CONTENT_TYPE,
        session_status: "completed",
      };
    } catch (error) {
      await this.aiUsageClient.fail(session.usage_event_id, {
        error_code: error.code || "voice_provider_error",
        error_message: "Voice-Verarbeitung fehlgeschlagen.",
      }, session.internal_auth_context).catch(() => {});
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

function requestedAssistantContext(input) {
  const projectCommit = optionalRevision(input.project_commit, "project_commit");
  const assistantRevision = optionalRevision(input.assistant_revision, "assistant_revision");
  if ((projectCommit ? 1 : 0) + (assistantRevision ? 1 : 0) !== 1) {
    throw new DeviceVoiceError(
      "voice_revision_ambiguous",
      "Genau eine Revision muss angegeben werden: project_commit oder assistant_revision.",
      400,
    );
  }
  return {
    project_id: identifier(input.project_id, "project_id"),
    project_commit: projectCommit,
    assistant_revision: assistantRevision,
    assistant_definition_id: identifier(input.assistant_definition_id, "assistant_definition_id"),
    assistant_instance_id: identifier(input.assistant_instance_id, "assistant_instance_id"),
    mode_id: identifier(input.mode_id, "mode_id"),
  };
}

function authorizedAssistantContext(value, requested) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DeviceVoiceError("voice_assistant_not_authorized", "Die Assistentenbindung wurde nicht bestaetigt.", 403);
  }
  const authorized = requestedAssistantContext(value);
  for (const field of Object.keys(requested)) {
    if (authorized[field] !== requested[field]) {
      throw new DeviceVoiceError("voice_assistant_binding_mismatch", "Die bestaetigte Assistentenbindung stimmt nicht ueberein.", 403);
    }
  }
  return authorized;
}

function validatedAssistantPolicy(value, platformMaximumRecordingSeconds) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DeviceVoiceError("voice_assistant_policy_missing", "Die Assistenten-Policy fehlt.", 403);
  }
  const locale = limitedText(value.locale, "locale", 35);
  if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale)) {
    throw new DeviceVoiceError("invalid_assistant_policy", "Ungueltige Assistenten-Policy: locale.", 400);
  }
  const safetyProfileId = identifier(value.safety_profile_id, "safety_profile_id");
  const maximumRecordingSeconds = Math.min(
    positiveInteger(value.maximum_recording_seconds, "maximum_recording_seconds"),
    platformMaximumRecordingSeconds,
  );
  const maximumReplySeconds = Math.min(positiveInteger(value.maximum_reply_seconds, "maximum_reply_seconds"), 30);
  const allowedToolIds = uniqueIdentifiers(value.allowed_tool_ids || [], "allowed_tool_ids", 16);
  const maximumToolCalls = nonNegativeInteger(value.maximum_tool_calls ?? 0, "maximum_tool_calls", 4);
  if (maximumToolCalls > allowedToolIds.length) {
    throw new DeviceVoiceError("invalid_assistant_policy", "Werkzeuggrenze und Freigabeliste passen nicht zusammen.", 400);
  }
  return {
    locale,
    safety_profile_id: safetyProfileId,
    maximum_recording_seconds: maximumRecordingSeconds,
    maximum_reply_seconds: maximumReplySeconds,
    allowed_tool_ids: allowedToolIds,
    maximum_tool_calls: maximumToolCalls,
  };
}

function validatedAssistantRuntime(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DeviceVoiceError("voice_assistant_runtime_missing", "Die aufgeloeste Assistentendefinition fehlt.", 403);
  }
  return {
    system_instruction: limitedText(value.system_instruction, "system_instruction", 12000),
    mode_instruction: optionalLimitedText(value.mode_instruction, "mode_instruction", 4000),
    provider_inputs: validatedProviderInputs(value.provider_inputs),
  };
}

function validatedProviderInputs(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DeviceVoiceError("invalid_provider_inputs", "Provider-Eingaben muessen ein JSON-Objekt sein.", 400);
  }
  const result = {};
  for (const stage of ["speech_to_text", "language_model", "text_to_speech"]) {
    const parameters = value[stage] ?? {};
    if (!isPlainJsonObject(parameters) || Buffer.byteLength(JSON.stringify(parameters), "utf8") > 8192) {
      throw new DeviceVoiceError("invalid_provider_inputs", `Ungueltige Provider-Eingaben: ${stage}.`, 400);
    }
    result[stage] = JSON.parse(JSON.stringify(parameters));
  }
  return result;
}

function isPlainJsonObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  try {
    const encoded = JSON.stringify(value);
    return encoded !== undefined && !containsUnsafeJsonKey(value) && JSON.parse(encoded) !== undefined;
  } catch {
    return false;
  }
}

function containsUnsafeJsonKey(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsUnsafeJsonKey);
  return Object.keys(value).some((key) => ["__proto__", "prototype", "constructor"].includes(key)
    || containsUnsafeJsonKey(value[key]));
}

function uniqueIdentifiers(value, field, maximumItems) {
  if (!Array.isArray(value) || value.length > maximumItems) {
    throw new DeviceVoiceError("invalid_assistant_policy", `Ungueltige Assistenten-Policy: ${field}.`, 400);
  }
  return [...new Set(value.map((item) => identifier(item, field)))];
}

function nonNegativeInteger(value, field, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > maximum) {
    throw new DeviceVoiceError("invalid_voice_limit", `Ungueltige Grenze: ${field}.`, 400);
  }
  return number;
}

function identifier(value, field) {
  const normalized = required(value, field);
  if (normalized.length > 160 || !/^[A-Za-z0-9][A-Za-z0-9._:@/-]*$/.test(normalized)) {
    throw new DeviceVoiceError("invalid_identifier", `Ungueltiger Bezeichner: ${field}.`, 400);
  }
  return normalized;
}

function optionalRevision(value, field) {
  if (value === undefined || value === null || value === "") return null;
  return identifier(value, field);
}

function limitedText(value, field, maximumLength) {
  const normalized = required(value, field);
  if (normalized.length > maximumLength) {
    throw new DeviceVoiceError("invalid_assistant_runtime", `Feld ist zu lang: ${field}.`, 400);
  }
  return normalized;
}

function optionalLimitedText(value, field, maximumLength) {
  if (value === undefined || value === null || value === "") return "";
  return limitedText(value, field, maximumLength);
}

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new DeviceVoiceError("missing_required_field", `Pflichtfeld fehlt: ${field}.`);
  return normalized;
}

module.exports = { DeviceVoiceService, INPUT_CONTENT_TYPE, maximumAudioBytes };
