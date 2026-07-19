const assert = require("node:assert/strict");
const test = require("node:test");
const { passkeyBrowserFailureEvent, passkeyLoginFailureEvent } = require("../src/services/passkey-login-events");

test("passkey login events contain operational context but no credential material", () => {
  const credentialId = "secret-credential-id";
  const event = passkeyLoginFailureEvent("verification", new Error(`Credential ${credentialId} is not registered`), { id: "acct-1" });
  const serialized = JSON.stringify(event);

  assert.equal(event.event_type, "passkey_login_failed");
  assert.equal(event.account_id, "acct-1");
  assert.equal(event.details.stage, "verification");
  assert.equal(event.details.error_code, "passkey_authentication_failed");
  assert.doesNotMatch(serialized, new RegExp(credentialId));
  assert.ok(event.correlation_id);
});

test("passkey login events retain safe machine-readable error codes", () => {
  const error = new Error("passkey_challenge_expired");
  error.code = "passkey_challenge_expired";
  const event = passkeyLoginFailureEvent("options", error);

  assert.equal(event.details.error_code, "passkey_challenge_expired");
  assert.equal(event.account_id, null);
  assert.equal(event.route, "/api/passkeys/authentication/options");
});

test("browser-side WebAuthn domain failures become safe Admin Tool events", () => {
  const event = passkeyBrowserFailureEvent({
    flow: "authentication",
    error_name: "SecurityError",
    message: "This is an invalid domain.",
    credential: "must-not-be-recorded",
  });
  const serialized = JSON.stringify(event);

  assert.equal(event.event_type, "passkey_browser_failed");
  assert.equal(event.details.error_code, "webauthn_invalid_origin_or_rp_id");
  assert.doesNotMatch(serialized, /invalid domain|must-not-be-recorded/);
});

test("browser-side Passkey event names are allowlisted", () => {
  const event = passkeyBrowserFailureEvent({ error_name: "credential-secret-value" });
  assert.equal(event.details.error_name, "UnknownError");
  assert.equal(event.details.error_code, "passkey_browser_failed");
});
