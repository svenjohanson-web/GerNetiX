const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { Pool } = require("pg");
const { createDefaultIdentityModule, MockEmailService } = require("./index");
const { effectiveSubscriptionPlan } = require("./services/account-lifecycle");
const { createSmtpConfigStore } = require("./services/smtp-config-store");
const { SmtpEmailService } = require("./services/smtp-email-service");
const { ConfigurableEmailService } = require("./services/configurable-email-service");
const { createWebPushService } = require("./services/web-push-service");
const { SqlitePlatformDownloadRepository } = require("./repositories/sqlite-platform-download-repository");
const { SqliteAccountAssetRepository } = require("./repositories/sqlite-account-asset-repository");
const { PostgresPlatformDownloadRepository } = require("./repositories/postgres-platform-download-repository");
const { PostgresAccountAssetRepository } = require("./repositories/postgres-account-asset-repository");
const { ContentAddressedArtifactStore } = require("../../shared");
const { canonicalLocalPasskeyLocation } = require("./services/local-passkey-origin");
const { passkeyBrowserFailureEvent, passkeyLoginFailureEvent } = require("./services/passkey-login-events");
const { passkeyClientError } = require("./services/passkey-client-errors");
const { createSystemEventReporter } = require("./services/system-event-reporter");
const { createUserActionReporter } = require("./services/user-action-reporter");
const { createUserActionIngestHandler, readUserActionContext } = require("./services/user-action-events");
const { createPrivateCommunityNotifier } = require("./services/private-community-notifier");
const { createRuntimeStreamHub } = require("./runtime-stream-hub");
const { createIdentityLinkInventory } = require("./link-integrity/identity-link-inventory");
const { createAccountTransparencyFactory } = require("./dev/account-transparency");
const { createDeviceDiscoveryService } = require("./dev/device-discovery");
const { createDevelopmentAssistant } = require("./dev/development-assistant");
const { createHelpAssistant } = require("./dev/help-assistant");
const { createRequirementsWorkshopAssistant } = require("./dev/requirements-workshop-assistant");
const { createProjectRepositoryRead } = require("./dev/project-repository-read");
const { developmentProjectSources } = require("./dev/development-project-structure");
const { completeBrowserFlashDefinitions, esp32FirmwareAddress, usesGerNetixOtaAppLayout } = require("./dev/browser-flash-manifest");
const { mergeBoardFeatures } = require("./dev/board-configuration-merge");
const {
  developmentProjectTemplate,
  developmentProjectTemplateCatalog,
  developmentProjectTemplatePreviews,
  templateArchitecturePlantUml,
  templateBuildConfig,
  templateFirmwareSources,
  templateHardwareConfiguration,
  templateHardwareProfileId,
  templateSoftwareUnits,
  mergeSelectedGamesHeader,
} = require("./dev/development-project-templates");
const { createDevHardwareUtils } = require("./dev/hardware-utils");
const { createLlmConfigStore } = require("../../shared/llm-config");
const { normalizeBasissoftwareConfiguration } = require("../../shared/basissoftware-configuration");
const {
  applyProjectCommunicationSetup,
  defaultProjectCommunicationSetup,
  normalizeProjectCommunicationSetup,
} = require("../../shared/project-communication-setup");
const {
  authRoute,
  clearSessionCookie,
  normalizeAppPath,
  parseCookies,
  readJsonBody,
  redirect,
  sanitizeNextPath,
  sendDevJson,
  sendJson,
  serveStatic,
  setSessionCookie,
} = require("./dev/http-utils");
const { createDevServiceClients } = require("./dev/service-clients");
const { createRouteRegistry } = require("./dev/server/route-registry");
const { createSessionAccess } = require("./dev/server/session-access");
const { createIdentityAuthHandlers } = require("./dev/auth/identity-auth-handlers");
const { createSessionService } = require("./dev/session/session-service");
const { createSubscriptionAccess } = require("./dev/account/subscription-access");
const { createAccountWorkspaceService } = require("./dev/account/account-workspace-service");
const { createRequestHandler } = require("./dev/server/request-handler");
const { registerKnowledgeRoutes } = require("./dev/server/knowledge-routes");
const { registerPlatformRoutes } = require("./dev/server/platform-routes");
const { registerAuthRoutes } = require("./dev/server/auth-routes");
const { registerAccountRoutes } = require("./dev/server/account-routes");
const { registerHardwareRoutes } = require("./dev/server/hardware-routes");
const { registerDeviceRoutes } = require("./dev/server/device-routes");
const { registerCommunityRoutes } = require("./dev/server/community-routes");
const { registerBuildRoutes } = require("./dev/server/build-routes");
const { registerHardwareLabRoutes } = require("./dev/server/hardware-lab-routes");
const { registerRequirementsWorkshopRoutes } = require("./dev/server/requirements-workshop-routes");
const { customerArtifactList } = require("./dev/server/build-artifact-visibility");
const { registerProjectRoutes } = require("./dev/server/project-routes");
const { registerSystemRoutes } = require("./dev/server/system-routes");
const { registerDownloadRoutes } = require("./dev/server/download-routes");
const { registerPlatformExtraRoutes } = require("./dev/server/platform-extra-routes");
const { registerWebRoutes } = require("./dev/server/web-routes");
const { RecoveryService } = require("../../recovery-tool/src/services/recovery-service");
const { HardwareSourceReader } = require("../../recovery-tool/src/services/hardware-source-reader");
const { HardwareLabAi } = require("../../recovery-tool/src/services/hardware-lab-ai");
const { BuildDeployClient } = require("../../recovery-tool/src/services/build-deploy-client");
const { AiUsageClient } = require("../../recovery-tool/src/services/ai-usage-client");
const { PostgresHardwareLabRepository } = require("./dev/hardware-lab-repository");
const { createInterfaceCallTelemetry } = require("../../shared/persistence/interface-call-telemetry");
const { PostgresStateStore } = require("../../shared/persistence/postgres-state-store");
const { createLearningProjectModels } = require("./dev/learning/learning-project-models");
const { createLearningProgressService } = require("./dev/learning/learning-progress-service");
const { createLearningProjectService } = require("./dev/learning/learning-project-service");
const { createProjectSourceService } = require("./dev/projects/project-source-service");
const { createProjectConfigurationService } = require("./dev/projects/project-configuration-service");
const { createProjectHardwareModel } = require("./dev/projects/project-hardware-model");
const { createProjectViewModel } = require("./dev/projects/project-view-model");
const { createProjectPlatformMapper } = require("./dev/projects/project-platform-mapper");
const { createProjectCatalogSeedingService } = require("./dev/projects/project-catalog-seeding-service");
const { createProjectRuntimeService } = require("./dev/projects/project-runtime-service");
const { createDemoProjectSources, slugifyProjectId } = require("./dev/projects/demo-project-sources");
const { createPlatformService } = require("./dev/platform/platform-service");
const { createAccountRuntimeService } = require("./dev/platform/account-runtime-service");
const { createDeviceService } = require("./dev/devices/device-service");
const { createDeviceRuntimeService } = require("./dev/devices/device-runtime-service");
const { createDeviceProfileService, normalizeDataLoggerConfiguration } = require("./dev/devices/device-profile-service");
const { createBuildService } = require("./dev/builds/build-service");
const { createBuildRuntimeUtils } = require("./dev/builds/build-runtime-utils");
const { createDownloadService } = require("./dev/downloads/download-service");
const { filterSoftwareUnitsForArchitecture, softwareArchitectureComponents } = require("../../shared/project-software-ownership");
const { developmentLessonCatalog } = require("./dev/project-models/development-lesson-catalog");
const {
  canReadKnowledgeChapter,
  findKnowledgeChapterRelease,
  knowledgeChapterHistory,
  unreadKnowledgeChapterReleases,
} = require("./knowledge/knowledge-chapter-releases");
const { getFirmwareBuildTarget, getFactoryFirmwareRelease } = require("../../../basissoftware/esp32/firmware-build-targets");
const { resolveIdentityRuntimePersistence } = require("./runtime-persistence-policy");
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");

