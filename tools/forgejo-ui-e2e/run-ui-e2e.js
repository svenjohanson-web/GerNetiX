#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");
const { createHttpApp } = require("../../services/project-server/src/http-app");
const { InMemoryProjectRepository } = require("../../services/project-server/src/repositories/in-memory-project-repository");
const { ForgejoClient } = require("../../services/project-server/src/repository-store/forgejo-client");
const { ForgejoProjectRepositoryStore } = require("../../services/project-server/src/repository-store/forgejo-project-repository-store");
const { GitProjectRepositoryStore } = require("../../services/project-server/src/repository-store/git-project-repository-store");
const { ProjectService } = require("../../services/project-server/src/services/project-service");
const { createProjectRepositoryRead } = require("../../services/identity-server/src/dev/project-repository-read");
const { createRouteRegistry } = require("../../services/identity-server/src/dev/server/route-registry");
const { registerProjectRoutes } = require("../../services/identity-server/src/dev/server/project-routes");

const forgejoBaseUrl = required(process.env.FORGEJO_BASE_URL, "FORGEJO_BASE_URL");
const forgejoToken = required(process.env.FORGEJO_TOKEN, "FORGEJO_TOKEN");
const sessionToken = required(process.env.UI_E2E_SESSION_TOKEN, "UI_E2E_SESSION_TOKEN");
const organization = "gernetix-ui-e2e";
const accountId = "ui-e2e-account";
const uiProjectId = "ui-e2e-project";
const projectId = "ui-e2e-project-server-id";
const projectServerOrigin = "http://127.0.0.1:4800";
const identityOrigin = "http://127.0.0.1:4300";

async function main() {
  await ensureOrganization();
  const repository = new InMemoryProjectRepository();
  const projectRepositoryStore = new ForgejoProjectRepositoryStore({
    organization,
    client: new ForgejoClient({ baseUrl: forgejoBaseUrl, token: forgejoToken }),
    git: new GitProjectRepositoryStore({ authToken: forgejoToken }),
  });
  const service = new ProjectService({ repository, projectRepositoryStore });
  await service.ready;
  await seedProject({ repository, service, projectRepositoryStore });

  const projectApp = createHttpApp({ service });
  const projectServer = http.createServer((req, res) => projectApp(req, res).catch((error) => sendError(res, error)));
  await listen(projectServer, 4800);

  const publicResponses = [];
  const identityServer = await createIdentityFixtureServer({ service, publicResponses });
  await listen(identityServer, 4300);

  let browser;
  try {
    await verifyHttpSecurityBoundary();
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    await verifyRepositoryCard(browser, publicResponses);
  } finally {
    await browser?.close();
    await close(identityServer);
    await close(projectServer);
  }
  process.stdout.write("OK UI-E2E: Sitzung, Project Server, echtes Forgejo, Dateibaum, Datei, Historie, Diff und Secret-Negativtest bestanden.\n");
}

async function seedProject({ repository, service, projectRepositoryStore }) {
  const initialSources = [
    { path: "README.md", content: "# Synthetisches UI-Projekt\n" },
    { path: "docs/empty.txt", content: "" },
    { path: "src/main.cpp", content: "void setup() {}\n" },
  ];
  const binding = await projectRepositoryStore.provisionProject({
    project_id: projectId,
    message: "UI-E2E-Projekt angelegt",
    changes: initialSources,
  });
  const now = new Date().toISOString();
  await repository.saveProject({
    project_id: projectId,
    user_id: accountId,
    plan_id: "premium",
    title: "Synthetisches UI-E2E-Projekt",
    description: "Nur fuer den isolierten Browsernachweis",
    status: "active",
    build_config: null,
    software_units: [],
    view_manifest: {},
    repository_binding: binding,
    created_at: now,
    updated_at: now,
  });
  for (const source of initialSources) {
    await repository.saveSource({ project_id: projectId, ...source, content_type: "text/plain", role: "source", updated_at: now });
  }
  await service.commitRepositoryChanges(projectId, {
    expected_head_sha: binding.head_sha,
    message: "UI-E2E-Quellcode aktualisiert",
    changes: [
      { path: "src/main.cpp", content: "void setup() { /* UI E2E */ }\n" },
      { path: "docs/notes.md", content: "Browsernachweis\n" },
    ],
  });
}

