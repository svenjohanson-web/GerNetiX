const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const guidedView = fs.readFileSync(path.resolve(__dirname, "../public/app/guided-project-view.js"), "utf8");
const publicApp = fs.readFileSync(path.resolve(__dirname, "../public/app/app.js"), "utf8");
const assistant = fs.readFileSync(path.resolve(__dirname, "../src/dev/development-assistant.js"), "utf8");
const devServer = fs.readFileSync(path.resolve(__dirname, "../src/dev-server.js"), "utf8");

test("shows a contextual AI chat only for code explorer views", () => {
  assert.match(guidedView, /view\?\.type === "source_analysis"/);
  assert.match(guidedView, /artifact\?\.type === "code"/);
  assert.match(guidedView, /Code gemeinsam verstehen/);
  assert.match(guidedView, /assistantMode: "code_explorer"/);
  assert.match(guidedView, /content: artifact\.content \|\| document\.querySelector\("#sourceEditor"\)/);
});

test("renders the project assistant in the visible IDE workbench", () => {
  assert.match(publicApp, /renderIdeCodeAssistant\(project\)/);
  assert.match(publicApp, /GuidedProjectView\.create\(\{[\s\S]*escapeAttribute,[\s\S]*meta,/);
  assert.match(guidedView, /document\.querySelector\("#ideCodeAssistant"\)/);
  assert.match(guidedView, /renderProjectAssistant/);
});

test("separates chat history from input before the first message", () => {
  assert.match(guidedView, />Verlauf<\/p>[\s\S]*code-explorer-chat-messages/);
  assert.match(guidedView, /<form data-code-explorer-chat>[\s\S]*>Eingabe<\/p>/);
});

test("routes code explorer questions with bounded source context", () => {
  assert.match(assistant, /codeExplorerMode \? "code_generation" : "architecture_discovery"/);
  assert.match(assistant, /Rolle: Code-Explorer/);
  assert.match(assistant, /slice\(0, 24000\)/);
  assert.match(assistant, /"code_explorer_assistance"/);
});

test("uses a code-specific fallback when the configured provider is unavailable", () => {
  assert.match(assistant, /codeExplorerMode[\s\S]*codeExplorerFallback\(body\.codeContext/);
  assert.match(assistant, /Der Code-Assistent kann die/);
  assert.match(assistant, /Es wurden keine Dateien veraendert/);
});

test("identity uses the same installed default Ollama model as the admin tool", () => {
  assert.match(devServer, /process\.env\.OLLAMA_MODEL \|\| "llama3\.2:3b"/);
});

test("knows project artifacts and applies confirmed edits through project source persistence", () => {
  assert.match(publicApp, /GuidedProjectView\.create\(\{[\s\S]*getJson,[\s\S]*putJson,/);
  assert.match(guidedView, /loadCodeExplorerProjectFiles/);
  assert.match(guidedView, /artifacts: guidedViews\(project\)/);
  assert.match(guidedView, /data-apply-code-edit/);
  assert.match(guidedView, /await putJson\(`\/api\/platform\/projects\/\$\{encodeURIComponent\(project\.id\)\}\/sources/);
  assert.match(assistant, /<gernetix-file-edits>/);
  assert.match(assistant, /allowedPaths\.has\(edit\.path\)/);
});