const publicDir = path.join(__dirname, "..", "public");
const appDir = path.join(publicDir, "app");
const operatorShellDir = path.join(__dirname, "..", "..", "shared", "public");
const esptoolJsDir = path.join(__dirname, "..", "node_modules", "esptool-js");
const workspaceRoot = path.resolve(__dirname, "..", "..", "..");
const provisioningFirmwareRoot = process.env.PROVISIONING_FIRMWARE_ROOT
  ? path.resolve(process.env.PROVISIONING_FIRMWARE_ROOT)
  : path.join(workspaceRoot, ".runtime", "server-firmware", "esp32-basissoftware");
const usbSerialHelperDistDir = path.join(workspaceRoot, "tools", "usb-serial-helper", "dist");
const usbSerialHelperManifest = require(path.join(workspaceRoot, "tools", "usb-serial-helper", "package.json"));
const identityPersistenceBackend = resolveIdentityRuntimePersistence(process.env);
const identityRuntimeLocation = String(process.env.IDENTITY_RUNTIME_LOCATION || "server").trim().toLowerCase();
const identityRemoteDev = identityRuntimeLocation === "local-development" && process.env.IDENTITY_REMOTE_DEV === "1";
const identityAuxiliarySqlitePath = ":memory:";
const platformDownloadSqlitePath = process.env.PLATFORM_DOWNLOAD_SQLITE_PATH || ":memory:";
let platformDownloadRepository = identityPersistenceBackend === "postgres"
  ? null
  : new SqlitePlatformDownloadRepository(platformDownloadSqlitePath);
const accountAssetSqlitePath = process.env.ACCOUNT_ASSET_SQLITE_PATH || ":memory:";
let accountAssetRepository = identityPersistenceBackend === "postgres"
  ? null
  : new SqliteAccountAssetRepository(accountAssetSqlitePath);
const identityPostgres = {
  connectionString: process.env.IDENTITY_POSTGRES_URL || "",
  host: process.env.IDENTITY_POSTGRES_HOST || "127.0.0.1",
  port: Number(process.env.IDENTITY_POSTGRES_PORT || 5432),
  database: process.env.IDENTITY_POSTGRES_DATABASE || "gernetix_runtime",
  user: process.env.IDENTITY_POSTGRES_USER || "gernetix_runtime",
  password: process.env.IDENTITY_POSTGRES_PASSWORD || "",
};
const identityAuxiliaryPool = identityPersistenceBackend === "postgres" ? new Pool(identityPostgres) : null;
const identityPushStateStore = identityAuxiliaryPool
  ? new PostgresStateStore(identityAuxiliaryPool, "identity-web-push", { subscriptions: [] })
  : null;
const identitySmtpStateStore = identityAuxiliaryPool
  ? new PostgresStateStore(identityAuxiliaryPool, "identity-email-config", { config: null })
  : null;
const identityLlmStateStore = identityAuxiliaryPool
  ? new PostgresStateStore(identityAuxiliaryPool, "llm-routing-config", { config: null }, {
    encryptionKey: process.env.RUNTIME_STATE_ENCRYPTION_KEY || "",
  })
  : null;
const identityHardwareLabStateStore = identityAuxiliaryPool
  ? new PostgresStateStore(identityAuxiliaryPool, "identity-hardware-lab", { sessions: [] })
  : null;
const identityUserActionOutboxStore = identityAuxiliaryPool
  ? new PostgresStateStore(identityAuxiliaryPool, "identity-user-action-outbox", { items: [] })
  : null;
const identityAppBaseUrl = process.env.IDENTITY_APP_BASE_URL || process.env.APP_BASE_URL || "";
const identityAdminToken = process.env.IDENTITY_ADMIN_TOKEN || "";
const emailConfigEncryptionKey = process.env.EMAIL_CONFIG_ENCRYPTION_KEY || "";
const webPushService = createWebPushService({ sqlitePath: identityAuxiliarySqlitePath, stateStore: identityPushStateStore, publicKey: process.env.WEB_PUSH_VAPID_PUBLIC_KEY || "", privateKey: process.env.WEB_PUSH_VAPID_PRIVATE_KEY || "", subject: process.env.WEB_PUSH_VAPID_SUBJECT || "" });
const securityAlertPushAccountIds = String(process.env.WEB_PUSH_SECURITY_ALERT_ACCOUNT_IDS || "").split(",").map((value) => value.trim()).filter(Boolean);
const port = Number(process.env.PORT || 4300);
const host = process.env.HOST || "127.0.0.1";
const demoUsername = process.env.DEMO_USER || "demo";
const demoEmail = process.env.DEMO_EMAIL || "demo@gernetix.local";
const demoPassword = process.env.DEMO_PASSWORD || "demo-passwort";
const basisDemoUsername = process.env.BASIS_DEMO_USER || "basis";
const basisDemoEmail = process.env.BASIS_DEMO_EMAIL || "basis@gernetix.local";
const basisDemoPassword = process.env.BASIS_DEMO_PASSWORD || demoPassword;
const defaultAccountPlan = process.env.GERNETIX_DEFAULT_ACCOUNT_PLAN || "premium_demo";
const runtimeStreamHub = createRuntimeStreamHub();
const projectServerBaseUrl = process.env.PROJECT_SERVER_BASE_URL || "http://127.0.0.1:4800";
const telemetryServerBaseUrl = process.env.TELEMETRY_SERVER_BASE_URL || "http://127.0.0.1:5600";
const telemetryInternalToken = process.env.TELEMETRY_INTERNAL_TOKEN || "";
const buildDeployBaseUrl = process.env.BUILD_DEPLOY_BASE_URL || "http://127.0.0.1:4400";
const buildWorkerPoolBaseUrl = process.env.BUILD_WORKER_POOL_BASE_URL || buildDeployBaseUrl;
const publicDemoBaseUrl = process.env.PUBLIC_DEMO_BASE_URL || "http://127.0.0.1:4920";
const communityPlatformBaseUrl = process.env.COMMUNITY_PLATFORM_BASE_URL || "http://127.0.0.1:5200";
const communityInternalToken = process.env.COMMUNITY_INTERNAL_TOKEN || "";
const communityNotificationEmailRecipient = process.env.COMMUNITY_NOTIFICATION_EMAIL_RECIPIENT || "";
const otaBuildDeployBaseUrl = process.env.OTA_BUILD_DEPLOY_BASE_URL || "https://build.gernetix.com";
const hardwareShopBaseUrl = process.env.HARDWARE_SHOP_BASE_URL || "http://127.0.0.1:4900";
const hardwareCatalogBaseUrl = process.env.HARDWARE_CATALOG_BASE_URL || "http://10.77.0.1:4910";
const deviceManagementBaseUrl = process.env.DEVICE_MANAGEMENT_BASE_URL || "http://127.0.0.1:4700";
const aiUsageBaseUrl = process.env.AI_USAGE_BASE_URL || "http://127.0.0.1:5000";
const hardwareLabAiUsageBaseUrl = /\/api\/ai-usage\/?$/.test(aiUsageBaseUrl)
  ? aiUsageBaseUrl.replace(/\/$/, "")
  : `${aiUsageBaseUrl.replace(/\/$/, "")}/api/ai-usage`;
