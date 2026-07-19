const crypto = require("node:crypto");

function passkeyLoginFailureEvent(stage, error, account = null) {
  return {
    severity: "warning",
    source_service: "identity_server",
    target_service: "identity_server",
    category: "security",
    event_type: "passkey_login_failed",
    message: stage === "options"
      ? "Passkey-Login konnte nicht vorbereitet werden."
      : "Passkey-Login konnte nicht verifiziert werden.",
    impact: "Ein Konto konnte nicht per Passkey angemeldet werden.",
    account_id: account?.id || null,
    route: stage === "options"
      ? "/api/passkeys/authentication/options"
      : "/api/passkeys/authentication/verify",
    correlation_id: crypto.randomUUID(),
    details: {
      stage,
      error_code: safePasskeyErrorCode(error),
      error_name: /^[A-Za-z][A-Za-z0-9]*$/.test(String(error.name || ""))
        ? String(error.name)
        : "Error",
    },
  };
}

function safePasskeyErrorCode(error) {
  for (const value of [error.code, error.message]) {
    const candidate = String(value || "");
    if (/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(candidate)) return candidate;
  }
  return "passkey_authentication_failed";
}

function passkeyBrowserFailureEvent(input = {}) {
  const flow = input.flow === "registration" ? "registration" : "authentication";
  const errorName = safeBrowserErrorName(input.error_name);
  return {
    severity: "warning",
    source_service: "identity_server",
    target_service: "identity_server",
    category: "security",
    event_type: "passkey_browser_failed",
    message: flow === "registration"
      ? "Passkey-Erstellung ist bereits im Browser fehlgeschlagen."
      : "Passkey-Login ist bereits im Browser fehlgeschlagen.",
    impact: flow === "registration"
      ? "Ein Passkey-Konto konnte nicht vollständig angelegt werden."
      : "Ein Konto konnte nicht per Passkey angemeldet werden.",
    route: "/app/auth/",
    correlation_id: crypto.randomUUID(),
    details: {
      flow,
      stage: "browser_webauthn",
      error_name: errorName,
      error_code: browserErrorCode(errorName),
    },
  };
}

function safeBrowserErrorName(value) {
  const allowed = new Set([
    "AbortError",
    "ConstraintError",
    "InvalidStateError",
    "NotAllowedError",
    "NotSupportedError",
    "SecurityError",
    "TypeError",
    "UnknownError",
  ]);
  const candidate = String(value || "");
  return allowed.has(candidate) ? candidate : "UnknownError";
}

function browserErrorCode(errorName) {
  return {
    SecurityError: "webauthn_invalid_origin_or_rp_id",
    NotAllowedError: "passkey_cancelled_or_timed_out",
    NotSupportedError: "webauthn_not_supported",
    InvalidStateError: "passkey_invalid_state",
  }[errorName] || "passkey_browser_failed";
}

module.exports = { passkeyBrowserFailureEvent, passkeyLoginFailureEvent };
