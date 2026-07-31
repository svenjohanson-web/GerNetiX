const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const authSource = fs.readFileSync(path.join(__dirname, "..", "public", "app", "auth", "auth.js"), "utf8");
const serverSource = [
  "dev-server.js",
  path.join("dev", "server", "auth-routes.js"),
].map((file) => fs.readFileSync(path.join(__dirname, "..", "src", file), "utf8")).join("\n");

test("browser-side WebAuthn failures are reported without sending their message or credential", () => {
  const reporterSource = authSource.slice(
    authSource.indexOf("async function reportPasskeyBrowserError"),
    authSource.indexOf("function registrationFailureMessage"),
  );
  assert.match(authSource, /reportPasskeyBrowserError\("authentication", error\)/);
  assert.match(authSource, /reportPasskeyBrowserError\("registration", error\)/);
  assert.match(reporterSource, /body: JSON\.stringify\(\{ flow, error_name: error\?\.name \|\| "UnknownError" \}\)/);
  assert.doesNotMatch(reporterSource, /error\.message|credential/);
});

test("Identity wires the browser error endpoint to the configured system-event reporter", () => {
  assert.match(serverSource, /const recordSystemEvent = createSystemEventReporter/);
  assert.match(serverSource, /path: "\/api\/passkeys\/client-error"/);
  assert.match(serverSource, /recordSystemEvent\(passkeyBrowserFailureEvent/);
});

test("Passkey registration reports an explicit persisted success or a failure with reason", () => {
  assert.match(authSource, /statusElement\.textContent = tr\("auth\.status\.account\.created", "Konto wurde angelegt\."\)/);
  assert.match(authSource, /return tr\("auth\.error\.registration_reason", "Konto wurde nicht angelegt\. Grund: \{reason\}", \{ reason \}\)/);
  assert.match(serverSource, /message: "Konto wurde angelegt\."/);
  assert.match(serverSource, /Konto wurde nicht angelegt\. Grund: Passkey konnte nicht vorbereitet werden\./);
  assert.match(serverSource, /Konto wurde nicht angelegt\. Grund: Passkey konnte nicht verifiziert werden/);
});

test("Passkey login translates known account and browser failures into an actionable reason", () => {
  assert.match(authSource, /statusElement\.textContent = passkeyLoginFailureMessage\(error\)/);
  assert.match(authSource, /invalid_credentials: "auth\.error\.login\.account_not_found"/);
  assert.match(authSource, /passkey_not_configured: "auth\.error\.login\.passkey_not_configured"/);
  assert.match(authSource, /account_disabled: "auth\.error\.login\.account_disabled"/);
  assert.match(authSource, /account_not_verified: "auth\.error\.login\.account_not_verified"/);
  assert.match(authSource, /NotAllowedError: "auth\.error\.login\.not_allowed"/);
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
  assert.match(serverSource, /const resolved = await auth\.resolve_session_token\(token\)/);
  assert.match(serverSource, /offlineRecoveryRateLimit\(req, username\)/);
  assert.match(serverSource, /offlineRecoveryAttempts = new Map/);
  assert.match(serverSource, /event_type: eventType/);
  assert.match(serverSource, /username_hash: hashedAuditValue/);
  assert.match(serverSource, /client_hash: hashedAuditValue/);
});
