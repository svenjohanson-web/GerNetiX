const { OrchestratedVoiceProvider } = require("./orchestrated-voice-provider");

class AvailableFakeStage {
  isAvailable() { return true; }
}

class DeterministicFakeSpeechToText extends AvailableFakeStage {
  async transcribe() {
    return { text: "deterministic fake transcript", usage: { input_tokens: 4, output_tokens: 0 } };
  }
}

class DeterministicFakeLanguageModel extends AvailableFakeStage {
  async generate(input) {
    return {
      text: "deterministic fake reply",
      safety: { allowed: true, profile_id: input.policy.safety_profile_id },
      tool_calls: [],
      usage: { input_tokens: 6, output_tokens: 3 },
    };
  }
}

class DeterministicFakeTextToSpeech extends AvailableFakeStage {
  async synthesize() {
    return {
      audio: Buffer.from([0, 0, 1, 0, 0, 0, 255, 255]),
      content_type: "audio/L16;rate=16000;channels=1",
      usage: { input_tokens: 3, output_tokens: 0 },
    };
  }
}

class DeterministicFakeVoiceProvider extends OrchestratedVoiceProvider {
  constructor() {
    super({
      speechToText: new DeterministicFakeSpeechToText(),
      languageModel: new DeterministicFakeLanguageModel(),
      textToSpeech: new DeterministicFakeTextToSpeech(),
    });
  }
}

module.exports = {
  DeterministicFakeLanguageModel,
  DeterministicFakeSpeechToText,
  DeterministicFakeTextToSpeech,
  DeterministicFakeVoiceProvider,
};
