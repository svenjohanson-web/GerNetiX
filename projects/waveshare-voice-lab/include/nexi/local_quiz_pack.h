#pragma once

#include <cstddef>
#include <cstdint>

namespace nexi {

enum class QuizAnswer : uint8_t {
  Left,
  Middle,
  Right,
  Count,
};

struct LocalQuizItem {
  uint16_t id;
  uint8_t toneCount;
  uint16_t frequencyHz;
  uint16_t gapMs;
  QuizAnswer correctAnswer;
};

struct LocalQuizPack {
  const char* id;
  uint16_t version;
  const LocalQuizItem* items;
  size_t itemCount;
};

class LocalQuizPackValidator {
 public:
  static constexpr size_t kMaximumItems = 12;
  static bool valid(const LocalQuizPack& pack);
};

struct LocalQuizCatalog {
  const LocalQuizPack* packs;
  size_t packCount;
};

class LocalQuizCatalogValidator {
 public:
  static constexpr size_t kMaximumPacks = 4;
  static constexpr size_t kMaximumTotalItems =
      kMaximumPacks * LocalQuizPackValidator::kMaximumItems;
  static bool valid(const LocalQuizCatalog& catalog);
};

const LocalQuizCatalog& builtInLocalQuizCatalog();

}  // namespace nexi