const aiContextBaseUrl = process.env.AI_CONTEXT_BASE_URL || "http://127.0.0.1:5500";
const adminToolBaseUrl = process.env.ADMIN_TOOL_BASE_URL || "http://127.0.0.1:4600";
const systemEventIngestToken = process.env.SYSTEM_EVENT_INGEST_TOKEN || "";
const recordSystemEvent = createSystemEventReporter({
  baseUrl: adminToolBaseUrl,
  ingestToken: systemEventIngestToken,
});
const recordUserActionEvent = createUserActionReporter({
  baseUrl: adminToolBaseUrl,
  ingestToken: systemEventIngestToken,
  outboxStore: identityUserActionOutboxStore,
});
const handleUserActionIngest = createUserActionIngestHandler({
  readJsonBody,
  sendJson,
  reportUserAction: recordUserActionEvent,
});
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const ollamaModel = process.env.OLLAMA_MODEL || "llama3.2:3b";
const deviceDiscoveryUrls = process.env.GERNETIX_DEVICE_DISCOVERY_URLS || process.env.DEVICE_DISCOVERY_URLS || "";
const gernetixNodeHostnamePrefix = "gernetix-";
const execFileAsync = promisify(execFile);
const interfaceTelemetry = createInterfaceCallTelemetry({
  dbPath: process.env.INTERFACE_TELEMETRY_SQLITE_PATH || process.env.PERSISTENCE_SQLITE_PATH,
  endpoint: process.env.INTERFACE_TELEMETRY_ENDPOINT,
  token: process.env.INTERFACE_TELEMETRY_TOKEN,
  sourceService: "identity-server",
});
const {
  aiContextJson,
  aiUsageJson,
  buildDeployJson,
  buildWorkerPoolJson,
  communityJson,
  deviceManagementJson,
  hardwareCatalogJson,
  hardwareShopJson,
  projectServerJson,
  telemetryJson,
} = createDevServiceClients({
  aiContextBaseUrl,
  aiUsageBaseUrl,
  buildDeployBaseUrl,
  buildWorkerPoolBaseUrl,
  communityPlatformBaseUrl,
  communityInternalToken,
  deviceManagementBaseUrl,
  hardwareCatalogBaseUrl,
  hardwareShopBaseUrl,
  projectServerBaseUrl,
  telemetryBaseUrl: telemetryServerBaseUrl,
  telemetryInternalToken,
  interfaceTelemetry,
});
const projectRepositoryRead = createProjectRepositoryRead({ projectServerJson });
const { buildDeployJson: otaBuildDeployJson } = createDevServiceClients({
  aiContextBaseUrl,
  aiUsageBaseUrl,
  buildDeployBaseUrl: otaBuildDeployBaseUrl,
  deviceManagementBaseUrl,
  hardwareCatalogBaseUrl,
  hardwareShopBaseUrl,
  projectServerBaseUrl,
  interfaceTelemetry,
});
const {
  buildTargetLabel,
  createGerNetixSerialNumber,
  defaultUploadPort,
  deviceBuildConfig,
  findProcessorBoard,
  isUsbFlashDevice,
  listUsbSerialPorts,
  loadProcessorBoards,
  loadSensors,
  normalizeGerNetixNodeName,
  renderPlatformioIni,
  requiredField,
} = createDevHardwareUtils({
  execFileAsync,
  hardwareCatalogJson,
  interfaceTelemetry,
});
const createAccountTransparency = createAccountTransparencyFactory({
  aiUsageJson,
  demoEmail,
  demoUsername,
  deviceManagementJson,
  hardwareShopJson,
  projectServerJson,
  projectServerUserId,
});
const {
  nexiCourseModel,
  learningProjectRegistry,
} = createLearningProjectModels({ readWorkspaceText });
const llmConfigStore = createLlmConfigStore({
  configPath: path.join(workspaceRoot, ".runtime", "identity-llm-config.json"),
  stateStore: identityLlmStateStore,
  defaultOllamaBaseUrl: ollamaBaseUrl,
  defaultOllamaModel: ollamaModel,
});
const hardwareLabRepository = new PostgresHardwareLabRepository(identityHardwareLabStateStore);
const hardwareLabService = new RecoveryService({
  repository: hardwareLabRepository,
  deviceManagementBaseUrl,
  registerRecoveredDevices: false,
  sourceReader: new HardwareSourceReader(),
  hardwareLabAi: new HardwareLabAi({
    llmConfigStore,
    aiUsageClient: new AiUsageClient({ baseUrl: hardwareLabAiUsageBaseUrl }),
  }),
  buildDeployClient: new BuildDeployClient({ baseUrl: buildDeployBaseUrl }),
});
const { discoverNetworkDevices } = createDeviceDiscoveryService({
  deviceDiscoveryUrls,
  deviceManagementJson,
  loadUserIdeDevices: (...args) => loadUserIdeDevices(...args),
  normalizeCapabilityIds: (...args) => normalizeCapabilityIds(...args),
  nodeHostnamePrefix: gernetixNodeHostnamePrefix,
});
const developmentAssistant = createDevelopmentAssistant({
  aiContextJson,
  aiUsageJson,
  hardwareCatalogJson,
  llmConfigStore,
  projectServerJson,
  projectServerUserId,
  readJsonBody,
  requireProjectAccess: requireSessionProject,
  sendJson,
});
const helpAssistant = createHelpAssistant({ aiContextJson, aiUsageJson, llmConfigStore, projectServerUserId, readJsonBody, sendJson });
const requirementsWorkshopAssistant = createRequirementsWorkshopAssistant({ aiUsageJson, llmConfigStore, projectServerUserId, readJsonBody, sendJson });
const builtInDemoAccounts = [
  { user_id: "acct-demo", username: demoUsername, email: demoEmail, password: demoPassword, subscription_plan: "premium_demo" },
  { user_id: "acct-basis-demo", username: basisDemoUsername, email: basisDemoEmail, password: basisDemoPassword, subscription_plan: "free" },
];

