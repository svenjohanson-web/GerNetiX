"use strict";

/*
 * Das Dockerfile kopiert einzelne Dateien statt des ganzen Baums: der Container
 * soll nur enthalten, was der Lauf wirklich braucht. Der Preis ist, dass ein
 * neues require in einer beteiligten Datei erst beim Containerstart auffaellt --
 * mit MODULE_NOT_FOUND, nach dem Bauen des Images, in der CI.
 *
 * Zweimal passiert: user-action-events.js aus project-routes.js und
 * forgejo-migration-dry-run.js aus project-service.js. Beide Male stand die
 * Ursache in einer Datei, die niemand fuer diesen Container angefasst hatte.
 *
 * Dieser Test loest die require-Kette vom Einstiegspunkt aus auf und vergleicht
 * sie mit den COPY-Zeilen -- vor dem Bauen, in Millisekunden.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..", "..");
const entryPoint = path.join(__dirname, "run-ui-e2e.js");

function copiedPaths() {
  const dockerfile = fs.readFileSync(path.join(__dirname, "Dockerfile"), "utf8");
  return [...dockerfile.matchAll(/^COPY\s+(\S+)\s/gm)]
    .map((match) => match[1])
    .filter((source) => !source.includes("package"));
}

function resolveRequire(fromFile, request) {
  const target = path.resolve(path.dirname(fromFile), request);
  for (const candidate of [target, `${target}.js`, path.join(target, "index.js")]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function requireChain(start) {
  const seen = new Set();
  const pending = [start];
  while (pending.length > 0) {
    const file = path.resolve(pending.pop());
    if (seen.has(file) || !fs.existsSync(file)) continue;
    seen.add(file);
    for (const match of fs.readFileSync(file, "utf8").matchAll(/require\("(\.[^"]+)"\)/g)) {
      const resolved = resolveRequire(file, match[1]);
      if (resolved) pending.push(resolved);
    }
  }
  return [...seen];
}

test("the container image carries every file the UI E2E run requires", () => {
  const copied = copiedPaths();
  const isCopied = (relative) => copied.some((source) => relative === source || relative.startsWith(`${source}/`));

  const chain = requireChain(entryPoint);
  assert.ok(chain.length > 10, "die require-Kette wurde nicht aufgeloest");

  const missing = chain
    .map((file) => path.relative(repoRoot, file).replace(/\\/g, "/"))
    .filter((relative) => !isCopied(relative))
    .sort();

  assert.deepEqual(missing, [], `Diese Dateien fehlen als COPY-Zeile in tools/forgejo-ui-e2e/Dockerfile:\n  ${missing.join("\n  ")}`);
});

test("every COPY line points at something that exists", () => {
  const fehlend = copiedPaths().filter((source) => !fs.existsSync(path.join(repoRoot, source)));
  assert.deepEqual(fehlend, [], "COPY verweist auf nicht vorhandene Pfade");
});
