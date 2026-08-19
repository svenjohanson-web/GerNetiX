"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const appRoot = path.resolve(__dirname, "../public/app");
const read = (file) => fs.readFileSync(path.join(appRoot, file), "utf8");
const html = read("index.html");
const hardwareFragment = read("fragments/hardware-lab.html");
const css = read("app.css");
const pattern = read("ai-chat-pattern.js");
const guided = read("guided-project-view.js");
const information = read("information-view.js");
const development = read("development-platform.js");
const hardwareLab = read("hardware-lab-controller.js");
const shell = read("app-shell-controller.js");

test("loads one shared AI-chat behavior before domain controllers", () => {
  assert.doesNotMatch(html, /guided-project-view\.js/);
  assert.match(shell, /loadGuidedProjectAssets[\s\S]*guided-project-view\.js/);
  assert.doesNotMatch(html, /hardware-lab-controller\.js/);
  assert.match(shell, /loadPlatformScript\(`\/app\/hardware-lab-controller\.js\?v=\$\{version\}`\)/);
  assert.doesNotMatch(shell, /requirements-workshop-controller\.js/);
  assert.ok(html.indexOf("ai-chat-pattern.js") < html.indexOf("app-shell-controller.js"));
  assert.equal((html.match(/ai-chat-pattern\.js/g) || []).length, 1);
});

test("applies the standard pattern to every current platform AI chat", () => {
  assert.match(html, /development-chat-sidebar[^\n]*ai-chat ai-chat--compact/);
  assert.match(hardwareFragment, /hardware-lab-chat ai-chat ai-chat--large/);
  assert.match(guided, /code-explorer-chat ai-chat ai-chat--compact/);
  assert.match(information, /help-chat ai-chat ai-chat--regular/);
  assert.match(guided, /guided-requirements-mirror ai-chat ai-chat--large/);
  [html, hardwareFragment, guided, information].forEach((source) => {
    assert.match(source, /data-ai-chat-form/);
    assert.match(source, /data-ai-chat-input/);
    assert.match(source, /data-ai-chat-send/);
    assert.match(source, /ai-chat__send/);
    assert.match(source, /&uarr;/);
  });
  assert.doesNotMatch(information, />Send<\/button>/);
});

test("standardizes scale, composer, messages and accessible arrow controls", () => {
  assert.match(css, /\.ai-chat \{[\s\S]*--ai-chat-send-size: 36px/);
  assert.match(css, /\.ai-chat--compact \{[^}]*--ai-chat-send-size: 32px/);
  assert.match(css, /\.ai-chat--large \{[^}]*--ai-chat-message-font: 14px/);
  assert.match(css, /\.ai-chat \.ai-chat__input-box \{ position: relative; display: block/);
  assert.match(css, /\.ai-chat \.ai-chat__send \{[\s\S]*position: absolute;[\s\S]*border-radius: 999px/);
  assert.match(css, /\.ai-chat \.ai-chat__send:focus-visible/);
  assert.match(html, /ai-chat__send[^>]*aria-label="Nachricht senden"/);
  assert.match(hardwareFragment, /ai-chat__send[^>]*aria-label="Nachricht senden"/);
  assert.match(guided, /ai-chat__send[^>]*aria-label="Vorschlag prüfen"/);
  assert.match(guided, /ai-chat__send[^>]*aria-label="Frage senden"/);
  assert.match(information, /ai-chat__send[^>]*aria-label="Frage senden"/);
});

test("keeps pending and error feedback visible in every AI-chat domain", () => {
  assert.match(development, /pending: true/);
  assert.match(development, /ai-chat__status/);
  assert.match(development, /error: true/);
  assert.match(guided, /pending: true/);
  assert.match(guided, /ai-chat__status/);
  assert.match(guided, /error: true/);
  assert.match(information, /pending: true[\s\S]*chatBusy = true/);
  assert.match(information, /error: true/);
  assert.match(hardwareLab, /state: "pending"/);
  assert.match(hardwareLab, /state = "error"/);
  assert.match(guided, /requirements_mirror[\s\S]*pending: true/);
  assert.match(guided, /requirements-workshop\/feedback/);
  assert.match(css, /\.ai-chat \.ai-chat__message\.is-error/);
  assert.match(css, /\.ai-chat \.ai-chat__status/);
});

test("Enter submits, Shift+Enter keeps a newline and IME composition stays safe", () => {
  const listeners = {};
  const document = { addEventListener(type, handler) { listeners[type] = handler; } };
  vm.runInNewContext(pattern, {
    document,
    queueMicrotask,
    getComputedStyle: () => ({ maxHeight: "180px" }),
    Number,
    Math,
  });
  let submitted = 0;
  let prevented = 0;
  const input = { form: { requestSubmit() { submitted += 1; } }, closest: () => input };
  const keyEvent = (overrides = {}) => ({ target: input, key: "Enter", shiftKey: false, isComposing: false, keyCode: 13, preventDefault() { prevented += 1; }, ...overrides });

  listeners.keydown(keyEvent());
  listeners.keydown(keyEvent({ shiftKey: true }));
  listeners.keydown(keyEvent({ isComposing: true }));
  listeners.keydown(keyEvent({ keyCode: 229 }));

  assert.equal(submitted, 1);
  assert.equal(prevented, 1);
});

test("prevents native navigation for every standard AI-chat form", async () => {
  const listeners = {};
  const document = { addEventListener(type, handler) { listeners[type] = handler; } };
  vm.runInNewContext(pattern, {
    document,
    queueMicrotask,
    getComputedStyle: () => ({ maxHeight: "180px" }),
    Number,
    Math,
  });
  let prevented = 0;
  const form = {
    matches: (selector) => selector === "[data-ai-chat-form]",
    querySelector: () => null,
  };
  listeners.submit({ target: form, preventDefault() { prevented += 1; } });
  await Promise.resolve();
  assert.equal(prevented, 1);
});
