"use strict";

class PasskeyConfigurationError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function createPasskeyConfiguration(options = {}) {
  const canonicalOrigin = normalizeOrigin(options.canonicalOrigin);
  if (!canonicalOrigin) throw new Error("IDENTITY_APP_BASE_URL muss fuer Passkeys gesetzt sein.");
  const canonicalHostname = new URL(canonicalOrigin).hostname.toLowerCase();
  const canonicalRpId = String(options.canonicalRpId || canonicalHostname).trim().toLowerCase();
  if (!canonicalRpId || (canonicalHostname !== canonicalRpId && !canonicalHostname.endsWith(`.${canonicalRpId}`))) {
    throw new Error("IDENTITY_PASSKEY_RP_ID muss zur kanonischen Identity-Domain gehoeren.");
  }
  const allowedOrigins = new Set([canonicalOrigin, ...(options.allowedOrigins || []).map(normalizeOrigin).filter(Boolean)]);
  const remoteDev = options.remoteDev === true;

  function forRequest(req, { mutation = false } = {}) {
    const requestOrigin = normalizeOrigin(req?.headers?.origin);
    if (!requestOrigin || !allowedOrigins.has(requestOrigin)) {
      throw new PasskeyConfigurationError(
        "passkey_canonical_origin_required",
        "Passkeys koennen nur auf der kanonischen GerNetiX-Anmeldeseite verwendet werden.",
        409,
      );
    }
    if (remoteDev && mutation) {
      throw new PasskeyConfigurationError(
        "passkey_remote_dev_mutation_forbidden",
        "Der lokale Entwicklungsserver darf zentrale Passkeys weder anlegen noch ersetzen.",
        409,
      );
    }
    return { origin: canonicalOrigin, rpID: canonicalRpId };
  }

  return { canonicalOrigin, canonicalRpId, allowedOrigins: [...allowedOrigins], remoteDev, forRequest };
}

function normalizeOrigin(value) {
  const raw = String(value || "").trim().replace(/\/$/, "");
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) return "";
    return parsed.origin;
  } catch {
    return "";
  }
}

module.exports = { PasskeyConfigurationError, createPasskeyConfiguration, normalizeOrigin };
