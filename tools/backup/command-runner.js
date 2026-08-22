"use strict";

// Der Orchestrator streamt Dumps und Archive direkt aus den Containern in den
// verschluesselten Sicherungssatz. Ein Kommando gilt erst als erfolgreich, wenn
// es mit Code 0 endet; ein Abbruch mitten im Stream verwirft den ganzen Satz.

const { spawn } = require("node:child_process");
const { Readable } = require("node:stream");

const MAX_STDERR_BYTES = 64 * 1024;

function startCommand({ command, args, input }) {
  const child = spawn(command, args, { stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    if (stderr.length < MAX_STDERR_BYTES) stderr += chunk;
  });
  const completed = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) return resolve();
      const description = `${command} ${args.join(" ")}`;
      const reason = signal ? `Signal ${signal}` : `Exit-Code ${code}`;
      reject(new Error(`Kommando fehlgeschlagen (${reason}): ${description}\n${stderr.trim()}`));
    });
  });
  if (input !== undefined) {
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  }
  return { stdout: child.stdout, completed };
}

// Streamt die Ausgabe eines Kommandos an einen Verbraucher und stellt sicher,
// dass ein spaeter Fehlschlag des Kommandos nicht als Erfolg durchgeht.
async function streamCommand(descriptor, consume) {
  const { stdout, completed } = startCommand(descriptor);
  // Ein Fehlschlag darf nicht als unbehandelte Ablehnung enden, waehrend der
  // Verbraucher noch laeuft; der Fehler wird unten gemeinsam ausgewertet.
  const settled = completed.then(() => null, (error) => error);
  let consumeError = null;
  try {
    await consume(stdout);
  } catch (error) {
    consumeError = error;
    stdout.destroy();
  }
  const commandError = await settled;
  if (commandError) throw commandError;
  if (consumeError) throw consumeError;
}

async function captureCommand(descriptor, options = {}) {
  const maxBytes = options.maxBytes || 1024 * 1024;
  const pieces = [];
  let size = 0;
  await streamCommand(descriptor, async (stdout) => {
    for await (const chunk of stdout) {
      size += chunk.length;
      if (size > maxBytes) throw new Error(`Kommandoausgabe ist groesser als erwartet: ${descriptor.command}`);
      pieces.push(chunk);
    }
  });
  return Buffer.concat(pieces).toString("utf8");
}

async function runCommand(descriptor) {
  await streamCommand(descriptor, async (stdout) => {
    stdout.resume();
    await new Promise((resolve) => stdout.on("end", resolve));
  });
}

// Testdouble-Fabrik: bildet Kommandos anhand ihrer Argumente auf feste
// Antworten ab, ohne dass ein Test Docker benoetigt.
function createScriptedRunner(handlers) {
  const calls = [];
  async function streamScripted(descriptor, consume) {
    calls.push(descriptor);
    const handler = handlers.find((entry) => entry.matches(descriptor));
    if (!handler) throw new Error(`Unerwartetes Kommando im Test: ${descriptor.command} ${descriptor.args.join(" ")}`);
    if (handler.fails) throw new Error(`Kommando fehlgeschlagen (Exit-Code 1): ${descriptor.args.join(" ")}`);
    const output = typeof handler.output === "function" ? handler.output(descriptor) : handler.output;
    await consume(Readable.from([Buffer.isBuffer(output) ? output : Buffer.from(String(output ?? ""))]));
  }
  return {
    calls,
    streamCommand: streamScripted,
    captureCommand: async (descriptor) => {
      const pieces = [];
      await streamScripted(descriptor, async (stdout) => {
        for await (const chunk of stdout) pieces.push(chunk);
      });
      return Buffer.concat(pieces).toString("utf8");
    },
    runCommand: async (descriptor) => {
      await streamScripted(descriptor, async (stdout) => {
        for await (const chunk of stdout) void chunk;
      });
    },
  };
}

module.exports = { captureCommand, createScriptedRunner, runCommand, startCommand, streamCommand };
