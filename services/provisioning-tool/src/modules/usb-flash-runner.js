const fs = require("node:fs");
const path = require("node:path");
const { execFile, spawn } = require("node:child_process");
const { ProvisioningError } = require("../errors");

class UsbFlashRunner {
  static createEsptoolInvocation(options = {}) {
    return createEsptoolInvocation(options);
  }

  static parseEsptoolProgressLine(line = "") {
    return parseEsptoolProgressLine(line);
  }

  constructor(options = {}) {
    this.runner = options.runner || "mock";
    this.allowRealUsbFlash = options.allowRealUsbFlash === true;
    this.firmwareRoot = options.firmwareRoot;
    this.firmwareArtifact = options.firmwareArtifact || null;
    this.toolchainRoot = options.toolchainRoot || "";
    this.toolchainManifestPath = options.toolchainManifestPath || "";
    this.platformioExecutable = options.platformioExecutable || "";
    this.esptoolExecutable = options.esptoolExecutable || "";
    this.esptoolPythonExecutable = options.esptoolPythonExecutable || "";
    this.timeoutMs = Number(options.timeoutMs || 180000);
  }

  async run(input = {}) {
    const port = input.port || null;
    const firmwareArtifact = input.firmwareArtifact || this.firmwareArtifact || null;
    const runner = input.runner || this.runner;
    if (runner === "mock") {
      return {
        status: "mock_flash_completed",
        runner: "mock",
        transport: "usb",
        port,
        firmware_artifact: summarizeArtifact(firmwareArtifact),
        firmware_root: this.firmwareRoot || "",
        completed_at: new Date().toISOString(),
      };
    }

    if (!["platformio", "esptool"].includes(runner)) {
      throw new ProvisioningError("unsupported_flash_runner", `USB-Flash-Runner wird nicht unterstuetzt: ${runner}`, 400);
    }

    if (!this.allowRealUsbFlash) {
      throw new ProvisioningError(
        "real_usb_flash_disabled",
        "Echter USB-Flash ist serverseitig deaktiviert. Starte das Provisioning Tool mit ALLOW_REAL_USB_FLASH=true.",
        409,
      );
    }

    if (runner === "esptool") {
      this.assertToolchainReady("esptool");
      return this.runEsptool({ port, firmwareArtifact, cancelToken: input.cancelToken, onProgress: input.onProgress });
    }

    this.assertToolchainReady("platformio");

    const stagingPath = firmwareArtifact?.local_staging_path || this.firmwareRoot || "";
    if (!stagingPath) {
      throw new ProvisioningError(
        "missing_firmware_artifact_staging_path",
        "Kein serverseitiges Firmware-Artefakt mit lokalem Staging-Pfad fuer USB-Flash konfiguriert.",
        500,
      );
    }

    const args = ["run", "-t", "upload"];
    if (port) {
      args.push("--upload-port", port);
    }

    const startedAt = new Date().toISOString();
    const result = await execFileAsync(this.platformioExecutable, args, {
      cwd: stagingPath,
      timeout: this.timeoutMs,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    }).catch((error) => ({
      error,
      stdout: error.stdout || "",
      stderr: error.stderr || "",
    }));

    if (result.error) {
      return {
        status: result.error.killed ? "timeout" : "failed",
        runner: "platformio",
        transport: "usb",
        port,
        firmware_artifact: summarizeArtifact(firmwareArtifact),
        firmware_staging_path: stagingPath,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        exit_code: result.error.code ?? null,
        signal: result.error.signal ?? null,
        stdout: trimLog(result.stdout),
        stderr: trimLog(result.stderr || result.error.message),
      };
    }

    return {
      status: "flashed",
      runner: "platformio",
      transport: "usb",
      port,
      firmware_artifact: summarizeArtifact(firmwareArtifact),
      firmware_staging_path: stagingPath,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      stdout: trimLog(result.stdout),
      stderr: trimLog(result.stderr),
    };
  }