const mockEmailService = new MockEmailService({ log() {} });
const smtpConfigStore = createSmtpConfigStore({ sqlitePath: identityAuxiliarySqlitePath, stateStore: identitySmtpStateStore, encryptionKey: emailConfigEncryptionKey });
const smtpEmailService = new SmtpEmailService({ configStore: smtpConfigStore });
const emailService = new ConfigurableEmailService({ smtpEmailService, fallbackEmailService: mockEmailService });
const notifyPrivateCommunityRequest = createPrivateCommunityNotifier({
  smtpEmailService,
  smtpConfigStore,
  recordSystemEvent,
  webPushService,
  // Community processing is performed through the separate Admin Access and
  // Admin Tool path. Customer Identity accounts never receive operator rights.
  operatorAccountIds: [],
  emailRecipient: communityNotificationEmailRecipient,
});
let auth;
let userIdeState;
const {
  defaultHomeAutomationConfiguration,
  normalizeHomeAutomationConfiguration,
  defaultTouchscreenGameConfiguration,
  normalizeTouchscreenGameConfiguration,
  isTouchscreenGameBoard,
  touchscreenGameInventoryMatches,
  restoreDevelopmentTemplateReference,
  normalizeArchitectureDiagram,
  stripPlantUmlNotes,
  normalizeArchitecturePlantUml,
  numberGenericIotDeviceInstances,
  architectureDiagramFromManifest,
  hardwareConfigurationFromManifest,
  normalizeHardwareConfiguration,
  normalizeDevelopmentBoardConfiguration,
  compilerBoardConfiguration,
  normalizeHardwareProperties,
  hardwareCircuitFor,
  hardwareConfigurationSources,
  primaryHardwareComponentPath,
  hardwareBoardMarkdown,
  hardwareIoMarkdown,
  hardwareCircuitMarkdown,
  hardwareWiringPlantUml,
  boardFeatureForHardwareComponent,
  boardFeatureIdForHardwareComponent,
  formatHardwarePins,
  plantUmlLabel,
  hardwarePropertyLines,
  plantUmlText,
  slugifyHardwareFolder,
  buildConfigForBoard,
  platformSoftwareUnits,
  platformActiveSoftwareUnitId,
  developmentSoftwareUnits,
  developmentArchitectureSoftwareComponents,
  normalizeArchitectureDialog,
} = createProjectHardwareModel({
  developmentProjectTemplate,
  developmentProjectTemplateCatalog,
  filterSoftwareUnitsForArchitecture,
  mergeBoardFeatures,
  requiredField,
  softwareArchitectureComponents,
  templateArchitecturePlantUml,
});
const {
  createUserIdeState,
  project,
  normalizeLearningProjectCategory,
  normalizeLearningProjectTags,
  ownedCapabilityIds,
  normalizeCapabilityIds,
  step,
  primarySourcePath,
  projectViewManifest,
  developmentProjectViewManifest,
  initialArchitecturePlantUml,
} = createProjectViewModel({
  learningProjectRegistry,
  developmentLessonCatalog,
  normalizeArchitectureDialog,
  normalizeArchitecturePlantUml,
  normalizeDataLoggerConfiguration,
  normalizeHomeAutomationConfiguration,
  normalizeProjectCommunicationSetup,
  normalizeTouchscreenGameConfiguration,
  stripPlantUmlNotes,
  getUserIdeState: () => userIdeState,
  normalizePwaDashboardConfiguration: (...args) => projectConfiguration.normalizePwaDashboardConfiguration(...args),
});
const sessionService = createSessionService({ auth: () => auth, parseCookies });
const sessions = sessionService.sessions;
userIdeState = createUserIdeState();
const { demoProjectSources } = createDemoProjectSources({
  learningProjectRegistry,
  primarySourcePath,
});
const {
  loadHardwareShopSummary,
  loadUserIdeDevices,
  loadAccountBoardConfigurations,
  loadAvailableProcessorBoards,
  decorateUserIdeDevice,
  handlePlatformFlashboxClaim,
  handleHardwareShopOrder,
  loadAiUsageSummary,
} = createAccountRuntimeService({
  projectServerUserId,
  deviceManagementJson,
  loadProcessorBoards,
  mergeBoardFeatures,
  isUsbFlashDevice,
  defaultUploadPort,
  deviceBuildConfig,
  buildTargetLabel,
  hardwareShopJson,
  hardwareShopBaseUrl,
  getUserIdeState: () => userIdeState,
  ownedCapabilityIds,
  readJsonBody,
  requiredField,
  sendJson,
  aiUsageJson,
  aiUsageBaseUrl,
});
const {
  latestBuildStatus,
  loadBuildDeployJob,
  toBuildDeployPackage,
  resolveBuildConfig,
  touchscreenGameBuildConfigurationProblems,
  toProjectBuildResult,
} = createBuildRuntimeUtils({
  projectServerJson,
  otaBuildDeployJson,
  buildDeployJson,
  renderPlatformioIni,
});
const { accountSubscription, hasEntitlements, requireEntitlement, requireEntitlements } = createSubscriptionAccess({
  effectiveSubscriptionPlan, defaultAccountPlan, sendJson,
});
const {
  ensureAccountResourcePlan,
  getWorkspaceState,
  loadBillingSummary,
  touchWorkspace,
  updateAccountProjectSelection,
  updateWorkspaceState,
} = createAccountWorkspaceService({
  accountSubscription,
  getUserIdeState: () => userIdeState,
  loadAiUsageSummary,
  projectServerJson,
  projectServerUserId,
});
const {
  mapProjectServerProject,
  mapUserIdeProjectSummaries,
  mapUserIdeProjects,
  toPlatformProject,
  toPlatformProjectSummary,
} = createProjectPlatformMapper({
  catalogProjectIdForDefinition,
  developmentProjectViewManifest,
  getUserIdeState: () => userIdeState,
  getWorkspaceState,
  hardwareConfigurationFromManifest,
  hardwareWiringPlantUml,
  initialArchitecturePlantUml,
  isEstablishedLearningProject,
  isRetiredCatalogProject,
  latestBuildStatus,
  normalizeHardwareConfiguration,
  platformActiveSoftwareUnitId,
  platformSoftwareUnits,
  projectServerUserId,
  projectViewManifest,
  restoreDevelopmentTemplateReference,
});
const { scheduleProjectServerDemoProjects } = createProjectCatalogSeedingService({
  accountSubscription,
  demoProjectSources,
  getUserIdeState: () => userIdeState,
  projectServerJson,
  projectServerUserId,
  projectViewManifest,
});
const {
  invalidateUserIdeProjectCaches,
  loadUserIdeProjectSummaries,
  loadUserIdeProjects,
  requireSessionProject,
  sessionProjectNotFound,
} = createProjectRuntimeService({
  ensureAccountResourcePlan,
  getLearningProjects: () => learningProjects,
  getUserIdeState: () => userIdeState,
  mapProjectServerProject,
  mapUserIdeProjectSummaries,
  mapUserIdeProjects,
  projectServerJson,
  projectServerUserId,
  scheduleProjectServerDemoProjects,
});
const routeRegistry = createRouteRegistry();
const sessionAccess = createSessionAccess({ resolveSession: sessionService.read, sendJson });
const learningProgress = createLearningProgressService({
  projectServerJson,
  projectServerUserId,
  requireSessionProject: (...args) => requireSessionProject(...args),
  requiredField,
  touchWorkspace: (...args) => touchWorkspace(...args),
});
const projectSources = createProjectSourceService({
  projectServerJson,
  requireSessionProject: (...args) => requireSessionProject(...args),
  touchWorkspace: (...args) => touchWorkspace(...args),
  readJsonBody,
  readUserActionContext,
  sendJson,
});
const projectConfiguration = createProjectConfigurationService({
  readJsonBody,
  projectServerUserId,
  developmentProjectTemplate,
  requireEntitlements,
  requiredField,
  templateBuildConfig,
  templateHardwareConfiguration,
  templateSoftwareUnits,
  loadAvailableProcessorBoards,
  sendJson,
  compilerBoardConfiguration,
  normalizeHardwareConfiguration,
  defaultProjectCommunicationSetup,
  applyProjectCommunicationSetup,
  slugifyProjectId,
  templateArchitecturePlantUml,
  developmentProjectSources,
  templateFirmwareSources,
  templateHardwareProfileId,
  projectServerJson,
  accountSubscription,
  developmentProjectViewManifest,
  defaultHomeAutomationConfiguration,
  defaultTouchscreenGameConfiguration,
  touchWorkspace,
  toPlatformProject,
  mapProjectServerProject,
  requireSessionProject,
  normalizeArchitectureDiagram,
  architectureDiagramFromManifest,
  projectSources,
  hardwareConfigurationFromManifest,
  loadUserIdeProjects,
  initialArchitecturePlantUml,
  normalizeArchitectureDialog,
  normalizeHomeAutomationConfiguration,
  normalizeTouchscreenGameConfiguration,
  isTouchscreenGameBoard,
  buildConfigForBoard,
  touchscreenGameInventoryMatches,
  mergeSelectedGamesHeader,
  developmentSoftwareUnits,
  loadUserIdeDevices: (...args) => loadUserIdeDevices(...args),
  hardwareConfigurationSources,
  hardwareWiringPlantUml,
  loadProcessorBoards,
  normalizeBasissoftwareConfiguration,
  platformSoftwareUnits,
  normalizeProjectCommunicationSetup,
});
const platformService = createPlatformService({
  loadUserIdeProjects,
  loadUserIdeDevices,
  loadProjectBuilds,
  sendJson,
  createAccountSummary,
  loadHardwareShopSummary,
  loadAiUsageSummary,
  loadUserIdeProjectSummaries,
  recordSystemEvent,
  projectServerUserId,
  deviceManagementBaseUrl,
  learningProgress,
  getWorkspaceState,
  developmentAssistant,
  developmentProjectTemplateCatalog,
  hasEntitlements,
  developmentProjectTemplatePreviews,
  toPlatformProjectSummary,
  loadBillingSummary,
  accountSubscription,
  auth: () => auth,
  unreadKnowledgeChapterReleases,
  knowledgeChapterHistory,
  findKnowledgeChapterRelease,
  canReadKnowledgeChapter,
  communityJson,
});
const learningProjects = createLearningProjectService({
  userIdeState,
  catalogProjectIdForDefinition,
  sendJson,
  projectServerUserId,
  projectServerJson,
  crypto,
  accountSubscription,
  projectViewManifest,
  demoProjectSources,
  mapProjectServerProject,
  invalidateUserIdeProjectCaches,
  touchWorkspace,
  learningProgress,
  toPlatformProject,
  nexiCourseModel,
  mapUserIdeProjects,
  requireSessionProject,
  readJsonBody,
  loadUserIdeDevices,
  loadAvailableProcessorBoards,
  platformSoftwareUnits,
  buildConfigForBoard,
  compilerBoardConfiguration,
  telemetryJson,
  webPushService,
});
const deviceService = createDeviceService({
  readJsonBody,
  projectServerUserId,
  requiredField,
  createGerNetixSerialNumber,
  normalizeGerNetixNodeName,
  findProcessorBoard,
  normalizeCapabilityIds,
  deviceManagementJson,
  assignFirstEsp32AsRecoveryToken,
  sendJson,
  decorateUserIdeDevice,
  recordDeviceInventoryFailure,
});
const deviceProfileService = createDeviceProfileService({
  provisioningFirmwareRoot,
  hardwareCatalogJson,
  getFirmwareBuildTarget,
  getFactoryFirmwareRelease,
  readJsonBody,
  projectServerUserId,
  deviceManagementJson,
  decorateUserIdeDevice,
  sendJson,
});
const deviceRuntime = createDeviceRuntimeService({
  deviceManagementJson,
  loadUserIdeDevices,
  sendJson,
  discoverNetworkDevices,
  publicDemoBaseUrl,
  esptoolJsDir,
  serveStatic,
  readJsonBody,
});
const buildService = createBuildService({
  readJsonBody,
  readUserActionContext,
  sessionService,
  loadUserIdeProjects,
  loadUserIdeDevices,
  platformSoftwareUnits,
  resolveBuildConfig,
  touchscreenGameBuildConfigurationProblems,
  projectServerJson,
  renderPlatformioIni,
  sendJson,
  otaBuildDeployJson,
  buildWorkerPoolJson,
  buildDeployJson,
  toBuildDeployPackage,
  toProjectBuildResult,
  completeBrowserFlashDefinitions,
  usesGerNetixOtaAppLayout,
  esp32FirmwareAddress,
  customerArtifactList,
  buildDeployBaseUrl,
  otaBuildDeployBaseUrl,
  userIdeState,
  touchWorkspace,
});
const downloadService = createDownloadService({
  readJsonBody,
  sendDevJson,
  projectServerJson,
  getUserIdeState: () => userIdeState,
  usbSerialHelperDistDir,
  usbSerialHelperManifest,
  getPlatformDownloadRepository: () => platformDownloadRepository,
  sendJson,
});
const authHandlers = createIdentityAuthHandlers({
  auth: () => auth,
  sessions,
  readJsonBody,
  sendJson,
  setSessionCookie,
  clearSessionCookie,
  readSessionToken: sessionService.readToken,
  readSession: sessionService.read,
  sanitizeNextPath,
  mockEmailService,
  smtpEmailService,
  host,
  port,
  identityAppBaseUrl,
  crypto,
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  readUserActionContext,
  passkeyClientError,
  recordSystemEvent,
  recordPasskeyLoginFailure,
  evictCachedSessionsForUser: sessionService.evictUser,
});

