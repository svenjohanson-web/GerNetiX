"use strict";

const { ProjectServerError } = require("../errors");

class ForgejoClient {
  constructor(options = {}) {
    this.baseUrl = normalizedBaseUrl(options.baseUrl);
    this.token = String(options.token || "");
    this.fetch = options.fetch || globalThis.fetch;
    this.timeoutMs = positiveInteger(options.timeoutMs, 10_000);
    if (typeof this.fetch !== "function") throw new Error("forgejo_fetch_unavailable");
  }

  async getRepository(owner, name) {
    const response = await this.request("GET", `/api/v1/repos/${segment(owner)}/${segment(name)}`, { readRetries: 1, notFound: true });
    return response;
  }

  async getOrganization(name) {
    return this.request("GET", `/api/v1/orgs/${segment(name)}`, { readRetries: 1, notFound: true });
  }

  async createOrganization(input = {}) {
    const username = repositoryName(input.username);
    return this.request("POST", "/api/v1/orgs", { body: {
      username,
      full_name: String(input.full_name || username).slice(0, 100),
      description: String(input.description || "").slice(0, 255),
      visibility: "private",
      repo_admin_change_team_access: false,
    } });
  }

  async ensureOrganization(name, input = {}) {
    const existing = await this.getOrganization(name);
    if (existing) return { organization: existing, created: false };
    try {
      return { organization: await this.createOrganization({ ...input, username: name }), created: true };
    } catch (error) {
      if (error.code !== "forgejo_conflict") throw error;
      const concurrent = await this.getOrganization(name);
      if (!concurrent) throw error;
      return { organization: concurrent, created: false };
    }
  }

  async createOrganizationRepository(owner, input = {}) {
    const payload = {
      name: repositoryName(input.name),
      description: String(input.description || "").slice(0, 255),
      private: true,
      auto_init: false,
      default_branch: branchName(input.default_branch || "main"),
      has_issues: false,
      has_projects: false,
      has_wiki: false,
      has_pull_requests: false,
    };
    return this.request("POST", `/api/v1/orgs/${segment(owner)}/repos`, { body: payload });
  }

  async ensureOrganizationRepository(owner, input = {}) {
    const name = repositoryName(input.name);
    const existing = await this.getRepository(owner, name);
    if (existing) return { repository: existing, created: false };
    try {
      return { repository: await this.createOrganizationRepository(owner, { ...input, name }), created: true };
    } catch (error) {
      if (error.code !== "forgejo_conflict") throw error;
      const concurrent = await this.getRepository(owner, name);
      if (!concurrent) throw error;
      return { repository: concurrent, created: false };
    }
  }

  async archiveRepository(owner, name) {
    return this.request("PATCH", `/api/v1/repos/${segment(owner)}/${segment(name)}`, { body: { archived: true } });
  }

  async addRepositoryCollaborator(owner, name, username, permission = "write") {
    const normalizedPermission = String(permission || "write");
    if (!["read", "write", "admin"].includes(normalizedPermission)) throw new Error("forgejo_collaborator_permission_invalid");
    return this.request("PUT", `/api/v1/repos/${segment(owner)}/${segment(name)}/collaborators/${segment(username)}`, {
      body: { permission: normalizedPermission },
    });
  }

  async request(method, pathname, options = {}) {
    const attempts = method === "GET" ? 1 + Number(options.readRetries || 0) : 1;
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetch(`${this.baseUrl}${pathname}`, {
          method,
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            ...(this.token ? { Authorization: `token ${this.token}` } : {}),
            ...(options.body ? { "Content-Type": "application/json" } : {}),
          },
          ...(options.body ? { body: JSON.stringify(options.body) } : {}),
        });
        if (response.status === 404 && options.notFound) return null;
        if (!response.ok) throw responseError(response.status);
        if (response.status === 204) return null;
        return await response.json();
      } catch (error) {
        lastError = normalizeFetchError(error);
        if (attempt + 1 >= attempts || !["forgejo_unavailable", "forgejo_timeout"].includes(lastError.code)) throw lastError;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError;
  }
}

function normalizedBaseUrl(value) {
  const raw = String(value || "").replace(/\/$/, "");
  let url;
  try { url = new URL(raw); } catch { throw new Error("forgejo_base_url_invalid"); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("forgejo_base_url_invalid");
  return url.toString().replace(/\/$/, "");
}

function segment(value) {
  const normalized = String(value || "");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(normalized)) throw new ProjectServerError("invalid_forgejo_identifier", "Forgejo-Kennung ist ungültig.", 500);
  return encodeURIComponent(normalized);
}

function repositoryName(value) {
  return segment(value);
}

function branchName(value) {
  const normalized = String(value || "");
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$/.test(normalized) || normalized.includes("..")) throw new ProjectServerError("invalid_repository_branch", "Repository-Branch ist ungültig.", 500);
  return normalized;
}

function responseError(status) {
  if (status === 401 || status === 403) return new ProjectServerError("forgejo_unauthorized", "Forgejo hat den Dienstzugriff abgewiesen.", 502);
  if (status === 409 || status === 422) return new ProjectServerError("forgejo_conflict", "Forgejo meldet einen Repository-Konflikt.", 409);
  if (status === 429) return new ProjectServerError("forgejo_rate_limited", "Forgejo begrenzt den Dienstzugriff.", 503);
  return new ProjectServerError("forgejo_request_failed", "Forgejo-Anfrage ist fehlgeschlagen.", 502, { forgejo_status: status });
}

function normalizeFetchError(error) {
  if (error instanceof ProjectServerError) return error;
  if (error?.name === "AbortError") return new ProjectServerError("forgejo_timeout", "Forgejo hat nicht rechtzeitig geantwortet.", 504);
  return new ProjectServerError("forgejo_unavailable", "Forgejo ist nicht erreichbar.", 503);
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

module.exports = { ForgejoClient };
