const { DeviceVoiceError } = require("../errors");

class OrchestratedVoiceProvider {
  constructor(options = {}) {
    this.speechToText = options.speechToText;
    this.languageModel = options.languageModel;
    this.textToSpeech = options.textToSpeech;
    this.tools = new Map(Object.entries(options.tools || {}));
  }

  isAvailable() {
    return [this.speechToText, this.languageModel, this.textToSpeech]
      .every((provider) => provider && provider.isAvailable() === true);
  }

  describe() {
    return {
      contract: "stt_llm_tools_tts_v1",
      stages: ["speech_to_text", "language_model", "tools", "text_to_speech"],
    };
  }

  async process(input) {
    if (!this.isAvailable()) {
      throw new DeviceVoiceError("voice_provider_disabled", "Der GerNetiX Voice-Provider ist nicht konfiguriert.", 503);
    }

    const transcription = await this.speechToText.transcribe({
      audio: input.audio,
      content_type: input.content_type,
      locale: input.policy.locale,
      provider_parameters: input.provider_inputs.speech_to_text,
    });
    const transcript = nonEmptyText(transcription?.text, "voice_transcript_missing");
    let completion = await this.languageModel.generate({
      transcript,
      assistant: input.assistant,
      policy: input.policy,
      provider_parameters: input.provider_inputs.language_model,
      tool_results: [],
    });
    requireSafeCompletion(completion, input.policy.safety_profile_id);
    const languageModelUsage = [completion?.usage];

    const toolCalls = Array.isArray(completion.tool_calls) ? completion.tool_calls : [];
    if (toolCalls.length > input.policy.maximum_tool_calls) {
      throw new DeviceVoiceError("voice_tool_limit_exceeded", "Der Assistent hat zu viele Werkzeugaufrufe angefordert.", 502);
    }
    if (toolCalls.length > 0) {
      const toolResults = [];
      for (const call of toolCalls) {
        const toolId = String(call?.tool_id || "").trim();
        if (!input.policy.allowed_tool_ids.includes(toolId) || !this.tools.has(toolId)) {
          throw new DeviceVoiceError("voice_tool_not_allowed", "Der Assistent hat ein nicht freigegebenes Werkzeug angefordert.", 502);
        }
        toolResults.push({
          call_id: String(call.call_id || "").trim(),
          tool_id: toolId,
          result: await this.tools.get(toolId).execute({
            arguments: jsonObject(call.arguments),
            assistant: input.assistant,
            policy: input.policy,
          }),
        });
      }
      completion = await this.languageModel.generate({
        transcript,
        assistant: input.assistant,
        policy: input.policy,
        provider_parameters: input.provider_inputs.language_model,
        tool_results: toolResults,
      });
      requireSafeCompletion(completion, input.policy.safety_profile_id);
      languageModelUsage.push(completion?.usage);
      if (Array.isArray(completion.tool_calls) && completion.tool_calls.length > 0) {
        throw new DeviceVoiceError("voice_tool_round_limit_exceeded", "Weitere Werkzeugrunden sind nicht freigegeben.", 502);
      }
    }

    const replyText = nonEmptyText(completion.text, "voice_reply_text_missing");
    const synthesis = await this.textToSpeech.synthesize({
      text: replyText,
      locale: input.policy.locale,
      maximum_reply_seconds: input.policy.maximum_reply_seconds,
      provider_parameters: input.provider_inputs.text_to_speech,
    });
    return {
      audio: synthesis?.audio,
      content_type: synthesis?.content_type,
      safety: completion.safety,
      usage: sumUsage(transcription?.usage, ...languageModelUsage, synthesis?.usage),
    };
  }
}

function requireSafeCompletion(completion, safetyProfileId) {
  if (!completion?.safety
    || completion.safety.allowed !== true
    || completion.safety.profile_id !== safetyProfileId) {
    throw new DeviceVoiceError("voice_safety_response_missing", "Der Voice-Provider lieferte keine sichere Antwort.", 502);
  }
}

function nonEmptyText(value, code) {
  const text = String(value || "").trim();
  if (!text) throw new DeviceVoiceError(code, "Eine erforderliche Provider-Antwort fehlt.", 502);
  return text;
}

function jsonObject(value) {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new DeviceVoiceError("voice_tool_arguments_invalid", "Werkzeugargumente muessen ein JSON-Objekt sein.", 502);
  }
  return value;
}

function sumUsage(...values) {
  return values.reduce((sum, value) => ({
    input_tokens: sum.input_tokens + finiteNumber(value?.input_tokens),
    output_tokens: sum.output_tokens + finiteNumber(value?.output_tokens),
  }), { input_tokens: 0, output_tokens: 0 });
}

function finiteNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

module.exports = { OrchestratedVoiceProvider };