async function createIdentityFixtureServer({ service, publicResponses }) {
  const registry = createRouteRegistry();
  const projectRepositoryRead = createProjectRepositoryRead({ projectServerJson });
  const sendJson = (res, status, body) => {
    const serialized = JSON.stringify(body);
    if (res.__identityResponse) publicResponses.push(serialized);
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(serialized);
  };
  registerProjectRoutes({
    registry,
    projectRepositoryRead,
    sendJson,
    requireSession: async (req, res) => {
      if (cookie(req, "ui_e2e_session") === sessionToken) return { account: { user_id: accountId } };
      sendJson(res, 401, { error: "authentication_required", message: "Anmeldung erforderlich." });
      return null;
    },
    requireSessionProject: async (session, requestedProjectId) => {
      if (requestedProjectId !== uiProjectId || session.account.user_id !== accountId) throw httpError(404, "project_not_found", "Projekt wurde nicht gefunden.");
      const project = await service.getProject(projectId);
      if (project.user_id !== session.account.user_id) throw httpError(404, "project_not_found", "Projekt wurde nicht gefunden.");
      return { id: uiProjectId, project_server_id: projectId };
    },
  });

  const componentPath = path.resolve("services/identity-server/public/app/project-repository-card.js");
  const cssPath = path.resolve("services/identity-server/public/app/app.css");
  const [component, css] = await Promise.all([fs.readFile(componentPath), fs.readFile(cssPath)]);
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, identityOrigin);
      if (url.pathname === "/") {
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Set-Cookie": `ui_e2e_session=${sessionToken}; HttpOnly; SameSite=Strict; Path=/`,
          "Cache-Control": "no-store",
        });
        res.end(fixtureHtml());
        return;
      }
      if (url.pathname === "/app/project-repository-card.js") return sendAsset(res, "application/javascript; charset=utf-8", component);
      if (url.pathname === "/app/app.css") return sendAsset(res, "text/css; charset=utf-8", css);
      if (url.pathname.startsWith("/api/")) {
        res.__identityResponse = true;
        if (await registry.dispatch({ req, res, url })) return;
      }
      sendJson(res, 404, { error: "not_found" });
    } catch (error) {
      sendError(res, error);
    }
  });
}

async function verifyHttpSecurityBoundary() {
  const ownPath = `/api/platform/projects/${uiProjectId}/repository`;
  const anonymous = await fetch(`${identityOrigin}${ownPath}`);
  assert.equal(anonymous.status, 401, "Repository-API verlangt eine Sitzung");
  const foreign = await fetch(`${identityOrigin}/api/platform/projects/foreign-project/repository`, {
    headers: { Cookie: `ui_e2e_session=${sessionToken}` },
  });
  assert.equal(foreign.status, 404, "fremdes Projekt bleibt verborgen");
}

async function verifyRepositoryCard(browser, publicResponses) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 820 } });
  const browserErrors = [];
  const requestUrls = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("request", (request) => requestUrls.push(request.url()));
  await page.goto(identityOrigin, { waitUntil: "networkidle" });
  /*
   * Beim Warten auf die Karte sagt ein blosser Timeout nichts darueber, warum
   * sie ausbleibt. Die Fehler der Seite werden oben schon gesammelt; hier
   * werden sie samt dem tatsaechlichen Zustand der Karte ausgegeben, sonst
   * bleibt als Befund nur "30000ms exceeded".
   */
  try {
    await page.waitForFunction(() => document.querySelector(".repository-state")?.textContent === "Aktiv");
  } catch (error) {
    const zustand = await page.evaluate(() => {
      const card = document.querySelector("#projectRepositoryCard");
      return {
        karteVorhanden: Boolean(card),
        klassen: card?.className || "",
        zustand: document.querySelector(".repository-state")?.textContent ?? null,
        inhalt: (card?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 300),
      };
    }).catch(() => null);
    console.error("Repository-Karte blieb aus.");
    console.error(`  Seitenfehler: ${browserErrors.length ? browserErrors.join(" | ") : "keine"}`);
    console.error(`  Zustand: ${JSON.stringify(zustand)}`);
    console.error(`  Angefragte Adressen: ${requestUrls.join(", ")}`);
    throw error;
  }

  assert.equal((await page.locator("#projectRepositoryCard h2").textContent()).trim(), "Git-Repository");
  assert.equal((await page.locator(".repository-state").textContent()).trim(), "Aktiv");
  assert.equal((await page.locator(".project-repository-meta dd").nth(1).textContent()).trim(), "main");
  assert.ok(await page.locator('[data-repository-file="src/main.cpp"]').isVisible());
  assert.ok((await page.locator("[data-repository-commit]").count()) >= 2, "mindestens zwei echte Commits erscheinen");

  await page.locator('[data-repository-file="src/main.cpp"]').click();
  await page.waitForFunction(() => document.querySelector("#projectRepositoryPreview")?.textContent?.includes("UI E2E"));
  assert.match(await page.locator("#projectRepositoryPreview").textContent(), /void setup\(\).*UI E2E/);

  await page.locator("[data-repository-commit]").first().click();
  await page.waitForFunction(() => document.querySelector("#projectRepositoryPreview")?.textContent?.includes("Commit-Diff"));
  assert.match(await page.locator("#projectRepositoryPreview").textContent(), /src\/main\.cpp/);

  const pageContent = await page.content();
  const exposed = `${pageContent}\n${publicResponses.join("\n")}`;
  assert.equal(exposed.includes(forgejoToken), false, "Forgejo-Token gelangt nicht in Browserantworten");
  assert.equal(exposed.includes(forgejoBaseUrl), false, "interne Forgejo-URL gelangt nicht in Browserantworten");
  assert.equal(requestUrls.some((url) => url.startsWith(forgejoBaseUrl)), false, "Browser greift nie direkt auf Forgejo zu");

  await page.setViewportSize({ width: 700, height: 820 });
  const mobileColumns = await page.locator(".project-repository-workspace").evaluate((element) => getComputedStyle(element).gridTemplateColumns);
  assert.equal(mobileColumns.trim().split(/\s+/).length, 1, "Repository-Karte wechselt mobil in eine Spalte");
  assert.deepEqual(browserErrors, []);
  await page.close();
}