registerKnowledgeRoutes({
  registry: routeRegistry,
  requireSession: sessionAccess.requireSession,
  markChapterRead: platformService.handleKnowledgeChapterRead,
});
registerPlatformRoutes({
  registry: routeRegistry,
  requireSession: sessionAccess.requireSession,
  readJsonBody,
  sendJson,
  handleSummary: platformService.handlePlatformSummary,
  handleBootstrap: platformService.handlePlatformBootstrap,
  updateWorkspaceState,
  updateLearningProgress: learningProgress.update,
  updateResourceSelection: updateAccountProjectSelection,
});
registerAuthRoutes({
  registry: routeRegistry,
  readJsonBody,
  sendJson,
  redirect,
  recordSystemEvent,
  passkeyBrowserFailureEvent,
  auth: () => auth,
  ...authHandlers,
});
registerAccountRoutes({
  registry: routeRegistry,
  requireSession: sessionAccess.requireSession,
  readJsonBody,
  sendJson,
  auth: () => auth,
  sessions,
  setSessionCookie,
  sanitizeNextPath,
  updateCachedSessionAccount: sessionService.updateAccount,
  accountAssetRepository: () => accountAssetRepository,
  createAccountTransparency,
});
registerHardwareRoutes({
  registry: routeRegistry,
  requireSession: sessionAccess.requireSession,
  readJsonBody,
  sendJson,
  loadAvailableProcessorBoards,
  projectServerUserId,
  loadAccountBoardConfigurations,
  deviceManagementJson,
  hardwareCatalogJson,
  loadSensors,
  recordSystemEvent,
});
registerDeviceRoutes({
  registry: routeRegistry,
  requireSession: sessionAccess.requireSession,
  sendJson,
  discoverNetworkDevices,
  handleDeviceConnectivityCheck: deviceRuntime.handleDeviceConnectivityCheck,
  listUsbSerialPorts,
  handlePlatformDiscoveredDeviceClaim: deviceService.handlePlatformDiscoveredDeviceClaim,
  handlePlatformDeviceCreate: deviceService.handlePlatformDeviceCreate,
  handlePlatformDeviceBasissoftwareProfileUpdate: deviceProfileService.handlePlatformDeviceBasissoftwareProfileUpdate,
  handlePlatformDeviceVoiceAiPolicyUpdate: deviceProfileService.handlePlatformDeviceVoiceAiPolicyUpdate,
  handlePlatformDeviceRemove: deviceService.handlePlatformDeviceRemove,
  handlePlatformProvisioningSession: deviceService.handlePlatformProvisioningSession,
  handlePlatformProvisioningComplete: deviceService.handlePlatformProvisioningComplete,
  loadUserIdeDevices,
  handleDeviceRecoveryFirmwareCheck: deviceRuntime.handleDeviceRecoveryFirmwareCheck,
  handlePlatformFlashboxClaim,
});
registerCommunityRoutes({
  registry: routeRegistry,
  requireSession: sessionAccess.requireSession,
  readJsonBody,
  sendJson,
  communityJson,
  auth: () => auth,
  createCommunityProjectSnapshot,
  notifyPrivateCommunityRequest,
});
registerBuildRoutes({
  registry: routeRegistry,
  requireSession: sessionAccess.requireSession,
  readJsonBody,
  sendJson,
  handleUserIdeBuildJob: buildService.handleUserIdeBuildJob,
  loadUserIdeProjects,
  buildDeployJson,
  projectServerJson,
  loadBuildDeployJob,
  recordCompletedBuildJob: buildService.recordCompletedBuildJob,
  browserFlashManifest: buildService.browserFlashManifest,
  projectServerUserId,
  proxyBuildArtifact: buildService.proxyBuildArtifact,
});
registerHardwareLabRoutes({
  registry: routeRegistry,
  requireSession: sessionAccess.requireSession,
  readJsonBody,
  sendJson,
  projectServerUserId,
  hardwareLabService,
  hardwareLabRepository,
  buildDeployBaseUrl,
  aiUsageJson,
});
registerRequirementsWorkshopRoutes({
  registry: routeRegistry,
  requireSession: sessionAccess.requireSession,
  requirementsWorkshopAssistant,
});
registerProjectRoutes({
  registry: routeRegistry,
  requireSession: sessionAccess.requireSession,
  readJsonBody,
  sendJson,
  requireEntitlement,
  requireSessionProject,
  projectServerJson,
  projectRepositoryRead,
  projectServerUserId,
  loadUserIdeDevices,
  loadProcessorBoards,
  loadAiUsageSummary,
  telemetryJson,
  developmentProjectTemplateCatalog,
  developmentAssistant,
  helpAssistant,
  recordSystemEvent,
  handleUserIdeSummary: platformService.handleUserIdeSummary,
  handleDevelopmentProjectCreate: projectConfiguration.handleDevelopmentProjectCreate,
  handleDevelopmentProjectArchitectureSave: projectConfiguration.handleDevelopmentProjectArchitectureSave,
  handleLearningProjectStart: learningProjects.handleLearningProjectStart,
  handleDevelopmentLessonStart: learningProjects.handleDevelopmentLessonStart,
  handlePlatformProjectRead: learningProjects.handlePlatformProjectRead,
  handleLearningProjectDeviceAssign: learningProjects.handleLearningProjectDeviceAssign,
  handlePlatformProjectDelete: learningProjects.handlePlatformProjectDelete,
  handleDevelopmentProjectDialogSave: projectConfiguration.handleDevelopmentProjectDialogSave,
  handleDevelopmentProjectHardwareSave: projectConfiguration.handleDevelopmentProjectHardwareSave,
  handleProjectComponentFeatures: projectConfiguration.handleProjectComponentFeatures,
  handleProjectBasissoftwareConfiguration: projectConfiguration.handleProjectBasissoftwareConfiguration,
  handleProjectCommunicationSetup: projectConfiguration.handleProjectCommunicationSetup,
  handleProjectComponentHardwareFeatures: projectConfiguration.handleProjectComponentHardwareFeatures,
  handleProjectPwaDashboard: projectConfiguration.handleProjectPwaDashboard,
  handleProjectEventConfiguration: projectConfiguration.handleProjectEventConfiguration,
  handlePlatformSourceSearch: projectSources.search,
  handlePlatformSourceList: projectSources.list,
  handlePlatformSourceRead: projectSources.read,
  handlePlatformSourceWrite: projectSources.write,
  loadUserIdeProjects,
});
registerSystemRoutes({
  registry: routeRegistry,
  requireSession: sessionAccess.requireSession,
  readJsonBody,
  sendJson,
  sendDevJson,
  requireInternalAdmin,
  handleDevLessonPreviewMigration: downloadService.handleDevLessonPreviewMigration,
  identityPersistenceBackend,
  identityRuntimeLocation,
  identityRemoteDev,
  smtpConfigStore,
  smtpEmailService,
  createIdentityLinkInventory,
  publicDir,
  webPushService,
  securityAlertPushAccountIds,
  requireSessionProject,
  projectServerUserId,
  handleInternalDevicePushEvent,
  handleInternalDeviceRuntimeEvent,
  handleUserActionIngest,
  handleProjectRuntimeStream,
  telemetryJson,
});
registerDownloadRoutes({
  registry: routeRegistry,
  requireSession: sessionAccess.requireSession,
  sendJson,
  currentFlashboxInitialFirmware: downloadService.currentFlashboxInitialFirmware,
  publicFlashboxFirmwareMetadata: downloadService.publicFlashboxFirmwareMetadata,
  servePublicFlashboxFirmware: downloadService.servePublicFlashboxFirmware,
  usbSerialHelperDownloads: downloadService.usbSerialHelperDownloads,
  serveUsbSerialHelperDownload: downloadService.serveUsbSerialHelperDownload,
  provisioningFirmwareRequest: deviceProfileService.provisioningFirmwareRequest,
  resolveProvisioningFirmwareArtifact: deviceProfileService.resolveProvisioningFirmwareArtifact,
});
registerPlatformExtraRoutes({
  registry: routeRegistry,
  requireSession: sessionAccess.requireSession,
  sendJson,
  loadHardwareShopSummary,
  loadAiUsageSummary,
  handleHardwareShopOrder,
});
registerWebRoutes({
  registry: routeRegistry,
  requireSession: (req, res) => res ? sessionAccess.requireSession(req, res) : sessionService.read(req),
  redirect,
  authRoute,
  serveStatic,
  normalizeAppPath,
  appDir,
  operatorShellDir,
  publicDir,
  serveVendorEsptool: deviceRuntime.serveVendorEsptool,
  proxyPublicDemo: deviceRuntime.proxyPublicDemo,
});

