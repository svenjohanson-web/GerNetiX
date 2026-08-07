#pragma once

#include <cstddef>
#include <cstdint>

#include "nexi/local_quiz_pack.h"

namespace nexi {

class LocalQuizFeedback {
 public:
  virtual ~LocalQuizFeedback() = default;
  virtual void showPackSelection(const LocalQuizPack& pack,
      size_t packNumber, size_t packCount) = 0;
  virtual void quizStarted(
      const char* packId, uint16_t version, size_t itemCount) = 0;
  virtual void playPrompt(
      const LocalQuizItem& item, size_t itemNumber) = 0;
  virtual void showAnswer(bool correct, QuizAnswer answer) = 0;
  virtual void quizCompleted(uint16_t correct, uint16_t total) = 0;
  virtual void quizStopped() = 0;
};

}  // namespace nexi
