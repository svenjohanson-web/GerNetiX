const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const app = fs.readFileSync(path.resolve(__dirname, "../public/app/app.js"), "utf8");
const html = fs.readFileSync(path.resolve(__dirname, "../public/app/index.html"), "utf8");
const css = fs.readFileSync(path.resolve(__dirname, "../public/app/app.css"), "utf8");

test("IDE view is selected automatically from the opened file", () => {
  assert.doesNotMatch(html, /data-ide-view-mode|saveSourceButton|ideToolbar/);
  assert.doesNotMatch(html, /Freier Entwicklungsmodus[\s\S]*<h2>Entwickeln<\/h2>/);
  assert.match(app, /const plantUml = \/\\\.\(puml\|plantuml\)\$\/i/);
  assert.match(app, /PlantUML · Quelle und Grafik/);
  assert.match(app, /const image = \/\\\.\(svg\|png\|jpe\?g\|gif\|webp\)\$\/i/);
});

test("Ctrl or Command S saves and build or flash persists first", () => {
  assert.match(app, /event\.ctrlKey \|\| event\.metaKey/);
  assert.match(app, /event\.key\.toLowerCase\(\) !== "s"/);
  assert.match(app, /async function persistCurrentSource/);
  assert.ok((app.match(/await persistCurrentSource\(project\)/g) || []).length >= 3);
});

test("failed builds show their concrete error in the terminal", () => {
  assert.match(app, /Build fehlgeschlagen: \$\{completed\.error/);
  assert.match(app, /appendBuildFailureLog\(completed\.build_log\)/);
  assert.match(app, /fatal error:/);
  assert.doesNotMatch(app, /failed: Build abgeschlossen/);
});

test("build terminal keeps progress and error output compact", () => {
  assert.match(app, /kind === "running" && previous\?\.classList\.contains\("terminal-running"\)/);
  assert.match(app, /slice\(-8\)/);
  assert.match(app, /replace\(\/\\x1b/);
});

test("IDE responds to available container width and browser sidebars", () => {
  assert.match(css, /\.app-shell \{[^}]*width: 100%;[^}]*max-width: none/);
  assert.match(css, /#ideView \{\s*container-type: inline-size/);
  assert.match(css, /@container \(max-width: 700px\)/);
  assert.match(css, /\.ide-layout \{[\s\S]*grid-template-columns: auto minmax\(0, 1fr\)/);
});

test("IDE fits into viewport height and scrolls only inside its panes", () => {
  assert.match(app, /document\.body\.classList\.toggle\("ide-workspace-active", route === "ide"\)/);
  assert.match(css, /\.ide-workspace-active \{[^}]*height: 100dvh;[^}]*overflow: hidden/);
  assert.match(css, /\.ide-workspace-active \.ide-layout,[\s\S]*height: 100%/);
  assert.match(css, /\.ide-workspace-active #ideTerminalOutput \{[\s\S]*overflow: auto/);
});

test("project tree stays top-aligned and build console keeps useful history visible", () => {
  assert.match(css, /\.ide-project-browser \{[\s\S]*align-content: start;[\s\S]*grid-auto-rows: max-content/);
  assert.match(css, /height: clamp\(260px, 32vh, 360px\)/);
  assert.match(css, /\.ide-build-actions \{[\s\S]*flex-wrap: nowrap/);
});

test("workspace panes and chat input can be resized by the user", () => {
  assert.match(css, /\.ide-workspace-active \.ide-project-browser-panel \{[\s\S]*resize: horizontal/);
  assert.match(css, /\.ide-workspace-active \.ide-code-assistant \{[\s\S]*resize: horizontal/);
  assert.match(css, /\.ide-workspace-active \.ide-build-console \{[\s\S]*resize: vertical/);
  assert.match(css, /\.code-explorer-chat textarea \{[\s\S]*min-height: 72px;[\s\S]*resize: vertical/);
});

test("workspace sizes persist locally per account without backend storage", () => {
  assert.match(app, /gernetix\.ide\.layout\.v1:\$\{accountId\}/);
  assert.match(app, /localStorage\.setItem\(ideLayoutStorageKey\(\), JSON\.stringify\(layout\)\)/);
  assert.match(app, /new ResizeObserver/);
  assert.match(app, /projectBrowserWidth/);
  assert.match(app, /assistantWidth/);
  assert.match(app, /buildHeight/);
  assert.match(app, /chatInputHeight/);
  assert.doesNotMatch(app, /postJson\([^\n]*ideLayoutStorageKey/);
});