async function bootstrap() {
  if (identityPushStateStore) await identityPushStateStore.initialize();
  if (identitySmtpStateStore) await identitySmtpStateStore.initialize();
  if (identityLlmStateStore) await identityLlmStateStore.initialize();
  if (identityUserActionOutboxStore) {
    await identityUserActionOutboxStore.initialize();
    const outboxResult = await recordUserActionEvent.flush();
    if (outboxResult.pending) console.warn(`User action outbox: ${outboxResult.pending} Ereignisse warten auf Operations.`);
  }
  if (identityHardwareLabStateStore) {
    await identityHardwareLabStateStore.initialize();
    hardwareLabRepository.hydrate();
  }
  if (identityPersistenceBackend === "postgres") {
    const artifactStore = new ContentAddressedArtifactStore(process.env.ARTIFACT_STORE_DIR || path.join(workspaceRoot, ".runtime", "artifacts"));
    platformDownloadRepository = await PostgresPlatformDownloadRepository.create({ poolOptions: identityPostgres, artifactStore });
    accountAssetRepository = await PostgresAccountAssetRepository.create({ poolOptions: identityPostgres, artifactStore });
  }
  auth = await createDefaultIdentityModule({
    emailService,
    persistenceBackend: identityPersistenceBackend,
    postgres: identityPostgres,
    appBaseUrl: identityAppBaseUrl || `http://${host}:${port}`,
  });
  await seedDemoAccount();

  const requestHandler = createRequestHandler({
    routeRequest,
    sendJson,
    reportError: (error) => console.error(error),
    reportSlowRequest: (measurement) => console.warn(`[identity-http] slow request ${JSON.stringify(measurement)}`),
    slowRequestMs: Number(process.env.IDENTITY_SLOW_REQUEST_MS || 1500),
  });
  const server = http.createServer(requestHandler);

  server.listen(port, host, () => {
  console.log(`Identity login UI: http://${host}:${port}/app/auth/`);
  console.log(`GerNetiX Dashboard+: http://${host}:${port}/app/dashboard/`);
  console.log(`Project Server adapter: ${projectServerBaseUrl}`);
  console.log(`Build & Deploy adapter: ${buildDeployBaseUrl}`);
  console.log(`Build Worker Pool adapter: ${buildWorkerPoolBaseUrl}`);
  console.log(`OTA Build & Deploy adapter: ${otaBuildDeployBaseUrl}`);
  console.log(`Hardware Shop adapter: ${hardwareShopBaseUrl}`);
  console.log(`Hardware Catalog adapter: ${hardwareCatalogBaseUrl}`);
  console.log(`Device Management adapter: ${deviceManagementBaseUrl}`);
  console.log(`AI Usage adapter: ${aiUsageBaseUrl}`);
  console.log(`AI Context adapter: ${aiContextBaseUrl}`);
  console.log(`Identity persistence: ${identityPersistenceBackend} (${identityRuntimeLocation})`);
  const llmConfig = llmConfigStore.publicConfig();
  console.log(`Development Platform LLM: ${llmConfig.baseUrl} (${llmConfig.model})`);
  });
}

