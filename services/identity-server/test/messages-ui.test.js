"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public", "app", "index.html"), "utf8");
const client = fs.readFileSync(path.join(root, "public", "app", "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "public", "app", "app.css"), "utf8");

test("adds Messages to the authenticated hamburger menu and route map", () => {
  assert.match(html, /href="\/app\/messages\/" data-route="messages">Nachrichten<\/a>/);
  assert.match(client, /messages: "messagesView"/);
  assert.match(client, /if \(route === "messages"\) loadMessages\(\)/);
});

test("renders an Outlook-like folder, list and reading layout", () => {
  assert.match(html, /id="messagesView"[\s\S]*Posteingang[\s\S]*Postausgang[\s\S]*Gesendet[\s\S]*Support[\s\S]*Archiv/);
  assert.match(html, /id="messageThreadList"[\s\S]*id="messageReadingPane"/);
  assert.match(css, /\.messages-shell\s*\{[\s\S]*grid-template-columns: 210px minmax\(280px, 370px\) minmax\(420px, 1fr\)/);
});

test("uses server-side message contracts for compose, reply, read and archive", () => {
  assert.match(client, /postJson\("\/api\/community\/message-threads", data\)/);
  assert.match(client, /\/api\/community\/message-threads\/\$\{encodeURIComponent\(state\.messages\.activeThreadId\)\}\/messages/);
  assert.match(client, /\/api\/community\/message-threads\/\$\{encodeURIComponent\(threadId\)\}\/read/);
  assert.match(client, /\?folder=archived/);
});
