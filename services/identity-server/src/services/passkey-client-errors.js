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
  "ENETUNREACH",
  "EHOSTUNREACH",
  "ENOTFOUND",
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
  if (isPersistenceUnavailable(error)) {
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

function isPersistenceUnavailable(error) {
  const chain=[];
  for(let current=error;current&&chain.length<4;current=current.cause)chain.push(current);
  return chain.some((current)=>{
    const code=String(current?.code||"").toUpperCase();
    const message=String(current?.message||current||"");
    return PERSISTENCE_ERROR_CODES.has(code)
      || /^08[A-Z0-9]{3}$/.test(code)
      || /(?:connect\s+)?ECONNREFUSED|connection (?:terminated|closed) unexpectedly|server closed the connection|database system is (?:starting up|shutting down)|terminating connection due to administrator command|timeout (?:expired|acquiring a client)|no pg_hba\.conf entry/i.test(message);
  });
}

module.exports = { isPersistenceUnavailable, passkeyClientError };
