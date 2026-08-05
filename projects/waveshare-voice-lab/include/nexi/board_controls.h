#pragma once

#include "esp_err.h"
#include "nexi/voice_types.h"

namespace nexi {

void showReadyEffect(VoiceEffect effect);
void showVolumeFeedback(const VolumeState &volume);
void showModeSelection(OperatingMode mode);
esp_err_t selectOperatingMode(OperatingMode *mode);
esp_err_t waitForUserAction(
    VoiceEffect *effect, VolumeState *volume, UserAction *action);

}  // namespace nexi
