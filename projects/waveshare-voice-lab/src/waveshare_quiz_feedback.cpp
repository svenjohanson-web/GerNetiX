#include "nexi/waveshare_quiz_feedback.h"

#include "basissoftware/feedback.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nexi/hardware_platform.h"
#include "nexi/local_tone_output.h"

namespace nexi {
namespace {
constexpr const char* kTag = "localQuiz";

const char* answerName(QuizAnswer answer) {
  switch (answer) {
    case QuizAnswer::Left: return "KEY1 left";
    case QuizAnswer::Middle: return "KEY2 middle";
    case QuizAnswer::Right: return "KEY3 right";
    default: return "timeout";
  }
}
}  // namespace

void WaveshareQuizFeedback::showPackSelection(const LocalQuizPack& pack,
    size_t packNumber, size_t packCount) {
  HardwarePlatform::instance().setStatusLeds(packNumber, 0, 10, 20);
  feedbackInfo(kTag,
      "Quiz pack %u/%u: '%s' v%u; KEY1 previous, KEY3 next, KEY2 starts",
      static_cast<unsigned>(packNumber), static_cast<unsigned>(packCount),
      pack.id, static_cast<unsigned>(pack.version));
  playLocalTone(static_cast<uint16_t>(420 + packNumber * 140), 55);
}

void WaveshareQuizFeedback::quizStarted(
    const char* packId, uint16_t version, size_t itemCount) {
  feedbackInfo(kTag, "Local quiz '%s' v%u started with %u items",
      packId, static_cast<unsigned>(version), static_cast<unsigned>(itemCount));
  playLocalTone(440, 60);
  playLocalTone(660, 60);
}

void WaveshareQuizFeedback::playPrompt(
    const LocalQuizItem& item, size_t itemNumber) {
  HardwarePlatform::instance().setStatusLeds(
      HardwarePlatform::STATUS_LED_COUNT, 10, 10, 10);
  feedbackInfo(kTag,
      "Question %u: count the tones; answer KEY1=one, KEY2=two, KEY3=three",
      static_cast<unsigned>(itemNumber));
  for (uint8_t tone = 0; tone < item.toneCount; ++tone) {
    playLocalTone(item.frequencyHz, 90);
    if (tone + 1 < item.toneCount) vTaskDelay(pdMS_TO_TICKS(item.gapMs));
  }
}

void WaveshareQuizFeedback::showAnswer(bool correct, QuizAnswer answer) {
  constexpr uint8_t brightness = HardwarePlatform::STATUS_LED_BRIGHTNESS;
  HardwarePlatform::instance().setStatusLeds(
      HardwarePlatform::STATUS_LED_COUNT,
      correct ? 0 : brightness,
      correct ? brightness : 0,
      0);
  feedbackInfo(kTag, "%s answer: %s",
      correct ? "Correct" : "Wrong", answerName(answer));
  playLocalTone(correct ? 900 : 240, correct ? 80 : 120);
}

void WaveshareQuizFeedback::quizCompleted(uint16_t correct, uint16_t total) {
  HardwarePlatform::instance().setStatusLeds(
      HardwarePlatform::STATUS_LED_COUNT, 0, 8, 20);
  feedbackInfo(kTag, "Quiz complete: %u/%u correct; score remains volatile",
      static_cast<unsigned>(correct), static_cast<unsigned>(total));
  playLocalTone(520, 60);
  playLocalTone(700, 60);
  playLocalTone(920, 90);
}

void WaveshareQuizFeedback::quizStopped() {
  HardwarePlatform::instance().setStatusLeds(1, 0, 8, 8);
  HardwarePlatform::instance().setSpeakerAmplifier(false);
  feedbackInfo(kTag, "Local quiz stopped");
}

}  // namespace nexi
