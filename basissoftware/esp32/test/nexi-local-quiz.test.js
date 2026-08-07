const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../../..");
const projectRoot = path.join(repositoryRoot, "projects/waveshare-voice-lab");
const includeRoot = path.join(projectRoot, "include");

test("versioned local quiz pack runs bounded questions and remains volatile", (t) => {
  const compiler = process.env.CXX || "c++";
  const probe = spawnSync(compiler, ["--version"], { encoding: "utf8" });
  if (probe.error && probe.error.code === "ENOENT") {
    t.skip(`${compiler} is not installed`);
    return;
  }
  assert.equal(probe.status, 0, probe.stderr);

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nexi-quiz-"));
  const harnessPath = path.join(temporaryRoot, "local_quiz_test.cpp");
  const executablePath = path.join(temporaryRoot, "local_quiz_test");
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));

  fs.writeFileSync(harnessPath, String.raw`
#include <cassert>
#include <cstring>

#include "nexi/application_manager.h"
#include "nexi/local_quiz_application.h"
#include "nexi/local_quiz_pack.h"

class Feedback final : public nexi::LocalQuizFeedback {
 public:
  void showPackSelection(const nexi::LocalQuizPack& pack,
      size_t number, size_t count) override {
    ++selections;
    packId = pack.id;
    selectedNumber = number;
    packCount = count;
  }
  void quizStarted(const char* id, uint16_t version, size_t count) override {
    ++started;
    packId = id;
    packVersion = version;
    itemCount = count;
  }
  void playPrompt(const nexi::LocalQuizItem& prompt, size_t item) override {
    ++prompts;
    lastTones = prompt.toneCount;
    lastFrequency = prompt.frequencyHz;
    lastGap = prompt.gapMs;
    lastItem = item;
  }
  void showAnswer(bool value, nexi::QuizAnswer answer) override {
    ++answers;
    correct = value;
    lastAnswer = answer;
  }
  void quizCompleted(uint16_t value, uint16_t total) override {
    ++completed;
    score = value;
    completedTotal = total;
  }
  void quizStopped() override { ++stopped; }

  int started = 0;
  int selections = 0;
  int prompts = 0;
  int answers = 0;
  int completed = 0;
  int stopped = 0;
  const char* packId = nullptr;
  uint16_t packVersion = 0;
  size_t itemCount = 0;
  size_t selectedNumber = 0;
  size_t packCount = 0;
  uint8_t lastTones = 0;
  uint16_t lastFrequency = 0;
  uint16_t lastGap = 0;
  size_t lastItem = 0;
  bool correct = false;
  nexi::QuizAnswer lastAnswer = nexi::QuizAnswer::Count;
  uint16_t score = 0;
  uint16_t completedTotal = 0;
};

nexi::Intent answerIntent(nexi::QuizAnswer answer) {
  switch (answer) {
    case nexi::QuizAnswer::Left:
      return nexi::Intent::create(nexi::IntentType::NextEffect,
          nexi::IntentSource::Test);
    case nexi::QuizAnswer::Middle:
      return nexi::Intent::create(nexi::IntentType::Record,
          nexi::IntentSource::Test);
    case nexi::QuizAnswer::Right:
      return nexi::Intent::create(nexi::IntentType::AdjustVolume,
          nexi::IntentSource::Test, 1);
    default:
      return nexi::Intent::create(nexi::IntentType::None);
  }
}

int main() {
  const nexi::LocalQuizCatalog& catalog = nexi::builtInLocalQuizCatalog();
  assert(nexi::LocalQuizCatalogValidator::valid(catalog));
  assert(catalog.packCount == 3);
  assert(std::strcmp(catalog.packs[0].id,
      "nexi.sound-memory.beginner.de") == 0);
  assert(std::strcmp(catalog.packs[1].id,
      "nexi.sound-memory.fast.de") == 0);
  assert(std::strcmp(catalog.packs[2].id,
      "nexi.sound-memory.deep.de") == 0);
  assert(catalog.packs[0].itemCount == 6);
  assert(catalog.packs[1].itemCount == 9);
  assert(catalog.packs[2].itemCount == 9);

  const nexi::LocalQuizItem duplicateItems[] = {
      {1, 1, 700, 100, nexi::QuizAnswer::Left},
      {1, 2, 700, 100, nexi::QuizAnswer::Middle},
  };
  const nexi::LocalQuizPack duplicate = {"duplicate", 1, duplicateItems, 2};
  assert(!nexi::LocalQuizPackValidator::valid(duplicate));
  const nexi::LocalQuizPack noVersion = {"no-version", 0, duplicateItems, 1};
  assert(!nexi::LocalQuizPackValidator::valid(noVersion));
  const nexi::LocalQuizPack duplicatePacks[] = {
      catalog.packs[0], catalog.packs[0]};
  const nexi::LocalQuizCatalog duplicateCatalog = {duplicatePacks, 2};
  assert(!nexi::LocalQuizCatalogValidator::valid(duplicateCatalog));

  const nexi::CapabilityPolicy policy = nexi::CapabilityPolicy::offlineDefault();
  Feedback feedback;
  nexi::LocalQuizApplication quiz(policy, catalog, feedback);
  nexi::ApplicationManager manager;
  assert(manager.registerApplication(&quiz));
  assert(manager.dispatch(nexi::Intent::selectApplication(
      nexi::ApplicationId::LocalQuiz, nexi::IntentSource::Voice)));
  assert(quiz.running());
  assert(feedback.selections == 1);
  assert(feedback.started == 0);
  assert(feedback.prompts == 0);

  // Spoken controls never become quiz answers.
  manager.dispatch(nexi::Intent::create(
      nexi::IntentType::NextEffect, nexi::IntentSource::Voice));
  assert(feedback.answers == 0);
  assert(quiz.selectedPackIndex() == 0);

  // KEY3 selects the faster second pack; KEY2 starts it.
  manager.dispatch(nexi::Intent::create(
      nexi::IntentType::AdjustVolume, nexi::IntentSource::Test, 1));
  assert(quiz.selectedPackIndex() == 1);
  assert(feedback.selections == 2);
  manager.dispatch(nexi::Intent::create(
      nexi::IntentType::Record, nexi::IntentSource::Test));
  assert(feedback.started == 1);
  assert(feedback.prompts == 1);
  const nexi::LocalQuizPack& pack = catalog.packs[1];
  assert(feedback.lastFrequency == 900);
  assert(feedback.lastGap == 65);

  for (size_t index = 0; index < pack.itemCount; ++index) {
    assert(quiz.currentItemIndex() == index);
    assert(manager.dispatch(answerIntent(pack.items[index].correctAnswer)));
    assert(feedback.correct);
    for (int tick = 0; tick < 21; ++tick) manager.tick();
  }
  assert(quiz.completed());
  assert(quiz.correctAnswers() == pack.itemCount);
  assert(feedback.completed == 1);
  assert(feedback.score == pack.itemCount);
  assert(feedback.completedTotal == pack.itemCount);

  assert(manager.dispatch(nexi::Intent::create(
      nexi::IntentType::StopApplication, nexi::IntentSource::Voice)));
  assert(!quiz.running());
  assert(feedback.stopped == 1);

  const nexi::CapabilityPolicy denied({1, 0, false, false});
  Feedback deniedFeedback;
  nexi::LocalQuizApplication deniedQuiz(denied, catalog, deniedFeedback);
  assert(!deniedQuiz.start(nexi::Intent::selectApplication(
      nexi::ApplicationId::LocalQuiz)));
}
`);

  const compilation = spawnSync(compiler, [
    "-std=c++11",
    "-Wall",
    "-Wextra",
    "-pedantic",
    `-I${includeRoot}`,
    harnessPath,
    path.join(projectRoot, "src/intent.cpp"),
    path.join(projectRoot, "src/application_manager.cpp"),
    path.join(projectRoot, "src/capability_policy.cpp"),
    path.join(projectRoot, "src/local_quiz_pack.cpp"),
    path.join(projectRoot, "src/local_quiz_application.cpp"),
    "-o",
    executablePath,
  ], { encoding: "utf8" });
  assert.equal(compilation.status, 0, compilation.stderr || compilation.stdout);

  const execution = spawnSync(executablePath, [], { encoding: "utf8" });
  assert.equal(execution.status, 0, execution.stderr || execution.stdout);
});

test("local quiz core excludes drivers, networks and persistence", () => {
  const source = [
    "include/nexi/local_quiz_pack.h",
    "include/nexi/local_quiz_feedback.h",
    "include/nexi/local_quiz_application.h",
    "src/local_quiz_pack.cpp",
    "src/local_quiz_application.cpp",
  ].map((relativePath) => fs.readFileSync(
    path.join(projectRoot, relativePath), "utf8",
  )).join("\n");

  assert.match(source, /kMaximumItems = 12/);
  assert.match(source, /kMaximumPacks = 4/);
  assert.match(source, /kMaximumTotalItems/);
  assert.match(source, /version/);
  assert.match(source, /Capability::LocalQuiz/);
  assert.doesNotMatch(source,
    /driver\/|freertos|nvs_|fopen|fstream|esp_http|WiFi|socket\s*\(|https?:\/\//);
});
