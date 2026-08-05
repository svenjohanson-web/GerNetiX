const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "../../../projects/waveshare-voice-lab");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("Nexi offline policy exposes only currently implemented local applications", () => {
  const policy = read("src/capability_policy.cpp");

  assert.match(policy, /CapabilityPolicy::offlineDefault/);
  assert.match(policy, /Capability::VoiceStudio/);
  const offlineDefault = policy.match(
    /CapabilityPolicy::offlineDefault[\s\S]*?\n}\n/,
  )?.[0] || "";
  assert.doesNotMatch(offlineDefault, /Capability::Oracle/);
  assert.doesNotMatch(offlineDefault, /Capability::LearningCompanion/);
  assert.doesNotMatch(offlineDefault, /Capability::VoiceCompanion/);
  assert.doesNotMatch(offlineDefault, /Capability::CloudConversation/);
});

test("Nexi audio transmission needs account, provider, capability and session consent", () => {
  const policy = read("src/capability_policy.cpp");
  const privacy = read("src/privacy_gate.cpp");

  assert.match(policy, /snapshot_\.accountBound/);
  assert.match(policy, /snapshot_\.providerEnabled/);
  assert.match(policy, /allows\(Capability::CloudConversation\)/);
  assert.match(privacy, /explicitConsent/);
  assert.match(privacy, /policy_\.cloudConversationAvailable\(\)/);
  assert.match(privacy, /cloudAuthorized_ = false/);
  assert.match(privacy, /mayTransmitAudio/);
});
