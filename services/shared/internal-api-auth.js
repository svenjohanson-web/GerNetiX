"use strict";

const crypto = require("node:crypto");

class InternalApiAuthError extends Error {
  constructor(code, message, status = 403) {
    super(message);
    this.name = "InternalApiAuthError";
    this.code = code;
    this.status = status;
  }
}

function issueInternalToken(claims, secret, { now = Date.now(), ttlSeconds = 60 } = {}) {
  const signingKey = resolveSigningKey(secret);
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new InternalApiAuthError("internal_auth_invalid_ttl", "Die Lebensdauer des internen Tokens ist ungueltig.", 503);
  }
  const issuedAt = Math.floor(now / 1000);
  const normalizedClaims = normalizeClaims(claims);
  if (signingKey.issuer && normalizedClaims.iss !== signingKey.issuer) throw denied("internal_token_wrong_issuer");
  const payload = {
    v: 1,
    jti: crypto.randomUUID(),
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
    ...normalizedClaims,
    ...(signingKey.kid ? { kid: signingKey.kid, alg: signingKey.algorithm } : {}),
  };
  const encoded = base64Url(JSON.stringify(payload));
  return `${encoded}.${signEncoded(encoded, signingKey)}`;
}

function verifyInternalToken(token, secret, {
  audience,
  requiredScopes = [],
  issuer,
  issuers,
  expectedIssuer,
  expectedIssuers,
  subject,
  subjects,
  expectedSubject,
  expectedSubjects,
  replayGuard,
  now = Date.now(),
} = {}) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw denied("internal_token_invalid");
  let claims;
  try { claims = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")); } catch { throw denied("internal_token_invalid"); }
  const hasKid = claims && Object.prototype.hasOwnProperty.call(claims, "kid");
  const hasAlgorithm = claims && Object.prototype.hasOwnProperty.call(claims, "alg");
  if ((hasKid || hasAlgorithm) && (!normalizeKid(claims.kid) || !normalizeAlgorithm(claims.alg))) {
    throw denied("internal_token_invalid");
  }
  const verificationKey = resolveVerificationKey(secret, claims);
  if (!verifyEncoded(parts[0], parts[1], verificationKey)) throw denied("internal_token_invalid");
  if (!claims || claims.v !== 1 || !claims.sub || !claims.iss || !claims.aud || !Array.isArray(claims.scopes)) throw denied("internal_token_invalid");
  if (!Number.isInteger(claims.exp) || claims.exp <= Math.floor(now / 1000)) throw denied("internal_token_expired", 401);
  if (audience && claims.aud !== audience) throw denied("internal_token_wrong_audience");
  if (verificationKey.issuers && !verificationKey.issuers.includes(claims.iss)) throw denied("internal_token_wrong_issuer");
  if (!matchesExpectedClaim(claims.iss, issuer ?? expectedIssuer, issuers ?? expectedIssuers)) throw denied("internal_token_wrong_issuer");
  if (!matchesExpectedClaim(claims.sub, subject ?? expectedSubject, subjects ?? expectedSubjects)) throw denied("internal_token_wrong_subject");
  const scopes = new Set(claims.scopes);
  if (!requiredScopes.every((scope) => scopes.has(scope))) throw denied("internal_token_scope_denied");
  consumeReplayGuard(replayGuard, claims);
  return claims;
}

function verifyDelegation(token, secret, options = {}) {
  const claims = verifyInternalToken(token, secret, options);
  if (claims.kind !== "delegated_user_action" || !claims.context?.account_id) throw denied("internal_delegation_invalid");
  return claims;
}

function assertDelegatedResource(claims, { accountId = "", projectId = "", entitlement = "" } = {}) {
  const context = claims?.context || {};
  if (accountId && context.account_id !== accountId) throw denied("delegated_account_access_denied");
  if (projectId && !(context.project_ids || []).includes(projectId)) throw denied("delegated_project_access_denied");
  if (entitlement && !(context.entitlements || []).includes(entitlement)) throw denied("delegated_entitlement_denied");
  return claims;
}

