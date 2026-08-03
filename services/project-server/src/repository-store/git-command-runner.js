"use strict";

const { spawn } = require("node:child_process");

class GitCommandError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "GitCommandError";
    this.code = code;
    this.details = details;
  }
}

function createGitCommandRunner(options = {}) {
  const gitBinary = options.gitBinary || "git";
  const timeoutMs = positiveTimeout(options.timeoutMs, 30_000);

  return async function runGit(args, runOptions = {}) {
    if (!Array.isArray(args) || args.some((argument) => typeof argument !== "string")) {
      throw new TypeError("git_arguments_must_be_strings");
    }
    const authToken = String(runOptions.authToken || "");
    const env = {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
      ...(authToken ? {
        GIT_CONFIG_COUNT: "1",
        GIT_CONFIG_KEY_0: "http.extraHeader",
        GIT_CONFIG_VALUE_0: `Authorization: token ${authToken}`,
      } : {}),
    };
    return new Promise((resolve, reject) => {
      const child = spawn(gitBinary, args, {
        cwd: runOptions.cwd,
        env,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => child.kill("SIGKILL"), positiveTimeout(runOptions.timeoutMs, timeoutMs));
      child.stdout.on("data", (chunk) => { stdout = appendBounded(stdout, chunk); });
      child.stderr.on("data", (chunk) => { stderr = appendBounded(stderr, chunk); });
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(new GitCommandError("git_process_failed", "Git konnte nicht gestartet werden.", { cause: error.code || error.message }));
      });
      child.once("close", (exitCode, signal) => {
        clearTimeout(timer);
        if (exitCode === 0) {
          resolve({ stdout, stderr });
          return;
        }
        reject(new GitCommandError(
          signal ? "git_command_timeout" : "git_command_failed",
          signal ? "Git-Zeitlimit wurde überschritten." : "Git-Befehl ist fehlgeschlagen.",
          { exit_code: exitCode, signal: signal || "", stderr: redactGitOutput(stderr) },
        ));
      });
    });
  };
}

function appendBounded(current, chunk) {
  return `${current}${String(chunk)}`.slice(-16_384);
}

function redactGitOutput(value) {
  return String(value || "")
    .replace(/(https?:\/\/)[^\s/@]+@/gi, "$1<redacted>@")
    .slice(-4_096);
}

function positiveTimeout(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

module.exports = { GitCommandError, createGitCommandRunner };
