"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { main } = require("./start-identity-remote-dev");

test("refuses to start a second local Identity process", () => {
  assert.throws(() => main(), /Lokaler Identity-Remote-Dev ist deaktiviert/);
});
