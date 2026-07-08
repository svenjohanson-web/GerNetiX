#include "basissoftware/feedback.h"

#include <cstdarg>
#include <cstdio>
#include <cstring>

#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/portmacro.h"

namespace {
constexpr size_t FEEDBACK_ENTRY_COUNT = 32;
constexpr size_t FEEDBACK_MESSAGE_SIZE = 128;
constexpr const char *DEFAULT_TAG = "feedback";

struct FeedbackEntry {
  int64_t timestampMs;
  FeedbackLevel level;
  char tag[24];
  char message[FEEDBACK_MESSAGE_SIZE];
};

FeedbackEntry entries[FEEDBACK_ENTRY_COUNT] = {};
size_t nextEntry = 0;
size_t entryCount = 0;
portMUX_TYPE feedbackMux = portMUX_INITIALIZER_UNLOCKED;

const char *levelName(FeedbackLevel level) {
  switch (level) {
    case FeedbackLevel::Warning:
      return "WARN";
    case FeedbackLevel::Error:
      return "ERROR";
    case FeedbackLevel::Info:
    default:
      return "INFO";
  }
}

void logToSerial(FeedbackLevel level, const char *tag, const char *message) {
  switch (level) {
    case FeedbackLevel::Warning:
      ESP_LOGW(tag, "%s", message);
      break;
    case FeedbackLevel::Error:
      ESP_LOGE(tag, "%s", message);
      break;
    case FeedbackLevel::Info:
    default:
      ESP_LOGI(tag, "%s", message);
      break;
  }
}

void feedbackVprintf(
    FeedbackLevel level,
    const char *tag,
    const char *format,
    va_list args) {
  char message[FEEDBACK_MESSAGE_SIZE] = {};
  std::vsnprintf(message, sizeof(message), format, args);
  recordFeedback(level, tag, message);
}
}

void recordFeedback(FeedbackLevel level, const char *tag, const char *message) {
  const char *safeTag = tag == nullptr ? DEFAULT_TAG : tag;
  const char *safeMessage = message == nullptr ? "" : message;

  logToSerial(level, safeTag, safeMessage);

  portENTER_CRITICAL(&feedbackMux);
  FeedbackEntry &entry = entries[nextEntry];
  entry.timestampMs = esp_timer_get_time() / 1000;
  entry.level = level;
  std::snprintf(entry.tag, sizeof(entry.tag), "%s", safeTag);
  std::snprintf(entry.message, sizeof(entry.message), "%s", safeMessage);
  nextEntry = (nextEntry + 1) % FEEDBACK_ENTRY_COUNT;
  if (entryCount < FEEDBACK_ENTRY_COUNT) {
    entryCount++;
  }
  portEXIT_CRITICAL(&feedbackMux);
}

void feedbackInfo(const char *tag, const char *format, ...) {
  va_list args;
  va_start(args, format);
  feedbackVprintf(FeedbackLevel::Info, tag, format, args);
  va_end(args);
}

void feedbackWarning(const char *tag, const char *format, ...) {
  va_list args;
  va_start(args, format);
  feedbackVprintf(FeedbackLevel::Warning, tag, format, args);
  va_end(args);
}

void feedbackError(const char *tag, const char *format, ...) {
  va_list args;
  va_start(args, format);
  feedbackVprintf(FeedbackLevel::Error, tag, format, args);
  va_end(args);
}

size_t copyFeedbackLog(char *target, size_t targetSize) {
  if (target == nullptr || targetSize == 0) {
    return 0;
  }

  target[0] = '\0';
  size_t written = 0;

  portENTER_CRITICAL(&feedbackMux);
  const size_t start =
      entryCount == FEEDBACK_ENTRY_COUNT ? nextEntry : 0;

  for (size_t i = 0; i < entryCount && written < targetSize; i++) {
    const FeedbackEntry &entry =
        entries[(start + i) % FEEDBACK_ENTRY_COUNT];

    const int result = std::snprintf(
        target + written,
        targetSize - written,
        "[%lld ms] %s %s: %s\n",
        static_cast<long long>(entry.timestampMs),
        levelName(entry.level),
        entry.tag,
        entry.message);

    if (result < 0) {
      break;
    }

    const size_t appended = static_cast<size_t>(result);
    if (appended >= targetSize - written) {
      written = targetSize - 1;
      break;
    }

    written += appended;
  }
  portEXIT_CRITICAL(&feedbackMux);

  target[written] = '\0';
  return written;
}
