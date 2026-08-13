const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const publicRoot = path.join(__dirname, "..", "public", "app");
const authHtml = fs.readFileSync(path.join(publicRoot, "auth", "index.html"), "utf8");
const authScript = fs.readFileSync(path.join(publicRoot, "auth", "auth.js"), "utf8");
const authCss = fs.readFileSync(path.join(publicRoot, "auth", "auth.css"), "utf8");
const appHtml = fs.readFileSync(path.join(publicRoot, "index.html"), "utf8");
const apiClient = fs.readFileSync(path.join(publicRoot, "api-client.js"), "utf8");
const sessionState = fs.readFileSync(path.join(publicRoot, "session-state.js"), "utf8");

test("login conflict explains the one-session rule and possible unsaved-data loss", () => {
  assert.match(authHtml, /id="active-session-dialog"[\s\S]*Eine weitere Sitzung ist aktiv/);
  assert.match(authHtml, /nur eine aktive Sitzung gleichzeitig zulässig/);
  assert.match(authHtml, /noch nicht gespeicherte Eingaben oder laufende Bearbeitungen können verloren gehen/);
  assert.match(authHtml, /Bereits gespeicherte Projekte und laufende Serveraufträge bleiben erhalten/);
  assert.match(authHtml, /Andere Sitzung abmelden und fortfahren/);
  assert.match(authHtml, /Diese Anmeldung nicht erkannt – Konto sichern/);
  assert.match(authCss, /\.session-loss-warning/);
});

test("login conflict uses only the short-lived pending token for cancel, takeover and securing", () => {
  assert.match(authScript, /error\?\.code === "active_session_exists"/);
  assert.match(authScript, /error\?\.payload\?\.pending_login_token/);
  assert.match(authScript, /"\/api\/session\/takeover\/cancel"/);
  assert.match(authScript, /"\/api\/session\/takeover"/);
  assert.match(authScript, /"\/api\/session\/secure"/);
  assert.match(authScript, /\{ pending_login_token: pendingLogin\.token \}/);
  assert.doesNotMatch(authScript, /localStorage|sessionStorage/);
});

test("a displaced app session gets a non-dismissible, actionable explanation", () => {
  assert.match(apiClient, /response\.status !== 401 \|\| payload\?\.error !== "session_revoked"/);
  assert.match(apiClient, /gernetix:session-revoked/);
  assert.match(appHtml, /id="sessionRevokedDialog"[\s\S]*Konto wurde auf einem anderen Gerät übernommen/);
  assert.match(appHtml, /href="\/app\/auth\/">Erneut anmelden/);
  assert.match(appHtml, /href="\/app\/auth\/\?next=%2Fapp%2Faccount-setup%2F%3Fsecurity%3Dreview">Konto sichern/);
  assert.match(sessionState, /cancelEvent\) => cancelEvent\.preventDefault\(\)/);
  assert.match(sessionState, /dialog\.showModal\(\)/);
});

test("account securing keeps the freshly authenticated session and opens the security setup", () => {
  assert.match(authScript, /"\/api\/session\/secure"/);
  assert.match(authScript, /window\.location\.href = result\.next/);
});
