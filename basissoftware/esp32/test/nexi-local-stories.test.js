const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../../..");
const projectRoot = path.join(repositoryRoot, "projects/waveshare-voice-lab");
const includeRoot = path.join(projectRoot, "include");

test("versioned local story packs select and play bounded offline audio", (t) => {
  const compiler = process.env.CXX || "c++";
  const probe = spawnSync(compiler, ["--version"], { encoding: "utf8" });
  if (probe.error && probe.error.code === "ENOENT") {
    t.skip(`${compiler} is not installed`);
    return;
  }
  assert.equal(probe.status, 0, probe.stderr);

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nexi-stories-"));
  const harnessPath = path.join(temporaryRoot, "local_story_test.cpp");
  const executablePath = path.join(temporaryRoot, "local_story_test");
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));

  fs.writeFileSync(harnessPath, String.raw`
#include <cassert>
#include <cstring>

#include "nexi/application_manager.h"
#include "nexi/local_story_application.h"
#include "nexi/local_story_pack.h"

class Feedback final : public nexi::LocalStoryFeedback {
 public:
  void showStorySelection(const nexi::LocalStoryPack& pack,
      const nexi::LocalStory& story, size_t number, size_t count) override {
    ++selections;
    packId = pack.id;
    storyId = story.id;
    selectedNumber = number;
    storyCount = count;
  }
  void storyStarted(const nexi::LocalStoryPack& pack,
      const nexi::LocalStory& story) override {
    ++started;
    packId = pack.id;
    storyId = story.id;
  }
  bool playStory(const nexi::LocalStory& story) override {
    ++plays;
    playedSamples = story.sampleCount;
    sampleRate = story.sampleRateHz;
    return playbackResult;
  }
  void storyFinished(const nexi::LocalStory&, bool played) override {
    ++finished;
    lastPlayed = played;
  }
  void storyStopped() override { ++stopped; }

  int selections = 0;
  int started = 0;
  int plays = 0;
  int finished = 0;
  int stopped = 0;
  const char* packId = nullptr;
  const char* storyId = nullptr;
  size_t selectedNumber = 0;
  size_t storyCount = 0;
  size_t playedSamples = 0;
  uint16_t sampleRate = 0;
  bool playbackResult = true;
  bool lastPlayed = false;
};

int main() {
  const nexi::LocalStoryCatalog& catalog = nexi::builtInLocalStoryCatalog();
  assert(nexi::LocalStoryCatalogValidator::valid(catalog));
  assert(catalog.packCount == 2);
  assert(std::strcmp(catalog.packs[0].id, "nexi.stories.wonder.de") == 0);
  assert(std::strcmp(catalog.packs[1].id, "nexi.stories.calm.de") == 0);
  assert(catalog.packs[0].version == 1);
  assert(catalog.packs[0].storyCount == 2);
  assert(catalog.packs[1].storyCount == 1);

  const nexi::LocalStory invalidStory = {"bad", "Bad", nullptr, 0, 8000};
  const nexi::LocalStoryPack invalidPack = {"bad", 1, &invalidStory, 1};
  assert(!nexi::LocalStoryPackValidator::valid(invalidPack));
  const nexi::LocalStoryPack noVersion = {
      "bad-version", 0, catalog.packs[0].stories, 1};
  assert(!nexi::LocalStoryPackValidator::valid(noVersion));
  const nexi::LocalStoryPack duplicatePacks[] = {
      catalog.packs[0], catalog.packs[0]};
  const nexi::LocalStoryCatalog duplicateCatalog = {duplicatePacks, 2};
  assert(!nexi::LocalStoryCatalogValidator::valid(duplicateCatalog));

  const nexi::CapabilityPolicy policy = nexi::CapabilityPolicy::offlineDefault();
  Feedback feedback;
  nexi::LocalStoryApplication stories(policy, catalog, feedback);
  nexi::ApplicationManager manager;
  assert(manager.registerApplication(&stories));
  assert(manager.dispatch(nexi::Intent::selectApplication(
      nexi::ApplicationId::LocalStories, nexi::IntentSource::Voice)));
  assert(stories.running());
  assert(stories.totalStoryCount() == 3);
  assert(feedback.selections == 1);
  assert(feedback.selectedNumber == 1);

  // Voice volume/effect commands never change the story selection.
  manager.dispatch(nexi::Intent::create(
      nexi::IntentType::AdjustVolume, nexi::IntentSource::Voice, 1));
  assert(stories.selectedStoryIndex() == 0);

  // KEY3 advances to the second story; KEY2 plays it from local audio.
  manager.dispatch(nexi::Intent::create(
      nexi::IntentType::AdjustVolume, nexi::IntentSource::ServiceButton, 1));
  assert(stories.selectedStoryIndex() == 1);
  manager.dispatch(nexi::Intent::create(
      nexi::IntentType::Record, nexi::IntentSource::ServiceButton));
  assert(feedback.started == 1);
  assert(feedback.plays == 1);
  assert(feedback.finished == 1);
  assert(feedback.lastPlayed);
  assert(feedback.playedSamples > 0);
  assert(feedback.sampleRate == 8000);
  assert(feedback.selections == 3);

  // KEY1 moves back; from the first story it wraps to the final story.
  manager.dispatch(nexi::Intent::create(
      nexi::IntentType::NextEffect, nexi::IntentSource::ServiceButton));
  assert(stories.selectedStoryIndex() == 0);
  manager.dispatch(nexi::Intent::create(
      nexi::IntentType::NextEffect, nexi::IntentSource::ServiceButton));
  assert(stories.selectedStoryIndex() == 2);
  assert(std::strcmp(feedback.packId, "nexi.stories.calm.de") == 0);

  assert(manager.dispatch(nexi::Intent::create(
      nexi::IntentType::StopApplication, nexi::IntentSource::Voice)));
  assert(!stories.running());
  assert(feedback.stopped == 1);

  const nexi::CapabilityPolicy denied({1, 0, false, false});
  Feedback deniedFeedback;
  nexi::LocalStoryApplication deniedStories(denied, catalog, deniedFeedback);
  assert(!deniedStories.start(nexi::Intent::selectApplication(
      nexi::ApplicationId::LocalStories)));
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
    path.join(projectRoot, "src/generated_story_audio.cpp"),
    path.join(projectRoot, "src/local_story_pack.cpp"),
    path.join(projectRoot, "src/local_story_application.cpp"),
    "-o",
    executablePath,
  ], { encoding: "utf8" });
  assert.equal(compilation.status, 0, compilation.stderr || compilation.stdout);

  const execution = spawnSync(executablePath, [], { encoding: "utf8" });
  assert.equal(execution.status, 0, execution.stderr || execution.stdout);
});

test("local story core is bounded and excludes drivers, network and persistence", () => {
  const source = [
    "include/nexi/local_story_pack.h",
    "include/nexi/local_story_feedback.h",
    "include/nexi/local_story_application.h",
    "src/local_story_pack.cpp",
    "src/local_story_application.cpp",
  ].map((relativePath) => fs.readFileSync(
    path.join(projectRoot, relativePath), "utf8",
  )).join("\n");

  assert.match(source, /kMaximumStories = 4/);
  assert.match(source, /kMaximumPacks = 4/);
  assert.match(source, /kMaximumTotalStories = 12/);
  assert.match(source, /kMaximumTotalSeconds = 120/);
  assert.match(source, /Capability::LocalStories/);
  assert.doesNotMatch(source,
    /driver\/|freertos|nvs_|fopen|fstream|esp_http|WiFi|socket\s*\(|https?:\/\//);
});

test("generated story assets match their original German source catalog", () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(
    projectRoot, "assets/stories/stories.de.json"), "utf8"));
  const implementation = fs.readFileSync(path.join(
    projectRoot, "src/generated_story_audio.cpp"), "utf8");
  const stories = catalog.packs.flatMap((pack) => pack.stories);
  assert.equal(catalog.schemaVersion, 1);
  assert.equal(catalog.sampleRateHz, 8000);
  assert.equal(stories.length, 3);
  for (const story of stories) {
    assert.match(implementation, new RegExp(`// ${story.id}; sha256=[a-f0-9]{64}`));
  }
  assert.match(implementation, /Do not edit the sample arrays manually/);
});
