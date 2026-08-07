#pragma once

#include "nexi/local_quiz_feedback.h"

namespace nexi {

class WaveshareQuizFeedback final : public LocalQuizFeedback {
 public:
  void showPackSelection(const LocalQuizPack& pack,
      size_t packNumber, size_t packCount) override;
  void quizStarted(
      const char* packId, uint16_t version, size_t itemCount) override;
  void playPrompt(
      const LocalQuizItem& item, size_t itemNumber) override;
  void showAnswer(bool correct, QuizAnswer answer) override;
  void quizCompleted(uint16_t correct, uint16_t total) override;
  void quizStopped() override;
};

}  // namespace nexi
