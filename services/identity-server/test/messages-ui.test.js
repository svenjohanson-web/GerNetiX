"use strict";

const { readPlatformAppSource } = require("../test-support/platform-app-source");

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { authenticatedItem, navigationModel } = require("../test-support/navigation-model");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public", "app", "index.html"), "utf8");
const fragment = fs.readFileSync(path.join(root, "public", "app", "fragments", "messages.html"), "utf8");
const client = readPlatformAppSource();
const css = fs.readFileSync(path.join(root, "public", "app", "community-routes.css"), "utf8");

test("keeps Messages permanently visible outside the authenticated hamburger groups", () => {
  const messages = authenticatedItem("messagesMenuLink");
  assert.ok(navigationModel.authenticated.fixed.includes(messages));
  assert.deepEqual({ href: messages.href, route: messages.route, className: messages.className }, {
    href: "/app/messages/", route: "messages", className: "utility menu-fixed-action",
  });
  assert.match(client, /messages: "messagesView"/);
  assert.match(client, /if \(route === "messages"\) loadMessages\(\)/);
});

test("renders an Outlook-like folder, list and reading layout", () => {
  assert.doesNotMatch(html, /id="messagesView"/);
  assert.match(fragment, /id="messagesView"[\s\S]*Posteingang[\s\S]*Postausgang[\s\S]*Gesendet[\s\S]*Support[\s\S]*Archiv/);
  assert.match(fragment, /id="messageThreadList"[\s\S]*id="messageReadingPane"/);
  assert.match(css, /\.messages-shell\s*\{[\s\S]*grid-template-columns: 210px minmax\(280px, 370px\) minmax\(420px, 1fr\)/);
});

test("uses server-side message contracts for compose, reply, read and archive", () => {
  assert.match(client, /postJson\("\/api\/community\/message-threads", data\)/);
  assert.match(client, /\/api\/community\/message-threads\/\$\{encodeURIComponent\(state\.messages\.activeThreadId\)\}\/messages/);
  assert.match(client, /\/api\/community\/message-threads\/\$\{encodeURIComponent\(threadId\)\}\/read/);
  assert.match(client, /\?folder=archived/);
});
