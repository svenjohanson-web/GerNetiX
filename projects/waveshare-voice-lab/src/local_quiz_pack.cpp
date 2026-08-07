#include "nexi/local_quiz_pack.h"

#include <cstring>

namespace nexi {

bool LocalQuizPackValidator::valid(const LocalQuizPack& pack) {
  if (pack.id == nullptr || pack.id[0] == '\0' || std::strlen(pack.id) > 31 ||
      pack.version == 0 || pack.items == nullptr || pack.itemCount == 0 ||
      pack.itemCount > kMaximumItems) {
    return false;
  }
  for (size_t index = 0; index < pack.itemCount; ++index) {
    const LocalQuizItem& item = pack.items[index];
    if (item.id == 0 || item.toneCount < 1 || item.toneCount > 3 ||
        item.frequencyHz < 180 || item.frequencyHz > 1600 ||
        item.gapMs < 40 || item.gapMs > 400 ||
        item.correctAnswer == QuizAnswer::Count ||
        static_cast<uint8_t>(item.correctAnswer) + 1 != item.toneCount) {
      return false;
    }
    for (size_t previous = 0; previous < index; ++previous) {
      if (pack.items[previous].id == item.id) return false;
    }
  }
  return true;
}

bool LocalQuizCatalogValidator::valid(const LocalQuizCatalog& catalog) {
  if (catalog.packs == nullptr || catalog.packCount == 0 ||
      catalog.packCount > kMaximumPacks) {
    return false;
  }
  size_t totalItems = 0;
  for (size_t index = 0; index < catalog.packCount; ++index) {
    const LocalQuizPack& pack = catalog.packs[index];
    if (!LocalQuizPackValidator::valid(pack)) return false;
    totalItems += pack.itemCount;
    if (totalItems > kMaximumTotalItems) return false;
    for (size_t previous = 0; previous < index; ++previous) {
      if (std::strcmp(catalog.packs[previous].id, pack.id) == 0) return false;
    }
  }
  return true;
}

const LocalQuizCatalog& builtInLocalQuizCatalog() {
  static const LocalQuizItem kBeginnerItems[] = {
      {101, 1, 700, 160, QuizAnswer::Left},
      {102, 2, 700, 160, QuizAnswer::Middle},
      {103, 3, 700, 160, QuizAnswer::Right},
      {104, 2, 700, 160, QuizAnswer::Middle},
      {105, 1, 700, 160, QuizAnswer::Left},
      {106, 3, 700, 160, QuizAnswer::Right},
  };
  static const LocalQuizItem kFastItems[] = {
      {201, 2, 900, 65, QuizAnswer::Middle},
      {202, 3, 900, 65, QuizAnswer::Right},
      {203, 1, 900, 65, QuizAnswer::Left},
      {204, 3, 900, 65, QuizAnswer::Right},
      {205, 2, 900, 65, QuizAnswer::Middle},
      {206, 1, 900, 65, QuizAnswer::Left},
      {207, 2, 900, 65, QuizAnswer::Middle},
      {208, 3, 900, 65, QuizAnswer::Right},
      {209, 1, 900, 65, QuizAnswer::Left},
  };
  static const LocalQuizItem kDeepItems[] = {
      {301, 3, 360, 120, QuizAnswer::Right},
      {302, 1, 360, 120, QuizAnswer::Left},
      {303, 2, 360, 120, QuizAnswer::Middle},
      {304, 1, 360, 120, QuizAnswer::Left},
      {305, 3, 360, 120, QuizAnswer::Right},
      {306, 2, 360, 120, QuizAnswer::Middle},
      {307, 3, 360, 120, QuizAnswer::Right},
      {308, 2, 360, 120, QuizAnswer::Middle},
      {309, 1, 360, 120, QuizAnswer::Left},
  };
  static const LocalQuizPack kPacks[] = {
      {"nexi.sound-memory.beginner.de", 1, kBeginnerItems,
          sizeof(kBeginnerItems) / sizeof(kBeginnerItems[0])},
      {"nexi.sound-memory.fast.de", 1, kFastItems,
          sizeof(kFastItems) / sizeof(kFastItems[0])},
      {"nexi.sound-memory.deep.de", 1, kDeepItems,
          sizeof(kDeepItems) / sizeof(kDeepItems[0])},
  };
  static const LocalQuizCatalog kCatalog = {
      kPacks, sizeof(kPacks) / sizeof(kPacks[0])};
  return kCatalog;
}

}  // namespace nexi
