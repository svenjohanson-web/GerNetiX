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

// Die Position wird ueber den Dateinamen gesucht, nicht ueber eine bestimmte
// Cache-Version. Geprueft wird die Ladereihenfolge; welche Version dabei
// ausgeliefert wird, sichert asset-cache-versions.test.js.
const ladePosition = (datei) => html.indexOf(`/app/${datei}?v=`);

test("loads the hamburger binding before route and feature controllers", () => {
  const early = ladePosition("app-shell-early.js");
  const shell = ladePosition("app-shell-controller.js");
  const bindings = ladePosition("app-event-bindings.js");

  assert.ok(early >= 0, "app-shell-early.js wird nicht geladen");
  assert.ok(shell >= 0, "app-shell-controller.js wird nicht geladen");
  assert.ok(bindings >= 0, "app-event-bindings.js wird nicht geladen");
  assert.ok(early < shell, "app-shell-early.js muss vor dem Controller stehen");
  assert.ok(shell < bindings, "der Controller muss vor den Bindungen stehen");
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
