const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("defines shared runtime identity and JSON writer contracts", () => {
  const header = read("include/gernetix/runtime_core.h");
  const source = read("src/runtime_core.cpp");

  assert.match(header, /struct RuntimeIdentity/);
  assert.match(header, /struct JsonWriter/);
  assert.match(header, /writeRuntimeIdentityJsonFields/);
  assert.match(source, /jsonAppendString\(writer, "serial_number"/);
  assert.match(source, /jsonAppendString\(writer, "hardware_profile_id"/);
  assert.doesNotMatch(source, /PRIVATE KEY/);
});

test("keeps Basissoftware hostname semantics available for reuse", () => {
  const source = read("src/runtime_core.cpp");

  assert.match(source, /writeGerNetixDeviceName/);
  assert.match(source, /writeGerNetixHostname/);
  assert.match(source, /appendHostnamePart/);
  assert.match(source, /GerNetiX %s/);
});

test("is packaged as a PlatformIO library for Flashbox and future Basissoftware reuse", () => {
  const library = JSON.parse(read("library.json"));

  assert.equal(library.name, "gernetix-runtime-core");
  assert.deepEqual(library.frameworks, ["arduino", "espidf"]);
  assert.equal(library.build.includeDir, "include");
});

