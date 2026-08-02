const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const basisRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(basisRoot, "../..");
const provisioningRoot = path.join(repoRoot, "projects/provisioning");
const cmake = fs.readFileSync(path.join(basisRoot, "src/CMakeLists.txt"), "utf8");
const platformio = fs.readFileSync(path.join(basisRoot, "platformio.ini"), "utf8");
const initHook = fs.readFileSync(path.join(basisRoot, "src/hooks/onProjectInit.cpp"), "utf8");
const tickHook = fs.readFileSync(path.join(basisRoot, "src/hooks/onProjectTick.cpp"), "utf8");
const projectManifest = fs.readFileSync(path.join(provisioningRoot, "project.yaml"), "utf8");
const userMain = fs.readFileSync(path.join(provisioningRoot, "Komponenten/Provisioning/src/user_main.cpp"), "utf8");

test("keeps the provisioning user entrypoint outside the protected basissoftware", () => {
  assert.equal(fs.existsSync(path.join(basisRoot, "src/user/user_app.cpp")), false);
  assert.match(projectManifest, /id: system-provisioning/);
  assert.match(projectManifest, /entrypoint: src\/user_main\.cpp/);
  assert.match(projectManifest, /user_target_path: src\/user\/user_app\.cpp/);
  assert.match(userMain, /extern "C" void userMain\(\)/);
  assert.match(userMain, /extern "C" void userTick\(\)/);
});

test("routes direct basissoftware builds through the provisioning project", () => {
  const provisioningSource = /projects\/provisioning\/Komponenten\/Provisioning\/src/g;
  assert.ok((platformio.match(provisioningSource) || []).length >= 2);
  assert.match(cmake, /GERNETIX_PROJECT_SOURCE_DIR/);
  assert.match(cmake, /GERNETIX_PACKAGED_USER_SOURCES "user\/\*\.cpp"/);
});

test("keeps the user lifecycle adapter in protected hooks", () => {
  assert.match(initHook, /__attribute__\(\(weak\)\) void userMain\(\)/);
  assert.match(initHook, /void onProjectInit\(\)[\s\S]*userMain\(\)/);
  assert.match(tickHook, /__attribute__\(\(weak\)\) void userTick\(\)/);
  assert.match(tickHook, /void onProjectTick\(\)[\s\S]*userTick\(\)/);
});
