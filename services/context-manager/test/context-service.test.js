const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");

const { ContextService, InMemoryContextRepository, LocalProjectAnalyzer, SqliteBackedContextRepository } = require("../src");

test("builds current context from requirement slices and runtime references", () => {
  const service = new ContextService({ repository: new InMemoryContextRepository() });
  const scope = service.upsertScope({ account_id: "acct-1", project_id: "project-1", title: "User IDE Ausbau" });

  const slice = service.upsertRequirementSlice({
    scope_id: scope.scope_id,
    requirement_id: "BR-IDE-001",
    slice_key: "ide-project-server-binding",
    title: "User IDE an Project Server anbinden",
    status: "implemented",
    implemented_by: ["services/project-server", "tools/guided-code-lesson"],
    related_artifacts: ["data/architecture/artifacts.yaml"],
  });
  service.upsertRuntimeReference({
    scope_id: scope.scope_id,
    reference_type: "service",
    reference_id: "project-server",
    source_service: "project-server",
    payload: { endpoint: "/api/projects", token: "secret-token" },
  });
  service.recordDecision({
    scope_id: scope.scope_id,
    title: "Requirement Slices statt 1:1 Requirement Mapping",
    related_slice_ids: [slice.slice_id],
  });

  const context = service.currentContext({ account_id: "acct-1", project_id: "project-1" });
  assert.equal(context.scope.title, "User IDE Ausbau");
  assert.equal(context.requirement_slices[0].slice_key, "ide-project-server-binding");
  assert.equal(context.runtime_references[0].source_service, "project-server");
  assert.equal(context.decisions[0].related_slice_ids[0], slice.slice_id);
});

test("creates redacted context packs", () => {
  const service = new ContextService({ repository: new InMemoryContextRepository() });
  const scope = service.upsertScope({ account_id: "acct-1", project_id: "project-1", title: "AI Usage" });
  service.upsertRuntimeReference({
    scope_id: scope.scope_id,
    title: "AI Usage State",
    payload: { token: "do-not-leak", nested: { wifi_password: "also-secret", value: 7 } },
  });

  const pack = service.createContextPack({ scope_id: scope.scope_id, purpose: "codex_handoff" });
  assert.equal(pack.payload.runtime_references[0].payload.token, "[redacted]");
  assert.equal(pack.payload.runtime_references[0].payload.nested.wifi_password, "[redacted]");
  assert.equal(pack.payload.runtime_references[0].payload.nested.value, 7);
});

test("persists context manager state in sqlite normalized tables", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-context-"));
  const dbPath = path.join(tmp, "context.sqlite");
  const repository = SqliteBackedContextRepository.create(dbPath);
  const service = new ContextService({
    repository,
    analyzer: {
      analyze: () => [{
        type: "artifact",
        title: "Context Manager README",
        source: "services/context-manager/README.md",
        payload: {
          artifact_id: "context-manager-readme",
          artifact_type: "documentation",
          path: "services/context-manager/README.md",
        },
      }],
    },
  });
  const scope = service.upsertScope({ account_id: "acct-1", project_id: "project-1", title: "Project Context" });

  service.upsertRequirementSlice({
    scope_id: scope.scope_id,
    requirement_id: "BR-CTX-001",
    title: "Kontext aus Anforderungen ableiten",
    status: "implemented",
    evidence: ["services/context-manager"],
  });
  service.analyzeScope({
    scope_id: scope.scope_id,
  });
  service.createContextPack({ scope_id: scope.scope_id });

  repository.store.close();
  const db = new DatabaseSync(dbPath);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM context_scopes").get().count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM context_requirement_slices").get().count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM context_packs").get().count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM context_suggestions").get().count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM service_documents WHERE service_key = 'context-manager'").get().count >= 3, true);
  db.close();
});

test("analyzes project context into reviewable suggestions", () => {
  const analyzer = {
    analyze: () => [
      {
        type: "runtime",
        title: "Project Server Service",
        summary: "Service erkannt.",
        confidence: 0.9,
        source: "services/project-server",
        payload: {
          reference_type: "service",
          reference_id: "project-server",
          source_service: "project-server",
          payload: { path: "services/project-server" },
        },
      },
      {
        type: "decision",
        title: "Graph ist Single Source of Truth",
        summary: "Aus README erkannt.",
        confidence: 0.7,
        source: "docs",
        payload: {
          status: "proposed",
          rationale: "Aus Dokumentation erkannt.",
        },
      },
    ],
  };
  const service = new ContextService({ repository: new InMemoryContextRepository(), analyzer });
  const scope = service.upsertScope({ account_id: "acct-1", project_id: "project-1" });

  const firstRun = service.analyzeScope({ scope_id: scope.scope_id });
  const secondRun = service.analyzeScope({ scope_id: scope.scope_id });

  assert.equal(firstRun.created_count, 2);
  assert.equal(firstRun.summary.runtime, 1);
  assert.equal(firstRun.summary.decision, 1);
  assert.equal(secondRun.created_count, 0);
  assert.equal(service.listSuggestions({ scope_id: scope.scope_id, status: "pending" }).length, 2);
});