async function seedDemoAccount() {
  for (const account of builtInDemoAccounts) {
    try {
      const beforeCount = mockEmailService.sentMessages.length;
      await auth.register_local(account.username, account.email, account.password, true, account.password, {
        user_id: account.user_id,
        subscription_plan: account.subscription_plan,
      });
      const verification = mockEmailService.sentMessages
        .slice(beforeCount)
        .find((message) => message.type === "verification");
      const token = verification ? new URL(verification.link).searchParams.get("token") : "";
      if (token) {
        await auth.verify_email(token);
      }
    } catch (error) {
      if (!["username_already_exists", "email_already_exists", "user_id_already_exists"].includes(error.code)) {
        throw error;
      }
      const existing = await auth.repository.findUserByUsername(account.username);
      if (existing && existing.subscription_plan !== account.subscription_plan) {
        await auth.update_subscription_plan(existing.id, account.subscription_plan);
      }
    }
  }
}

function requireInternalAdmin(req) {
  if (!identityAdminToken) {
    const error = new Error("Interne Admin-Authentifizierung ist nicht konfiguriert.");
    error.status = 503;
    error.code = "identity_admin_token_missing";
    throw error;
  }
  const provided = String(req.headers["x-gernetix-admin-token"] || "");
  const expectedBuffer = Buffer.from(identityAdminToken);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
    const error = new Error("Interne Admin-Authentifizierung fehlgeschlagen.");
    error.status = 403;
    error.code = "internal_admin_access_denied";
    throw error;
  }
}

async function handleInternalDevicePushEvent(req, res) {
  requireInternalAdmin(req);
  const event = await readJsonBody(req);
  const accountId = String(event.account_id || "").trim();
  const projectId = String(event.project_id || "").trim();
  const deviceId = String(event.device_id || "").trim();
  if (!accountId || !projectId || !deviceId) { sendJson(res, 400, { error: "account_project_and_device_required" }); return; }
  const title = String(event.title || "GerNetiX Board").trim().slice(0, 120) || "GerNetiX Board";
  const body = String(event.body || "Neue Meldung von deinem Board.").trim().slice(0, 500) || "Neue Meldung von deinem Board.";
  const requestedUrl = String(event.url || "").trim();
  const url = requestedUrl.startsWith("/app/") ? requestedUrl : "/app/device-management/";
  const push = await webPushService.notifyProject(accountId, projectId, { title, body, url });
  sendJson(res, 202, { accepted: true, account_id: accountId, project_id: projectId, device_id: deviceId, push });
}

async function handleInternalDeviceRuntimeEvent(req, res) {
  requireInternalAdmin(req);
  const event = await readJsonBody(req);
  const accountId = String(event.account_id || "").trim();
  const projectId = String(event.project_id || "").trim();
  const deviceId = String(event.device_id || "").trim();
  const line = String(event.line || "").trim().slice(0, 500);
  if (!accountId || !projectId || !deviceId || !line) { sendJson(res, 400, { error: "account_project_device_and_line_required" }); return; }
  runtimeStreamHub.publish({ accountId, projectId, deviceId, channel: event.channel, line, occurredAt: event.occurred_at });
  sendJson(res, 202, { accepted: true, account_id: accountId, project_id: projectId, device_id: deviceId });
}

async function handleProjectRuntimeStream(req, res, session, projectId) {
  await requireSessionProject(session, projectId);
  const accountId = projectServerUserId(session);
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("event: ready\ndata: {}\n\n");
  const unsubscribe = runtimeStreamHub.subscribe({ accountId, projectId, send: (payload) => res.write(`event: runtime\ndata: ${payload}\n\n`) });
  const heartbeat = setInterval(() => res.write(": keepalive\n\n"), 25000);
  heartbeat.unref?.();
  req.on("close", () => { clearInterval(heartbeat); unsubscribe(); });
}

async function routeRequest(req, res) {
  const canonicalLocation = canonicalLocalPasskeyLocation(req);
  if (canonicalLocation) {
    redirect(res, canonicalLocation);
    return;
  }
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (await routeRegistry.dispatch({ req, res, url })) return;

  sendJson(res, 404, { error: "route_not_found" });
}

