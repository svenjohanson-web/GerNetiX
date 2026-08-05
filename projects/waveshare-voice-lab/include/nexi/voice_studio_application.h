#pragma once

#include <cstddef>
#include <cstdint>

#include "nexi/application.h"
#include "nexi/audio_engine.h"
#include "nexi/capability_policy.h"
#include "nexi/privacy_gate.h"

namespace nexi {

class VoiceStudioApplication final : public Application {
 public:
  VoiceStudioApplication(int16_t *recording, size_t capacityBytes,
      const CapabilityPolicy &policy, PrivacyGate &privacy);

  ApplicationId id() const override;
  bool start(const Intent &trigger) override;
  void stop(ApplicationStopReason reason) override;
  void handleIntent(const Intent &intent) override;
  void tick() override;

 private:
  void selectEffect(VoiceEffect effect);
  void recordAndPlay();
  void playRetained();
  void changeVolume(int32_t steps);

  int16_t *recording_;
  size_t capacityBytes_;
  const CapabilityPolicy &policy_;
  PrivacyGate &privacy_;
  AudioEngine audio_;
  VoiceEffect effect_;
  VolumeState volume_;
  RecordingLevel retainedLevel_;
  size_t retainedFrames_;
  bool running_;
};

}  // namespace nexi
