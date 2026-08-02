"use strict";

const crypto = require("node:crypto");
const { ComputeError } = require("./errors");

class ProjectRuntimeGrantService {
  constructor({ secret, now = () => Date.now(), maxTtlSeconds = 300, maxPatchBytes = 65536 }) {
    this.secret = String(secret || ""); this.now = now; this.maxTtlSeconds = maxTtlSeconds; this.maxPatchBytes = maxPatchBytes;
  }
  issue(input = {}) {
    if (!this.secret) throw new ComputeError("project_grant_secret_missing", "Project-Runtime-Grant ist nicht konfiguriert.", 503);
    const accountId = required(input.account_id, "account_id"); const projectId = required(input.project_id, "project_id");
    const inputRevision = required(input.input_revision, "input_revision");
    const ttl = Math.min(this.maxTtlSeconds, positive(input.ttl_seconds, 60));
    const payload = { grant_id: crypto.randomUUID(), account_id: accountId, project_id: projectId, input_revision: inputRevision, read_paths: paths(input.read_paths), write_paths: paths(input.write_paths), exp: Math.floor(this.now() / 1000) + ttl };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return { token: `${encoded}.${this.#sign(encoded)}`, expires_at: new Date(payload.exp * 1000).toISOString(), grant_id: payload.grant_id };
  }
  verify(token, context = {}) {
    const [encoded, signature, extra] = String(token || "").split(".");
    if (!encoded || !signature || extra || !safeEqual(signature, this.#sign(encoded))) throw denied("project_grant_invalid");
    let grant; try { grant = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")); } catch { throw denied("project_grant_invalid"); }
    if (grant.exp <= Math.floor(this.now() / 1000)) throw denied("project_grant_expired");
    if (context.account_id !== grant.account_id || context.project_id !== grant.project_id || context.input_revision !== grant.input_revision) throw denied("project_grant_scope_mismatch");
    return grant;
  }
  async applyPatch({ token, account_id, project_id, input_revision, patch }, writer) {
    const grant = this.verify(token, { account_id, project_id, input_revision });
    const serialized = JSON.stringify(patch || {});
    if (Buffer.byteLength(serialized) > this.maxPatchBytes) throw new ComputeError("project_patch_too_large", "Project-Patch überschreitet sein Limit.", 413);
    const written = flatten(patch);
    const allowed = new Set(grant.write_paths);
    if (written.some((path) => !allowed.has(path))) throw denied("project_patch_path_denied");
    if (typeof writer !== "function") throw new ComputeError("project_patch_writer_missing", "Atomarer Project-Patch-Writer fehlt.", 503);
    return writer({ account_id, project_id, input_revision, patch: structuredClone(patch), grant_id: grant.grant_id });
  }
  #sign(value) { return crypto.createHmac("sha256", this.secret).update(value).digest("base64url"); }
}

function flatten(value, prefix = "") { if (!value || typeof value !== "object" || Array.isArray(value)) return prefix ? [prefix] : []; return Object.entries(value).flatMap(([key, child]) => { const path = prefix ? `${prefix}.${key}` : key; return child && typeof child === "object" && !Array.isArray(child) ? flatten(child, path) : [path]; }); }
function paths(value) { if (!Array.isArray(value) || value.some((path) => !/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*$/.test(String(path)))) throw new ComputeError("invalid_project_grant_paths", "Project-Runtime-Pfade sind ungültig.", 422); return [...new Set(value.map(String))]; }
function required(value, name) { const normalized = String(value || "").trim(); if (!normalized) throw new ComputeError("invalid_project_grant", `${name} fehlt.`, 422); return normalized; }
function positive(value, fallback) { const number = Number(value || fallback); return Number.isInteger(number) && number > 0 ? number : fallback; }
function safeEqual(left, right) { const a = Buffer.from(String(left)); const b = Buffer.from(String(right)); return a.length === b.length && crypto.timingSafeEqual(a, b); }
function denied(code) { return new ComputeError(code, "Project-Runtime-Grant wurde abgewiesen.", 403); }

module.exports = { ProjectRuntimeGrantService };