  async runEsptool({ port, firmwareArtifact, cancelToken, onProgress }) {
    if (!firmwareArtifact?.materialized_file_path) {
      throw new ProvisioningError(
        "missing_materialized_firmware_file",
        "Kein materialisiertes Firmware-File fuer echten USB-Flash vorhanden.",
        500,
      );
    }
    const invocation = createEsptoolInvocation({
      esptoolExecutable: this.esptoolExecutable,
      esptoolPythonExecutable: this.esptoolPythonExecutable,
    });
    const args = invocation.args.concat(["--chip", "esp32"]);
    if (port) args.push("--port", port);
    args.push("write_flash", firmwareArtifact.flash_offset || "0x0", firmwareArtifact.materialized_file_path);
    const startedAt = new Date().toISOString();
    const executor = onProgress ? execFileStreaming : execFileAsync;
    const result = await executor(invocation.command, args, {
      timeout: this.timeoutMs,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
      cancelToken,
    }, onProgress).catch((error) => ({
      error,
      stdout: error.stdout || "",
      stderr: error.stderr || "",
    }));
    if (result.error) {
      return {
        status: result.error.killed ? "timeout" : "failed",
        runner: "esptool",
        transport: "usb",
        port,
        firmware_artifact: summarizeArtifact(firmwareArtifact),
        command: invocation.command,
        args,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        exit_code: result.error.code ?? null,
        signal: result.error.signal ?? null,
        stdout: trimLog(result.stdout),
        stderr: trimLog(result.stderr || result.error.message),
      };
    }
    return {
      status: "flashed",
      runner: "esptool",
      transport: "usb",
      port,
      firmware_artifact: summarizeArtifact(firmwareArtifact),
      command: invocation.command,
      args,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      stdout: trimLog(result.stdout),
      stderr: trimLog(result.stderr),
    };
  }

  mode(options = {}) {
    const artifactReady = options.artifact_ready === true;
    const toolchain = this.toolchainReadiness();
    return {
      default_runner: this.runner,
      allow_real_usb_flash: this.allowRealUsbFlash,
      artifact_ready: artifactReady,
      toolchain,
      modes: [
        {
          id: "mock",
          title: "Mock-Test",
          enabled: true,
          description: "Simuliert den USB-Flash ohne PlatformIO und ohne Board-Zugriff.",
        },
        {
          id: "esptool",
          title: "Echter USB-Flash",
          enabled: this.allowRealUsbFlash && artifactReady && toolchain.esptool.ready,
          description: "Flasht das materialisierte Firmware-Binary per esptool.",
          disabled_reason: disabledReason([
            [this.allowRealUsbFlash, "Echter USB-Flash ist serverseitig nicht erlaubt."],
            [artifactReady, "Firmware-Artefakt ist noch nicht materialisiert."],
            [toolchain.esptool.ready, toolchain.esptool.message],
          ]),
        },
        {
          id: "platformio",
          title: "PlatformIO USB-Flash",
          enabled: this.allowRealUsbFlash && toolchain.platformio.ready,
          description: "Startet PlatformIO im gestagten Projektverzeichnis.",
          disabled_reason: disabledReason([
            [this.allowRealUsbFlash, "Echter USB-Flash ist serverseitig nicht erlaubt."],
            [toolchain.platformio.ready, toolchain.platformio.message],
          ]),
        },
      ],
    };
  }

  isRealUsbFlashAllowed() {
    return this.allowRealUsbFlash;
  }

  assertToolchainReady(runner) {
    const readiness = this.toolchainReadiness();
    const item = runner === "platformio" ? readiness.platformio : readiness.esptool;
    if (item.ready) return;
    throw new ProvisioningError(
      "usb_flash_toolchain_missing",
      item.message,
      409,
      {
        runner,
        toolchain: readiness,
      },
    );
  }

  toolchainReadiness() {
    return {
      root: this.toolchainRoot,
      manifest_path: this.toolchainManifestPath,
      esptool: checkExecutable("esptool", this.esptoolExecutable, {
        pythonExecutable: this.esptoolPythonExecutable,
        manifestPath: this.toolchainManifestPath,
      }),
      platformio: checkExecutable("PlatformIO", this.platformioExecutable, {
        manifestPath: this.toolchainManifestPath,
      }),
    };
  }
}

function createEsptoolInvocation(options = {}) {
  const esptoolExecutable = options.esptoolExecutable || "";
  if (options.esptoolPythonExecutable && /\.py$/i.test(esptoolExecutable)) {
    return {
      command: options.esptoolPythonExecutable,
      args: [esptoolExecutable],
    };
  }
  return {
    command: esptoolExecutable,
    args: [],
  };
}

