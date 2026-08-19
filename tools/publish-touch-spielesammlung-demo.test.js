"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const test = require("node:test");
const { parseArgs, remotePublishCommand, resolveBuildCacheRoot } = require("./publish-touch-spielesammlung-demo");
const { publishPublicDemo } = require("../services/identity-server/src/operations/publish-public-demo");

test("requires an explicit preview or publication action", () => {
  assert.deepEqual(parseArgs(["--dry-run"]), { dryRun: true, publish: false });
  assert.deepEqual(parseArgs(["--publish"]), { dryRun: false, publish: true });
  assert.throws(() => parseArgs([]), /Genau eines/);
  assert.throws(() => parseArgs(["--dry-run", "--publish"]), /Genau eines/);
});

test("uses the same short Windows cache root as the Forgejo build adapter", () => {
  const root = resolveBuildCacheRoot("C:\\Users\\sven_\\Desktop\\GerNetiX-Projekte\\spielesammlung-esp32-s3-touch", {}, "win32");
  assert.equal(root, path.win32.join("C:\\", "g", "gernetix-build", "spielesammlung-e"));
});

test("invokes only the fixed server-side publisher and never transports signing secrets", () => {
  const command = remotePublishCommand("/opt/gernetix");
  assert.match(command, /scripts\/staging\/publish-public-demo\.sh/);
  assert.doesNotMatch(command, /SIGNING|PRIVATE_KEY|\.env\.vps/);
});

test("server-side publisher signs the scoped request inside Identity", async () => {
  const pair = crypto.generateKeyPairSync("ed25519");
  const keyId = "identity-server-test";
  let request;
  const result = await publishPublicDemo({ demo_id: "touch-spielesammlung", version: "1.0.0" }, {
    env: { PUBLIC_DEMO_BASE_URL: "http://public-demo-server:4920" },
    signingConfig: {
      activeKid: keyId,
      signingKeys: { [keyId]: { key: pair.privateKey.export({ format: "der", type: "pkcs8" }), algorithm: "Ed25519" } },
    },
    fetchImpl: async (url, options) => {
      request = { url: String(url), options };
      return { ok: true, status: 201, async json() { return { releases: [{ version: "1.0.0" }] }; } };
    },
  });
  assert.equal(request.url, "http://public-demo-server:4920/api/internal/public-demos");
  assert.match(request.options.headers.Authorization, /^Bearer [^.]+\.[^.]+\.[^.]+$/);
  assert.deepEqual(JSON.parse(request.options.body), { demo_id: "touch-spielesammlung", version: "1.0.0" });
  assert.equal(result.releases[0].version, "1.0.0");
});
