"use strict";

const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const listed = spawnSync("git", ["ls-files", "-z", "*.js", "*.cjs", "*.mjs"], {
  cwd: repoRoot,
  encoding: "utf8",
});
if (listed.error) throw listed.error;
if (listed.status !== 0) {
  process.stderr.write(listed.stderr || "");
  process.exit(listed.status || 1);
}

const files = listed.stdout.split("\0").filter(Boolean);
const concurrency = Math.min(8, Math.max(2, os.availableParallelism?.() || os.cpus().length));
const failures = [];
let nextIndex = 0;

function check(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--check", file], {
      cwd: repoRoot,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      failures.push({ file, message: error.message });
      resolve();
    });
    child.on("exit", (code) => {
      if (code !== 0) failures.push({ file, message: stderr.trim() || `exit ${code}` });
      resolve();
    });
  });
}

async function worker() {
  while (nextIndex < files.length) {
    const file = files[nextIndex++];
    await check(file);
  }
}

Promise.all(Array.from({ length: concurrency }, worker)).then(() => {
  if (failures.length) {
    for (const failure of failures) console.error(`\n${failure.file}\n${failure.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`JavaScript syntax valid: ${files.length} tracked files`);
});
