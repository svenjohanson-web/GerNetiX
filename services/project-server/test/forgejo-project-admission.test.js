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

test("materializes every customer template copy into its own private Forgejo repository", async () => {
  const treesByRepository = new Map();
  const projectRepositoryStore = {
    provisionProject: async (input) => {
      const repositoryName = `repository-${input.project_id}`;
      treesByRepository.set(repositoryName, input.changes.map((source) => ({ ...source })));
      return {
        provider: "forgejo",
        organization: "gernetix-projects",
        repository_name: repositoryName,
        repository_id: repositoryName,
        clone_url: `http://forgejo:3000/gernetix-projects/${repositoryName}.git`,
        default_branch: "main",
        head_sha: require("node:crypto").createHash("sha1").update(repositoryName).digest("hex"),
        state: "active",
      };
    },
    readFiles: async (binding) => treesByRepository.get(binding.repository_name) || [],
  };
  const service = new ProjectService({
    repository: new InMemoryProjectRepository(),
    requireForgejoForNewProjects: true,
    projectRepositoryStore,
  });

  const template = await service.createProject({
    project_id: "system-template-sensor-v1",
    user_id: "system",
    title: "Sensorvorlage",
    status: "template",
    sources: [{ path: "src/main.cpp", content: "int templateValue = 1;\n" }],
  });
  const customer = await service.createProject({
    project_id: "customer-sensor-project",
    template_project_id: template.project_id,
    user_id: "customer-1",
    title: "Mein Sensorprojekt",
  });

  assert.equal(template.repository_binding.state, "active");
  assert.equal(customer.repository_binding.state, "active");
  assert.notEqual(customer.repository_binding.repository_name, template.repository_binding.repository_name);
  assert.equal(treesByRepository.get(customer.repository_binding.repository_name)
    .some((source) => source.path.endsWith("src/main.cpp") && source.content === "int templateValue = 1;\n"), true);
  assert.equal(treesByRepository.get(customer.repository_binding.repository_name)
    .some((source) => source.path === "gernetix/project.json"), true);
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

test("registers the camera touch display v20 repository as a protected product source", () => {
  const approvedCommit = "c".repeat(40);
  const source = createSystemRepositoryCatalog({
    FORGEJO_CAMERA_TOUCH_DISPLAY_COMMIT: approvedCommit,
  }).find((entry) => entry.source_id === "gernetix-product-camera-touch-display");

  assert.equal(source.kind, "product");
  assert.equal(source.organization, "gernetix-products");
  assert.equal(source.repository_name, "kamera-touchdisplay");
  assert.equal(source.commit_sha, approvedCommit);
  assert.deepEqual(source.materialization, {
    target_root: "",
    path_mappings: {},
    entrypoint_adapters: {},
    excluded_paths: ["gernetix/system-repository.json"],
  });
});

test("registers radar room presence as a protected Forgejo product source", () => {
  const approvedCommit = "d".repeat(40);
  const source = createSystemRepositoryCatalog({
    FORGEJO_RADAR_ROOM_PRESENCE_COMMIT: approvedCommit,
  }).find((entry) => entry.source_id === "gernetix-product-radar-room-presence");

  assert.equal(source.kind, "product");
  assert.equal(source.organization, "gernetix-products");
  assert.equal(source.repository_name, "radar-raumpraesenz");
  assert.equal(source.commit_sha, approvedCommit);
  assert.deepEqual(source.materialization, {
    target_root: "Komponenten/IoT-Device 1",
    path_mappings: {},
    entrypoint_adapters: {},
    excluded_paths: ["gernetix/system-repository.json"],
  });
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
          { path: "assets/story.pcm8", content_base64: Buffer.from([0, 1, 255]).toString("base64"), binary: true },
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
  assert.equal(provisionInput.changes.some((item) => item.path.endsWith("story.pcm8")), false);
  assert.equal(provisionInput.changes.some((item) => item.path.endsWith("gernetix/system-repository.json")), false);
});

test("adds protected binary product assets to the immutable build package", async () => {
  const approvedCommit = "d".repeat(40);
  const repository = new InMemoryProjectRepository();
  const audio = Buffer.from([0, 1, 2, 255]);
  const productFiles = [
    { path: "src/user_main.cpp", content: 'extern "C" void userMain() {}\nextern "C" void userTick() {}\n' },
    { path: "assets/story.pcm8", content_base64: audio.toString("base64"), binary: true },
  ];
  const service = new ProjectService({
    repository,
    systemRepositories: [{
      source_id: "product-audio", title: "Produkt mit Audio", kind: "product", provider: "forgejo",
      organization: "gernetix-products", repository_name: "product-audio", default_branch: "main",
      commit_sha: approvedCommit, protected: true,
      materialization: { target_root: "Komponenten/IoT-Device 1", path_mappings: {}, excluded_paths: [] },
    }],
    projectRepositoryStore: {
      readProtectedFiles: async () => productFiles,
      provisionProject: async () => ({
        provider: "forgejo", organization: "gernetix-projects", repository_name: "project-audio",
        repository_id: "789", clone_url: "http://forgejo:3000/gernetix-projects/project-audio.git",
        default_branch: "main", head_sha: "a".repeat(40), state: "active",
      }),
    },
  });
  const created = await service.createProject({
    project_id: "project-audio", user_id: "account-audio", title: "Audio Build",
    system_source_id: "product-audio",
    build_config: { platform: "espressif32", framework: "arduino", board: "esp32dev", environment: "esp32dev", user_source_path: "src/user_main.cpp" },
  });
  await repository.saveProject({ ...(await repository.findProject(created.project_id)), repository_binding: null });

  const job = await service.createBuildJob(created.project_id);
  const buildPackage = await service.createBuildPackage(job.build_job_id);
  assert.deepEqual(buildPackage.files.find((file) => file.path === "assets/story.pcm8").content, { base64: audio.toString("base64") });
  assert.equal(buildPackage.files.find((file) => file.path === "assets/story.pcm8").sha256, require("node:crypto").createHash("sha256").update(audio).digest("hex"));
});

test("adapts the touchscreen demo entrypoint to the protected basissoftware contract", async () => {
  const approvedCommit = "f".repeat(40);
  const service = new ProjectService({
    repository: new InMemoryProjectRepository(),
    systemRepositories: [{
      source_id: "touch-game", title: "Touch-Spiel", kind: "product", provider: "forgejo",
      organization: "gernetix-products", repository_name: "touch-game", default_branch: "main",
      commit_sha: approvedCommit, protected: true,
      materialization: {
        target_root: "Komponenten/IoT-Device 1",
        path_mappings: { "src/main.cpp": "src/user_main.cpp" },
        entrypoint_adapters: { "src/main.cpp": "touchscreen_game_basis" },
        excluded_paths: [],
      },
    }],
    projectRepositoryStore: {
      readProtectedFiles: async () => [{ path: "src/main.cpp", content: "void setup() {}\nvoid loop() {}\n" }],
    },
  });
  const source = await service.loadProductSource("touch-game");
  const entrypoint = source.sources.find((file) => file.path.endsWith("src/user_main.cpp"));
  assert.match(entrypoint.content, /extern "C" void userMain\(\)/);
  assert.doesNotMatch(entrypoint.content, /void setup\(\)/);
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
