const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const authSource = fs.readFileSync(path.join(__dirname, "..", "public", "app", "auth", "auth.js"), "utf8");
const serverSource = fs.readFileSync(path.join(__dirname, "..", "src", "dev-server.js"), "utf8");

test("browser-side WebAuthn failures are reported without sending their message or credential", () => {
  const reporterSource = authSource.slice(
    authSource.indexOf("async function reportPasskeyBrowserError"),
    authSource.indexOf("function parseCreationOptions"),
  );
  assert.match(authSource, /reportPasskeyBrowserError\("authentication", error\)/);
  assert.match(authSource, /reportPasskeyBrowserError\("registration", error\)/);
  assert.match(reporterSource, /body: JSON\.stringify\(\{ flow, error_name: error\?\.name \|\| "UnknownError" \}\)/);
  assert.doesNotMatch(reporterSource, /error\.message|credential/);
});

test("Identity wires the browser error endpoint to the configured system-event reporter", () => {
  assert.match(serverSource, /const recordSystemEvent = createSystemEventReporter/);
  assert.match(serverSource, /url\.pathname === "\/api\/passkeys\/client-error"/);
  assert.match(serverSource, /recordSystemEvent\(passkeyBrowserFailureEvent/);
});

test("Passkey registration reports an explicit persisted success or a failure with reason", () => {
  assert.match(authSource, /statusElement\.textContent = result\.message \|\| "Konto wurde angelegt\."/);
  assert.match(authSource, /return `Konto wurde nicht angelegt\. Grund: \$\{reason\}`/);
  assert.match(serverSource, /message: "Konto wurde angelegt\."/);
  assert.match(serverSource, /Konto wurde nicht angelegt\. Grund: Passkey konnte nicht vorbereitet werden\./);
  assert.match(serverSource, /Konto wurde nicht angelegt\. Grund: Passkey konnte nicht verifiziert werden/);
});

test("offline recovery is wired as a token-bound passkey registration flow", () => {
  assert.match(authSource, /\/api\/recovery\/offline\/start/);
  assert.match(authSource, /\/api\/recovery\/offline\/passkey\/options/);
  assert.match(authSource, /\/api\/recovery\/offline\/passkey\/verify/);
  assert.match(serverSource, /handleOfflineRecoveryStart/);
  assert.match(serverSource, /handleOfflineRecoveryPasskeyOptions/);
  assert.match(serverSource, /handleOfflineRecoveryPasskeyVerify/);
  assert.match(serverSource, /offlineRecoveryChallengeSubject\(recoveryToken\)/);
  assert.match(serverSource, /evictCachedSessionsForUser\(completed\.account\.user_id\)/);
  assert.match(serverSource, /const resolved = auth\.resolve_session_token\(token\)/);
  assert.match(serverSource, /offlineRecoveryRateLimit\(req, username\)/);
  assert.match(serverSource, /offlineRecoveryAttempts = new Map/);
  assert.match(serverSource, /event_type: eventType/);
  assert.match(serverSource, /username_hash: hashedAuditValue/);
  assert.match(serverSource, /client_hash: hashedAuditValue/);
});