function checkExecutable(title, executable, options = {}) {
  const configured = String(executable || "").trim();
  const pythonExecutable = String(options.pythonExecutable || "").trim();
  if (!configured) {
    return {
      ready: false,
      command: "",
      python_executable: pythonExecutable,
      message: `${title}-Toolchain ist nicht konfiguriert. Erzeuge ${options.manifestPath || "das Provisioning-Toolchain-Manifest"} als Runtime-Artefakt.`,
    };
  }
  if (!isConcreteExecutablePath(configured)) {
    return {
      ready: false,
      command: configured,
      python_executable: pythonExecutable,
      message: `${title}-Toolchain muss als konkreter Runtime-Pfad im Provisioning-Toolchain-Manifest stehen, nicht als PATH-Kommando.`,
    };
  }
  if (!fs.existsSync(configured)) {
    return {
      ready: false,
      command: configured,
      python_executable: pythonExecutable,
      message: `${title}-Toolchain-Datei existiert nicht: ${configured}`,
    };
  }
  if (/\.py$/i.test(configured)) {
    if (!pythonExecutable) {
      return {
        ready: false,
        command: configured,
        python_executable: "",
        message: `${title}-Toolchain nutzt ein Python-Skript, aber kein Python-Executable ist im Runtime-Vertrag hinterlegt.`,
      };
    }
    if (!isConcreteExecutablePath(pythonExecutable) || !fs.existsSync(pythonExecutable)) {
      return {
        ready: false,
        command: configured,
        python_executable: pythonExecutable,
        message: `${title}-Python-Executable existiert nicht oder ist kein konkreter Runtime-Pfad: ${pythonExecutable}`,
      };
    }
  }
  return {
    ready: true,
    command: configured,
    python_executable: pythonExecutable,
    message: `${title}-Toolchain ist bereit.`,
  };
}

function isConcreteExecutablePath(value) {
  if (!value) return false;
  return path.isAbsolute(value) || value.includes("/") || value.includes("\\");
}

function disabledReason(checks) {
  const failed = checks.find(([ok]) => !ok);
  return failed ? failed[1] : "";
}

function summarizeArtifact(artifact) {
  if (!artifact) return null;
  return {
    artifact_id: artifact.artifact_id || "",
    source: artifact.source || "",
    uri: artifact.uri || "",
    version: artifact.version || "",
    sha256: artifact.sha256 || "",
    file_name: artifact.file_name || "",
    flash_strategy: artifact.flash_strategy || "",
    flash_offset: artifact.flash_offset || "",
  };
}

function execFileAsync(command, args, options) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function execFileStreaming(command, args, options = {}, onProgress) {
  return new Promise((resolve, reject) => {
    const { timeout, maxBuffer, cancelToken, ...spawnOptions } = options;
    const child = spawn(command, args, spawnOptions);
    let stdout = "";
    let stderr = "";
    const buffers = { stdout: "", stderr: "" };
    let settled = false;
    const timeoutHandle = timeout
      ? setTimeout(() => {
          child.kill();
        }, timeout)
      : null;
    cancelToken?.setCancel?.(() => {
      if (!settled) child.kill();
    });

    const emitLine = (stream, line) => {
      if (!line) return;
      const parsed = parseEsptoolProgressLine(line);
      onProgress?.({
        type: parsed ? "progress" : "log",
        stream,
        line,
        ...(parsed || {}),
      });
    };

    const handleChunk = (stream, chunk) => {
      const text = chunk.toString();
      if (stream === "stdout") stdout += text;
      if (stream === "stderr") stderr += text;
      buffers[stream] += text;
      const parts = buffers[stream].split(/\r?\n/);
      buffers[stream] = parts.pop() || "";
      for (const line of parts) emitLine(stream, line.trimEnd());
    };

    child.stdout?.on("data", (chunk) => handleChunk("stdout", chunk));
    child.stderr?.on("data", (chunk) => handleChunk("stderr", chunk));
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      emitLine("stdout", buffers.stdout.trimEnd());
      emitLine("stderr", buffers.stderr.trimEnd());
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const error = new Error(`Command failed: ${command} ${args.join(" ")}`);
      error.code = code;
      error.signal = signal;
      error.killed = signal !== null;
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

function parseEsptoolProgressLine(line = "") {
  const text = String(line || "");
  const percentMatch = text.match(/\((\d{1,3})\s*%\)/);
  if (percentMatch) {
    return {
      phase: "writing",
      percent: clampPercent(Number(percentMatch[1])),
      message: text,
    };
  }
  if (/^Connecting/i.test(text)) return { phase: "connecting", percent: 2, message: text };
  if (/Uploading stub/i.test(text)) return { phase: "uploading_stub", percent: 5, message: text };
  if (/Stub running/i.test(text)) return { phase: "stub_running", percent: 8, message: text };
  if (/Configuring flash size/i.test(text)) return { phase: "configuring_flash", percent: 10, message: text };
  if (/Flash will be erased/i.test(text)) return { phase: "erasing", percent: 12, message: text };
  if (/Hash of data verified/i.test(text)) return { phase: "verifying", percent: 98, message: text };
  if (/Hard resetting/i.test(text)) return { phase: "resetting", percent: 100, message: text };
  if (/Leaving/i.test(text)) return { phase: "finishing", percent: 99, message: text };
  return null;
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function trimLog(value) {
  const text = String(value || "");
  if (text.length <= 12000) return text;
  return `${text.slice(0, 6000)}\n...[log truncated]...\n${text.slice(-6000)}`;
}

module.exports = { UsbFlashRunner, createEsptoolInvocation, parseEsptoolProgressLine };
