const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appRoot = path.join(__dirname, "..", "public", "app");
const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
const fragment = fs.readFileSync(path.join(appRoot, "fragments", "hardware-lab.html"), "utf8");
const controller = fs.readFileSync(path.join(appRoot, "hardware-lab-controller.js"), "utf8");
const shellController = fs.readFileSync(path.join(appRoot, "app-shell-controller.js"), "utf8");
const css = ["app.css", "hardware-lab-route.css"]
  .map((fileName) => fs.readFileSync(path.join(appRoot, fileName), "utf8"))
  .join("\n");
const initialViewRouter = fs.readFileSync(path.join(appRoot, "initial-view-router.js"), "utf8");
const aiChatPattern = fs.readFileSync(path.join(appRoot, "ai-chat-pattern.js"), "utf8");

test("presents the hardware lab as an explanatory AI chat with a live board profile", () => {
  const view = fragment;
  assert.doesNotMatch(html, /id="hardwareLabView"/);
  assert.match(view, /<p class="eyebrow">Boards erkennen und einrichten<\/p>/);
  assert.match(view, /<h1 id="hardwareLabTitle">KI-Hardware-Assistent<\/h1>/);
  assert.doesNotMatch(view, /KI-Hardware-Labor/);
  assert.match(view, /id="labChatMessages"/);
  assert.match(view, /id="labChatForm"/);
  assert.match(view, /id="labAiUsage"[^>]*aria-label="KI-Nutzung"/);
  assert.match(view, /class="panel hardware-lab-profile"/);
  assert.match(view, /id="labProfileMemory"/);
  assert.match(view, /id="labProfileCapabilities"/);
  assert.match(view, /id="labProfilePeripherals"/);
  assert.match(view, /id="labProfilePins"/);
  assert.match(view, /id="labProfileQuestions"/);
  assert.match(view, /Bestätigte GPIO-Zuordnungen/);
  assert.match(view, /Aktuelle Frage/);
  assert.doesNotMatch(view, /hardware-lab-progress|hardware-lab-ai-result/);
  assert.doesNotMatch(view, /hardwareLabForm|labBoardName|labManufacturer|labSourceUrls|labNotes/);
  assert.doesNotMatch(view, /Eine Webadresse pro Zeile|Eine HTTP-\/HTTPS-URL pro Zeile/);
});

test("shows account AI usage and the token usage of the latest hardware-lab request", () => {
  assert.match(controller, /getJson\("\/api\/platform\/hardware-lab\/ai-usage"\)/);
  assert.match(controller, /Wird geladen …/);
  assert.match(controller, /renderAiRating\("#labAiUsage", true\)/);
  assert.match(controller, /session\?\.lab_chat\?\.usage \|\| session\?\.ai_analysis\?\.usage/);
  assert.match(controller, /Letzter KI-Aufruf/);
  assert.match(controller, /usage\.input_tokens/);
  assert.match(controller, /usage\.output_tokens/);
  assert.match(controller, /usage\.total_tokens/);
  assert.match(controller, /source_id === "openai_gpt"/);
  assert.match(css, /\.hardware-lab-ai-usage \.ai-rating-grid\.compact/);
  assert.match(css, /\.hardware-lab-usage-loading/);
  assert.match(css, /\.hardware-lab-last-usage/);
});

test("connects chat, source analysis and safe discovery actions to the board profile", () => {
  assert.match(controller, /endpoint\(labState\.session, "chat"\)/);
  assert.match(controller, /initial_message: message/);
  assert.match(controller, /profile\.integrated_peripherals/);
  assert.match(controller, /confirmedPins = \(profile\?\.pin_candidates \|\| \[\]\)/);
  assert.match(controller, /session\?\.lab_chat\?\.assistant_state\?\.current_question/);
  assert.match(controller, /assistantStepLabel/);
  assert.match(controller, /proposed_tests/);
  assert.match(controller, /requires_confirmation/);
  assert.match(fragment, /Aktive Pin- oder Bustests werden nie ungefragt ausgeführt/);
  assert.match(css, /\.hardware-lab-layout[^{]*\{[^}]*grid-template-columns/);
  assert.match(css, /\.hardware-lab-chat-messages/);
  assert.match(css, /\.hardware-lab-suggested-actions\.hidden[^}]*display: none/);
});

