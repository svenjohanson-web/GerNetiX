#include "nexi/service_button_input.h"

#include "nexi/hardware_platform.h"

namespace nexi {
namespace {
constexpr uint8_t DEBOUNCE_CHECKS = 3;
constexpr uint16_t LONG_PRESS_CHECKS = 50;
}

ServiceButtonInput::ServiceButtonInput()
    : record_{false, false, 0, 0},
      effect_{false, false, 0, 0},
      volume_{false, false, 0, 0} {
}

bool ServiceButtonInput::poll(Intent *intent) {
  if (intent == nullptr) return false;

  auto &hardware = HardwarePlatform::instance();
  bool recordSample = false;
  bool effectSample = false;
  bool volumeSample = false;
  if (hardware.readButtonPressed(BoardButton::Record, &recordSample) != ESP_OK
      || hardware.readButtonPressed(BoardButton::Effect, &effectSample) != ESP_OK
      || hardware.readButtonPressed(BoardButton::Volume, &volumeSample) != ESP_OK) {
    return false;
  }

  const Edge recordEdge = update(&record_, recordSample);
  const Edge effectEdge = update(&effect_, effectSample);
  const uint16_t effectHeld = effect_.heldChecks;
  const Edge volumeEdge = update(&volume_, volumeSample);
  const uint16_t volumeHeld = volume_.heldChecks;

  if (recordEdge == Edge::Pressed) {
    *intent = Intent::create(IntentType::Record, IntentSource::ServiceButton);
    return true;
  }
  if (effectEdge == Edge::Released) {
    *intent = Intent::create(
        effectHeld >= LONG_PRESS_CHECKS
            ? IntentType::StopApplication
            : IntentType::NextEffect,
        IntentSource::ServiceButton);
    return true;
  }
  if (volumeEdge == Edge::Released) {
    *intent = Intent::create(
        volumeHeld >= LONG_PRESS_CHECKS
            ? IntentType::ToggleMute
            : IntentType::AdjustVolume,
        IntentSource::ServiceButton,
        1);
    return true;
  }
  return false;
}

ServiceButtonInput::Edge ServiceButtonInput::update(
    ButtonState *state, bool sampled) {
  if (state == nullptr) return Edge::None;
  if (sampled == state->sampled) {
    if (state->stableChecks < DEBOUNCE_CHECKS) state->stableChecks++;
  } else {
    state->sampled = sampled;
    state->stableChecks = 1;
  }

  if (state->stableChecks < DEBOUNCE_CHECKS || state->stable == sampled) {
    if (state->stable && state->heldChecks < UINT16_MAX) state->heldChecks++;
    return Edge::None;
  }

  state->stable = sampled;
  if (sampled) {
    state->heldChecks = 0;
    return Edge::Pressed;
  }
  return Edge::Released;
}

}  // namespace nexi
