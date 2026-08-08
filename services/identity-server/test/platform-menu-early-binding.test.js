"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const appRoot = path.join(__dirname, "..", "public", "app");
const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
const earlyShell = fs.readFileSync(path.join(appRoot, "app-shell-early.js"), "utf8");
const eventBindings = fs.readFileSync(path.join(appRoot, "app-event-bindings.js"), "utf8");

test("loads the hamburger binding before route and feature controllers", () => {
  const earlyIndex = html.indexOf("/app/app-shell-early.js?v=20260805-shell-menu-1");
  const shellIndex = html.indexOf("/app/app-shell-controller.js?v=20260808-guided-sequence-17");
  const bindingsIndex = html.indexOf("/app/app-event-bindings.js?v=20260805-shell-menu-1");
  assert.ok(earlyIndex >= 0);
  assert.ok(earlyIndex < shellIndex);
  assert.ok(shellIndex < bindingsIndex);
  assert.doesNotMatch(eventBindings, /#mainMenuButton[^\n]*addEventListener/);
});

test("opens and closes the menu without any feature module", () => {
  const listeners = { button: {}, menu: {}, document: {} };
  const attributes = { "aria-expanded": "false" };
  const classes = new Set(["hidden"]);
  const button = {
    addEventListener(type, listener) { listeners.button[type] = listener; },
    setAttribute(name, value) { attributes[name] = value; },
  };
  const menu = {
    addEventListener(type, listener) { listeners.menu[type] = listener; },
    classList: {
      add(name) { classes.add(name); },
      contains(name) { return classes.has(name); },
      toggle(name) { return classes.has(name) ? (classes.delete(name), false) : (classes.add(name), true); },
    },
  };
  const document = {
    addEventListener(type, listener) { listeners.document[type] = listener; },
    querySelector(selector) { return selector === "#mainMenuButton" ? button : selector === "#mainMenu" ? menu : null; },
  };
  vm.runInNewContext(earlyShell, { document });

  let propagationStopped = false;
  listeners.button.click({ stopPropagation() { propagationStopped = true; } });
  assert.equal(propagationStopped, true);
  assert.equal(classes.has("hidden"), false);
  assert.equal(attributes["aria-expanded"], "true");

  listeners.document.click();
  assert.equal(classes.has("hidden"), true);
  assert.equal(attributes["aria-expanded"], "false");
});

test("global bindings start before lazy feature handlers exist", () => {
  const element = {
    addEventListener() {},
    classList: { contains() { return true; } },
    dataset: {},
    value: "",
  };
  const document = {
    addEventListener() {},
    querySelector() { return element; },
    querySelectorAll() { return []; },
  };
  const window = {
    addEventListener() {},
    location: { href: "", origin: "http://localhost:4300" },
    setTimeout() {},
  };

  assert.doesNotThrow(() => vm.runInNewContext(eventBindings, {
    bootstrap() {},
    document,
    window,
  }));
});