test("invalidates cached hardware-lab UI assets", () => {
  assert.match(html, /app\.css\?v=20260812-knowledge-library-3/);
  assert.match(html, /api-client\.js\?v=20260807-action-observability-1/);
  assert.doesNotMatch(html, /hardware-lab-controller\.js/);
  assert.match(shellController, /const version = "20260805-route-lazy-3"/);
  assert.match(shellController, /loadPlatformScript\(`\/app\/hardware-lab-controller\.js\?v=\$\{version\}`\)/);
  assert.match(shellController, /loadRouteFragment\("hardwareLabView", `\/app\/fragments\/hardware-lab\.html\?v=\$\{version\}`\)/);
  assert.match(shellController, /loadPlatformStyle\(`\/app\/hardware-lab-route\.css\?v=\$\{version\}`\)/);
  assert.match(html, /ai-chat-pattern\.js\?v=20260805-standard-ai-chat-4/);
  assert.match(html, /app-event-bindings\.js\?v=20260805-shell-menu-1/);
});

test("selects the hardware lab before account data and translations finish loading", () => {
  assert.match(html, /initial-view-router\.js\?v=20260805-hardware-lab-route-1/);
  assert.match(initialViewRouter, /initial-hardware-lab-route/);
  assert.match(initialViewRouter, /#dashboardView\{display:none\}/);
  assert.match(css, /\.hardware-lab-view\.hidden \{ display: none; \}/);
  assert.match(css, /html\.initial-hardware-lab-route #dashboardView \{ display: none; \}/);
  assert.match(css, /html\.initial-hardware-lab-route #hardwareLabView\.hidden \{ display: grid; \}/);
  assert.ok(shellController.indexOf("renderInitialRoute();") < shellController.indexOf("await Promise.all([refreshBootstrap(initialRoute), loadRouteAssets(initialRoute)]);"));
  assert.doesNotMatch(shellController.match(/function renderInitialRoute\(\)[\s\S]*?\n}/)?.[0] || "", /GerNetiXHardwareLab\.render\(\)/);
});

test("shows the greeting and submitted message immediately while the AI request is pending", () => {
  assert.doesNotMatch(controller, /async function enter\(\) \{\s*render\(\);/);
  assert.match(shellController, /if \(!contentRendered\) GerNetiXHardwareLab\.render\(\);\s*GerNetiXHardwareLab\.enter\(\);/);
  assert.match(controller, /pendingMessages\.push\(userMessage, pendingMessage\)[\s\S]*render\(\)[\s\S]*await run/);
  assert.match(controller, /KI verarbeitet die Nachricht …/);
  assert.match(controller, /Die Verbindung ist weiterhin bereit/);
  assert.match(controller, /pendingMessage\.state = "error"/);
  assert.match(css, /\.ai-chat \.hardware-lab-message\.is-error > p \{ border-color: #d97706/);
  assert.match(css, /\.hardware-lab-status\.notice/);
});

test("aligns the hardware-lab shell with the top edge", () => {
  assert.match(shellController, /classList\.toggle\("hardware-lab-active", route === "hardware-lab"\)/);
  assert.match(css, /\.hardware-lab-active \.app-shell, html\.initial-hardware-lab-route \.app-shell \{ padding-top: 0; \}/);
  assert.match(css, /\.hardware-lab-active \.topbar, html\.initial-hardware-lab-route \.topbar \{ position: fixed; top: 0;/);
  assert.match(css, /\.hardware-lab-active #hardwareLabView, html\.initial-hardware-lab-route #hardwareLabView \{ padding-top: 92px; \}/);
});

test("uses explicit high-contrast dark colors for both chat participants", () => {
  assert.match(css, /\.hardware-lab-message p[^}]*background: #172131;[^}]*color: #e5e7eb/);
  assert.match(css, /\.hardware-lab-message\.is-user p[^}]*background: #164e63;[^}]*color: #ecfeff/);
  assert.doesNotMatch(css, /\.hardware-lab-message p[^}]*var\(--surface, #fff\)/);
});

test("sends with Enter and embeds an arrow button inside the composer", () => {
  assert.match(aiChatPattern, /event\.key !== "Enter" \|\| event\.shiftKey \|\| composingText/);
  assert.match(aiChatPattern, /input\.form\?\.requestSubmit\(\)/);
  assert.match(aiChatPattern, /function handleSubmit\(event\)[\s\S]*event\.preventDefault\(\)/);
  assert.match(fragment, /class="hardware-lab-composer-box ai-chat__input-box"[\s\S]*class="hardware-lab-send-button ai-chat__send"[^>]*aria-label="Nachricht senden"[^>]*>&uarr;<\/button>/);
  assert.doesNotMatch(fragment, /id="labChatSendButton"[^>]*>Senden<\/button>/);
  assert.match(css, /\.hardware-lab-composer-box \{ position: relative; display: block; \}/);
  assert.match(css, /\.hardware-lab-send-button \{ position: absolute;[^}]*border-radius: 999px/);
});
