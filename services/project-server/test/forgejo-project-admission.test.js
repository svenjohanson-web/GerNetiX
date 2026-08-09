"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { InMemoryProjectRepository, ProjectService } = require("../src");
const { createSystemRepositoryCatalog } = require("../src/system-repository-catalog");

test("rejects new projects when the Forgejo cutover gate is active without a repository store", async () => {
  const service = new ProjectService({
    repository: new InMemoryProjectRepository(),
    requireForgejoForNewProjects: true,
  });

  await assert.rejects(
    service.createProject({ user_id: "account-1", title: "Nur Forgejo" }),
    (error) => error.code === "forgejo_project_repository_required",
  );
});

test("provisions the complete generated project tree into Forgejo when the cutover gate is active", async () => {
  let provisionInput;
  const service = new ProjectService({
    repository: new InMemoryProjectRepository(),
    requireForgejoForNewProjects: true,
    projectRepositoryStore: {
      provisionProject: async (input) => {
        provisionInput = input;
        return {
          provider: "forgejo",
          organization: "gernetix-projects",
          repository_name: "project-123",
          repository_id: "123",
          clone_url: "http://forgejo:3000/gernetix-projects/project-123.git",
          default_branch: "main",
          head_sha: "a".repeat(40),
          state: "active",
        };
      },
    },
  });

  const created = await service.createProject({
    user_id: "account-1",
    title: "Forgejo Projekt",
    sources: [{ path: "src/main.cpp", content: "void setup() {}\nvoid loop() {}\n" }],
  });

  assert.equal(created.repository_binding.state, "active");
  assert.equal(provisionInput.message, "Projekt Forgejo Projekt angelegt");
  assert.ok(provisionInput.changes.some((source) => source.path.endsWith("/src/main.cpp") && source.content.includes("void setup()")));
  assert.ok(provisionInput.changes.some((source) => source.path === "gernetix/project.json"));
});

test("pins protected Basissoftware to the server-approved Forgejo commit", async () => {
  let provisionInput;
  let protectedRead;
  const approvedCommit = "b".repeat(40);
  const service = new ProjectService({
    repository: new InMemoryProjectRepository(),
    requireForgejoForNewProjects: true,
    systemRepositories: [{
      source_id: "gernetix-runtime-basissoftware",
      title: "Basissoftware ESP32",
      kind: "basissoftware",
      provider: "forgejo",
      organization: "gernetix-platform",
      repository_name: "basissoftware-esp32",
      default_branch: "main",
      commit_sha: approvedCommit,
      protected: true,
    }],
    projectRepositoryStore: {
      provisionProject: async (input) => {
        provisionInput = input;
        return {
          provider: "forgejo", organization: "gernetix-projects", repository_name: "project-123",
          repository_id: "123", clone_url: "http://forgejo:3000/gernetix-projects/project-123.git",
          default_branch: "main", head_sha: "a".repeat(40), state: "active",
        };
      },
      readProtectedFiles: async (reference) => {
        protectedRead = reference;
        return [{ path: "src/main.cpp", content: "// protected core\n" }];
      },
    },
  });

  const created = await service.createProject({
    user_id: "account-1",
    title: "Nexi Erweiterung",
    build_config: {
      firmware_basis_id: "gernetix-runtime-basissoftware",
      firmware_basis_reference: {
        provider: "forgejo", organization: "attacker", repository_name: "modified-core", commit_sha: "f".repeat(40),
      },
    },
  });

  assert.equal(created.build_config.firmware_basis_reference.commit_sha, approvedCommit);
  assert.equal(created.build_config.firmware_basis_reference.organization, "gernetix-platform");
  const unitFile = provisionInput.changes.find((source) => source.path === "gernetix/software-units/firmware.json");
  assert.equal(JSON.parse(unitFile.content).build.firmware_basis_reference.commit_sha, approvedCommit);
  await service.loadProtectedBasissoftwareFiles(created.build_config);
  assert.equal(protectedRead.commit_sha, approvedCommit);
  assert.equal(protectedRead.repository_name, "basissoftware-esp32");
});

