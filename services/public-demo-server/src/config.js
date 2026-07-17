const path = require("node:path");

const workspaceRoot = path.resolve(__dirname, "..", "..", "..");

function createConfig(env = process.env) {
  const runtimeRoot = env.PUBLIC_DEMO_RUNTIME_DIR
    ? path.resolve(env.PUBLIC_DEMO_RUNTIME_DIR)
    : path.join(workspaceRoot, ".runtime", "public-demos");
  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 4920),
    runtimeRoot,
    sqlitePath: env.PUBLIC_DEMO_SQLITE_PATH
      ? path.resolve(env.PUBLIC_DEMO_SQLITE_PATH)
      : path.join(runtimeRoot, "gernetix-public-demos.sqlite"),
    publisherToken: env.PUBLIC_DEMO_PUBLISHER_TOKEN || "",
  };
}

module.exports = { createConfig };
