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
  assert.match(guidedView, /content: ""/);
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

test("shows the submitted question immediately and an animated waiting answer", () => {
  assert.match(guidedView, /messages\.push\(\{ role: "user", content \}\);[\s\S]*pending: true[\s\S]*renderProjectAssistant\(project\);/);
  assert.match(guidedView, /code-explorer-chat-waiting[\s\S]*<i><\/i><i><\/i><i><\/i>/);
  assert.match(guidedView, /messages: messages\.filter\(\(message\) => !message\.pending\)/);
  assert.match(guidedView, /Object\.assign\(pendingMessage,[\s\S]*pending: false/);
  assert.match(guidedView, /scrollCodeExplorerChatToEnd/);
});

test("shows responder model token usage and duration below every AI answer", () => {
  assert.match(guidedView, /responseMeta: codeExplorerResponseMeta\(response\)/);
  assert.match(guidedView, /routing\.label \|\| routing\.provider/);
  assert.match(guidedView, /promptTokens: Number\.isFinite\(usage\.promptTokens\)/);
  assert.match(guidedView, /completionTokens: Number\.isFinite\(usage\.completionTokens\)/);
  assert.match(guidedView, /totalTokens: Number\.isFinite\(usage\.totalTokens\)/);
  assert.match(guidedView, /code-explorer-response-meta/);
  assert.match(guidedView, /System \/ Fehler/);
});

test("shows and updates the account token allowance next to the development AI chat", () => {
  assert.match(guidedView, /renderCodeExplorerUsage\(\)/);
  assert.match(guidedView, /state\.aiUsage\?\.rating/);
  assert.match(guidedView, /code-explorer-usage-bar/);
  assert.match(guidedView, /Tokens diesen Monat/);
  assert.match(guidedView, /recordCodeExplorerUsage\(response\)/);
  assert.match(guidedView, /source\.month_tokens = Number\(source\.month_tokens \|\| 0\) \+ totalTokens/);
});

test("routes code explorer questions through agentic project tools", () => {
  assert.match(assistant, /codeExplorerMode \? "code_generation" : "architecture_discovery"/);
  assert.match(assistant, /Rolle: Projekt-Coding-Agent/);
  assert.match(assistant, /find_and_read_project_sources/);
  assert.match(assistant, /source_kind=architecture fuer Komponenten, Boards, Module, Beziehungen oder Diagramme/);
  assert.match(assistant, /projectSourceMatchesKind\(item\.path, sourceKind\)/);
  assert.match(assistant, /Architektur\\\/\|\\\.\(\?:puml\|plantuml\)/);
  assert.doesNotMatch(assistant, /name: "read_project_source"/);
  assert.match(assistant, /"code_explorer_assistance"/);
});

test("returns a real endpoint error instead of a fallback answer", () => {
  assert.doesNotMatch(assistant, /codeExplorerFallback|fallbackAnswer/);
  assert.match(assistant, /development_assistant_unavailable/);
  assert.match(assistant, /sendJson\(res, Number\(error\.status\) >= 400 \? Number\(error\.status\) : 503/);
  assert.match(assistant, /KI-Tageslimit erreicht/);
  assert.match(assistant, /Kurze Folgenachrichten verfeinern die offene Aufgabe/);
  assert.match(assistant, /fehlende GPIO-\/Schaltungsdetails bleiben offen/);
});

test("allows long reasoning requests and reports provider timeouts clearly", () => {
  assert.match(assistant, /const PROVIDER_TIMEOUT_MS = 180000/);
  assert.match(assistant, /setTimeout\(\(\) => controller\.abort\(\), PROVIDER_TIMEOUT_MS\)/);
  assert.match(assistant, /const CODE_EXPLORER_FILE_CONTEXT_CHARS = 24000/);
  assert.match(assistant, /\.slice\(0, 8\)/);
  assert.doesNotMatch(assistant, /payload: JSON\.stringify\(artifact\.payload/);
  assert.match(guidedView, /Die KI arbeitet noch – die Antwort dauert ungewöhnlich lange/);
  assert.match(guidedView, /}, 8000\)/);
  assert.match(assistant, /nicht innerhalb von 180 Sekunden geantwortet/);
  assert.match(assistant, /es wurde keine Datei verändert/);
});

test("identity uses the same installed default Ollama model as the admin tool", () => {
  assert.match(devServer, /process\.env\.OLLAMA_MODEL \|\| "llama3\.2:3b"/);
});

test("discovers project sources server-side and applies confirmed edits through project source persistence", () => {
  assert.match(publicApp, /GuidedProjectView\.create\(\{[\s\S]*getJson,[\s\S]*putJson,/);
  assert.doesNotMatch(guidedView, /loadCodeExplorerProjectFiles/);
  assert.match(guidedView, /files: \[\]/);
  assert.match(assistant, /callOpenAiCodeAgent/);
  assert.match(assistant, /function_call_output/);
  assert.match(assistant, /projectServerJson\(`\/api\/projects/);
  assert.match(guidedView, /previousResponseId: messages\.providerResponseId/);
  assert.match(guidedView, /messages\.providerResponseId = response\.providerResponseId/);
  assert.match(assistant, /previousResponseId && codeExplorerMode \? \[userMessages\.at\(-1\)\] : userMessages/);
  assert.match(guidedView, /Werkzeugschritte/);
  assert.match(guidedView, /data-apply-code-edit/);
  assert.match(guidedView, /data-show-code-edit/);
  assert.match(guidedView, /Änderung anzeigen/);
  assert.match(guidedView, /function buildCodeExplorerDiff/);
  assert.match(guidedView, /code-diff-line/);
  assert.match(guidedView, /await putJson\(`\/api\/platform\/projects\/\$\{encodeURIComponent\(project\.id\)\}\/sources/);
  assert.match(guidedView, /updateGuidedSourceContent\(project, edit\.path, edit\.content\)/);
  assert.doesNotMatch(guidedView, /delete state\.projectSourcesByProjectId\[project\.id\][\s\S]{0,300}updateGuidedSourceContent/);
  assert.match(guidedView, /renderIdeViewMode\(project\)/);
  assert.match(guidedView, /guidedView\.payload\.source = content/);
  assert.match(assistant, /<gernetix-file-edits>/);
  assert.match(assistant, /allowedPaths\.has\(edit\.path\)/);
});

test("adds a deterministic file and line summary to proposed AI edits", () => {
  assert.match(assistant, /describeCodeExplorerEdit\(edit, context\)/);
  assert.match(assistant, /lineStart/);
  assert.match(assistant, /lineEnd/);
  assert.match(assistant, /addedLines/);
  assert.match(assistant, /removedLines/);
  assert.match(guidedView, /code-explorer-change-summary/);
  assert.match(guidedView, />Zusammenfassung</);
  assert.match(guidedView, /Zeile \$\{edit\.lineStart/);
});

test("turns explicit file changes into concise confirmable edits even when a local model ignores the marker", () => {
  assert.match(assistant, /Kein doppelter Markdown-Code/);
  assert.match(assistant, /parseCodeExplorerResult\(rawAssistantContent, effectiveCodeContext, latestUserRequest\)/);
  assert.match(assistant, /recoverCodeExplorerEdit/);
  assert.match(assistant, /@startuml\[\\s\\S\]\*@enduml/);
  assert.match(assistant, /resolveCodeExplorerFile\(context, currentPath\)/);
  assert.match(assistant, /allowedPaths\.has\(currentFile\.path\)/);
  assert.match(assistant, /keine übernehmbare Dateiänderung geliefert/);
});

test("lets the coding agent discover structural targets instead of hard-coded component routing", () => {
  assert.doesNotMatch(guidedView, /function codeExplorerTargetPath/);
  assert.doesNotMatch(guidedView, /genericElementMutation/);
  assert.match(assistant, /bearbeite nur einen dadurch gelesenen Pfad/);
  assert.match(assistant, /toolFiles\.set\(item\.path/);
  assert.match(assistant, /allowedPaths\.has\(edit\.path\)/);
  assert.match(assistant, /loadResponseFileContext\(responseFileContext, options\.previousResponseId\)/);
  assert.match(assistant, /rememberResponseFileContext\(responseFileContext, payload\.id, toolFiles\)/);
  assert.match(assistant, /Die KI hat keine übernehmbare Dateiänderung geliefert; es wurde nichts verändert/);
});
