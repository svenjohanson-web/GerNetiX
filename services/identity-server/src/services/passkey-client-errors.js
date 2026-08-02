const ACCOUNT_ERROR_CODES = new Set([
  "invalid_credentials",
  "account_not_found",
  "passkey_not_configured",
  "account_disabled",
  "account_not_verified",
  "guest_expired",
]);

const PERSISTENCE_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "57P01",
  "57P02",
  "57P03",
]);

function passkeyClientError(stage, error) {
  const candidates = [String(error?.code || ""), String(error?.message || "")];
  const accountCode = candidates.find((candidate) => ACCOUNT_ERROR_CODES.has(candidate));
  if (accountCode) return { status: Number(error.status || 401), error: accountCode, message: "Konto konnte nicht für den Passkey-Login geladen werden." };
  if (candidates.some((candidate) => PERSISTENCE_ERROR_CODES.has(candidate))) {
    return { status: 503, error: "identity_persistence_unavailable", message: "Die zentrale Kontodatenbank ist momentan nicht erreichbar." };
  }
  if (candidates.includes("passkey_challenge_expired")) {
    return { status: 401, error: "passkey_challenge_expired", message: "Die Passkey-Anfrage ist abgelaufen. Bitte starte die Anmeldung erneut." };
  }
  if (stage === "verification") {
    return { status: Number(error.status || 401), error: "passkey_verification_failed", message: "Der ausgewählte Passkey konnte für dieses Konto nicht verifiziert werden." };
  }
  return { status: Number(error.status || 400), error: "passkey_authentication_unavailable", message: "Passkey-Login konnte nicht vorbereitet werden." };
}

module.exports = { passkeyClientError };
