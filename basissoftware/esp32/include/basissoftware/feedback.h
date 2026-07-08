#pragma once

#include <cstddef>

enum class FeedbackLevel {
  Info,
  Warning,
  Error,
};

void recordFeedback(FeedbackLevel level, const char *tag, const char *message);
void feedbackInfo(const char *tag, const char *format, ...);
void feedbackWarning(const char *tag, const char *format, ...);
void feedbackError(const char *tag, const char *format, ...);
size_t copyFeedbackLog(char *target, size_t targetSize);
size_t feedbackLogCapacity();