function readBearerToken(req) {
  const match = String(req?.headers?.authorization || "").match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

function requiredSecret(secret) {
  if (typeof secret !== "string" && !Buffer.isBuffer(secret)) throw authNotConfigured();
  const value = String(secret);
  if (!value) throw new InternalApiAuthError("internal_auth_not_configured", "Interne API-Authentifizierung ist nicht konfiguriert.", 503);
  return value;
}

function resolveSigningKey(configuration) {
  // Passing a string deliberately selects the legacy, kid-less compatibility
  // contract. New deployments should pass { activeKid, keys } instead.
  if (typeof configuration === "string" || Buffer.isBuffer(configuration)) {
    return { kid: "", algorithm: "HS256", key: requiredSecret(configuration), issuer: "" };
  }
  if (!configuration || typeof configuration !== "object") throw authNotConfigured();
  const kid = normalizeKid(configuration.activeKid);
  if (!kid) throw authNotConfigured();
  const keys = normalizeKeyring(configuration.signingKeys || configuration.keys, configuration.algorithm, "sign");
  if (!keys.has(kid)) throw authNotConfigured();
  const issuer = optionalConfiguredIssuer(configuration, "issuer");
  return { kid, ...keys.get(kid), issuer };
}

function resolveVerificationKey(configuration, claims) {
  // A plain secret is retained only as an explicit legacy call-site choice.
  if (typeof configuration === "string" || Buffer.isBuffer(configuration)) {
    if (claims?.kid !== undefined || claims?.alg !== undefined) throw denied("internal_token_invalid");
    return { algorithm: "HS256", key: requiredSecret(configuration) };
  }
  if (!configuration || typeof configuration !== "object") throw authNotConfigured();
  const keys = normalizeKeyring(configuration.verificationKeys || configuration.keys, configuration.algorithm, "verify");
  const kid = normalizeKid(claims?.kid);
  if (kid) {
    if (keys.size === 0) throw authNotConfigured();
    if (!keys.has(kid)) throw denied("internal_token_invalid");
    const verificationKey = keys.get(kid);
    if (verificationKey.algorithm !== normalizeAlgorithm(claims?.alg)) throw denied("internal_token_invalid");
    return verificationKey;
  }
  if (configuration.allowLegacyTokens !== true) throw denied("internal_token_invalid");
  return { algorithm: "HS256", key: requiredSecret(configuration.legacySecret) };
}

function normalizeKeyring(value, defaultAlgorithm = "HS256", purpose = "verify") {
  const entries = value instanceof Map
    ? Array.from(value.entries())
    : value && typeof value === "object" && !Array.isArray(value)
      ? Object.entries(value)
      : [];
  const keys = new Map();
  for (const [rawKid, rawSecret] of entries) {
    const kid = normalizeKid(rawKid);
    if (!kid) throw authNotConfigured();
    const wrapped = isWrappedKey(rawSecret) ? rawSecret : { key: rawSecret };
    const algorithm = normalizeAlgorithm(wrapped.algorithm || wrapped.alg || defaultAlgorithm);
    if (!algorithm) throw authNotConfigured();
    keys.set(kid, {
      algorithm,
      key: requiredKey(wrapped.key, algorithm, purpose),
      issuers: normalizeTrustedIssuers(wrapped),
    });
  }
  return keys;
}

function normalizeKid(value) {
  const kid = String(value || "");
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(kid) ? kid : "";
}

function normalizeAlgorithm(value) {
  const algorithm = String(value || "").toUpperCase();
  if (algorithm === "HS256") return "HS256";
  if (algorithm === "ED25519" || algorithm === "EDDSA") return "Ed25519";
  return "";
}

function normalizeTrustedIssuers(configuration) {
  const hasIssuer = Object.prototype.hasOwnProperty.call(configuration, "issuer");
  const hasIssuers = Object.prototype.hasOwnProperty.call(configuration, "issuers");
  if (!hasIssuer && !hasIssuers) return null;
  if ((hasIssuer && typeof configuration.issuer !== "string")
    || (hasIssuers && (!Array.isArray(configuration.issuers) || configuration.issuers.some((value) => typeof value !== "string")))) {
    throw authNotConfigured();
  }
  const values = [
    ...(hasIssuer ? [configuration.issuer] : []),
    ...(hasIssuers && Array.isArray(configuration.issuers) ? configuration.issuers : []),
  ].map((value) => String(value || ""));
  if (values.length === 0 || values.some((value) => !value)) {
    throw authNotConfigured();
  }
  return Array.from(new Set(values));
}

function optionalConfiguredIssuer(configuration, property) {
  if (!Object.prototype.hasOwnProperty.call(configuration, property)) return "";
  if (typeof configuration[property] !== "string") throw authNotConfigured();
  const issuer = String(configuration[property] || "");
  if (!issuer) throw authNotConfigured();
  return issuer;
}

function isWrappedKey(value) {
  return value && typeof value === "object" && !Buffer.isBuffer(value) && !(value instanceof crypto.KeyObject)
    && Object.prototype.hasOwnProperty.call(value, "key");
}

function requiredKey(key, algorithm, purpose) {
  if (algorithm === "HS256") return requiredSecret(key);
  if (typeof key !== "string" && !Buffer.isBuffer(key) && !(key instanceof crypto.KeyObject)) throw authNotConfigured();
  try {
    let keyObject;
    if (key instanceof crypto.KeyObject) {
      keyObject = key;
    } else if (purpose === "sign") {
      keyObject = crypto.createPrivateKey(key);
    } else {
      try {
        crypto.createPrivateKey(key);
        throw authNotConfigured();
      } catch (error) {
        if (error instanceof InternalApiAuthError) throw error;
      }
      keyObject = crypto.createPublicKey(key);
    }
    const expectedType = purpose === "sign" ? "private" : "public";
    if (keyObject.asymmetricKeyType !== "ed25519" || keyObject.type !== expectedType) throw authNotConfigured();
    return keyObject;
  } catch (error) {
    if (error instanceof InternalApiAuthError) throw error;
    throw authNotConfigured();
  }
}

function consumeReplayGuard(replayGuard, claims) {
  if (replayGuard === undefined) return;
  if (!replayGuard || typeof replayGuard.consume !== "function") throw replayGuardError("internal_auth_replay_guard_invalid");
  if (!claims.jti || !Number.isInteger(claims.exp)) throw denied("internal_token_invalid");
  let accepted;
  try {
    accepted = replayGuard.consume({ jti: claims.jti, exp: claims.exp, iss: claims.iss, aud: claims.aud });
  } catch (error) {
    if (error instanceof InternalApiAuthError) throw error;
    throw replayGuardError("internal_auth_replay_guard_failed");
  }
  if (accepted && typeof accepted.then === "function") throw replayGuardError("internal_auth_replay_guard_invalid");
  if (accepted !== true) throw denied("internal_token_replayed");
}

function createInMemoryReplayGuard({ clock = Date.now, maxEntries = 10_000 } = {}) {
  if (typeof clock !== "function" || !Number.isInteger(maxEntries) || maxEntries <= 0) {
    throw replayGuardError("internal_auth_replay_guard_invalid");
  }
  const consumed = new Map();
  // This helper is deliberately process-local and provides no multi-instance
  // guarantee. Such deployments need a separate shared atomic consume store.
  return {
    consume({ jti, exp, iss = "", aud = "" } = {}) {
      const nowSeconds = Math.floor(clock() / 1000);
      for (const [key, expiresAt] of consumed) {
        if (expiresAt <= nowSeconds) consumed.delete(key);
      }
      if (!jti || !Number.isInteger(exp) || exp <= nowSeconds) return false;
      const key = `${String(iss)}\u0000${String(aud)}\u0000${String(jti)}`;
      if (consumed.has(key)) return false;
      if (consumed.size >= maxEntries) throw replayGuardError("internal_auth_replay_guard_capacity");
      consumed.set(key, exp);
      return true;
    },
  };
}

function replayGuardError(code) {
  return new InternalApiAuthError(code, "Der Replay-Schutz fuer interne Tokens ist nicht verfuegbar.", 503);
}

function readInternalApiAuthConfig(env, { serviceId } = {}) {
  if (!env || typeof env !== "object" || typeof serviceId !== "string" || !serviceId.trim()) throw authNotConfigured();
  const issuer = serviceId.trim();
  const trustedRaw = String(env.INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON || "");
  if (!trustedRaw) throw authNotConfigured();
  let trusted;
  try { trusted = JSON.parse(trustedRaw); } catch { throw authNotConfigured(); }
  if (trusted && Array.isArray(trusted.keys)) {
    trusted = Object.fromEntries(trusted.keys.map((entry) => [entry?.kid, entry]));
  }
  if (!trusted || typeof trusted !== "object" || Array.isArray(trusted) || Object.keys(trusted).length === 0) {
    throw authNotConfigured();
  }

  const verificationKeys = {};
  for (const [rawKid, descriptor] of Object.entries(trusted)) {
    const kid = normalizeKid(rawKid);
    if (!kid || !descriptor || typeof descriptor !== "object" || Array.isArray(descriptor)) throw authNotConfigured();
    const issuers = normalizeTrustedIssuers(descriptor);
    if (!issuers) throw authNotConfigured();
    const publicKeyDer = decodeRequiredBase64(descriptor.publicKeyB64);
    let publicKey;
    try {
      publicKey = crypto.createPublicKey({ key: publicKeyDer, format: "der", type: "spki" });
    } catch { throw authNotConfigured(); }
    if (publicKey.asymmetricKeyType !== "ed25519" || publicKey.type !== "public") throw authNotConfigured();
    verificationKeys[kid] = { algorithm: "Ed25519", key: publicKey, issuers };
  }

  const keyIdRaw = String(env.INTERNAL_API_SIGNING_KEY_ID || "");
  const privateKeyRaw = String(env.INTERNAL_API_SIGNING_PRIVATE_KEY_B64 || "");
  if (Boolean(keyIdRaw) !== Boolean(privateKeyRaw)) throw authNotConfigured();
  const configuration = { issuer, algorithm: "Ed25519", verificationKeys };
  if (!keyIdRaw) return configuration;
  const activeKid = normalizeKid(keyIdRaw);
  if (!activeKid) throw authNotConfigured();
  const privateKeyDer = decodeRequiredBase64(privateKeyRaw);
  let privateKey;
  try {
    privateKey = crypto.createPrivateKey({ key: privateKeyDer, format: "der", type: "pkcs8" });
  } catch { throw authNotConfigured(); }
  if (privateKey.asymmetricKeyType !== "ed25519" || privateKey.type !== "private") throw authNotConfigured();
  return {
    ...configuration,
    activeKid,
    signingKeys: { [activeKid]: { algorithm: "Ed25519", key: privateKey } },
  };
}

function decodeRequiredBase64(value) {
  const encoded = String(value || "");
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded) || !encoded) {
    throw authNotConfigured();
  }
  return Buffer.from(encoded, "base64");
}