async function projectServerJson(pathname, options = {}) {
  const response = await fetch(`${projectServerOrigin}${pathname}`, {
    method: options.method || "GET",
    headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}) },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const body = await response.json();
  if (!response.ok) throw httpError(response.status, body.error || "project_server_error", body.message || "Project Server error");
  return body;
}

async function ensureOrganization() {
  const response = await fetch(`${forgejoBaseUrl}/api/v1/orgs`, {
    method: "POST",
    headers: { Authorization: `token ${forgejoToken}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ username: organization, full_name: "Synthetic UI E2E", visibility: "private" }),
  });
  if (response.ok) return;
  if (response.status === 422) {
    const existing = await fetch(`${forgejoBaseUrl}/api/v1/orgs/${organization}`, { headers: { Authorization: `token ${forgejoToken}` } });
    if (existing.ok) return;
  }
  throw new Error(`organization_create_failed:${response.status}`);
}

function fixtureHtml() {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Forgejo UI E2E</title><link rel="stylesheet" href="/app/app.css"></head><body><main style="max-width:1100px;margin:24px auto;padding:0 16px"><article id="projectRepositoryCard" class="panel project-repository-card hidden" aria-label="Git-Repository"></article></main><script type="module">
  /*
   * project-repository-card.js ist ein ES-Modul. Als klassisches Skript
   * geladen scheitert es am export-Schluesselwort, der Controller bleibt
   * undefiniert und die Karte erscheint nie -- der Test lief dann in seinen
   * Timeout, ohne die Ursache zu nennen.
   *
   * Eingefuehrt wird direkt statt ueber die Uebergangsbruecke der Datei: die
   * setzt den Namen zwar global, aber Module werden verzoegert ausgefuehrt,
   * und ein klassisches Skript daneben liefe vorher.
   */
  import { ProjectRepositoryCard } from "/app/project-repository-card.js";
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
  const getJson = async (url) => { const response = await fetch(url, { headers: { Accept: "application/json" } }); const body = await response.json(); if (!response.ok) { const error = new Error(body.message || "Request failed"); error.status = response.status; error.code = body.error; throw error; } return body; };
  const controller = ProjectRepositoryCard.create({ getJson, escapeHtml, escapeAttribute: escapeHtml });
  controller.init();
  controller.render({ id: "${uiProjectId}", project_server_id: "${projectId}", updatedAt: "e2e" });
</script></body></html>`;
}

function sendAsset(res, contentType, content) {
  res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
  res.end(content);
}

function sendError(res, error) {
  if (res.headersSent) return res.end();
  const status = Number(error.status || 500);
  /*
   * Ein 500er ist ein Fehler des Testaufbaus, nicht der geprueften Sache. Der
   * Browser bekommt weiterhin nur "Interner Testfehler", damit der Test keine
   * Interna spiegelt -- im Lauf selbst muss die Ursache aber lesbar sein,
   * sonst bleibt als Befund nur eine leere Karte.
   */
  if (status >= 500) console.error(`Testserver-Fehler bei ${res.req?.url || "unbekannt"}: ${error?.stack || error?.message || error}`);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify({ error: error.code || "internal_error", message: status >= 500 ? "Interner Testfehler." : error.message }));
}

function httpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function cookie(req, name) {
  return String(req.headers.cookie || "").split(";").map((entry) => entry.trim().split("=")).find(([key]) => key === name)?.[1] || "";
}

function listen(server, port) {
  return new Promise((resolve, reject) => server.once("error", reject).listen(port, "127.0.0.1", resolve));
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

function required(value, name) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${name}_required`);
  return normalized;
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