function recordPasskeyLoginFailure(stage, error, account, correlationId = "") {
  return recordSystemEvent(passkeyLoginFailureEvent(stage, error, account, correlationId));
}

function recordDeviceInventoryFailure(session, eventType, error, context = {}) {
  recordSystemEvent({
    severity: "error",
    source_service: "identity_server",
    target_service: "device_management",
    category: "dependency",
    event_type: eventType,
    message: "Device-Inventarisierung konnte Device Management nicht erfolgreich nutzen.",
    impact: "Device konnte nicht ins Account-Inventar uebernommen, geladen oder entfernt werden.",
    account_id: projectServerUserId(session),
    route: context.route || "/app/device-management/inventory/",
    details: {
      dependency_base_url: deviceManagementBaseUrl,
      operation: context.operation || eventType,
      error: error.message || String(error),
      error_code: error.code || "",
      status: error.status || "",
      payload: error.payload || {},
    },
  });
}

async function createCommunityProjectSnapshot(session, projectId) {
  const project = await requireSessionProject(session, String(projectId || ""));
  const [storedProject, sourcePayload] = await Promise.all([
    projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`),
    projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/sources`),
  ]);
  const safeSources = [];
  let totalBytes = 0;
  for (const sourceInfo of (sourcePayload.items || []).slice(0, 60)) {
    if (isCommunityExcludedSource(sourceInfo)) continue;
    const source = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/sources/${encodeURIComponent(sourceInfo.path)}`);
    if (isCommunityExcludedSource(source)) continue;
    const content = redactCommunitySource(String(source.content || "")).slice(0, 48 * 1024);
    const nextBytes = Buffer.byteLength(content, "utf8");
    if (totalBytes + nextBytes > 180 * 1024 || safeSources.length >= 60) break;
    totalBytes += nextBytes;
    safeSources.push({
      path: source.path,
      content,
      content_type: source.content_type || "text/plain",
      content_sha256: crypto.createHash("sha256").update(content).digest("hex"),
    });
  }
  if (!safeSources.length) {
    const error = new Error("Aus diesem Projekt kann kein sicherer Community-Projektstand erstellt werden.");
    error.status = 400;
    error.code = "community_snapshot_empty";
    throw error;
  }
  return {
    snapshot_id: `community_snapshot_${crypto.randomUUID()}`,
    project_title: String(storedProject.title || project.title || "Projekt").slice(0, 120),
    captured_at: new Date().toISOString(),
    source_count: safeSources.length,
    sources: safeSources,
  };
}

function isCommunityExcludedSource(source = {}) {
  const path = String(source.path || "").toLowerCase();
  const type = String(source.content_type || "").toLowerCase();
  return /(^|\/)(\.env|.*\.(pem|key|p12|pfx)|.*(secret|credential|password).*)($|\/|\.)/.test(path)
    || /^(image|audio|video|application\/octet-stream)/.test(type);
}

function redactCommunitySource(content) {
  return content
    .replace(/-----BEGIN [^-]*(PRIVATE KEY|CERTIFICATE)[\s\S]*?-----END [^-]*(PRIVATE KEY|CERTIFICATE)-----/gi, "[ENTFERNT: kryptografisches Material]")
    .replace(/((?:password|passwort|ssid|token|api[_-]?key|secret|private[_-]?key)\s*[:=]\s*["']?)[^"'\s,;]+/gi, "$1[ENTFERNT]");
}

async function loadProjectBuilds(projects, session) {
  const devices = await loadUserIdeDevices(session);
  const result = [];
  for (const project of projects) {
    const [response, artifactResponse] = await Promise.all([
      projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/build-jobs`).catch(() => ({ items: [] })),
      projectServerJson(`/api/firmware-artifacts?project_id=${encodeURIComponent(project.project_server_id)}`).catch(() => ({ items: [] })),
    ]);
    for (const job of response.items) {
      const device = devices.find((item) => item.device_id === job.device_id);
      const artifacts = customerArtifactList(job.build_job_id, Object.fromEntries(artifactResponse.items
        .filter((artifact) => artifact.build_job_id === job.build_job_id)
        .map((artifact) => [artifact.file_name, artifact])));
      result.push({
        build_job_id: job.build_job_id,
        project_server_id: job.project_id,
        project_slug: project.slug,
        project_title: project.title,
        software_unit_id: job.software_unit_id || "",
        software_unit_title: job.software_unit?.title || "Firmware",
        device_id: job.device_id,
        device_label: device ? device.display_name : job.device_id || "kein Device",
        mode: job.mode,
        status: job.status,
        flash_status: job.result?.build?.usb_flash?.status || job.result?.deploy?.status || "nicht angefordert",
        created_at: job.created_at,
        finished_at: job.finished_at,
        build_config: job.build_config || project.build_config || null,
        artifacts,
        build_id: job.result?.build?.build_id || "",
        build_package_contract: "Project Server BuildPackage",
      });
    }
  }
  return result.sort((left, right) => right.created_at.localeCompare(left.created_at));
}

function catalogProjectIdForDefinition(definition) {
  return `catalog_${definition.slug}`;
}

function isEstablishedLearningProject(project) {
  return project.learning_project_id === "learning_project.software_engineering_tamagotchi";
}

function isRetiredCatalogProject(project) {
  return project.project_id === "project_esp32-ota-bootstrap-firmware"
    || project.learning_project_id === "learning_project.esp32_ota_bootstrap_firmware";
}

async function assignFirstEsp32AsRecoveryToken(req, session, deviceId, hardwareProfileId) {
  if (!/esp32/i.test(String(hardwareProfileId || ""))) return null;
  if (Number(session.account?.recovery_board_count || 0) > 0) return null;
  const result = await auth.add_esp32_recovery_token(session.account.user_id, deviceId);
  session.account = result.account;
  sessionService.updateAccount(req, result.account);
  return result.account;
}

function projectServerUserId(session) {
  const userId = String(session?.account?.user_id || "").trim();
  if (!userId) {
    const error = new Error("Authenticated session is missing identity.user_id.");
    error.code = "missing_identity_user_id";
    error.status = 500;
    throw error;
  }
  return userId;
}

async function createAccountSummary(session, existingAiUsage = null, { includeAiCredits = true } = {}) {
  const aiUsage = includeAiCredits ? (existingAiUsage || await loadAiUsageSummary(session)) : null;
  const subscription = accountSubscription(session);
  return {
    username: session.account.username || "",
    user_id: projectServerUserId(session),
    plan: subscription.plan,
    capabilities: ["ide_flash_usb", "ide_flash_ota", "cloud_flash"],
    ai_credits: aiUsage?.credits?.available_credits || 0,
    consent_summary: "1 aktiver Device-Support-Consent",
    project_server: projectServerBaseUrl,
    build_deploy_server: buildDeployBaseUrl,
    hardware_shop: hardwareShopBaseUrl,
    device_management: deviceManagementBaseUrl,
    ai_usage: aiUsageBaseUrl,
  };
}


function readWorkspaceText(relativePath) {
  return fs.readFileSync(path.join(workspaceRoot, relativePath), "utf8");
}


bootstrap().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