function matchesExpectedClaim(actual, expected, expectedList) {
  if (expected === undefined && expectedList === undefined) return true;
  const configured = [
    ...(expected === undefined ? [] : [expected]),
    ...(expectedList === undefined ? [] : Array.isArray(expectedList) ? expectedList : [expectedList]),
  ].map(String);
  return configured.includes(actual);
}

function authNotConfigured() {
  return new InternalApiAuthError("internal_auth_not_configured", "Interne API-Authentifizierung ist nicht konfiguriert.", 503);
}

function normalizeClaims(claims = {}) {
  return {
    iss: String(claims.iss || ""),
    sub: String(claims.sub || ""),
    aud: String(claims.aud || ""),
    kind: String(claims.kind || "service"),
    scopes: Array.from(new Set((claims.scopes || []).map(String))).sort(),
    ...(claims.context ? { context: normalizeContext(claims.context) } : {}),
  };
}

function normalizeContext(context = {}) {
  return {
    account_id: String(context.account_id || ""),
    project_ids: Array.from(new Set((context.project_ids || []).map(String))).sort(),
    job_ids: Array.from(new Set((context.job_ids || []).map(String))).sort(),
    worker_ids: Array.from(new Set((context.worker_ids || []).map(String))).sort(),
    artifact_names: Array.from(new Set((context.artifact_names || []).map(String))).sort(),
    device_ids: Array.from(new Set((context.device_ids || []).map(String))).sort(),
    entitlements: Array.from(new Set((context.entitlements || []).map(String))).sort(),
    role: String(context.role || ""),
    capabilities: Array.from(new Set((context.capabilities || []).map(String))).sort(),
  };
}

