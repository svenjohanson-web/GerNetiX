#pragma once

#include <cstdint>

namespace nexi {

// Plays a short generated square-wave cue through the already initialized
// local codec. It does not load content, allocate memory or access a network.
void playLocalTone(uint16_t frequencyHz, uint16_t durationMs);

}  // namespace nexi
