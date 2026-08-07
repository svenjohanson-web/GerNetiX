#include "nexi/waveshare_story_feedback.h"

#include <array>
#include <cstddef>
#include <cstdint>

#include "basissoftware/feedback.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nexi/hardware_platform.h"

namespace nexi {
namespace {
constexpr const char* kTag = "localStories";
constexpr size_t kInputSamplesPerChunk = 128;
constexpr size_t kUpsampleFactor = 2;
constexpr size_t kOutputChannels = 2;
}

void WaveshareStoryFeedback::showStorySelection(const LocalStoryPack& pack,
    const LocalStory& story, size_t storyNumber, size_t storyCount) {
  HardwarePlatform::instance().setStatusLeds(storyNumber, 8, 0, 20);
  feedbackInfo(kTag,
      "Story %u/%u: '%s' from '%s' v%u; KEY1 previous, KEY3 next, KEY2 plays",
      static_cast<unsigned>(storyNumber), static_cast<unsigned>(storyCount),
      story.title, pack.id, static_cast<unsigned>(pack.version));
}

void WaveshareStoryFeedback::storyStarted(const LocalStoryPack& pack,
    const LocalStory& story) {
  HardwarePlatform::instance().setStatusLeds(
      HardwarePlatform::STATUS_LED_COUNT, 8, 0, 20);
  feedbackInfo(kTag, "Playing local story '%s' from '%s' v%u",
      story.title, pack.id, static_cast<unsigned>(pack.version));
}

bool WaveshareStoryFeedback::playStory(const LocalStory& story) {
  if (story.sampleRateHz != 8000 || story.pcm8Samples == nullptr ||
      story.sampleCount == 0) {
    return false;
  }
  auto& hardware = HardwarePlatform::instance();
  if (hardware.setSpeakerAmplifier(true) != ESP_OK) return false;
  vTaskDelay(pdMS_TO_TICKS(20));

  std::array<int32_t, kInputSamplesPerChunk * kUpsampleFactor *
      kOutputChannels> output{};
  size_t consumed = 0;
  bool played = true;
  while (consumed < story.sampleCount) {
    const size_t inputCount = (story.sampleCount - consumed) <
            kInputSamplesPerChunk
        ? story.sampleCount - consumed : kInputSamplesPerChunk;
    for (size_t input = 0; input < inputCount; ++input) {
      const int32_t sample =
          static_cast<int32_t>(story.pcm8Samples[consumed + input]) *
          256 * 65536;
      for (size_t copy = 0; copy < kUpsampleFactor; ++copy) {
        const size_t frame = input * kUpsampleFactor + copy;
        output[frame * 2] = sample;
        output[frame * 2 + 1] = sample;
      }
    }
    const size_t bytes = inputCount * kUpsampleFactor * kOutputChannels *
        sizeof(output[0]);
    if (hardware.writeAudio(output.data(), bytes) != ESP_OK) {
      played = false;
      break;
    }
    consumed += inputCount;
  }
  output.fill(0);
  hardware.setSpeakerAmplifier(false);
  return played;
}

void WaveshareStoryFeedback::storyFinished(
    const LocalStory& story, bool played) {
  feedbackInfo(kTag, "Local story '%s' %s",
      story.title, played ? "finished" : "playback failed");
}

void WaveshareStoryFeedback::storyStopped() {
  HardwarePlatform::instance().setSpeakerAmplifier(false);
  HardwarePlatform::instance().setStatusLeds(1, 8, 0, 8);
  feedbackInfo(kTag, "Local stories stopped");
}

}  // namespace nexi
