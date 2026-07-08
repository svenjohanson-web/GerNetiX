#include "basissoftware/feedback.h"

#include <cstdarg>
#include <cstdio>
#include <cstring>

#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/portmacro.h"

namespace {
constexpr size_t FEEDBACK_LOG_SIZE = 2048;
constexpr size_t FEEDBACK_LINE_SIZE = 192;
constexpr size_t FEEDBACK_MESSAGE_SIZE = 128;
constexpr const char *DEFAULT_TAG = "feedback";

char feedbackLog[FEEDBACK_LOG_SIZE] = {};
size_t logStart = 0;
size_t logUsed = 0;
size_t droppedBytes = 0;
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

void appendLogChar(char value) {
  if (logUsed >= FEEDBACK_LOG_SIZE - 1) {
    logStart = (logStart + 1) % FEEDBACK_LOG_SIZE;
    logUsed--;
    droppedBytes++;
  }

  const size_t writeIndex = (logStart + logUsed) % FEEDBACK_LOG_SIZE;
  feedbackLog[writeIndex] = value;
  logUsed++;
}
}

void recordFeedback(FeedbackLevel level, const char *tag, const char *message) {
  const char *safeTag = tag == nullptr ? DEFAULT_TAG : tag;
  const char *safeMessage = message == nullptr ? "" : message;

  logToSerial(level, safeTag, safeMessage);

  char line[FEEDBACK_LINE_SIZE] = {};
  const int lineLength = std::snprintf(
      line,
      sizeof(line),
      "[%lld ms] %s %s: %s\n",
      static_cast<long long>(esp_timer_get_time() / 1000),
      levelName(level),
      safeTag,
      safeMessage);
  if (lineLength < 0) {
    return;
  }

  portENTER_CRITICAL(&feedbackMux);
  for (size_t i = 0; line[i] != '\0'; i++) {
    appendLogChar(line[i]);
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
  const size_t headerLength = static_cast<size_t>(std::snprintf(
      target,
      targetSize,
      "GerNetiX event log: capacity=%u bytes used=%u droppedBytes=%u\n",
      static_cast<unsigned>(FEEDBACK_LOG_SIZE - 1),
      static_cast<unsigned>(logUsed),
      static_cast<unsigned>(droppedBytes)));
  written = headerLength < targetSize ? headerLength : targetSize - 1;

  for (size_t i = 0; i < logUsed && written + 1 < targetSize; i++) {
    target[written++] = feedbackLog[(logStart + i) % FEEDBACK_LOG_SIZE];
  }
  portEXIT_CRITICAL(&feedbackMux);

  target[written] = '\0';
  return written;
}

size_t feedbackLogCapacity() {
  return FEEDBACK_LOG_SIZE - 1;
}
