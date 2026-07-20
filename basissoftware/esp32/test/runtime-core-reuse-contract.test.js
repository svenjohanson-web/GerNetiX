const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("basissoftware builds the shared GerNetiX Runtime Core into its ESP-IDF component", () => {
  const cmake = read("src/CMakeLists.txt");

  assert.match(cmake, /gernetix-runtime-core\/src\/runtime_core\.cpp/);
  assert.match(cmake, /gernetix-runtime-core\/include/);
});

test("provisioning_config reuses Runtime Core JSON and hostname helpers", () => {
  const source = read("src/functions/provisioning_config.cpp");

  assert.match(source, /#include "gernetix\/runtime_core\.h"/);
  assert.match(source, /gernetix::runtime::writeGerNetixDeviceName/);
  assert.match(source, /gernetix::runtime::writeGerNetixHostname/);
  assert.match(source, /gernetix::runtime::JsonWriter/);
  assert.match(source, /gernetix::runtime::jsonAppendString/);
  assert.match(source, /gernetix::runtime::jsonAppendBool/);
  assert.doesNotMatch(source, /void copyString\(/);
  assert.doesNotMatch(source, /void appendHostnamePart\(/);
  assert.doesNotMatch(source, /std::string escapeJsonString\(/);
  assert.doesNotMatch(source, /void appendJsonString\(/);
});

test("shared Runtime Core remains the only place for GerNetiX hostname normalization", () => {
  const core = fs.readFileSync(
    path.resolve(root, "..", "..", "firmware/shared/gernetix-runtime-core/src/runtime_core.cpp"),
    "utf8",
  );

  assert.match(core, /void writeGerNetixHostname/);
  assert.match(core, /void appendHostnamePart/);
  assert.match(core, /bool isHostnameChar/);
});