test("accepts and rejects suggestions", () => {
  const analyzer = {
    analyze: () => [
      {
        type: "runtime",
        title: "Device Management Server",
        summary: "Service erkannt.",
        source: "services/device-management-server",
        payload: {
          reference_type: "service",
          reference_id: "device-management-server",
          source_service: "device-management-server",
        },
      },
      {
        type: "artifact",
        title: "Build Config",
        summary: "Konfiguration erkannt.",
        source: "package.json",
        payload: {
          artifact_id: "package.json",
          artifact_type: "node-package",
          path: "package.json",
        },
      },
    ],
  };
  const service = new ContextService({ repository: new InMemoryContextRepository(), analyzer });
  const scope = service.upsertScope({ account_id: "acct-1", project_id: "project-1" });
  const result = service.analyzeScope({ scope_id: scope.scope_id });

  const accepted = service.acceptSuggestion(result.suggestions[0].id);
  const rejected = service.rejectSuggestion(result.suggestions[1].id);

  assert.equal(accepted.suggestion.status, "accepted");
  assert.equal(accepted.entry.source_service, "device-management-server");
  assert.equal(rejected.status, "rejected");
  assert.equal(service.currentContext({ scope_id: scope.scope_id }).runtime_references.length, 1);
  assert.equal(service.listSuggestions({ scope_id: scope.scope_id, status: "pending" }).length, 0);
});

test("does not turn README commands and paths into decision suggestions", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-context-analyzer-"));
  fs.mkdirSync(path.join(tmp, "tools", "sqlite-graph-explorer"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "tools", "sqlite-graph-explorer", "README.md"), [
    "# SQLite Graph Explorer",
    "",
    "```powershell",
    "cd C:\\Users\\sven_\\Desktop\\GerNetiX\\tools\\sqlite-graph-explorer",
    "node server.js",
    "```",
    "",
    "tools/yaml-graph-sqlite/out/model-graph.sqlite",
    "",
    "Der SQLite Graph Explorer ist die Read-only Weboberflaeche fuer das kanonische SQLite-Graphmodell.",
  ].join("\n"));

  const analyzer = new LocalProjectAnalyzer({ rootDir: tmp });
  const suggestions = analyzer.analyze({ scope: { scope_id: "scope-1", project_id: "project-1" } });
  const decisionTitles = suggestions.filter((suggestion) => suggestion.type === "decision").map((suggestion) => suggestion.title);

  assert.equal(decisionTitles.some((title) => title.startsWith("cd ")), false);
  assert.equal(decisionTitles.some((title) => title.includes("model-graph.sqlite")), false);
  assert.equal(decisionTitles.includes("Der SQLite Graph Explorer ist die Read-only Weboberflaeche fuer das kanonische SQLite-Graphmodell."), true);
});

test("does not turn decision folder placeholders into decision suggestions", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-context-placeholders-"));
  fs.mkdirSync(path.join(tmp, "services", "build-deploy-server", "docs", "decisions"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "services", "build-deploy-server", "docs", "decisions", "README.md"), [
    "# Entscheidungen Build-&-Deploy-Server",
    "",
    "Hier werden spaeter serverspezifische Architekturentscheidungen abgelegt.",
    "",
    "Fuehrende Modellentscheidungen liegen weiterhin im Graphmodell und werden bei Bedarf hier lesbar gespiegelt.",
  ].join("\n"));

  const analyzer = new LocalProjectAnalyzer({ rootDir: tmp });
  const suggestions = analyzer.analyze({ scope: { scope_id: "scope-1", project_id: "project-1" } });
  const decisionTitles = suggestions.filter((suggestion) => suggestion.type === "decision").map((suggestion) => suggestion.title);

  assert.deepEqual(decisionTitles, []);
});

test("does not turn list introductions into decision suggestions", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-context-list-intro-"));
  fs.mkdirSync(path.join(tmp, "services", "persistence-server"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "services", "persistence-server", "README.md"), [
    "# Persistence Server",
    "",
    "SQLite-basierter MVP-Persistenzserver fuer GerNetiX-Services.",
    "",
    "Direkte SQLite-State-Persistenz ist vorbereitet fuer:",
    "",
    "- Identity Server",
    "- Build-&-Deploy Server",
    "",
    "Services aktivieren SQLite direkt ueber:",
    "",
    "Der Server speichert servicebezogenen State als SQLite-Collections und normalisierte Tabellen.",
  ].join("\n"));

  const analyzer = new LocalProjectAnalyzer({ rootDir: tmp });
  const suggestions = analyzer.analyze({ scope: { scope_id: "scope-1", project_id: "project-1" } });
  const decisionTitles = suggestions.filter((suggestion) => suggestion.type === "decision").map((suggestion) => suggestion.title);

  assert.equal(decisionTitles.some((title) => title.includes("vorbereitet fuer")), false);
  assert.equal(decisionTitles.some((title) => title.includes("aktivieren SQLite direkt")), false);
  assert.equal(decisionTitles.includes("Der Server speichert servicebezogenen State als SQLite-Collections und normalisierte Tabellen."), true);
});

test("keeps generated service and tool suggestions readable", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-context-readable-"));
  fs.mkdirSync(path.join(tmp, "services", "project-server"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "services", "shared"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "tools", "esp32-provisioning-tool"), { recursive: true });

  const analyzer = new LocalProjectAnalyzer({ rootDir: tmp });
  const suggestions = analyzer.analyze({ scope: { scope_id: "scope-1", project_id: "project-1" } });
  const titles = suggestions.map((suggestion) => suggestion.title);

  assert.equal(titles.includes("Project Server"), true);
  assert.equal(titles.includes("Project Server Service"), false);
  assert.equal(titles.includes("Shared Service"), false);
  assert.equal(titles.includes("Esp32 Provisioning Tool"), true);
  assert.equal(titles.includes("Esp32 Provisioning Tool Tool"), false);
});
