"use strict";

const crypto = require("node:crypto");
const { ComputeError } = require("./errors");

class WorkerTokenService {
  constructor({ secret, ttlSeconds = 900, now = () => Date.now() }) {
    this.secret = String(secret || "");
    this.ttlSeconds = ttlSeconds;
    this.now = now;
  }

  issue(worker) {
    this.#requireSecret();
    const payload = {
      worker_id: worker.worker_id,
      instance_id: worker.instance_id,
      exp: Math.floor(this.now() / 1000) + this.ttlSeconds,
    };
    const encoded = base64url(JSON.stringify(payload));
    return { token: `${encoded}.${this.#signature(encoded)}`, expires_at: new Date(payload.exp * 1000).toISOString() };
  }

  verify(token) {
    this.#requireSecret();
    const [encoded, signature, extra] = String(token || "").split(".");
    if (!encoded || !signature || extra || !safeEqual(signature, this.#signature(encoded))) throw denied();
    let payload;
    try { payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")); } catch { throw denied(); }
    if (!payload.worker_id || !payload.instance_id || !Number.isInteger(payload.exp) || payload.exp <= Math.floor(this.now() / 1000)) throw denied();
    return payload;
  }

  #signature(encoded) { return crypto.createHmac("sha256", this.secret).update(encoded).digest("base64url"); }
  #requireSecret() {
    if (!this.secret) throw new ComputeError("worker_signing_secret_missing", "Worker-Token-Signatur ist nicht konfiguriert.", 503);
  }
}

function base64url(value) { return Buffer.from(value, "utf8").toString("base64url"); }
function safeEqual(left, right) {
  const actual = Buffer.from(String(left));
  const expected = Buffer.from(String(right));
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
function denied() { return new ComputeError("worker_access_denied", "Worker-Authentifizierung fehlgeschlagen.", 403); }

module.exports = { WorkerTokenService, safeEqual };