test("blocks Basissoftware projects until a protected Forgejo commit is configured", async () => {
  const service = new ProjectService({
    repository: new InMemoryProjectRepository(),
    requireForgejoForNewProjects: true,
    systemRepositories: [{
      source_id: "gernetix-runtime-basissoftware", title: "Basissoftware ESP32", kind: "basissoftware",
      provider: "forgejo", organization: "gernetix-platform", repository_name: "basissoftware-esp32", commit_sha: "",
    }],
    projectRepositoryStore: { provisionProject: async () => ({}) },
  });
  await assert.rejects(
    service.createProject({ user_id: "account-1", title: "Noch nicht freigegeben", build_config: { firmware_basis_id: "gernetix-runtime-basissoftware" } }),
    (error) => error.code === "protected_repository_commit_required",
  );
});

test("copies a protected product commit into the customer repository and fixes its origin reference", async () => {
  const approvedCommit = "e".repeat(40);
  let protectedReference;
  let provisionInput;
  const service = new ProjectService({
    repository: new InMemoryProjectRepository(),
    requireForgejoForNewProjects: true,
    systemRepositories: createSystemRepositoryCatalog({ FORGEJO_NEXI_COMMIT: approvedCommit }),
    projectRepositoryStore: {
      readProtectedFiles: async (reference) => {
        protectedReference = reference;
        return [
          { path: "voice_lab.cpp", content: "// Nexi entry\n" },
          { path: "include/nexi/application.h", content: "// Nexi API\n" },
          { path: "gernetix/system-repository.json", content: "{}\n" },
        ];
      },
      provisionProject: async (input) => {
        provisionInput = input;
        return {
          provider: "forgejo", organization: "gernetix-projects", repository_name: "project-nexi",
          repository_id: "456", clone_url: "http://forgejo:3000/gernetix-projects/project-nexi.git",
          default_branch: "main", head_sha: "a".repeat(40), state: "active",
        };
      },
    },
  });

  const created = await service.createProject({
    user_id: "account-nexi", title: "Meine Nexi", system_source_id: "gernetix-product-nexi",
    view_manifest: { product_source_reference: { provider: "forgejo", organization: "attacker", repository_name: "fake", commit_sha: "f".repeat(40) } },
    sources: [{ path: "docs/meine-nexi.md", content: "Eigene Erweiterung\n" }],
  });

  assert.equal(protectedReference.commit_sha, approvedCommit);
  assert.equal(created.view_manifest.product_source_reference.organization, "gernetix-products");
  assert.equal(created.view_manifest.product_source_reference.commit_sha, approvedCommit);
  assert.ok(provisionInput.changes.some((item) => item.path === "Komponenten/IoT-Device 1/src/user_main.cpp"));
  assert.ok(provisionInput.changes.some((item) => item.path === "Komponenten/IoT-Device 1/include/nexi/application.h"));
  assert.ok(provisionInput.changes.some((item) => item.path === "docs/meine-nexi.md"));
  assert.equal(provisionInput.changes.some((item) => item.path.endsWith("gernetix/system-repository.json")), false);
});

test("migrates legacy SQL project sources into a private Forgejo repository", async () => {
  const repository = new InMemoryProjectRepository();
  const legacyService = new ProjectService({ repository });
  await legacyService.createProject({ user_id: "account-legacy", title: "Altprojekt", sources: [{ path: "docs/notes.md", content: "Bestand\n" }] });
  let provisionInput;
  const cutoverService = new ProjectService({
    repository,
    projectRepositoryStore: {
      provisionProject: async (input) => {
        provisionInput = input;
        return { provider: "forgejo", organization: "gernetix-projects", repository_name: "project-migrated", repository_id: "987", clone_url: "http://forgejo:3000/gernetix-projects/project-migrated.git", default_branch: "main", head_sha: "d".repeat(40), state: "active" };
      },
    },
  });
  const plan = await cutoverService.migrateProjectRepositories({});
  assert.equal(plan.mode, "plan");
  assert.equal(plan.count, 1);
  const result = await cutoverService.migrateProjectRepositories({ apply: true });
  assert.equal(result.migrated[0].commit_sha, "d".repeat(40));
  assert.ok(provisionInput.changes.some((item) => item.path === "docs/notes.md"));
  assert.ok((await cutoverService.listProjects({}))[0].repository_binding.state === "active");
});
