"use strict";

const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { BuildDeployError } = require("../errors");

const execFileAsync = promisify(execFile);

class ElfSymbolizer {
  constructor(options = {}) {
    this.commands = (options.commands || [
      "xtensa-esp32s3-elf-addr2line",
      "xtensa-esp32-elf-addr2line",
      "riscv32-esp-elf-addr2line",
    ]).filter(Boolean);
    this.execute = options.execute || execFileAsync;
  }

  async symbolize(elfContent, addresses) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "gernetix-symbolize-"));
    const elfPath = path.join(directory, "firmware.elf");
    try {
      await fs.writeFile(elfPath, elfContent, { mode: 0o600 });
      let missingCommand = null;
      let lastFailure = null;
      let unresolvedFallback = null;
      for (const command of this.commands) {
        try {
          const { stdout } = await this.execute(command, ["-f", "-C", "-e", elfPath, ...addresses], {
            timeout: 10000,
            maxBuffer: 256 * 1024,
          });
          const frames = parseAddr2line(stdout, addresses);
          if (frames.some((frame) => frame.resolved)) return frames;
          unresolvedFallback ||= frames;
        } catch (error) {
          if (error?.code === "ENOENT") {
            missingCommand = command;
            continue;
          }
          lastFailure = { command, reason: String(error?.message || error).slice(0, 300) };
        }
      }
      if (unresolvedFallback) return unresolvedFallback;
      if (lastFailure) {
        throw new BuildDeployError("symbolization_failed", "ELF-Symbolisierung ist fehlgeschlagen.", 422, lastFailure);
      }
      throw new BuildDeployError("addr2line_unavailable", "Für diese ESP32-Architektur ist kein addr2line-Werkzeug verfügbar.", 503, {
        last_command: missingCommand,
      });
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  }
}

function parseAddr2line(output, addresses) {
  const lines = String(output || "").split(/\r?\n/);
  return addresses.map((address, index) => {
    const functionName = String(lines[index * 2] || "??").trim();
    const location = String(lines[index * 2 + 1] || "??:0").trim();
    const match = location.match(/^(.*?):(\d+)(?:\s.*)?$/);
    const file = match ? match[1] : location;
    const line = match ? Number(match[2]) : 0;
    const resolved = functionName !== "??" && file !== "??" && line > 0;
    return { address, resolved, function: resolved ? functionName : "", file: resolved ? file : "", line: resolved ? line : 0 };
  });
}

module.exports = { ElfSymbolizer, parseAddr2line };