function signEncoded(encodedPayload, signingKey) {
  if (signingKey.algorithm === "HS256") return hmacSignature(encodedPayload, signingKey.key);
  try {
    return crypto.sign(null, Buffer.from(encodedPayload), signingKey.key).toString("base64url");
  } catch {
    throw authNotConfigured();
  }
}

function verifyEncoded(encodedPayload, suppliedSignature, verificationKey) {
  if (verificationKey.algorithm === "HS256") {
    return safeEqual(suppliedSignature, hmacSignature(encodedPayload, verificationKey.key));
  }
  try {
    return crypto.verify(
      null,
      Buffer.from(encodedPayload),
      verificationKey.key,
      Buffer.from(String(suppliedSignature), "base64url"),
    );
  } catch {
    return false;
  }
}

function hmacSignature(encodedPayload, secret) {
  return crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function base64Url(value) { return Buffer.from(value).toString("base64url"); }
function denied(code, status = 403) { return new InternalApiAuthError(code, "Interner API-Zugriff ist nicht berechtigt.", status); }

module.exports = {
  InternalApiAuthError,
  issueInternalToken,
  verifyInternalToken,
  verifyDelegation,
  assertDelegatedResource,
  readBearerToken,
  createInMemoryReplayGuard,
  readInternalApiAuthConfig,
};
