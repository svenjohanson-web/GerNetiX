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
const {
  migrateCameraTemplateDisplayGpioTypes,
  migrateCameraTemplateWifiArchitecture,
} = require("./dev/development-project-template-migrations");
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
const { createTamagotchiEntryCourseModel } = require("./dev/project-models/tamagotchi-entry-course");
const { createSmartAssistantCourseModel } = require("./dev/project-models/smart-assistant-course");
const { createNexiCourseModel } = require("./dev/project-models/nexi-course");
const { createButtonToSmartphoneNotificationCourseModel } = require("./dev/project-models/button-to-smartphone-notification-course");
const { createHomeAutomationNetworkCourseModel } = require("./dev/project-models/home-automation-network-course");
const { createHomeAutomationSensorsCourseModel } = require("./dev/project-models/home-automation-sensors-course");
const { createMotorControlBasicsCourseModel } = require("./dev/project-models/motor-control-basics-course");
const { createProximitySensorRadarCourseModel } = require("./dev/project-models/proximity-sensor-radar-course");
const { filterSoftwareUnitsForArchitecture, softwareArchitectureComponents } = require("../../shared/project-software-ownership");
const { createProgrammingFundamentalsCourseModel } = require("./dev/project-models/programming-fundamentals-course");
const { createMicrocontrollerFundamentalsCourseModel } = require("./dev/project-models/microcontroller-fundamentals-course");
const { createUmlFundamentalsCourseModel } = require("./dev/project-models/uml-fundamentals-course");
const { createRequirementsWorkshopCourseModel } = require("./dev/project-models/requirements-workshop-course");
const { createYamlFundamentalsCourseModel } = require("./dev/project-models/yaml-fundamentals-course");
const { createStorageLearningStoryCourseModel } = require("./dev/project-models/storage-learning-story-course");
const { createRadioTechnologiesCourseModel } = require("./dev/project-models/radio-technologies-course");
const { createMeasurementToolsBasicsCourseModel } = require("./dev/project-models/measurement-tools-basics-course");
const { createEsp32CameraStreamingCourseModel } = require("./dev/project-models/esp32-camera-streaming-course");
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
const passkeyChallenges = new Map();
const offlineRecoveryAttempts = new Map();
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
const tamagotchiEntryCourseModel = createTamagotchiEntryCourseModel({ readWorkspaceText });
const smartAssistantCourseModel = createSmartAssistantCourseModel();
const nexiCourseModel = createNexiCourseModel();
const buttonToSmartphoneNotificationCourseModel = createButtonToSmartphoneNotificationCourseModel();
const homeAutomationNetworkCourseModel = createHomeAutomationNetworkCourseModel();
const homeAutomationSensorsCourseModel = createHomeAutomationSensorsCourseModel();
const motorControlBasicsCourseModel = createMotorControlBasicsCourseModel();
const proximitySensorRadarCourseModel = createProximitySensorRadarCourseModel();
const programmingFundamentalsCourseModel = createProgrammingFundamentalsCourseModel();
const microcontrollerFundamentalsCourseModel = createMicrocontrollerFundamentalsCourseModel();
const umlFundamentalsCourseModel = createUmlFundamentalsCourseModel();
const requirementsWorkshopCourseModel = createRequirementsWorkshopCourseModel();
const yamlFundamentalsCourseModel = createYamlFundamentalsCourseModel();
const storageLearningStoryCourseModel = createStorageLearningStoryCourseModel();
const radioTechnologiesCourseModel = createRadioTechnologiesCourseModel();
const measurementToolsBasicsCourseModel = createMeasurementToolsBasicsCourseModel();
const esp32CameraStreamingCourseModel = createEsp32CameraStreamingCourseModel();
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
  loadUserIdeDevices,
  normalizeCapabilityIds,
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
const sessions = new Map();
const userIdeState = createUserIdeState();
const projectServerSeededUsers = new Set();
const projectServerSeedPromises = new Map();
const accountResourcePlanCache = new Map();
const accountResourcePlanLoads = new Map();
const accountResourcePlanCacheMs = 15_000;
const userIdeProjectsCache = new Map();
const userIdeProjectLoads = new Map();
const userIdeProjectsCacheMs = 2_500;
const userIdeProjectSummariesCache = new Map();
const userIdeProjectSummaryLoads = new Map();
const userIdeProjectSummariesCacheMs = 15_000;
const routeRegistry = createRouteRegistry();
const sessionAccess = createSessionAccess({ resolveSession: readSession, sendJson });

registerKnowledgeRoutes({
  registry: routeRegistry,
  requireSession: sessionAccess.requireSession,
  markChapterRead: handleKnowledgeChapterRead,
});
registerPlatformRoutes({
  registry: routeRegistry,
  requireSession: sessionAccess.requireSession,
  readJsonBody,
  sendJson,
  handleSummary: handlePlatformSummary,
  handleBootstrap: handlePlatformBootstrap,
  updateWorkspaceState,
  updateLearningProgress,
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
  handleLogin,
  handleRegister,
  handlePasskeyRegistrationOptions,
  handlePasskeyRegistrationVerify,
  handlePasskeyAuthenticationOptions,
  handlePasskeyAuthenticationVerify,
  handleExternalLogin,
  handleLogout,
  handleSession,
  handleOfflineRecoveryStart,
  handleOfflineRecoveryPasskeyOptions,
  handleOfflineRecoveryPasskeyVerify,
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
  updateCachedSessionAccount,
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
  handleDeviceConnectivityCheck,
  listUsbSerialPorts,
  handlePlatformDiscoveredDeviceClaim,
  handlePlatformDeviceCreate,
  handlePlatformDeviceBasissoftwareProfileUpdate,
  handlePlatformDeviceVoiceAiPolicyUpdate,
  handlePlatformDeviceRemove,
  handlePlatformProvisioningSession,
  handlePlatformProvisioningComplete,
  loadUserIdeDevices,
  handleDeviceRecoveryFirmwareCheck,
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
  handleUserIdeBuildJob,
  loadUserIdeProjects,
  buildDeployJson,
  projectServerJson,
  loadBuildDeployJob,
  recordCompletedBuildJob,
  browserFlashManifest,
  projectServerUserId,
  proxyBuildArtifact,
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
  handleUserIdeSummary,
  handleDevelopmentProjectCreate,
  handleDevelopmentProjectArchitectureSave,
  handleLearningProjectStart,
  handleDevelopmentLessonStart,
  handlePlatformProjectRead,
  handleLearningProjectDeviceAssign,
  handlePlatformProjectDelete,
  handleDevelopmentProjectDialogSave,
  handleDevelopmentProjectHardwareSave,
  handleProjectComponentFeatures,
  handleProjectBasissoftwareConfiguration,
  handleProjectCommunicationSetup,
  handleProjectComponentHardwareFeatures,
  handleProjectPwaDashboard,
  handleProjectEventConfiguration,
  handlePlatformSourceSearch,
  handlePlatformSourceList,
  handlePlatformSourceRead,
  handlePlatformSourceWrite,
  loadUserIdeProjects,
});
registerSystemRoutes({
  registry: routeRegistry,
  requireSession: sessionAccess.requireSession,
  readJsonBody,
  sendJson,
  sendDevJson,
  requireInternalAdmin,
  handleDevLessonPreviewMigration,
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
  currentFlashboxInitialFirmware,
  publicFlashboxFirmwareMetadata,
  servePublicFlashboxFirmware,
  usbSerialHelperDownloads,
  serveUsbSerialHelperDownload,
  provisioningFirmwareRequest,
  resolveProvisioningFirmwareArtifact,
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
  requireSession: (req, res) => res ? sessionAccess.requireSession(req, res) : readSession(req),
  redirect,
  authRoute,
  serveStatic,
  normalizeAppPath,
  appDir,
  operatorShellDir,
  publicDir,
  serveVendorEsptool,
  proxyPublicDemo,
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

function passkeyConfiguration(req) {
  const origin = String(req.headers.origin || identityAppBaseUrl || `http://${host}:${port}`).replace(/\/$/, "");
  return { origin, rpID: new URL(origin).hostname };
}

function storePasskeyChallenge(kind, username, challenge, config) {
  passkeyChallenges.set(`${kind}:${passkeyChallengeSubject(username)}`, { challenge, config, expiresAt: Date.now() + 5 * 60 * 1000 });
}

function readPasskeyChallenge(kind, username) {
  const key = `${kind}:${passkeyChallengeSubject(username)}`;
  const value = passkeyChallenges.get(key);
  passkeyChallenges.delete(key);
  if (!value || value.expiresAt < Date.now()) throw new Error("passkey_challenge_expired");
  return value;
}

function passkeyChallengeSubject(username) {
  return String(username || "").trim().toLowerCase() || "__discoverable_passkey__";
}

function offlineRecoveryChallengeSubject(token) {
  return `offline-recovery:${crypto.createHash("sha256").update(String(token || "")).digest("base64url")}`;
}

function toBase64Url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

async function handleOfflineRecoveryStart(req, res) {
  const body = await readJsonBody(req);
  const username = String(body.username || "");
  const rateLimit = offlineRecoveryRateLimit(req, username);
  if (rateLimit.limited) {
    await recordOfflineRecoveryEvent(req, "offline_recovery_rate_limited", "warning", "Offline-Recovery wurde wegen zu vieler Fehlversuche begrenzt.", username);
    sendJson(res, 429, { error: "offline_recovery_rate_limited", message: "Zu viele Recovery-Versuche. Bitte warte einige Minuten." });
    return;
  }
  try {
    const recovery = await auth.start_offline_recovery(username, String(body.recovery_set || ""));
    clearOfflineRecoveryAttempts(rateLimit.key);
    await recordOfflineRecoveryEvent(req, "offline_recovery_started", "info", "Offline-Recovery wurde vorbereitet.", username);
    sendJson(res, 200, recovery);
  } catch (error) {
    recordOfflineRecoveryFailure(rateLimit.key);
    await recordOfflineRecoveryEvent(req, "offline_recovery_failed", "warning", "Offline-Recovery-Set konnte nicht geprüft werden.", username, error);
    sendJson(res, error.status || 401, { error: error.code || "offline_recovery_failed", message: "Recovery-Set konnte nicht geprüft werden." });
  }
}

async function handleOfflineRecoveryPasskeyOptions(req, res) {
  try {
    const body = await readJsonBody(req);
    const recoveryToken = String(body.recovery_token || "");
    const account = await auth.get_offline_recovery_account(recoveryToken);
    const config = passkeyConfiguration(req);
    const options = await generateRegistrationOptions({
      rpName: "GerNetiX",
      rpID: config.rpID,
      userID: Buffer.from(account.id),
      userName: account.username,
      userDisplayName: account.username,
      attestationType: "none",
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
      excludeCredentials: account.passkey_credential_id ? [{ id: account.passkey_credential_id, transports: account.passkey_transports || [] }] : [],
    });
    storePasskeyChallenge("offline-recovery", offlineRecoveryChallengeSubject(recoveryToken), options.challenge, config);
    sendJson(res, 200, options);
  } catch (error) {
    sendJson(res, error.status || 401, { error: error.code || "offline_recovery_passkey_unavailable", message: "Neuer Passkey konnte nicht vorbereitet werden." });
  }
}

async function handleOfflineRecoveryPasskeyVerify(req, res) {
  try {
    const body = await readJsonBody(req);
    const recoveryToken = String(body.recovery_token || "");
    await auth.get_offline_recovery_account(recoveryToken);
    const challenge = readPasskeyChallenge("offline-recovery", offlineRecoveryChallengeSubject(recoveryToken));
    const verification = await verifyRegistrationResponse({
      response: body.credential,
      expectedChallenge: challenge.challenge,
      expectedOrigin: challenge.config.origin,
      expectedRPID: challenge.config.rpID,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) throw new Error("offline_recovery_passkey_not_verified");
    const credential = verification.registrationInfo.credential;
    const completed = await auth.complete_offline_recovery(recoveryToken, {
      credentialId: credential.id,
      publicKey: toBase64Url(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports || [],
    });
    if (body.locale) completed.account = await auth.update_preferred_locale(completed.account.user_id, body.locale);
    evictCachedSessionsForUser(completed.account.user_id);
    await recordOfflineRecoveryEvent(req, "offline_recovery_passkey_replaced", "warning", "Offline-Recovery hat den Login-Passkey ersetzt.", completed.account.username);
    sessions.set(completed.session.token, { account: completed.account, expiresAt: completed.session.expires_at });
    setSessionCookie(res, completed.session.token, completed.session.expires_at);
    sendJson(res, 200, { account: completed.account, next: sanitizeNextPath(body.next) || "/app/dashboard/" });
  } catch (error) {
    sendJson(res, error.status || 401, { error: error.code || "offline_recovery_passkey_failed", message: "Zugang konnte nicht wiederhergestellt werden." });
  }
}

function offlineRecoveryRateLimit(req, username) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const maxAttempts = 5;
  const key = `${clientAddress(req)}:${String(username || "").trim().toLowerCase()}`;
  for (const [attemptKey, attempt] of offlineRecoveryAttempts.entries()) {
    if (attempt.expiresAt <= now) offlineRecoveryAttempts.delete(attemptKey);
  }
  const attempt = offlineRecoveryAttempts.get(key);
  return {
    key,
    limited: Boolean(attempt && attempt.count >= maxAttempts && attempt.expiresAt > now),
    expiresAt: attempt?.expiresAt || now + windowMs,
  };
}

function recordOfflineRecoveryFailure(key) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const current = offlineRecoveryAttempts.get(key);
  offlineRecoveryAttempts.set(key, {
    count: current && current.expiresAt > now ? current.count + 1 : 1,
    expiresAt: current && current.expiresAt > now ? current.expiresAt : now + windowMs,
  });
}

function clearOfflineRecoveryAttempts(key) {
  offlineRecoveryAttempts.delete(key);
}

function clientAddress(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || "unknown";
}

function hashedAuditValue(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("base64url");
}

function recordOfflineRecoveryEvent(req, eventType, severity, message, username, error = null) {
  return recordSystemEvent({
    severity,
    source_service: "identity_server",
    category: "authentication",
    event_type: eventType,
    message,
    impact: eventType === "offline_recovery_passkey_replaced"
      ? "Ein Konto hat seinen Login-Passkey über Offline-Recovery ersetzt; vorherige Sessions wurden widerrufen."
      : "Offline-Recovery-Zugriffe werden begrenzt und ohne Recovery-Geheimnisse protokolliert.",
    route: "/app/auth/",
    details: {
      username_hash: hashedAuditValue(String(username || "").trim().toLowerCase()),
      client_hash: hashedAuditValue(clientAddress(req)),
      ...(error ? { error_code: error.code || "offline_recovery_failed" } : {}),
    },
  });
}

async function handlePasskeyRegistrationOptions(req, res) {
  try {
    const body = await readJsonBody(req);
    const username = String(body.username || "").trim();
    if (username.length < 3) throw new Error("invalid_username");
    const config = passkeyConfiguration(req);
    const options = await generateRegistrationOptions({
      rpName: "GerNetiX", rpID: config.rpID, userName: username,
      attestationType: "none",
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
    });
    storePasskeyChallenge("register", username, options.challenge, config);
    sendJson(res, 200, options);
  } catch (error) {
    sendJson(res, 400, {
      error: error.code || (error.message === "invalid_username" ? "invalid_username" : "passkey_registration_unavailable"),
      message: "Konto wurde nicht angelegt. Grund: Passkey konnte nicht vorbereitet werden.",
    });
  }
}

async function handlePasskeyRegistrationVerify(req, res) {
  try {
    const body = await readJsonBody(req);
    const username = String(body.username || "").trim();
    if (body.accepted_terms !== true) throw new Error("terms_not_accepted");
    const challenge = readPasskeyChallenge("register", username);
    const verification = await verifyRegistrationResponse({
      response: body.credential, expectedChallenge: challenge.challenge,
      expectedOrigin: challenge.config.origin, expectedRPID: challenge.config.rpID,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) throw new Error("passkey_registration_not_verified");
    const credential = verification.registrationInfo.credential;
    const created = await auth.create_passkey_account(username, {
      credentialId: credential.id, publicKey: toBase64Url(credential.publicKey),
      counter: credential.counter, transports: credential.transports || [],
    }, { preferredLocale: body.locale });
    sessions.set(created.session.token, { account: created.account, expiresAt: created.session.expires_at });
    setSessionCookie(res, created.session.token, created.session.expires_at);
    sendJson(res, 201, { account: created.account, message: "Konto wurde angelegt.", next: sanitizeNextPath(body.next) || "/app/dashboard/" });
  } catch (error) {
    const message = error.message === "terms_not_accepted"
      ? "Konto wurde nicht angelegt. Grund: Bitte bestätige Datenschutz und Nutzungsbedingungen."
      : host === "127.0.0.1"
        ? `Konto wurde nicht angelegt. Grund: Passkey konnte nicht verifiziert werden: ${error.message || "unbekannter Fehler"}`
        : "Konto wurde nicht angelegt. Grund: Passkey konnte nicht verifiziert werden.";
    sendJson(res, error.status || 400, {
      error: error.code || (error.message === "terms_not_accepted" ? "terms_not_accepted" : "passkey_registration_failed"),
      message,
    });
  }
}

async function handlePasskeyAuthenticationOptions(req, res) {
  let account = null;
  const actionContext = readUserActionContext(req, "identity.login.passkey");
  try {
    const body = await readJsonBody(req);
    const username = String(body.username || "").trim();
    const config = passkeyConfiguration(req);
    account = username ? await auth.get_passkey_login_candidate(username) : null;
    const options = await generateAuthenticationOptions({
      rpID: config.rpID, userVerification: "required",
      ...(account ? { allowCredentials: [{ id: account.passkey_credential_id, transports: account.passkey_transports || [] }] } : {}),
    });
    storePasskeyChallenge("authenticate", username, options.challenge, config);
    sendJson(res, 200, options);
  } catch (error) {
    await recordPasskeyLoginFailure("options", error, account, actionContext?.actionId);
    const clientError = passkeyClientError("options", error);
    sendJson(res, clientError.status, clientError);
  }
}

async function handlePasskeyAuthenticationVerify(req, res) {
  let account = null;
  const actionContext = readUserActionContext(req, "identity.login.passkey");
  try {
    const body = await readJsonBody(req);
    const username = String(body.username || "").trim();
    account = username
      ? await auth.get_passkey_login_candidate(username)
      : await auth.get_passkey_login_candidate_by_credential_id(body.credential?.id);
    const challenge = readPasskeyChallenge("authenticate", username);
    const verification = await verifyAuthenticationResponse({
      response: body.credential, expectedChallenge: challenge.challenge,
      expectedOrigin: challenge.config.origin, expectedRPID: challenge.config.rpID,
      requireUserVerification: true,
      credential: {
        id: account.passkey_credential_id,
        publicKey: Buffer.from(account.passkey_public_key, "base64url"),
        counter: Number(account.passkey_counter || 0),
        transports: account.passkey_transports || [],
      },
    });
    if (!verification.verified) throw new Error("passkey_authentication_not_verified");
    const login = await auth.login_passkey_by_credential_id(account.passkey_credential_id, verification.authenticationInfo.newCounter);
    if (body.locale) login.account = await auth.update_preferred_locale(login.account.user_id, body.locale);
    sessions.set(login.session.token, { account: login.account, expiresAt: login.session.expires_at });
    setSessionCookie(res, login.session.token, login.session.expires_at);
    sendJson(res, 200, { account: login.account, next: sanitizeNextPath(body.next) || "/app/dashboard/" });
  } catch (error) {
    await recordPasskeyLoginFailure("verification", error, account, actionContext?.actionId);
    const clientError = passkeyClientError("verification", error);
    sendJson(res, clientError.status, clientError);
  }
}

async function handleLogin(req, res) {
  const body = await readJsonBody(req);
  try {
    const login = await auth.login_local(body.identifier, body.password);
    if (body.locale) login.account = await auth.update_preferred_locale(login.account.user_id, body.locale);
    sessions.set(login.session.token, {
      account: login.account,
      expiresAt: login.session.expires_at,
    });
    setSessionCookie(res, login.session.token, login.session.expires_at);
    sendJson(res, 200, {
      account: login.account,
      next: sanitizeNextPath(body.next) || "/app/dashboard/",
    });
  } catch (error) {
    sendJson(res, error.status || 401, {
      error: error.code || "invalid_login",
      message: "Login fehlgeschlagen.",
    });
  }
}

async function handleRegister(req, res) {
  const body = await readJsonBody(req);
  try {
    const beforeCount = mockEmailService.sentMessages.length;
    const registered = await auth.register_local(
      body.username,
      body.email,
      body.password,
      body.accepted_terms === true,
      body.password_repeat,
      { preferredLocale: body.locale },
    );
    if (smtpEmailService.configured()) {
      sendJson(res, 202, {
        account: registered.account,
        requires_email_verification: true,
        message: "Konto erstellt. Bitte bestaetige jetzt die E-Mail-Adresse.",
      });
      return;
    }
    const verification = mockEmailService.sentMessages
      .slice(beforeCount)
      .find((message) => message.type === "verification");
    const token = verification ? new URL(verification.link).searchParams.get("token") : "";
    if (token) await auth.verify_email(token);
    const login = await auth.login_local(body.email, body.password);
    sessions.set(login.session.token, {
      account: login.account,
      expiresAt: login.session.expires_at,
    });
    setSessionCookie(res, login.session.token, login.session.expires_at);
    sendJson(res, 201, {
      account: login.account,
      next: sanitizeNextPath(body.next) || "/app/dashboard/",
    });
  } catch (error) {
    sendJson(res, error.status || 400, {
      error: error.code || "registration_failed",
      message: registrationMessage(error),
    });
  }
}

async function handleExternalLogin(req, res) {
  const body = await readJsonBody(req);
  const provider = String(body.provider || "").trim().toLowerCase();
  const email = String(body.email || "").trim().toLowerCase();
  const username = String(body.username || "").trim();
  try {
    if (!provider) throw new Error("provider_required");
    if (!email) throw new Error("email_required");
    const login = await auth.login_external(provider, {
      provider,
      provider_user_id: body.provider_user_id || `${provider}:${email}`,
      email,
      email_verified: body.email_verified !== false,
      username: username || email.split("@")[0],
    });
    if (!login.session) {
      sendJson(res, 202, {
        account: login.account,
        requires_email_verification: true,
        message: "Account erstellt, E-Mail-Verifizierung erforderlich.",
      });
      return;
    }
    sessions.set(login.session.token, {
      account: login.account,
      expiresAt: login.session.expires_at,
    });
    setSessionCookie(res, login.session.token, login.session.expires_at);
    sendJson(res, 200, {
      account: login.account,
      provider,
      next: sanitizeNextPath(body.next) || "/app/dashboard/",
    });
  } catch (error) {
    sendJson(res, error.status || 400, {
      error: error.code || "external_login_failed",
      message: externalLoginMessage(error),
    });
  }
}

async function handleLogout(req, res) {
  const token = readSessionToken(req);
  if (token) {
    sessions.delete(token);
    await auth.logout(token);
  }
  clearSessionCookie(res);
  sendJson(res, 200, { logged_out: true });
}

async function handleSession(req, res) {
  const session = await readSession(req);
  if (!session) {
    sendJson(res, 401, { authenticated: false });
    return;
  }

  sendJson(res, 200, {
    authenticated: true,
    account: session.account,
    expires_at: session.expiresAt,
  });
}

async function handleUserIdeSummary(res, session) {
  const projects = await loadUserIdeProjects(session);
  const devices = await loadUserIdeDevices(session);
  const builds = await loadProjectBuilds(projects, session);
  sendJson(res, 200, {
    account: await createAccountSummary(session),
    projects,
    devices,
    builds,
    hardware_shop: await loadHardwareShopSummary(session),
    ai_usage: await loadAiUsageSummary(session),
  });
}

const platformSummarySections = new Set(["projects", "devices", "builds", "ai", "community", "account", "knowledge", "billing", "subscription", "progress", "development"]);
const platformBootstrapSections = new Set(["projects", "development"]);

function requestedPlatformSummarySections(value) {
  if (value === null || value === undefined || value === "") return new Set(platformSummarySections);
  return new Set(String(value).split(",").map((item) => item.trim()).filter((item) => platformSummarySections.has(item)));
}

function requestedPlatformBootstrapSections(value) {
  if (value === null || value === undefined || value === "") return new Set(platformBootstrapSections);
  return new Set(String(value).split(",").map((item) => item.trim()).filter((item) => platformBootstrapSections.has(item)));
}

async function handlePlatformSummary(res, session, requestedSections = null) {
  const sections = requestedPlatformSummarySections(requestedSections);
  const serviceStatus = {};
  const needsFullProjects = sections.has("builds");
  const needsProjectSummaries = sections.has("projects") || sections.has("progress");
  const projectsPromise = needsFullProjects
    ? loadUserIdeProjects(session)
    : needsProjectSummaries ? loadUserIdeProjectSummaries(session) : Promise.resolve([]);
  const trackedProjectsPromise = projectsPromise.then((items) => {
    serviceStatus.project_server = { ok: true };
    return items;
  }).catch((error) => {
    serviceStatus.project_server = { ok: false, error: error.message || String(error) };
    return [];
  });
  const devicesPromise = sections.has("devices") ? loadUserIdeDevices(session).then((items) => {
    serviceStatus.device_management = { ok: true };
    return items;
  }).catch((error) => {
    serviceStatus.device_management = { ok: false, error: error.message || String(error) };
    recordSystemEvent({
      severity: "error",
      source_service: "identity_server",
      target_service: "device_management",
      category: "dependency",
      event_type: "dependency_unreachable",
      message: "Device Management Server ist fuer Identity nicht erreichbar.",
      impact: "Device-Inventarisierung und Recovery koennen keine Account-Devices laden oder speichern.",
      account_id: projectServerUserId(session),
      route: "/app/device-management/inventory/",
      details: {
        dependency_base_url: deviceManagementBaseUrl,
        operation: "loadUserIdeDevices",
        error: error.message || String(error),
      },
    });
    return [];
  }) : Promise.resolve([]);
  const needsAiUsage = sections.has("ai") || sections.has("billing");
  const aiUsagePromise = needsAiUsage ? loadAiUsageSummary(session).then((summary) => {
    serviceStatus.ai_usage = { ok: summary.available !== false };
    return summary;
  }).catch((error) => {
    serviceStatus.ai_usage = { ok: false, error: error.message || String(error) };
    return null;
  }) : Promise.resolve(null);
  const communitySummaryPromise = sections.has("community") ? loadCommunityDashboardSummary(session).then((summary) => {
    serviceStatus.community = { ok: true };
    return summary;
  }).catch((error) => {
    serviceStatus.community = { ok: false, error: error.message || String(error) };
    return {
      available: false,
      total: 0,
      public: { open: 0, closed: 0 },
      private: { open: 0, closed: 0 },
      messages: { unread: 0, threads: 0 },
    };
  }) : Promise.resolve(null);
  const knowledgeStatePromise = sections.has("knowledge") ? loadKnowledgeState(session) : Promise.resolve(null);
  const projects = await trackedProjectsPromise;
  const buildsPromise = sections.has("builds") ? loadProjectBuilds(projects, session).then((items) => {
    serviceStatus.builds = { ok: true };
    return items;
  }).catch((error) => {
    serviceStatus.builds = { ok: false, error: error.message || String(error) };
    return [];
  }) : Promise.resolve([]);
  const progressPromise = sections.has("progress") ? listLearningProgress(projectServerUserId(session), projects) : Promise.resolve([]);
  const [devices, builds, aiUsage, communitySummary, knowledgeState, learningProgress] = await Promise.all([
    devicesPromise,
    buildsPromise,
    aiUsagePromise,
    communitySummaryPromise,
    knowledgeStatePromise,
    progressPromise,
  ]);
  const userId = projectServerUserId(session);
  const payload = {
    routes: {
      auth: "/app/auth/",
      dashboard: "/app/dashboard/",
      learn: "/app/learn/",
      ide: "/app/ide/",
      projects: "/app/projects/",
      development_platform: "/app/development-platform/",
      devices: "/app/device-management/inventory/",
      billing: "/app/billing/",
    },
    workspace_state: getWorkspaceState(userId),
    service_status: serviceStatus,
  };
  if (sections.has("development")) {
    payload.development_assistant = developmentAssistant.config();
    payload.development_project_templates = developmentProjectTemplateCatalog().map((template) => ({
      ...template,
      available: hasEntitlements(session, template.required_entitlements),
    }));
    payload.development_project_template_previews = developmentProjectTemplatePreviews();
  }
  if (sections.has("account")) payload.account = await createAccountSummary(session, aiUsage, { includeAiCredits: needsAiUsage });
  if (sections.has("projects")) payload.projects = projects.map(toPlatformProjectSummary);
  if (sections.has("progress")) payload.learning_progress = learningProgress;
  if (sections.has("devices")) payload.devices = devices;
  if (sections.has("builds")) payload.builds = builds;
  if (sections.has("community")) payload.community_summary = communitySummary;
  if (sections.has("knowledge")) {
    payload.knowledge_updates = knowledgeState.updates;
    payload.knowledge_history = knowledgeState.history;
  }
  if (sections.has("billing")) payload.billing = await loadBillingSummary(session, aiUsage);
  else if (sections.has("subscription")) {
    const subscription = accountSubscription(session);
    payload.billing = { plan: subscription.plan, entitlements: subscription.entitlements };
  }
  if (sections.has("ai")) payload.ai_usage = aiUsage;
  sendJson(res, 200, payload);
}

async function handlePlatformBootstrap(res, session, requestedSections = null) {
  const startedAt = Date.now();
  const sections = requestedPlatformBootstrapSections(requestedSections);
  const projects = sections.has("projects") ? await loadUserIdeProjectSummaries(session) : [];
  const userId = projectServerUserId(session);
  const subscription = accountSubscription(session);
  const payload = {
    account: {
      username: session.account.username || "",
      user_id: userId,
      plan: subscription.plan,
      capabilities: ["ide_flash_usb", "ide_flash_ota", "cloud_flash"],
    },
    workspace_state: getWorkspaceState(userId),
    billing: {
      plan: subscription.plan,
      entitlements: subscription.entitlements,
      ai_credits: { monthly_available_credits: 0, purchased_available_credits: 0, consumed_credits: 0 },
      ai_credit_packages: [],
    },
    bootstrap_duration_ms: Date.now() - startedAt,
  };
  if (sections.has("projects")) payload.projects = projects.map(toPlatformProjectSummary);
  if (sections.has("development")) {
    payload.development_assistant = developmentAssistant.config();
    payload.development_project_templates = developmentProjectTemplateCatalog().map((template) => ({
      ...template,
      available: hasEntitlements(session, template.required_entitlements),
    }));
    payload.development_project_template_previews = developmentProjectTemplatePreviews();
  }
  sendJson(res, 200, payload);
}

async function loadKnowledgeState(session) {
  const accountId = projectServerUserId(session);
  const reads = await auth.list_knowledge_chapter_reads(accountId);
  const entitlements = accountSubscription(session).entitlements;
  return {
    updates: unreadKnowledgeChapterReleases(reads, entitlements),
    history: knowledgeChapterHistory(reads, entitlements),
  };
}

async function handleKnowledgeChapterRead(res, session, chapterId) {
  const release = findKnowledgeChapterRelease(chapterId);
  if (!release) {
    sendJson(res, 404, { error: "knowledge_chapter_not_found" });
    return;
  }
  if (!canReadKnowledgeChapter(release, accountSubscription(session).entitlements)) {
    sendJson(res, 403, {
      error: "knowledge_chapter_access_required",
      required_entitlements: release.required_entitlements,
    });
    return;
  }
  const read = await auth.mark_knowledge_chapter_read(
    projectServerUserId(session),
    release.chapter_id,
    release.version,
  );
  sendJson(res, 200, { read });
}

async function loadCommunityDashboardSummary(session) {
  const headers = {
    "X-GerNetiX-Community-Actor": session.account.user_id,
    "X-GerNetiX-Community-Operator": "false",
  };
  return communityJson("/api/community/dashboard-summary", { headers });
}

function externalLoginMessage(error) {
  if (error.code === "email_already_exists_link_required") {
    return "Fuer diese E-Mail existiert bereits ein Konto. Automatisches Verknuepfen ist gesperrt.";
  }
  if (error.message === "provider_required") return "Provider fehlt.";
  if (error.message === "email_required") return "E-Mail fehlt.";
  return "Externe Anmeldung fehlgeschlagen.";
}

function registrationMessage(error) {
  if (error.code === "username_already_exists") return "Dieser Benutzername ist bereits vergeben.";
  if (error.code === "email_already_exists") return "Diese E-Mail wird bereits verwendet.";
  if (error.code === "password_repeat_mismatch") return "Die Passwoerter stimmen nicht ueberein.";
  if (error.code === "terms_not_accepted") return "Bitte akzeptiere die Nutzungsbedingungen.";
  if (error.code === "invalid_username") return "Der Benutzername muss mindestens 3 Zeichen enthalten.";
  if (error.code === "invalid_email") return "Bitte gib eine gueltige E-Mail-Adresse ein.";
  return "Konto konnte nicht erstellt werden.";
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

async function handlePlatformSourceRead(res, session, projectId, sourcePath) {
  const project = await requireSessionProject(session, projectId);
  const source = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/sources/${encodeURIComponent(sourcePath)}`);
  touchWorkspace(session, project.project_server_id, "ide", `/app/ide/?project=${encodeURIComponent(project.project_server_id)}`);
  sendJson(res, 200, source);
}

async function handlePlatformSourceList(res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  const sources = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/sources`);
  touchWorkspace(session, project.project_server_id, "ide", `/app/ide/?project=${encodeURIComponent(project.project_server_id)}`);
  sendJson(res, 200, sources);
}

async function handlePlatformSourceSearch(res, session, projectId, searchParams) {
  const project = await requireSessionProject(session, projectId);
  const query = new URLSearchParams({
    q: String(searchParams.get("q") || "").slice(0, 1000),
    current_path: String(searchParams.get("current_path") || "").slice(0, 300),
    limit: "6",
  });
  const result = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/sources/search?${query}`);
  sendJson(res, 200, result);
}

async function handlePlatformSourceWrite(req, res, session, projectId, sourcePath) {
  const project = await requireSessionProject(session, projectId);
  const body = await readJsonBody(req);
  const actionContext = readUserActionContext(req, "project.build.start");
  const source = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/sources`, {
    method: "PUT",
    ...(actionContext ? { headers: actionContext.headers } : {}),
    body: {
      path: sourcePath,
      content: String(body.content || ""),
      content_type: body.content_type || "text/x-c++src",
      role: body.role || "user_code",
      ...(project.repository_binding?.state === "active" ? {
        expected_head_sha: project.repository_binding.head_sha,
      } : {}),
    },
  });
  touchWorkspace(session, project.project_server_id, "ide", `/app/ide/?project=${encodeURIComponent(project.project_server_id)}`);
  sendJson(res, 200, source);
}

async function persistGeneratedProjectSources(project, sources, message) {
  const binding = project.repository_binding;
  if (binding?.state === "active" && binding.head_sha) {
    const result = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/repository/commits`, {
      method: "POST",
      body: {
        expected_head_sha: binding.head_sha,
        message,
        changes: sources.map((source) => ({
          operation: "upsert",
          path: source.path,
          content: source.content,
          content_type: source.content_type,
          role: source.role,
        })),
      },
    });
    return result.commit?.head_sha || binding.head_sha;
  }
  await Promise.all(sources.map((source) => projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/sources`, {
    method: "PUT",
    body: source,
  })));
  return "";
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

async function handleDevelopmentProjectCreate(req, res, session) {
  const body = await readJsonBody(req);
  const userId = projectServerUserId(session);
  const template = developmentProjectTemplate(body.template_id);
  if (!requireEntitlements(res, session, template.requiredEntitlements || [])) return;
  const title = requiredField(body.title || template.title || "Neues Entwicklungsprojekt", "title").slice(0, 120);
  const description = String(body.description || template.description || "Architektur-Discovery-Projekt").trim().slice(0, 1000);
  let buildConfig = templateBuildConfig(template);
  let hardwareConfiguration = templateHardwareConfiguration(template);
  let softwareUnits = templateSoftwareUnits(template);
  let selectedPlaygroundBoard = null;
  if (template.id === "ai_board_playground") {
    const requestedBoardId = requiredField(body.board_profile_id, "board_profile_id").slice(0, 180);
    const boards = await loadAvailableProcessorBoards(session);
    selectedPlaygroundBoard = boards.find((board) => board.hardware_item_id === requestedBoardId);
    if (!selectedPlaygroundBoard?.platformio_build?.board) {
      sendJson(res, 409, {
        error: "board_playground_board_unavailable",
        message: "Das gewählte Board ist nicht als buildfähiges GerNetiX-Boardprofil verfügbar.",
      });
      return;
    }
    const catalogBuild = selectedPlaygroundBoard.platformio_build;
    buildConfig = {
      ...catalogBuild,
      libraries: Array.isArray(catalogBuild.libraries) ? catalogBuild.libraries : [],
      build_flags: Array.isArray(catalogBuild.build_flags) ? catalogBuild.build_flags : [],
      platformio_options: catalogBuild.platformio_options || {},
      firmware_basis_id: catalogBuild.firmware_basis_id || "gernetix-runtime-basissoftware",
      firmware_basis_version: catalogBuild.firmware_basis_version || "workspace",
      firmware_basis_variant: catalogBuild.firmware_basis_variant || "full",
      partition_profile_id: catalogBuild.partition_profile_id || "full",
      user_source_path: "src/user_main.cpp",
      user_target_path: "src/user/user_app.cpp",
      board_configuration: compilerBoardConfiguration(null, selectedPlaygroundBoard),
    };
    softwareUnits = [{
      software_unit_id: "board_playground",
      title: "Board-Spielprojekt",
      software_kind: "embedded_firmware",
      build_system: "platformio",
      source_root: "Komponenten/IoT-Device 1",
      entrypoint: "src/user_main.cpp",
      device_id: "",
      hardware_profile_id: selectedPlaygroundBoard.hardware_item_id,
      build_config: structuredClone(buildConfig),
    }];
    hardwareConfiguration = {
      schema_version: 6,
      components: [{
        component_id: "device",
        label: selectedPlaygroundBoard.title || "Ausgewähltes Board",
        plantuml_type: "rectangle",
        abstract_type: "iot_device",
        concrete_type: "processor_board",
        board_profile_id: selectedPlaygroundBoard.hardware_item_id,
        board_configuration: compilerBoardConfiguration(null, selectedPlaygroundBoard),
      }],
    };
  }
  if (softwareUnits.length) {
    const boards = await loadAvailableProcessorBoards(session);
    const missingBoard = softwareUnits.find((unit) => !boards.some((board) => board.hardware_item_id === unit.hardware_profile_id));
    if (missingBoard) {
      sendJson(res, 409, {
        error: "project_template_board_missing",
        message: `Das Boardprofil ${missingBoard.hardware_profile_id} fuer ${missingBoard.title} ist nicht verfügbar.`,
      });
      return;
    }
    softwareUnits = softwareUnits.map((unit) => {
      const board = boards.find((item) => item.hardware_item_id === unit.hardware_profile_id);
      const catalogBuild = board.platformio_build || {};
      return {
        ...unit,
        build_config: {
          ...unit.build_config,
          ...catalogBuild,
          board: unit.build_config.board || catalogBuild.board,
          framework: unit.build_config.framework || catalogBuild.framework,
          environment: unit.build_config.environment || catalogBuild.environment,
          libraries: unit.build_config.libraries || [],
          build_flags: unit.build_config.build_flags || [],
          platformio_options: unit.build_config.platformio_options || {},
          firmware_basis_id: unit.build_config.firmware_basis_id || "",
          firmware_basis_version: unit.build_config.firmware_basis_version || "",
          firmware_basis_variant: unit.build_config.firmware_basis_variant || "",
          partition_profile_id: unit.build_config.partition_profile_id || "",
          user_source_path: unit.build_config.user_source_path,
          user_target_path: unit.build_config.user_target_path,
          board_configuration: compilerBoardConfiguration(null, board),
        },
      };
    });
    if (hardwareConfiguration) {
      hardwareConfiguration.components = hardwareConfiguration.components.map((component) => {
        if (component.abstract_type !== "iot_device" || !component.board_profile_id) return component;
        const board = boards.find((item) => item.hardware_item_id === component.board_profile_id);
        return {
          ...component,
          board_configuration: compilerBoardConfiguration(null, board),
        };
      });
    }
    buildConfig = softwareUnits[0].build_config;
  }
  if (template.id === "touchscreen_game_collection") {
    const boards = await loadAvailableProcessorBoards(session);
    const board = boards.find((item) => item.hardware_item_id === "hardware.processor_board.esp32_s3_es3c28p");
    if (!board) {
      sendJson(res, 409, { error: "game_template_board_missing", message: "Das ES3C28P-Boardprofil für die Spielesammlung ist nicht verfügbar." });
      return;
    }
    buildConfig = { ...buildConfig, flash_size_mb: 16, board_configuration: compilerBoardConfiguration(null, board) };
  }
  if (hardwareConfiguration) {
    hardwareConfiguration = normalizeHardwareConfiguration(hardwareConfiguration, {
      software_units: softwareUnits,
      build_config: buildConfig,
    });
  }
  let communicationSetup = null;
  if (template.id === "esp32_camera_to_touch_display") {
    const defaultCommunication = defaultProjectCommunicationSetup(softwareUnits);
    const derivedCommunication = applyProjectCommunicationSetup(softwareUnits, {
      ...defaultCommunication,
      mode: "device_access_point",
    });
    communicationSetup = derivedCommunication.setup;
    softwareUnits = derivedCommunication.software_units;
    buildConfig = softwareUnits[0]?.build_config || buildConfig;
  }
  const projectId = `dev_project_${slugifyProjectId(title)}_${Date.now().toString(36)}`;
  const initialSource = template.id === "empty" ? "" : templateArchitecturePlantUml(template, title);
  const sources = developmentProjectSources({ title, description, architectureSource: initialSource })
    .concat(templateFirmwareSources(template, title));
  const templateVariant = selectedPlaygroundBoard
    ? `_${slugifyProjectId(selectedPlaygroundBoard.hardware_item_id)}`
    : "";
  const templateProjectId = `system_template_${template.id}${templateVariant}_v${template.schemaVersion}`;
  if (template.id !== "empty") {
    const existingTemplate = await projectServerJson(`/api/projects/${encodeURIComponent(templateProjectId)}`).catch((error) => error.status === 404 ? null : Promise.reject(error));
    if (!existingTemplate) await projectServerJson("/api/projects", {
      method: "POST",
      body: {
        project_id: templateProjectId, user_id: "system", title: template.title, description: template.description,
        learning_project_id: "system_template", hardware_profile_id: templateHardwareProfileId(template), build_config: buildConfig,
        ...(softwareUnits.length ? { software_units: softwareUnits, active_software_unit_id: softwareUnits[0].software_unit_id } : {}),
        status: "template", view_manifest: { template_id: template.id, template_ref: { version: template.schemaVersion } }, sources,
      },
    });
  }
  const project = await projectServerJson("/api/projects", {
    method: "POST",
    body: {
      project_id: projectId,
      ...(template.id !== "empty" ? { template_project_id: templateProjectId } : {}),
      user_id: userId,
      plan_id: accountSubscription(session).plan_id,
      title,
      description,
      learning_project_id: "development_project",
      hardware_profile_id: templateHardwareProfileId(template),
      device_id: null,
      build_config: buildConfig,
      ...(softwareUnits.length ? { software_units: softwareUnits, active_software_unit_id: softwareUnits[0].software_unit_id } : {}),
      view_manifest: developmentProjectViewManifest({
        title,
        description,
        source: initialSource,
        buildConfig,
        templateId: template.id,
        templateModelVersion: template.schemaVersion,
        hardwareConfiguration,
        communicationSetup,
        homeAutomationConfiguration: template.id === "distributed_home_automation"
          ? defaultHomeAutomationConfiguration()
          : null,
        gameConfiguration: template.id === "touchscreen_game_collection"
          ? defaultTouchscreenGameConfiguration()
          : null,
        dataLoggerConfiguration: template.dataLogger,
      }),
      ...(template.id === "empty" ? { sources } : {}),
    },
  });
  touchWorkspace(session, project.project_id, "development-platform", "/app/development-platform/");
  sendJson(res, 201, { project: toPlatformProject(mapProjectServerProject(session, project)) });
}

async function handleDevelopmentProjectArchitectureSave(req, res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  if (!["development_project", "custom_project"].includes(project.area)) {
    sendJson(res, 400, { error: "not_development_project", message: "Architektur-Discovery kann nur in eigenen Entwicklungsprojekten gespeichert werden." });
    return;
  }
  const body = await readJsonBody(req);
  const diagram = normalizeArchitectureDiagram(body.architectureDiagram || body.architecture_diagram || body.diagram);
  if (!diagram.source) {
    sendJson(res, 400, { error: "missing_diagram", message: "Keine PlantUML-Quelle zum Speichern vorhanden." });
    return;
  }
  const title = String(body.title || project.title || diagram.title || "Architektur").trim().slice(0, 120);
  const description = String(body.description || project.summary || diagram.summary || "").trim().slice(0, 1000);
  const sources = developmentProjectSources({ title, description, diagram, architectureSource: diagram.source });
  const expectedHeadSha = await persistGeneratedProjectSources(project, sources, "Architekturansichten aktualisiert");
  const persistedProject = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, {
    method: "PATCH",
    body: {
      ...(expectedHeadSha ? { expected_head_sha: expectedHeadSha } : {}),
      title,
      description,
      view_manifest: developmentProjectViewManifest({
        title,
        description,
        source: diagram.source,
        diagram,
        buildConfig: project.build_config,
        architectureDialog: project.view_manifest?.architecture_dialog,
        templateId: project.view_manifest?.template_id,
        templateModelVersion: project.view_manifest?.template_ref?.model_schema_version,
        hardwareConfiguration: hardwareConfigurationFromManifest(project.view_manifest),
        homeAutomationConfiguration: project.view_manifest?.home_automation_configuration,
        gameConfiguration: project.view_manifest?.game_configuration,
        pwaDashboardConfiguration: project.view_manifest?.pwa_dashboard,
        dataLoggerConfiguration: project.view_manifest?.data_logger,
        eventConfiguration: project.view_manifest?.event_configuration,
        communicationSetup: project.view_manifest?.communication_setup,
      }),
      build_config: project.build_config || null,
    },
  });
  touchWorkspace(session, project.project_server_id, "development-platform", "/app/development-platform/");
  const projects = await loadUserIdeProjects(session);
  const updated = projects.find((item) => item.project_server_id === project.project_server_id);
  sendJson(res, 200, { project: toPlatformProject(updated), saved_at: new Date().toISOString(), configuration_projection: persistedProject.configuration_projection || null });
}

async function handleLearningProjectStart(res, session, catalogProjectId) {
  const definition = userIdeState.projectDefinitions
    .find((item) => item.project_server_id === catalogProjectId || catalogProjectIdForDefinition(item) === catalogProjectId);
  if (!definition) {
    sendJson(res, 404, { error: "learning_project_not_found", message: "Dieses Lernprojekt ist im Katalog nicht vorhanden." });
    return;
  }

  const userId = projectServerUserId(session);
  const existing = await projectServerJson(`/api/projects?user_id=${encodeURIComponent(userId)}&profile=summary`);
  const existingSummary = existing.items.find((item) => item.learning_project_id === definition.learning_project_id
    && item.project_id !== definition.project_server_id
    && item.entry_mode !== "standalone_lesson");
  const alreadyStarted = existingSummary
    ? await projectServerJson(`/api/projects/${encodeURIComponent(existingSummary.project_id)}`)
    : null;
  const projectId = `learning_${definition.slug}_${crypto.randomUUID().slice(0, 8)}`;
  const project = alreadyStarted
    ? await synchronizeLearningProjectOnStart(alreadyStarted, definition)
    : await projectServerJson("/api/projects", {
    method: "POST",
    body: {
      project_id: projectId,
      user_id: userId,
      plan_id: accountSubscription(session).plan_id,
      title: definition.title,
      description: definition.summary,
      learning_project_id: definition.learning_project_id,
      hardware_profile_id: definition.hardware_profile_id,
      device_id: null,
      build_config: definition.build_config,
      view_manifest: projectViewManifest(definition),
      sources: demoProjectSources(definition, { projectId }),
    },
    });
  const mapped = mapProjectServerProject(session, project);
  invalidateUserIdeProjectCaches(userId);
  touchWorkspace(session, project.project_id, "learn", `/app/learning-project/?project=${encodeURIComponent(project.project_id)}`);
  const learningProgress = alreadyStarted
    ? (await listLearningProgress(userId, [mapped]))[0]
    : emptyPlatformLearningProgress(userId, mapped);
  const learningFeedbackSubmitted = learningProgress.status === "completed"
    ? await hasSubmittedLearningFeedback(userId, mapped.project_server_id)
    : false;
  sendJson(res, alreadyStarted ? 200 : 201, {
    project: toPlatformProject(mapped),
    learning_progress: learningProgress,
    learning_feedback_submitted: learningFeedbackSubmitted,
    created: !alreadyStarted,
  });
}

async function synchronizeLearningProjectOnStart(project, definition) {
  const canonicalManifest = learningProjectManifestForPersistedProject(project, definition);
  const needsManifestSync = Number(canonicalManifest?.schema_version || 0)
    > Number(project.view_manifest?.schema_version || 0);
  const existingPaths = new Set((project.source_files || []).map((source) => source.path));
  const needsSourceSync = demoProjectSources(definition, { projectId: project.project_id })
    .some((source) => !existingPaths.has(source.path));
  const needsLegacyNexiCheck = definition.slug === nexiCourseModel.slug;
  if (!needsManifestSync && !needsSourceSync && !needsLegacyNexiCheck) return project;
  return synchronizeLearningProjectStructure(project, definition);
}

async function handlePlatformProjectRead(res, session, projectId) {
  const definition = userIdeState.projectDefinitions
    .find((item) => item.project_server_id === projectId || catalogProjectIdForDefinition(item) === projectId);
  if (definition) {
    const catalogProject = mapUserIdeProjects(session, new Map())
      .find((item) => item.project_server_id === catalogProjectIdForDefinition(definition));
    sendJson(res, 200, { project: toPlatformProject(catalogProject) });
    return;
  }
  try {
    const project = await requireSessionProject(session, projectId);
    const isLearningProject = project.project_origin === "account_project"
      && project.learning_project_id?.startsWith("learning_project.");
    const userId = projectServerUserId(session);
    const [learningProgress] = isLearningProject
      ? await listLearningProgress(userId, [project])
      : [null];
    const learningFeedbackSubmitted = learningProgress?.status === "completed"
      ? await hasSubmittedLearningFeedback(userId, project.project_server_id)
      : false;
    sendJson(res, 200, {
      project: toPlatformProject(project),
      ...(learningProgress ? { learning_progress: learningProgress } : {}),
      ...(isLearningProject ? { learning_feedback_submitted: learningFeedbackSubmitted } : {}),
    });
  } catch (error) {
    sendJson(res, error.status || 500, {
      error: error.status === 404 ? "project_not_found" : "project_load_failed",
      message: error.message || "Das Projekt konnte nicht geladen werden.",
    });
  }
}

async function handleDevelopmentLessonStart(res, session, catalogProjectId, lessonId) {
  const definition = userIdeState.projectDefinitions
    .find((item) => item.project_server_id === catalogProjectId || catalogProjectIdForDefinition(item) === catalogProjectId);
  const lesson = definition?.development_lessons?.find((item) => item.id === lessonId);
  if (!definition || !lesson) {
    sendJson(res, 404, {
      error: "development_lesson_not_found",
      message: "Diese Entwicklungslesson ist im gewählten Entwicklungsprojekt nicht vorhanden.",
    });
    return;
  }

  const userId = projectServerUserId(session);
  const projectId = `lesson_${lesson.id.replace(/[^a-zA-Z0-9]+/g, "_")}_${crypto.randomUUID().slice(0, 8)}`;
  const project = await projectServerJson("/api/projects", {
    method: "POST",
    body: {
      project_id: projectId,
      user_id: userId,
      plan_id: accountSubscription(session).plan_id,
      title: `${lesson.title} – Einzelübung`,
      description: lesson.summary,
      learning_project_id: definition.learning_project_id,
      hardware_profile_id: lesson.standalone_start.runtime,
      device_id: null,
      build_config: null,
      view_manifest: projectViewManifest(definition, { lessonId: lesson.id }),
      sources: demoProjectSources(definition, { lessonId: lesson.id, projectId }),
    },
  });
  const mapped = mapProjectServerProject(session, project);
  touchWorkspace(session, project.project_id, "learn", `/app/learning-project/?project=${encodeURIComponent(project.project_id)}`);
  sendJson(res, 201, {
    project: toPlatformProject(mapped),
    created: true,
    entryMode: "standalone_lesson",
    lessonId: lesson.id,
  });
}

async function synchronizeLearningProjectStructure(project, definition) {
  const projectId = project.project_id;
  const isLegacyNexiBuild = definition.slug === nexiCourseModel.slug
    && project.build_config?.environment !== definition.build_config?.environment;
  const needsBuildConfig = !project.build_config?.user_source_path || isLegacyNexiBuild;
  const canonicalManifest = learningProjectManifestForPersistedProject(project, definition);
  const updated = await projectServerJson(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: "PATCH",
    body: {
      view_manifest: canonicalManifest,
      ...(needsBuildConfig ? { build_config: definition.build_config } : {}),
    },
  });
  const lessonId = canonicalManifest.entry_mode === "standalone_lesson"
    ? canonicalManifest.lesson_focus_id
    : "";
  for (const source of demoProjectSources(definition, { lessonId, projectId })) {
    const persistedSource = await projectServerJson(`/api/projects/${encodeURIComponent(projectId)}/sources/${encodeURIComponent(source.path)}`)
      .catch((error) => {
        if (error.status === 404) return null;
        throw error;
      });
    const isLegacyNexiManifest = definition.slug === nexiCourseModel.slug
      && source.path === "project-app/manifest.json"
      && persistedSource?.content?.includes('"app_id": "nexi"')
      && projectAppManifestVersion(persistedSource.content) < 3;
    if (!persistedSource || isLegacyNexiManifest) {
      await projectServerJson(`/api/projects/${encodeURIComponent(projectId)}/sources`, { method: "PUT", body: source });
    }
  }
  return updated;
}

function projectAppManifestVersion(content) {
  try {
    return Number(JSON.parse(content || "{}").manifest_version) || 0;
  } catch {
    return 0;
  }
}

function learningProjectManifestForPersistedProject(project, definition) {
  const lessonId = project.view_manifest?.entry_mode === "standalone_lesson"
    ? project.view_manifest.lesson_focus_id || ""
    : "";
  return projectViewManifest(definition, { lessonId });
}

async function handleLearningProjectDeviceAssign(req, res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  if (!project.learning_project_id || project.project_origin !== "account_project") {
    sendJson(res, 409, { error: "learning_project_required", message: "Ein Board kann hier nur einem eigenen Lernprojekt zugeordnet werden." });
    return;
  }
  const body = await readJsonBody(req);
  const deviceId = String(body.device_id || "").trim();
  const boardProfileId = String(body.board_profile_id || "").trim();
  const device = deviceId ? (await loadUserIdeDevices(session)).find((item) => item.device_id === deviceId) : null;
  if (deviceId && !device) { sendJson(res, 404, { error: "inventory_device_not_found", message: "Das gewaehlte Board ist nicht in deinem Inventar." }); return; }
  const availableBoards = await loadAvailableProcessorBoards(session);
  let selectedBoard = boardProfileId
    ? availableBoards.find((board) => [board.hardware_item_id, board.hardware_profile_id, board.id].filter(Boolean).includes(boardProfileId))
    : null;
  if (boardProfileId && !selectedBoard) { sendJson(res, 404, { error: "board_configuration_not_found", message: "Die gewaehlte GerNetiX- oder Account-Boardkonfiguration wurde nicht gefunden." }); return; }
  if (!selectedBoard && device) {
    selectedBoard = availableBoards.find((board) => String(board.base_board_profile_id || board.hardware_item_id) === String(device.hardware_profile_id)) || null;
  }
  if (selectedBoard && device && String(selectedBoard.base_board_profile_id || selectedBoard.hardware_item_id) !== String(device.hardware_profile_id)) {
    sendJson(res, 409, { error: "inventory_board_target_mismatch", message: "Inventar-Device und gewähltes Compiler-Board verwenden nicht dasselbe physische Boardprofil." });
    return;
  }
  const softwareUnits = platformSoftwareUnits(project);
  const softwareUnitId = String(body.software_unit_id || project.active_software_unit_id || softwareUnits[0]?.software_unit_id || "").trim();
  const softwareUnit = softwareUnits.find((unit) => unit.software_unit_id === softwareUnitId) || null;
  if (!softwareUnit) { sendJson(res, 404, { error: "software_unit_not_found", message: "Die gewählte Softwareeinheit gehört nicht zu diesem Lernprojekt." }); return; }
  if (softwareUnit.build_system !== "platformio") { sendJson(res, 409, { error: "software_unit_target_not_board", message: "Diese Softwareeinheit besitzt kein PlatformIO-Boardziel." }); return; }
  const baseBoardId = selectedBoard?.base_board_profile_id || device?.hardware_profile_id || softwareUnit.build_config?.board_configuration?.base_board_profile_id || project.hardware_profile_id;
  let buildConfig = buildConfigForBoard(selectedBoard || baseBoardId, softwareUnit.build_config || project.build_config);
  if (buildConfig && selectedBoard) buildConfig = {
    ...buildConfig,
    board_configuration: compilerBoardConfiguration(null, selectedBoard),
  };
  const nextSoftwareUnits = softwareUnits.map((unit) => unit.software_unit_id === softwareUnitId ? {
    ...unit,
    device_id: deviceId || unit.device_id || "",
    build_config: buildConfig,
  } : unit);
  const updated = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, {
    method: "PATCH",
    body: {
      device_id: device?.device_id || project.device_id || "",
      hardware_profile_id: baseBoardId,
      build_config: buildConfig,
      software_units: nextSoftwareUnits,
      active_software_unit_id: softwareUnitId,
    },
  });
  sendJson(res, 200, { project: toPlatformProject(mapProjectServerProject(session, updated)), device, board: selectedBoard, software_unit_id: softwareUnitId });
}

async function handlePlatformProjectDelete(res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  if (!['development_project', 'custom_project'].includes(project.area)) {
    sendJson(res, 400, { error: 'not_development_project', message: 'Nur eigene Entwicklungsprojekte koennen geloescht werden.' });
    return;
  }
  const accountId = projectServerUserId(session);
  const telemetryPath = `/api/telemetry/internal/accounts/${encodeURIComponent(accountId)}/projects/${encodeURIComponent(project.project_server_id)}/data`;
  const telemetry = await telemetryJson(telemetryPath, { method: 'DELETE' });
  const push = await webPushService.unsubscribeProject(accountId, project.project_server_id);
  const deletion = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, { method: 'DELETE' });
  sendJson(res, 200, { deleted: true, project_id: project.project_server_id, project: deletion, telemetry, push });
}

async function handleDevelopmentProjectDialogSave(req, res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  if (!["development_project", "custom_project"].includes(project.area)) {
    sendJson(res, 400, { error: "not_development_project", message: "Architektur-Dialog kann nur in eigenen Entwicklungsprojekten gespeichert werden." });
    return;
  }

  const body = await readJsonBody(req);
  const existingManifest = project.view_manifest || developmentProjectViewManifest({
    title: project.title,
    description: project.summary,
    source: initialArchitecturePlantUml(project.title),
    buildConfig: project.build_config,
  });
  const diagram = normalizeArchitectureDiagram(body.architectureDiagram || existingManifest.architecture_dialog?.architectureDiagram || architectureDiagramFromManifest(existingManifest));
  const architectureDialog = normalizeArchitectureDialog(body, diagram);
  const homeAutomationConfiguration = normalizeHomeAutomationConfiguration(
    body.homeAutomationConfiguration || body.home_automation_configuration || existingManifest.home_automation_configuration,
  );
  const gameConfiguration = normalizeTouchscreenGameConfiguration(
    body.gameConfiguration || body.game_configuration || existingManifest.game_configuration,
  );
  if (gameConfiguration?.board_configuration?.source === "custom_draft") {
    sendJson(res, 409, { error: "custom_board_not_saved", message: "Die geänderte Touch-Display-Boardkonfiguration muss zuerst als eigenes Board gespeichert werden." });
    return;
  }
  let buildConfig = project.build_config || null;
  let selectedBoard = null;
  let selectedInventoryDevice = null;
  if (existingManifest.template_id === "touchscreen_game_collection" && gameConfiguration) {
    const boards = await loadAvailableProcessorBoards(session);
    selectedBoard = boards.find((board) => board.hardware_item_id === gameConfiguration.board_profile_id) || null;
    if (gameConfiguration.board_profile_id && !selectedBoard) {
      sendJson(res, 409, { error: "game_board_not_found", message: "Das gewaehlte Touch-Display-Board ist nicht mehr im Hardware-Katalog vorhanden." });
      return;
    }
    if (selectedBoard && !isTouchscreenGameBoard(selectedBoard)) {
      sendJson(res, 409, { error: "game_board_not_touchscreen", message: "Das gewaehlte Board besitzt laut Hardware-Katalog keinen integrierten Touchscreen." });
      return;
    }
    if (selectedBoard) {
      buildConfig = buildConfigForBoard(selectedBoard, buildConfig);
      const configuredFlashValue = gameConfiguration.board_configuration?.board_features?.flash?.value || "";
      const configuredFlashSizeMb = Number(String(configuredFlashValue).match(/^(\d+)_mb$/)?.[1] || 0);
      if (buildConfig) {
        buildConfig.board_configuration = compilerBoardConfiguration(gameConfiguration.board_configuration, selectedBoard);
        if ([4, 8, 16].includes(configuredFlashSizeMb)) buildConfig.flash_size_mb = configuredFlashSizeMb;
      }
    }
    if (gameConfiguration.inventory_device_id) {
      const inventoryDevices = await loadUserIdeDevices(session);
      selectedInventoryDevice = inventoryDevices.find((device) => device.device_id === gameConfiguration.inventory_device_id) || null;
      if (!selectedInventoryDevice) {
        sendJson(res, 404, { error: "game_inventory_device_not_found", message: "Das gewaehlte Inventar-Board wurde nicht gefunden." });
        return;
      }
      const physicalBoardProfileId = selectedBoard?.base_board_profile_id || gameConfiguration.board_profile_id;
      if (physicalBoardProfileId && !touchscreenGameInventoryMatches(physicalBoardProfileId, selectedInventoryDevice)) {
        sendJson(res, 409, { error: "game_inventory_device_not_compatible", message: "Das Inventar-Board entspricht nicht dem gewaehlten Touch-Display-Board." });
        return;
      }
    }
    if (buildConfig) {
      buildConfig = {
        ...buildConfig,
        component_device_allocations: selectedInventoryDevice ? [{
          component_path: "Komponenten/IoT-Device 1",
          device_id: selectedInventoryDevice.device_id,
          allocated_at: new Date().toISOString(),
        }] : [],
      };
    }
    const selectedGamesPath = "Komponenten/IoT-Device 1/include/config/selected_games.h";
    const existingSelectedGames = await projectServerJson(
      `/api/projects/${encodeURIComponent(project.project_server_id)}/sources/${encodeURIComponent(selectedGamesPath)}`,
    ).catch(() => null);
    await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/sources`, {
      method: "PUT",
      body: {
        path: selectedGamesPath,
        role: "user_code",
        content_type: "text/x-c++hdr",
        content: mergeSelectedGamesHeader(gameConfiguration.selected_game_ids, existingSelectedGames?.content),
      },
    });
  }
  let softwareUnits = developmentSoftwareUnits(project, diagram, hardwareConfigurationFromManifest(existingManifest), {
    primaryBuildConfig: buildConfig,
  });
  if (existingManifest.communication_setup) {
    softwareUnits = applyProjectCommunicationSetup(softwareUnits, existingManifest.communication_setup).software_units;
  }
  const activeSoftwareUnitId = softwareUnits.some((unit) => unit.software_unit_id === project.active_software_unit_id)
    ? project.active_software_unit_id
    : softwareUnits[0]?.software_unit_id || "";
  const persistedProject = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, {
    method: "PATCH",
    body: {
      ...(selectedBoard ? { hardware_profile_id: selectedBoard.base_board_profile_id || selectedBoard.hardware_item_id } : {}),
      device_id: selectedInventoryDevice?.device_id || project.device_id || "",
      view_manifest: {
        ...existingManifest,
        architecture_dialog: architectureDialog,
        ...(homeAutomationConfiguration ? { home_automation_configuration: homeAutomationConfiguration } : {}),
        ...(gameConfiguration ? { game_configuration: gameConfiguration } : {}),
      },
      build_config: buildConfig,
      software_units: softwareUnits,
      active_software_unit_id: activeSoftwareUnitId,
    },
  });
  touchWorkspace(session, project.project_server_id, "development-platform", "/app/development-platform/");
  const projects = await loadUserIdeProjects(session);
  const updated = projects.find((item) => item.project_server_id === project.project_server_id);
  sendJson(res, 200, { project: toPlatformProject(updated), saved_at: new Date().toISOString(), configuration_projection: persistedProject.configuration_projection || null });
}

async function handleDevelopmentProjectHardwareSave(req, res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  if (!["development_project", "custom_project"].includes(project.area)) {
    sendJson(res, 400, { error: "not_development_project", message: "Hardware kann nur in eigenen Entwicklungsprojekten konfiguriert werden." });
    return;
  }
  const body = await readJsonBody(req);
  const existingManifest = project.view_manifest || developmentProjectViewManifest({
    title: project.title,
    description: project.summary,
    source: initialArchitecturePlantUml(project.title),
    buildConfig: project.build_config,
  });
  const diagram = architectureDiagramFromManifest(existingManifest);
  const hardwareConfiguration = normalizeHardwareConfiguration(body.hardware_configuration || body.hardwareConfiguration, project);
  const unsavedBoard = hardwareConfiguration.components.find((component) => component.abstract_type === "iot_device" && component.board_configuration?.source === "custom_draft");
  if (unsavedBoard) {
    sendJson(res, 409, { error: "custom_board_not_saved", message: `Die geänderte Boardkonfiguration für ${unsavedBoard.label} muss zuerst als eigenes Board gespeichert werden.` });
    return;
  }
  const boardComponent = hardwareConfiguration.components.find((component) => component.abstract_type === "iot_device" && component.board_profile_id);
  const availableBoards = boardComponent ? await loadAvailableProcessorBoards(session) : [];
  const selectedBoard = boardComponent
    ? availableBoards.find((board) => [board.hardware_item_id, board.hardware_profile_id, board.id]
      .filter(Boolean).some((id) => String(id) === String(boardComponent.board_profile_id))) || null
    : null;
  if (boardComponent && !selectedBoard) {
    sendJson(res, 409, { error: "project_board_not_found", message: "Das gewaehlte Board ist nicht mehr im Hardware-Katalog oder in deinen Account-Boards vorhanden." });
    return;
  }
  if (existingManifest.template_id === "touchscreen_game_collection" && selectedBoard && !isTouchscreenGameBoard(selectedBoard)) {
    sendJson(res, 409, { error: "game_board_not_touchscreen", message: "Die Spielesammlung benoetigt ein Board mit integriertem Touchscreen." });
    return;
  }
  const selectedBoardConfiguration = boardComponent
    ? compilerBoardConfiguration(boardComponent.board_configuration, selectedBoard)
    : null;
  const selectedBaseBoardId = selectedBoardConfiguration?.base_board_profile_id
    || selectedBoard?.base_board_profile_id
    || boardComponent?.board_profile_id
    || "";
  const baseBuildConfig = boardComponent
    ? buildConfigForBoard(selectedBoard || selectedBaseBoardId, project.build_config)
    : project.build_config;
  const inventoryDevices = await loadUserIdeDevices(session);
  const allocations = [];
  let primaryInventoryDevice = null;
  for (const component of hardwareConfiguration.components.filter((item) => item.abstract_type === "iot_device")) {
    component.inventory_device_label = "";
  }
  for (const component of hardwareConfiguration.components.filter((item) => item.abstract_type === "iot_device" && item.inventory_device_id)) {
    const inventoryDevice = inventoryDevices.find((device) => device.device_id === component.inventory_device_id);
    if (!inventoryDevice) {
      sendJson(res, 404, { error: "device_not_found", message: `Das Inventar-Device fuer ${component.label} wurde nicht gefunden.` });
      return;
    }
    const physicalBoardProfileId = component.board_configuration?.base_board_profile_id || component.board_profile_id;
    if (physicalBoardProfileId && inventoryDevice.hardware_profile_id !== physicalBoardProfileId) {
      sendJson(res, 409, { error: "device_not_compatible", message: `Das Inventar-Device fuer ${component.label} entspricht nicht dem gewaehlten Board.` });
      return;
    }
    component.inventory_device_label = String(inventoryDevice.display_name || inventoryDevice.device_id).slice(0, 180);
    primaryInventoryDevice ||= inventoryDevice;
    allocations.push({
      component_path: component.component_path,
      device_id: inventoryDevice.device_id,
      allocated_at: new Date().toISOString(),
    });
  }
  const allocatedBasissoftwareProfile = primaryInventoryDevice?.instance_configuration?.basissoftware_profile || null;
  const allocatedFlashValue = primaryInventoryDevice?.instance_configuration?.board_features?.flash?.value || "";
  const allocatedFlashSizeMb = Number(String(allocatedFlashValue).match(/^(\d+)_mb$/)?.[1] || 0);
  const configuredFlashValue = selectedBoardConfiguration?.board_features?.flash?.value || "";
  const configuredFlashSizeMb = Number(String(configuredFlashValue).match(/^(\d+)_mb$/)?.[1] || 0);
  const buildConfig = baseBuildConfig ? {
    ...baseBuildConfig,
    board_configuration: selectedBoardConfiguration,
    component_device_allocations: allocations,
    ...(allocatedBasissoftwareProfile ? {
      firmware_basis_variant: allocatedBasissoftwareProfile.class,
      partition_profile_id: allocatedBasissoftwareProfile.partition_profile_id,
      flash_size_mb: allocatedFlashSizeMb || undefined,
    } : {}),
    ...(!allocatedBasissoftwareProfile && [4, 8, 16].includes(configuredFlashSizeMb) ? { flash_size_mb: configuredFlashSizeMb } : {}),
  } : null;
  let softwareUnits = developmentSoftwareUnits(project, diagram, hardwareConfiguration, {
    primaryBuildConfig: buildConfig,
    boards: availableBoards,
  });
  if (existingManifest.communication_setup) {
    softwareUnits = applyProjectCommunicationSetup(softwareUnits, existingManifest.communication_setup).software_units;
  }
  const activeSoftwareUnitId = softwareUnits.some((unit) => unit.software_unit_id === project.active_software_unit_id)
    ? project.active_software_unit_id
    : softwareUnits[0]?.software_unit_id || "";
  const gameConfiguration = existingManifest.template_id === "touchscreen_game_collection"
    ? normalizeTouchscreenGameConfiguration({
        ...(existingManifest.game_configuration || defaultTouchscreenGameConfiguration()),
        board_profile_id: selectedBoard?.hardware_item_id || boardComponent?.board_profile_id || "",
        board_configuration: selectedBoardConfiguration,
        inventory_device_id: primaryInventoryDevice?.device_id || "",
      })
    : existingManifest.game_configuration;
  const sources = hardwareConfigurationSources(hardwareConfiguration, project.title);
  const expectedHeadSha = await persistGeneratedProjectSources(project, sources, "Hardwareansichten aktualisiert");
  const persistedProject = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, {
    method: "PATCH",
    body: {
      ...(expectedHeadSha ? { expected_head_sha: expectedHeadSha } : {}),
      hardware_profile_id: selectedBaseBoardId || project.hardware_profile_id,
      device_id: primaryInventoryDevice?.device_id || "",
      build_config: buildConfig || null,
      software_units: softwareUnits,
      active_software_unit_id: activeSoftwareUnitId,
      view_manifest: developmentProjectViewManifest({
        title: project.title,
        description: project.summary,
        source: diagram.source,
        diagram,
        buildConfig,
        architectureDialog: existingManifest.architecture_dialog,
        templateId: existingManifest.template_id,
        templateModelVersion: existingManifest.template_ref?.model_schema_version,
        hardwareConfiguration,
        communicationSetup: existingManifest.communication_setup,
        homeAutomationConfiguration: existingManifest.home_automation_configuration,
        gameConfiguration,
        pwaDashboardConfiguration: existingManifest.pwa_dashboard,
        dataLoggerConfiguration: existingManifest.data_logger,
        eventConfiguration: existingManifest.event_configuration,
      }),
    },
  });
  touchWorkspace(session, project.project_server_id, "development-hardware", `/app/development-platform/hardware/?project=${encodeURIComponent(project.project_server_id)}`);
  const projects = await loadUserIdeProjects(session);
  const updated = projects.find((item) => item.project_server_id === project.project_server_id);
  sendJson(res, 200, {
    project: toPlatformProject(updated),
    configuration_projection: persistedProject.configuration_projection || null,
    hardware_configuration: hardwareConfiguration,
    hardware_architecture: {
      source: hardwareWiringPlantUml(hardwareConfiguration, project.title),
      title: "Hardware-Architektur",
      summary: "Vollstaendige Hardware-Realisierung des Projekts.",
    },
    saved_at: new Date().toISOString(),
  });
}

async function handleProjectComponentFeatures(req, res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  if (!project.build_config) {
    sendJson(res, 409, { error: "missing_build_config", message: "Das Projekt besitzt keine konfigurierbare Firmware-Komponente." });
    return;
  }
  const body = await readJsonBody(req);
  const allowed = new Set(["wifi", "mqtt", "ota", "http", "webserver", "measurement_chart"]);
  const enabled = Array.isArray(body.enabled) ? body.enabled.map(String).filter((item) => allowed.has(item)) : [];
  const current = project.build_config.component_features || {};
  const webserver = body.webserver && typeof body.webserver === "object" ? body.webserver : {};
  const persistedProject = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, {
    method: "PATCH",
    body: {
      build_config: {
        ...project.build_config,
        component_features: {
          ...current,
          enabled,
          webserver: {
            ...(current.webserver || {}),
            title: String(webserver.title || "GerNetiX Device").trim().slice(0, 80),
            measurement_chart: Boolean(webserver.measurement_chart),
            measurement_label: String(webserver.measurement_label || "Messwert").trim().slice(0, 60),
            measurement_unit: String(webserver.measurement_unit || "").trim().slice(0, 16),
          },
        },
      },
    },
  });
  const projects = await loadUserIdeProjects(session);
  const updated = projects.find((item) => item.project_server_id === project.project_server_id);
  touchWorkspace(session, project.project_server_id, "ide", `/app/ide/?project=${encodeURIComponent(project.project_server_id)}`);
  sendJson(res, 200, { project: toPlatformProject(updated), configuration_projection: persistedProject.configuration_projection || null });
}

async function handleProjectBasissoftwareConfiguration(req, res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  const body = await readJsonBody(req);
  const softwareUnitId = String(body.software_unit_id || "").trim();
  const softwareUnits = Array.isArray(project.software_units) ? project.software_units : [];
  const softwareUnit = softwareUnits.find((unit) => unit.software_unit_id === softwareUnitId);
  if (!softwareUnit?.build_config?.firmware_basis_id) {
    sendJson(res, 409, { error: "basissoftware_unit_not_found", message: "Die gewählte Software-Einheit besitzt keine konfigurierbare GerNetiX-Basissoftware." });
    return;
  }
  const basissoftwareConfiguration = normalizeBasissoftwareConfiguration(body.configuration);
  let updatedUnits = softwareUnits.map((unit) => unit.software_unit_id === softwareUnitId
    ? { ...unit, build_config: { ...unit.build_config, basissoftware_configuration: basissoftwareConfiguration } }
    : unit);
  if (project.view_manifest?.communication_setup) {
    updatedUnits = applyProjectCommunicationSetup(updatedUnits, project.view_manifest.communication_setup).software_units;
  }
  const persistedProject = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, {
    method: "PATCH",
    body: { software_units: updatedUnits, active_software_unit_id: softwareUnitId },
  });
  const projects = await loadUserIdeProjects(session);
  const updated = projects.find((item) => item.project_server_id === project.project_server_id);
  touchWorkspace(session, project.project_server_id, "ide", `/app/ide/?project=${encodeURIComponent(project.project_server_id)}`);
  sendJson(res, 200, { project: toPlatformProject(updated), software_unit_id: softwareUnitId, configuration: basissoftwareConfiguration, configuration_projection: persistedProject.configuration_projection || null });
}

async function handleProjectCommunicationSetup(req, res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  const softwareUnits = platformSoftwareUnits(project);
  const embeddedUnits = softwareUnits.filter((unit) => unit.build_system === "platformio" || unit.software_kind === "embedded_firmware");
  if (embeddedUnits.length < 2) {
    sendJson(res, 409, { error: "communication_setup_requires_multiple_devices", message: "Ein geräteübergreifendes Kommunikationssetup benötigt mindestens zwei IoT-Firmware-Ziele." });
    return;
  }
  const setup = normalizeProjectCommunicationSetup(await readJsonBody(req), softwareUnits);
  const derived = applyProjectCommunicationSetup(softwareUnits, setup);
  const persistedProject = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, {
    method: "PATCH",
    body: {
      view_manifest: { ...project.view_manifest, communication_setup: derived.setup },
      software_units: derived.software_units,
      active_software_unit_id: project.active_software_unit_id || derived.software_units[0]?.software_unit_id || "",
    },
  });
  const projects = await loadUserIdeProjects(session);
  const updated = projects.find((item) => item.project_server_id === project.project_server_id);
  touchWorkspace(session, project.project_server_id, "ide", `/app/ide/?project=${encodeURIComponent(project.project_server_id)}`);
  sendJson(res, 200, { project: toPlatformProject(updated), communication_setup: derived.setup, configuration_projection: persistedProject.configuration_projection || null });
}

async function handleProjectComponentHardwareFeatures(req, res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  if (!project.build_config) {
    sendJson(res, 409, { error: "missing_build_config", message: "Das Projekt besitzt keine konfigurierbare IoT-Device-Komponente." });
    return;
  }
  const body = await readJsonBody(req);
  const componentId = String(body.component_id || "").trim();
  const hardwareConfiguration = hardwareConfigurationFromManifest(project.view_manifest);
  const component = hardwareConfiguration?.components?.find((item) => item.component_id === componentId && item.abstract_type === "iot_device");
  if (!component) {
    sendJson(res, 409, { error: "iot_device_component_not_found", message: "Die IoT-Device-Komponente gehoert nicht zur Hardware-Architektur des Projekts." });
    return;
  }
  const boards = await loadProcessorBoards();
  const effectiveBoardId = component.board_configuration?.base_board_profile_id || component.board_profile_id;
  const board = boards.find((item) => [item.hardware_item_id, item.hardware_profile_id, item.id]
    .filter(Boolean).some((id) => String(id) === String(effectiveBoardId)));
  if (!board) {
    sendJson(res, 409, { error: "processor_board_not_found", message: "Das reale Board der IoT-Device-Komponente wurde im Hardware Catalog nicht gefunden." });
    return;
  }
  const resources = Array.isArray(board.peripheral_profile?.resources)
    ? board.peripheral_profile.resources
    : [
      { id: "adc", configurable: true, pin_profile_key: "analog_inputs" },
      { id: "pwm", configurable: true, pin_profile_key: "pwm_pins" },
    ];
  const configurable = new Map(resources.filter((item) => item.configurable).map((item) => [String(item.id), item]));
  const enabled = Array.isArray(body.enabled)
    ? Array.from(new Set(body.enabled.map(String).filter((item) => configurable.has(item))))
    : [];
  const unsupported = enabled.filter((item) => {
    const resource = configurable.get(item);
    if (resource.supported === false) return true;
    if (!resource.pin_profile_key) return false;
    return !Array.isArray(board.pin_profile?.[resource.pin_profile_key]) || board.pin_profile[resource.pin_profile_key].length === 0;
  });
  if (unsupported.length) {
    sendJson(res, 409, { error: "board_peripheral_not_supported", message: `Das gewaehlte Board unterstuetzt nicht: ${unsupported.join(", ")}.` });
    return;
  }
  const current = project.build_config.component_hardware_features || {};
  const persistedProject = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, {
    method: "PATCH",
    body: {
      build_config: {
        ...project.build_config,
        component_hardware_features: {
          ...current,
          [componentId]: { enabled },
        },
      },
    },
  });
  const projects = await loadUserIdeProjects(session);
  const updated = projects.find((item) => item.project_server_id === project.project_server_id);
  touchWorkspace(session, project.project_server_id, "ide", `/app/ide/?project=${encodeURIComponent(project.project_server_id)}`);
  sendJson(res, 200, { project: toPlatformProject(updated), configuration_projection: persistedProject.configuration_projection || null });
}

async function handleProjectPwaDashboard(req, res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  if (project.view_manifest?.template_id !== "iot_datalogger_web_push_pwa") {
    sendJson(res, 409, { error: "pwa_dashboard_not_available", message: "Dieses Projekt besitzt keine konfigurierbare PWA-Dashboard-Komponente." });
    return;
  }
  const body = await readJsonBody(req);
  const pwaDashboard = normalizePwaDashboardConfiguration(body);
  const persistedProject = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, {
    method: "PATCH",
    body: {
      view_manifest: {
        ...project.view_manifest,
        pwa_dashboard: pwaDashboard,
      },
    },
  });
  const projects = await loadUserIdeProjects(session);
  const updated = projects.find((item) => item.project_server_id === project.project_server_id);
  touchWorkspace(session, project.project_server_id, "ide", `/app/ide/?project=${encodeURIComponent(project.project_server_id)}`);
  sendJson(res, 200, { project: toPlatformProject(updated), configuration_projection: persistedProject.configuration_projection || null });
}

async function handleProjectEventConfiguration(req, res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  if (project.view_manifest?.template_id !== "event_driven_project_application") {
    sendJson(res, 409, { error: "event_configuration_not_available", message: "Dieses Projekt besitzt keinen konfigurierbaren Ereignis-Worker oder Dispatcher." });
    return;
  }
  const configuration = normalizeEventConfiguration(await readJsonBody(req), project.view_manifest);
  const persistedProject = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, {
    method: "PATCH",
    body: {
      view_manifest: {
        ...project.view_manifest,
        event_configuration: {
          ...(project.view_manifest.event_configuration || {}),
          [configuration.kind]: configuration.value,
        },
      },
    },
  });
  const projects = await loadUserIdeProjects(session);
  const updated = projects.find((item) => item.project_server_id === project.project_server_id);
  touchWorkspace(session, project.project_server_id, "ide", `/app/ide/?project=${encodeURIComponent(project.project_server_id)}`);
  sendJson(res, 200, { project: toPlatformProject(updated), configuration_projection: persistedProject.configuration_projection || null });
}

function normalizeEventConfiguration(input = {}, manifest = {}) {
  const kind = String(input.kind || "").trim();
  if (!new Set(["worker", "dispatcher"]).has(kind)) throw new Error("Ungueltige Ereigniskomponente.");
  if (kind === "worker") {
    const triggerType = String(input.trigger_type || "timer");
    if (!new Set(["timer", "project_event"]).has(triggerType)) throw new Error("Ungueltiger Ausloeser.");
    const cycleMinutes = Number(input.cycle_minutes || 15);
    if (!Number.isInteger(cycleMinutes) || cycleMinutes < 1 || cycleMinutes > 10080) throw new Error("Der Timer-Zyklus muss zwischen 1 und 10.080 Minuten liegen.");
    const eventName = String(input.event_name || "").trim().slice(0, 80);
    if (!eventName) throw new Error("Ein Ereignisname wird benoetigt.");
    return { kind, value: { schema_version: 1, event_name: eventName, trigger_type: triggerType, cycle_minutes: cycleMinutes } };
  }
  const conditionType = String(input.condition_type || "event_available");
  if (!new Set(["event_available", "field_equals"]).has(conditionType)) throw new Error("Ungueltige Bedingung.");
  const targetComponentId = String(input.target_component_id || "").trim();
  const components = hardwareConfigurationFromManifest(manifest)?.components || [];
  const validTarget = components.some((component) => component.component_id === targetComponentId && component.abstract_type === "iot_device" && /ziel|target/i.test(`${component.label || ""} ${component.component_path || ""}`));
  if (!validTarget) throw new Error("Waehle ein IoT-Zielgeraet aus diesem Projekt.");
  return {
    kind,
    value: {
      schema_version: 1,
      condition_type: conditionType,
      condition_value: String(input.condition_value || "").trim().slice(0, 120),
      target_component_id: targetComponentId,
      push_enabled: input.push_enabled === true,
    },
  };
}

function normalizePwaDashboardConfiguration(input = {}) {
  const cards = new Set(["current_values", "history", "events", "device_status"]);
  const visibleCards = Array.isArray(input.visible_cards || input.visibleCards)
    ? (input.visible_cards || input.visibleCards).map(String).filter((id) => cards.has(id))
    : Array.from(cards);
  return {
    schema_version: 1,
    title: String(input.title || "Mein Datenlogger").trim().slice(0, 80),
    visible_cards: Array.from(new Set(visibleCards)),
  };
}

function primaryProjectComponentPath(project) {
  return String(project?.build_config?.user_source_path || "").match(/^(Komponenten\/[^/]+)\//)?.[1] || "Komponenten/IoT-Device 1";
}

async function handlePlatformDeviceCreate(req, res, session) {
  try {
    const body = await readJsonBody(req);
    const accountId = projectServerUserId(session);
    const hardwareProfileId = requiredField(body.hardware_profile_id, "hardware_profile_id");
    const serialNumber = String(body.serial_number || "").trim() || createGerNetixSerialNumber(hardwareProfileId);
    const displayName = requiredField(body.display_name || serialNumber, "display_name");
    const nodeName = normalizeGerNetixNodeName(body.node_name || body.board_short_name || displayName);
    const processorBoard = await findProcessorBoard(hardwareProfileId);
    const capabilities = normalizeCapabilityIds(
      body.technical_capability_ids || body.capability_ids || processorBoard?.capability_ids || [],
    );
    const registered = await deviceManagementJson("/api/device-management/devices/register", {
      method: "POST",
      body: {
        serial_number: serialNumber,
        hardware_profile_id: hardwareProfileId,
        authenticity_status: "community_unverified",
        lifecycle_state: "registered_by_customer",
        connectivity_status: body.connectivity_status || "unknown",
        ota_status: body.ota_status || (capabilities.includes("ota") ? "unknown" : "unsupported"),
        app_version: body.app_version || "",
        runtime_version: body.runtime_version || "",
        board_short_name: body.board_short_name || "",
        node_name: nodeName,
        instance_configuration: body.instance_configuration || {},
      },
    });
    const accountDevice = await deviceManagementJson(`/api/device-management/accounts/${encodeURIComponent(accountId)}/devices`, {
      method: "POST",
      body: {
        device_id: registered.device_id,
        display_name: displayName,
        technical_capability_ids: capabilities,
        purchase_context_id: body.purchase_context_id || "",
        board_short_name: body.board_short_name || "",
        node_name: nodeName,
        instance_configuration: body.instance_configuration || {},
      },
    });
    const recoveryAccount = await assignFirstEsp32AsRecoveryToken(req, session, registered.device_id, hardwareProfileId);
    sendJson(res, 201, {
      ...decorateUserIdeDevice(accountDevice),
      recovery_token_assigned: Boolean(recoveryAccount),
      account: recoveryAccount || undefined,
    });
  } catch (error) {
    recordDeviceInventoryFailure(session, "device_inventory_create_failed", error, {
      operation: "handlePlatformDeviceCreate",
      route: "/app/device-management/inventory/",
    });
    sendJson(res, error.status || 400, {
      error: error.code || "device_inventory_create_failed",
      message: error.message || "Device konnte nicht inventarisiert werden.",
      details: error.payload || {},
    });
  }
}

async function handlePlatformDiscoveredDeviceClaim(req, res, session) {
  const body = await readJsonBody(req);
  return claimPlatformDiscoveredDevice(req, res, session, body);
}

async function handlePlatformProvisioningSession(req, res, session) {
  try {
    const body = await readJsonBody(req);
    const accountId = projectServerUserId(session);
    const provisioningBinding = requiredField(body.provisioning_binding, "provisioning_binding");
    const token = await deviceManagementJson("/api/device-management/provisioning/tokens", {
      method: "POST",
      body: { account_id: accountId, provisioning_binding: provisioningBinding },
    });
    sendJson(res, 201, token);
  } catch (error) {
    sendJson(res, error.status || 400, {
      error: error.code || "provisioning_session_create_failed",
      message: error.message || "Provisionierungs-Token konnte nicht erstellt werden.",
    });
  }
}

async function handlePlatformProvisioningComplete(req, res, session) {
  try {
    const body = await readJsonBody(req);
    const accountId = projectServerUserId(session);
    const consumed = await deviceManagementJson("/api/device-management/provisioning/tokens/consume", {
      method: "POST",
      body: {
        provisioning_token: requiredField(body.provisioning_token, "provisioning_token"),
        provisioning_binding: requiredField(body.provisioning_binding, "provisioning_binding"),
      },
    });
    if (consumed.account_id !== accountId) throw new Error("Provisionierungs-Token gehoert nicht zum angemeldeten Account.");
    delete body.provisioning_token;
    delete body.provisioning_binding;
    return claimPlatformDiscoveredDevice(req, res, session, body);
  } catch (error) {
    sendJson(res, error.status || 400, {
      error: error.code || "provisioning_complete_failed",
      message: error.message || "WLAN-Provisionierung konnte nicht abgeschlossen werden.",
    });
  }
}

async function claimPlatformDiscoveredDevice(req, res, session, body) {
  try {
    const accountId = projectServerUserId(session);
    const discoveredDeviceId = body.device_id || body.deviceId || "";
    const hardwareProfileId = requiredField(body.hardware_profile_id || body.hardwareProfileId, "hardware_profile_id");
    const serialNumber = String(body.serial_number || body.serialNumber || "").trim() || createGerNetixSerialNumber(hardwareProfileId);
    const displayName = requiredField(body.display_name || body.displayName || serialNumber, "display_name");
    const nodeName = normalizeGerNetixNodeName(body.node_name || body.board_short_name || body.hostname || displayName);
    const capabilities = normalizeCapabilityIds(body.technical_capability_ids || body.capability_ids || body.capabilities || []);
    const registered = await deviceManagementJson("/api/device-management/devices/register", {
      method: "POST",
      body: {
        device_id: discoveredDeviceId || undefined,
        serial_number: serialNumber,
        hardware_profile_id: hardwareProfileId,
        authenticity_status: body.authenticity_status || body.authenticityStatus || "gernetix_verified_pending_proof",
        lifecycle_state: "discovered_by_user_ide",
        connectivity_status: body.connectivity_status || body.connectivityStatus || "online",
        ota_status: body.ota_status || body.otaStatus || (capabilities.includes("ota") ? "ready" : "unknown"),
        app_version: body.app_version || body.firmwareVersion || "",
        runtime_version: body.runtime_version || body.runtimeVersion || "",
        board_short_name: body.board_short_name || "",
        node_name: nodeName,
        instance_configuration: body.instance_configuration || {},
      },
    });
    const accountDevice = await deviceManagementJson(`/api/device-management/accounts/${encodeURIComponent(accountId)}/devices`, {
      method: "POST",
      body: {
        device_id: registered.device_id,
        display_name: displayName,
        technical_capability_ids: capabilities,
        purchase_context_id: body.purchase_context_id || "",
        board_short_name: body.board_short_name || "",
        node_name: nodeName,
        instance_configuration: body.instance_configuration || {},
      },
    });
    const recoveryAccount = await assignFirstEsp32AsRecoveryToken(req, session, registered.device_id, hardwareProfileId);
    sendJson(res, 201, {
      ...decorateUserIdeDevice(accountDevice),
      recovery_token_assigned: Boolean(recoveryAccount),
      account: recoveryAccount || undefined,
    });
  } catch (error) {
    recordDeviceInventoryFailure(session, "discovered_device_claim_failed", error, {
      operation: "handlePlatformDiscoveredDeviceClaim",
      route: "/app/device-management/inventory/",
    });
    sendJson(res, error.status || 400, {
      error: error.code || "discovered_device_claim_failed",
      message: error.message || "Gefundenes Device konnte nicht ins Inventar uebernommen werden.",
      details: error.payload || {},
    });
  }
}

async function handlePlatformDeviceRemove(res, session, accountDeviceId) {
  try {
    const accountId = projectServerUserId(session);
    const result = await deviceManagementJson(`/api/device-management/accounts/${encodeURIComponent(accountId)}/devices/${encodeURIComponent(accountDeviceId)}`, {
      method: "DELETE",
    });
    sendJson(res, 200, result);
  } catch (error) {
    recordDeviceInventoryFailure(session, "device_inventory_remove_failed", error, {
      operation: "handlePlatformDeviceRemove",
      route: "/app/device-management/inventory/",
    });
    sendJson(res, error.status || 400, {
      error: error.code || "device_inventory_remove_failed",
      message: error.message || "Device konnte nicht aus dem Inventar entfernt werden.",
      details: error.payload || {},
    });
  }
}

async function requireSessionProject(session, projectId) {
  const requestedProjectId = String(projectId || "");
  const accountId = projectServerUserId(session);
  const storedProject = await projectServerJson(`/api/projects/${encodeURIComponent(requestedProjectId)}`)
    .catch((error) => error.status === 404 ? null : Promise.reject(error));
  if (!storedProject || storedProject.user_id !== accountId) throw sessionProjectNotFound();
  const learningDefinition = userIdeState.projectDefinitions
    .find((item) => item.learning_project_id === storedProject.learning_project_id);
  const canonicalManifest = learningDefinition
    ? learningProjectManifestForPersistedProject(storedProject, learningDefinition)
    : null;
  const needsLearningViewSync = Number(canonicalManifest?.schema_version || 0)
    > Number(storedProject.view_manifest?.schema_version || 0);
  const synchronizedProject = storedProject.status === "plan_locked"
    ? storedProject
    : needsLearningViewSync
      ? await synchronizeLearningProjectStructure(storedProject, learningDefinition)
      : await synchronizeDevelopmentTemplateRuntimeModel(storedProject, session);
  return mapProjectServerProject(session, synchronizedProject);
}

function sessionProjectNotFound() {
  const error = new Error("Projekt wurde nicht gefunden.");
  error.status = 404;
  return error;
}

async function handleDeviceConnectivityCheck(res, session, deviceId) {
  const devices = await loadUserIdeDevices(session);
  const accountDevice = devices.find((device) => device.device_id === deviceId);
  if (!accountDevice) {
    sendJson(res, 404, { error: "device_not_in_account", message: "Das Device gehört nicht zum aktuellen Account." });
    return;
  }
  const discovery = await discoverNetworkDevices(session, { scope: "node" });
  const discovered = (discovery.items || []).find((device) => device.device_id === deviceId);
  if (!discovered) {
    sendJson(res, 200, {
      reachable: false,
      device_id: deviceId,
      checked_at: discovery.searched_at,
      message: `Das Board wurde über ${discovery.candidate_count || 0} lokale Adressen nicht erreicht.`,
    });
    return;
  }
  const status = await deviceManagementJson(`/api/device-management/devices/${encodeURIComponent(deviceId)}/connectivity/status`, {
    method: "POST",
    body: {
      connectivity_status: "online",
      ota_status: discovered.ota_status || accountDevice.ota_status,
      ota_hostname: discovered.hostname || "",
      last_seen_ip: new URL(discovered.source_url).hostname,
    },
  });
  sendJson(res, 200, {
    reachable: true,
    checked_at: discovery.searched_at,
    hostname: discovered.hostname,
    source_url: discovered.source_url,
    device: {
      ...accountDevice,
      connectivity_status: status.connectivity_status || "online",
      ota_status: status.ota_status || discovered.ota_status || accountDevice.ota_status,
    },
  });
}

async function handleUserIdeBuildJob(req, res) {
  const body = await readJsonBody(req);
  const actionContext = readUserActionContext(req, "project.build.start");
  const actionHeaders = actionContext?.headers || {};
  const session = await readSession(req);
  const projects = await loadUserIdeProjects(session);
  const devices = await loadUserIdeDevices(session);
  const project = projects.find((item) => item.slug === body.project_slug);
  let device = devices.find((item) => item.device_id === body.device_id || item.account_device_id === body.device_id) || null;
  const mode = body.mode || "build";
  const flashTransportRequested = body.flash_transport === "flashbox";
  const flashbox = flashTransportRequested
    ? devices.find((item) => item.device_id === body.flashbox_device_id || item.account_device_id === body.flashbox_device_id) || null
    : null;

  if (!project) {
    sendJson(res, 404, { error: "project_not_found", message: "Projekt wurde nicht gefunden." });
    return;
  }
  const softwareUnits = platformSoftwareUnits(project);
  const softwareUnitId = String(body.software_unit_id || project.active_software_unit_id || softwareUnits[0]?.software_unit_id || "").trim();
  const softwareUnit = softwareUnits.find((unit) => unit.software_unit_id === softwareUnitId) || null;
  if (softwareUnitId && !softwareUnit) {
    sendJson(res, 404, { error: "software_unit_not_found", message: "Die gewählte Softwareeinheit gehört nicht zu diesem Projekt." });
    return;
  }
  if (softwareUnit && softwareUnit.build_system !== "platformio") {
    sendJson(res, 409, { error: "software_unit_builder_not_supported", message: `Das Build-System ${softwareUnit.build_system} ist noch nicht an einen Build-Runner angebunden.` });
    return;
  }
  if (!device && softwareUnit?.device_id) {
    device = devices.find((item) => item.device_id === softwareUnit.device_id || item.account_device_id === softwareUnit.device_id) || null;
  }
  const resolvedBuildConfig = softwareUnit?.build_config || resolveBuildConfig(project, device || {});
  if (project.view_manifest?.template_id === "touchscreen_game_collection") {
    const problems = touchscreenGameBuildConfigurationProblems(project, resolvedBuildConfig);
    const sourcePayload = problems.length
      ? { items: [] }
      : await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/sources`);
    const sourceRoot = String(softwareUnit?.source_root || "").replace(/\/$/, "");
    const sourcePrefix = sourceRoot ? `${sourceRoot}/` : "";
    const sourcePaths = new Set((sourcePayload.items || []).map((source) => {
      const sourcePath = String(source.path || "");
      return sourcePrefix && sourcePath.startsWith(sourcePrefix) ? sourcePath.slice(sourcePrefix.length) : sourcePath;
    }));
    for (const requiredPath of ["src/user_main.cpp", "src/board_adapter.cpp", "src/game_application.cpp"]) {
      if (!sourcePaths.has(requiredPath)) problems.push(`Quelldatei ${requiredPath} fehlt`);
    }
    if (!problems.length) {
      const platformioIni = renderPlatformioIni(resolvedBuildConfig);
      if (!/^\s*\[env:es3c28p\]\s*$/m.test(platformioIni)) problems.push("platformio.ini enthaelt die Umgebung es3c28p nicht");
      if (!/^\s*framework\s*=\s*espidf\s*$/m.test(platformioIni)) problems.push("platformio.ini verwendet nicht ESP-IDF");
      if (!/^\s*board_build\.flash_size\s*=\s*16MB\s*$/mi.test(platformioIni)) problems.push("platformio.ini verwendet nicht 16 MB Flash");
      if (!/^\s*board_build\.partitions\s*=\s*partitions_full_16mb\.csv\s*$/mi.test(platformioIni)) problems.push("platformio.ini verwendet nicht das OTA-faehige Full-Partitionslayout");
      if (!/LovyanGFX/i.test(platformioIni)) problems.push("platformio.ini enthaelt LovyanGFX nicht");
      if (!/GERNETIX_BASISSOFTWARE_PROFILE_FULL=1/.test(platformioIni)) problems.push("platformio.ini aktiviert nicht das Full-Basisprofil");
    }
    if (problems.length) {
      sendJson(res, 409, {
        error: "touchscreen_game_build_configuration_invalid",
        message: `Build gesperrt: Die wirksame Konfiguration der Touchscreen-Spielesammlung ist widerspruechlich (${problems.join("; ")}). Erwartet werden ES3C28P, ESP-IDF, die vollstaendige GerNetiX-Basissoftware, Umgebung es3c28p, 16 MB Flash mit Full-A/B-Partitionen und die vollstaendigen Beispielquellen.`,
        problems,
      });
      return;
    }
  }
  if (!device && !["build", "build_and_usb_flash"].includes(mode)) {
    sendJson(res, 404, { error: "device_not_found", message: "Device wurde nicht gefunden." });
    return;
  }
  if (flashTransportRequested) {
    const hardwareProfile = String(flashbox?.hardware_profile_id || "").toLowerCase();
    const isFlashbox = flashbox?.hardware_class === "flashbox" || hardwareProfile.includes("hardware.flashbox.");
    if (!flashbox || !isFlashbox) {
      sendJson(res, 403, {
        error: "flashbox_not_in_inventory",
        message: "Die ausgewaehlte FlashBox gehoert nicht zum aktuellen Account-Inventar.",
      });
      return;
    }
    if (flashbox.device_id === device?.device_id) {
      sendJson(res, 409, {
        error: "flashbox_cannot_be_target",
        message: "Eine FlashBox kann nicht gleichzeitig der USB-Helper und das Zielgeraet sein.",
      });
      return;
    }
  }
  if (mode === "build_and_flash" && device.ota_status !== "ready") {
    sendJson(res, 409, { error: "device_not_ota_ready", message: "Das ausgewaehlte Device ist nicht OTA-ready." });
    return;
  }
  if (mode === "build_and_flash" && device.connectivity_status !== "online") {
    sendJson(res, 409, {
      error: "device_not_online",
      message: `Das ausgewaehlte Device ist nicht online (${device.connectivity_status || "unknown"}). OTA wurde nicht gestartet.`,
    });
    return;
  }
  if (mode === "build_and_flash") {
    const otaPreflight = await otaBuildDeployJson("/api/ota/preflight");
    if (!otaPreflight.ready) {
      const blockers = (otaPreflight.blockers || []).map((item) => item.message).filter(Boolean);
      sendJson(res, 409, {
        error: "ota_pipeline_not_ready",
        message: `OTA kann noch nicht gestartet werden: ${blockers.join(" ")}`,
        blockers: otaPreflight.blockers || [],
      });
      return;
    }
  }
  const projectServerJob = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/build-jobs`, {
    method: "POST",
    headers: actionHeaders,
    body: {
      mode,
      ...(actionContext ? { action_id: actionContext.actionId, action_type: actionContext.actionType } : {}),
      build_profile: body.build_profile || "standard",
      device_id: device?.device_id || null,
      software_unit_id: softwareUnit?.software_unit_id || "",
      build_config: resolvedBuildConfig,
    },
  });
  const buildPackage = await projectServerJson(`/api/build-jobs/${encodeURIComponent(projectServerJob.build_job_id)}/build-package`, { headers: actionHeaders });
  const buildDeployClient = mode === "build_and_flash"
    ? otaBuildDeployJson
    : (["build", "prebuild"].includes(mode) && !flashTransportRequested ? buildWorkerPoolJson : buildDeployJson);
  const buildDeployJob = await buildDeployClient("/api/build-jobs", {
    method: "POST",
    headers: actionHeaders,
    body: {
      job_id: projectServerJob.build_job_id,
      ...(actionContext ? { action_id: actionContext.actionId, action_type: actionContext.actionType } : {}),
      mode,
      build_profile: projectServerJob.build_profile || body.build_profile || "standard",
      project_id: project.project_server_id,
      software_unit_id: softwareUnit?.software_unit_id || "",
      device_id: device?.device_id || null,
      build_package: toBuildDeployPackage(buildPackage, device || {}, project),
      usb_flash: mode === "build_and_usb_flash" ? {
        upload_port: String(body.upload_port || device?.upload_port || "").trim(),
      } : null,
      deploy: mode === "build_and_flash" ? {
        requested: true,
        authorized: true,
        device_id: device.device_id,
      } : null,
      flashbox: flashTransportRequested ? {
        requested: true,
        flashbox_device_id: flashbox.device_id,
        flashbox_hardware_profile_id: flashbox.hardware_profile_id || "",
        target_device_id: device.device_id,
        target_hardware_profile_id: device.hardware_profile_id || "",
        manifest_type: "project_firmware_flash",
        transport: "flashbox_certificate_authenticated_mqtt_job",
      } : null,
    },
  });
  await projectServerJson(`/api/build-jobs/${encodeURIComponent(projectServerJob.build_job_id)}/submitted`, {
    method: "POST",
    headers: actionHeaders,
    body: {
      build_deploy_job_id: buildDeployJob.job_id,
    },
  });
  // Return the accepted job immediately so the browser can expose cancellation
  // while the worker compiles. Completion is synchronized by the status route.
  const completedBuildDeployJob = buildDeployJob;
  if (completedBuildDeployJob && ["succeeded", "failed", "cancelled"].includes(completedBuildDeployJob.status)) {
    await recordCompletedBuildJob(projectServerJob.build_job_id, completedBuildDeployJob);
  }

  const build = {
    build_job_id: projectServerJob.build_job_id,
    build_deploy_job_id: buildDeployJob.job_id,
    project_server_id: project.project_server_id,
    project_slug: project.slug,
    project_title: project.title,
    software_unit_id: softwareUnit?.software_unit_id || "",
    software_unit_title: softwareUnit?.title || "Firmware",
    device_id: device?.device_id || null,
    device_label: device?.display_name || "kein Device erforderlich",
    flashbox_device_id: flashbox?.device_id || null,
    flashbox_label: flashbox?.display_name || "",
    mode,
    status: completedBuildDeployJob ? completedBuildDeployJob.status : "submitted_to_build_deploy",
    created_at: projectServerJob.created_at,
    build_package_contract: `${buildPackage.files.length} Dateien: platformio.ini + Projektquellen`,
    artifact_url: completedBuildDeployJob?.result?.build?.primary_firmware?.download_url
      || completedBuildDeployJob?.result?.build?.artifacts?.["firmware.bin"]?.download_url
      || completedBuildDeployJob?.result?.build?.artifacts?.["firmware.hex"]?.download_url
      || "",
    build_id: completedBuildDeployJob?.result?.build?.build_id || "",
    artifacts: buildArtifactDownloads(projectServerJob.build_job_id, completedBuildDeployJob),
    flash_status: completedBuildDeployJob?.result?.build?.usb_flash?.status
      || completedBuildDeployJob?.result?.deploy?.status
      || "nicht angefordert",
    flash_manifest: browserFlashManifest(projectServerJob.build_job_id, completedBuildDeployJob, resolvedBuildConfig),
  };
  userIdeState.builds.unshift(build);
  touchWorkspace(session, project.project_server_id, body.mode === "learn" ? "learn" : "ide", `/app/ide/?project=${encodeURIComponent(project.project_server_id)}`);
  sendJson(res, 202, build);
}

async function recordCompletedBuildJob(jobId, completedJob) {
  return projectServerJson(`/api/build-jobs/${encodeURIComponent(jobId)}/result`, {
    method: "POST",
    body: toProjectBuildResult(completedJob),
  });
}

function browserFlashManifest(jobId, completedJob, buildConfig = {}) {
  const artifacts = completedJob?.result?.build?.artifacts || {};
  const runnerManifest = Array.isArray(completedJob?.result?.build?.flash_manifest)
    ? completedJob.result.build.flash_manifest
    : [];
  const fallbackDefinitions = [
    ["bootloader.bin", esp32BootloaderAddress(buildConfig)],
    ["partitions.bin", 0x8000],
    ["boot_app0.bin", 0xe000],
    ["firmware.bin", esp32FirmwareAddress(buildConfig)],
  ];
  const definitions = completeBrowserFlashDefinitions(runnerManifest, fallbackDefinitions, {
    authoritativeFallbackNames: usesGerNetixOtaAppLayout(buildConfig) ? ["firmware.bin"] : [],
  });
  return definitions.filter(([name, address]) => artifacts[name] && Number.isInteger(address) && address >= 0).map(([name, address]) => ({
    name,
    address,
    url: `/api/user-ide/build-artifacts/${encodeURIComponent(jobId)}/${encodeURIComponent(name)}`,
    size_bytes: artifacts[name].size_bytes,
    sha256: artifacts[name].sha256,
  }));
}

function esp32BootloaderAddress(buildConfig = {}) {
  const target = [
    buildConfig.board,
    buildConfig.environment,
    buildConfig.board_configuration?.base_board_profile_id,
  ].filter(Boolean).join(" ").toLowerCase();
  return /esp32[-_]?s3|es3c28p/.test(target) ? 0x0000 : 0x1000;
}

function buildArtifactDownloads(jobId, completedJob) {
  const artifacts = completedJob?.result?.build?.artifacts || {};
  return customerArtifactList(jobId, artifacts);
}

async function proxyBuildArtifact(res, jobId, fileName) {
  let upstream = await fetch(`${buildDeployBaseUrl.replace(/\/$/, "")}/artifacts/${encodeURIComponent(jobId)}/${encodeURIComponent(fileName)}`);
  if (upstream.status === 404 && otaBuildDeployBaseUrl !== buildDeployBaseUrl) {
    upstream = await fetch(`${otaBuildDeployBaseUrl.replace(/\/$/, "")}/artifacts/${encodeURIComponent(jobId)}/${encodeURIComponent(fileName)}`);
  }
  const content = Buffer.from(await upstream.arrayBuffer());
  res.writeHead(upstream.status, {
    "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
    "Content-Length": content.length,
    "Content-Disposition": `attachment; filename="${String(fileName).replace(/[^A-Za-z0-9._-]/g, "_")}"`,
    "Cache-Control": "no-store",
  });
  res.end(content);
}

async function proxyPublicDemo(res, requestPath) {
  try {
    const upstream = await fetch(`${publicDemoBaseUrl.replace(/\/$/, "")}${requestPath}`);
    const content = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
      "Content-Length": content.length,
      "Cache-Control": upstream.headers.get("cache-control") || "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(content);
  } catch {
    sendJson(res, 503, {
      error: "public_demo_unavailable",
      message: "Der lokale Demo-Katalog ist noch nicht erreichbar. Starte den Public Demo Server auf Port 4920.",
    });
  }
}

function serveVendorEsptool(res, requestPath) {
  const relativePath = requestPath.replace(/^\/vendor\/esptool-js\//, "");
  const root = relativePath === "bundle.js" ? esptoolJsDir : path.join(esptoolJsDir, "lib");
  serveStatic(res, root, `/${relativePath}`);
}

async function handleDeviceRecoveryFirmwareCheck(req, res, session) {
  const body = await readJsonBody(req);
  const devices = await loadUserIdeDevices(session);
  const device = devices.find((item) => item.device_id === body.device_id);
  if (!device) {
    sendJson(res, 404, { error: "device_not_found", message: "Device wurde nicht gefunden." });
    return;
  }
  const mode = String(body.mode || "").trim().toLowerCase();
  if (!["usb", "ota"].includes(mode)) {
    sendJson(res, 400, { error: "invalid_recovery_mode", message: "Recovery Check muss usb oder ota verwenden." });
    return;
  }
  sendJson(res, 200, createFirmwareRecoveryCheck(device, mode, {
    upload_port: body.upload_port || "",
  }));
}

function createFirmwareRecoveryCheck(device, mode, input = {}) {
  const checks = [
    recoveryCheckItem("device_known", true, "Device ist dem Account zugeordnet."),
    recoveryCheckItem("board_profile", Boolean(device.build_config), device.build_config
      ? `Boardprofil erkannt: ${device.build_target_label || device.hardware_profile_id || "konfiguriert"}.`
      : "Kein Boardprofil fuer Firmware-Checks hinterlegt."),
  ];
  if (mode === "usb") {
    const port = String(input.upload_port || device.upload_port || "").trim();
    checks.push(
      recoveryCheckItem("usb_supported", Boolean(device.usb_flash_supported), device.usb_flash_supported
        ? "USB-Firmwarepfad wird fuer dieses Device unterstuetzt."
        : "Dieses Device ist nicht fuer USB-Firmwarechecks konfiguriert."),
      recoveryCheckItem("usb_port", Boolean(port), port
        ? `USB-Port: ${port}.`
        : "Kein USB-Port ausgewaehlt oder erkannt."),
    );
  } else {
    checks.push(
      recoveryCheckItem("ota_ready", device.ota_status === "ready", device.ota_status === "ready"
        ? "OTA ist fuer dieses Device bereit."
        : `OTA ist nicht bereit: ${device.ota_status || "unknown"}.`),
      recoveryCheckItem("network_reachable", device.connectivity_status === "online", device.connectivity_status === "online"
        ? `Verbindungsstatus: ${device.connectivity_status}.`
        : `Device ist nicht erreichbar: ${device.connectivity_status || "unknown"}.`),
    );
  }
  const ok = checks.every((item) => item.ok);
  return {
    check_id: `firmware_${mode}_${Date.now()}`,
    device_id: device.device_id,
    device_label: device.display_name,
    mode,
    status: ok ? "ready" : "blocked",
    summary: ok
      ? `Firmware-Check ueber ${mode.toUpperCase()} ist bereit.`
      : `Firmware-Check ueber ${mode.toUpperCase()} ist noch blockiert.`,
    checks,
    next_action: ok
      ? (mode === "usb" ? "USB-Firmwarecheck kann als Recovery-Schritt angeschlossen werden." : "OTA-Firmwarecheck kann als Recovery-Schritt angeschlossen werden.")
      : "Fehlende Voraussetzungen beheben, dann erneut pruefen.",
  };
}

function recoveryCheckItem(checkId, ok, message) {
  return {
    check_id: checkId,
    ok: Boolean(ok),
    status: ok ? "ok" : "blocked",
    message,
  };
}

async function loadUserIdeProjects(session) {
  const userId = projectServerUserId(session);
  const cached = userIdeProjectsCache.get(userId);
  if (cached && cached.expires_at > Date.now()) return cached.value;
  if (userIdeProjectLoads.has(userId)) return userIdeProjectLoads.get(userId);
  const load = loadUserIdeProjectsUncached(session, userId)
    .then((value) => {
      userIdeProjectsCache.set(userId, { value, expires_at: Date.now() + userIdeProjectsCacheMs });
      return value;
    })
    .finally(() => userIdeProjectLoads.delete(userId));
  userIdeProjectLoads.set(userId, load);
  return load;
}

function invalidateUserIdeProjectCaches(userId) {
  userIdeProjectsCache.delete(userId);
  userIdeProjectSummariesCache.delete(userId);
}

async function loadUserIdeProjectSummaries(session) {
  const userId = projectServerUserId(session);
  const cached = userIdeProjectSummariesCache.get(userId);
  if (cached && cached.expires_at > Date.now()) return cached.value;
  if (userIdeProjectSummaryLoads.has(userId)) return userIdeProjectSummaryLoads.get(userId);
  const load = loadUserIdeProjectSummariesUncached(session, userId)
    .then((value) => {
      userIdeProjectSummariesCache.set(userId, { value, expires_at: Date.now() + userIdeProjectSummariesCacheMs });
      return value;
    })
    .finally(() => userIdeProjectSummaryLoads.delete(userId));
  userIdeProjectSummaryLoads.set(userId, load);
  return load;
}

async function loadUserIdeProjectSummariesUncached(session, userId) {
  await ensureAccountResourcePlan(session);
  scheduleProjectServerDemoProjects(session);
  const response = await projectServerJson(`/api/projects?user_id=${encodeURIComponent(userId)}&profile=summary`);
  return mapUserIdeProjectSummaries(session, response.items || []);
}

function mapUserIdeProjectSummaries(session, storedProjects) {
  const userId = projectServerUserId(session);
  const workspace = getWorkspaceState(userId);
  const catalog = userIdeState.projectDefinitions.map((definition) => ({
    project_server_id: catalogProjectIdForDefinition(definition),
    owner_user_id: userId,
    title: definition.title,
    summary: definition.summary,
    area: definition.area,
    project_origin: "catalog",
    hardware_profile_id: definition.hardware_profile_id,
    linked_device_id: "",
    linked_device_ids: [],
    slug: definition.slug,
    course_id: definition.course_id,
    lesson_id: definition.lesson_id,
    learning_project_id: definition.learning_project_id,
    entry_mode: "project_story",
    access_model: definition.access_model || "subscription",
    learning_category: definition.learning_category,
    tags: definition.tags || [],
    status: "catalog_template",
    has_project_app: false,
    created_at: "",
    updated_at: "",
  }));
  const accountProjects = storedProjects.map((project) => {
    const definition = userIdeState.projectDefinitions
      .find((item) => item.learning_project_id === project.learning_project_id);
    return {
      project_server_id: project.project_id,
      owner_user_id: project.user_id || userId,
      title: project.title || definition?.title || "Projekt",
      summary: project.description || definition?.summary || "",
      area: definition?.area || (project.learning_project_id === "development_project" ? "development_project" : "custom_project"),
      project_origin: "account_project",
      hardware_profile_id: project.hardware_profile_id || definition?.hardware_profile_id || "",
      linked_device_id: project.device_ids?.[0] || project.device_id || "",
      linked_device_ids: project.device_ids || (project.device_id ? [project.device_id] : []),
      slug: definition?.slug || project.project_id,
      course_id: definition?.course_id || "development",
      lesson_id: definition?.lesson_id || "",
      learning_project_id: project.learning_project_id || "",
      entry_mode: project.entry_mode || "project_story",
      access_model: definition?.access_model || "owned",
      learning_category: definition?.learning_category,
      tags: definition?.tags || [],
      status: project.status || "active",
      has_project_app: project.has_project_app === true,
      created_at: project.created_at || "",
      updated_at: project.updated_at || "",
      last_opened_mode: workspace.lastProjectId === project.project_id ? workspace.lastMode : "",
      last_opened_at: workspace.lastProjectId === project.project_id ? workspace.updatedAt : "",
    };
  });
  return catalog.concat(accountProjects)
    .sort((left, right) => String(right.updated_at || "").localeCompare(String(left.updated_at || "")));
}

async function loadUserIdeProjectsUncached(session, userId) {
  await ensureAccountResourcePlan(session);
  scheduleProjectServerDemoProjects(session);
  const response = await projectServerJson(`/api/projects?user_id=${encodeURIComponent(userId)}`);
  const synchronizedItems = await Promise.all(response.items.map(async (project) => {
    if (project.status === "plan_locked") return project;
    const definition = userIdeState.projectDefinitions
      .find((item) => item.learning_project_id === project.learning_project_id);
    const canonicalManifest = definition
      ? learningProjectManifestForPersistedProject(project, definition)
      : null;
    const needsLearningViewSync = Number(canonicalManifest?.schema_version || 0)
      > Number(project.view_manifest?.schema_version || 0);
    if (needsLearningViewSync) return synchronizeLearningProjectStructure(project, definition);
    return synchronizeDevelopmentTemplateRuntimeModel(project, session);
  }));
  return mapUserIdeProjects(session, new Map(synchronizedItems.map((item) => [item.project_id, item])));
}

async function synchronizeDevelopmentTemplateRuntimeModel(project, session) {
  const templateId = String(project.view_manifest?.template_id || "");
  if (project.learning_project_id !== "development_project" || templateId !== "esp32_camera_to_touch_display") return project;
  const template = developmentProjectTemplate(templateId);
  // This is the migration level of the persisted runtime model, not the
  // public template schema version.  Reusing schemaVersion (currently 1)
  // kept every project below migrations 16-19 and rewrote catalog snapshots
  // plus platformio.ini on every load, invalidating otherwise reusable builds.
  const targetVersion = 19;
  const templateRef = project.view_manifest?.template_ref || {};
  const currentVersion = Math.max(
    Number(templateRef.model_schema_version || 0),
    Number(templateRef.runtime_model_version || 0),
  );
  const canonicalUnits = templateSoftwareUnits(template);
  const existingUnits = platformSoftwareUnits(project);
  const hardwareConfiguration = hardwareConfigurationFromManifest(project.view_manifest);
  const hardwareDevices = (hardwareConfiguration?.components || [])
    .filter((component) => component.abstract_type === "iot_device");
  const missingBoardConfiguration = canonicalUnits.some((_canonical, index) => (
    !existingUnits[index]?.build_config?.board_configuration
  ));
  const missingCommunicationSetup = !project.view_manifest?.communication_setup;
  const refreshCatalogBoardConfigurations = currentVersion < 19;
  if (currentVersion >= targetVersion && !missingBoardConfiguration && !missingCommunicationSetup && !refreshCatalogBoardConfigurations) return project;
  const availableBoards = missingBoardConfiguration || refreshCatalogBoardConfigurations
    ? await loadAvailableProcessorBoards(session)
    : [];
  let softwareUnits = canonicalUnits.map((canonical, index) => {
    const existing = existingUnits[index] || {};
    const hardware = hardwareDevices[index] || {};
    const existingBuild = existing.build_config || {};
    const preservedBuildValues = {};
    for (const key of ["board_configuration", "component_device_allocations", "component_features", "component_hardware_features", "basissoftware_configuration"]) {
      if (existingBuild[key] !== undefined) preservedBuildValues[key] = structuredClone(existingBuild[key]);
    }
    const catalogBoard = availableBoards.find((board) => board.hardware_item_id === canonical.hardware_profile_id);
    if (refreshCatalogBoardConfigurations && preservedBuildValues.board_configuration && catalogBoard) {
      preservedBuildValues.board_configuration = compilerBoardConfiguration(
        preservedBuildValues.board_configuration,
        catalogBoard,
      );
    }
    if (!preservedBuildValues.board_configuration) {
      const resolvedBoardConfiguration = hardware.board_configuration
        || (catalogBoard ? compilerBoardConfiguration(null, catalogBoard) : null);
      if (resolvedBoardConfiguration) preservedBuildValues.board_configuration = structuredClone(resolvedBoardConfiguration);
    }
    // Template copies own their source code.  An older account project must
    // therefore not receive the v16 camera/display component dependencies
    // unless it was created with the matching v16 sources.
    if (currentVersion < 16) {
      preservedBuildValues.platformio_options = existingBuild.platformio_options || {
        "board_build.cmake_extra_args": "-DSDKCONFIG_DEFAULTS=\"sdkconfig.esp32-s3-n16r8\"",
      };
    }
    return {
      ...canonical,
      software_unit_id: existing.software_unit_id || canonical.software_unit_id,
      title: existing.title || canonical.title,
      source_root: `Komponenten/IoT-Device ${index + 1}`,
      device_id: existing.device_id || hardware.inventory_device_id || "",
      build_config: {
        ...existingBuild,
        ...canonical.build_config,
        ...preservedBuildValues,
      },
    };
  });
  const communicationSetup = normalizeProjectCommunicationSetup(
    project.view_manifest?.communication_setup || defaultProjectCommunicationSetup(softwareUnits),
    softwareUnits,
  );
  softwareUnits = applyProjectCommunicationSetup(softwareUnits, communicationSetup).software_units;
  const migratedArchitectureSource = currentVersion < 18
    ? await migrateCameraTemplateWifiArchitectureSources(project.project_id)
    : "";
  if (currentVersion < 19) await migrateCameraTemplateDisplaySource(project.project_id);
  const nextHardwareConfiguration = hardwareConfiguration ? {
    ...hardwareConfiguration,
    components: (hardwareConfiguration.components || []).map((component) => {
      if (component.abstract_type !== "iot_device") return component;
      const index = hardwareDevices.findIndex((device) => device.component_id === component.component_id);
      const catalogBoard = availableBoards.find((board) => board.hardware_item_id === component.board_profile_id);
      return {
        ...component,
        component_path: `Komponenten/IoT-Device ${index + 1}`,
        ...(refreshCatalogBoardConfigurations && catalogBoard ? {
          board_configuration: compilerBoardConfiguration(component.board_configuration, catalogBoard),
        } : {}),
      };
    }),
  } : null;
  const nextManifest = {
    ...project.view_manifest,
    template_ref: {
      ...templateRef,
      runtime_model_version: targetVersion,
    },
    communication_setup: communicationSetup,
    views: (project.view_manifest?.views || []).map((view) => {
      if (view.id === "hardware-configuration" && nextHardwareConfiguration) return { ...view, payload: nextHardwareConfiguration };
      if (view.id === "architecture-diagram" && migratedArchitectureSource) {
        return { ...view, payload: { ...(view.payload || {}), source: migratedArchitectureSource } };
      }
      return view;
    }),
  };
  return projectServerJson(`/api/projects/${encodeURIComponent(project.project_id)}`, {
    method: "PATCH",
    body: {
      build_config: softwareUnits[0]?.build_config || null,
      software_units: softwareUnits,
      active_software_unit_id: softwareUnits.some((unit) => unit.software_unit_id === project.active_software_unit_id)
        ? project.active_software_unit_id
        : softwareUnits[0]?.software_unit_id || "",
      view_manifest: nextManifest,
    },
  });
}

async function migrateCameraTemplateWifiArchitectureSources(projectId) {
  let primarySource = "";
  for (const sourcePath of ["docs/architecture.puml", "Architektur/statische-architektur/architecture.puml"]) {
    const source = await projectServerJson(`/api/projects/${encodeURIComponent(projectId)}/sources/${encodeURIComponent(sourcePath)}`)
      .catch((error) => error.status === 404 ? null : Promise.reject(error));
    if (!source) continue;
    const content = migrateCameraTemplateWifiArchitecture(source.content);
    if (content === source.content) continue;
    await projectServerJson(`/api/projects/${encodeURIComponent(projectId)}/sources`, {
      method: "PUT",
      body: {
        path: sourcePath,
        content,
        content_type: source.content_type || "text/plain",
        role: source.role || (sourcePath === "docs/architecture.puml" ? "architecture_model" : "architecture_static_view"),
      },
    });
    if (sourcePath === "docs/architecture.puml") primarySource = content;
  }
  return primarySource;
}

async function migrateCameraTemplateDisplaySource(projectId) {
  const sourcePath = "Komponenten/IoT-Device 2/src/user_main.cpp";
  const source = await projectServerJson(`/api/projects/${encodeURIComponent(projectId)}/sources/${encodeURIComponent(sourcePath)}`)
    .catch((error) => error.status === 404 ? null : Promise.reject(error));
  if (!source) return;
  const content = migrateCameraTemplateDisplayGpioTypes(source.content);
  if (content === source.content) return;
  await projectServerJson(`/api/projects/${encodeURIComponent(projectId)}/sources`, {
    method: "PUT",
    body: {
      path: sourcePath,
      content,
      content_type: source.content_type || "text/x-c++src",
      role: source.role || "firmware_source",
    },
  });
}

function mapUserIdeProjects(session, projectsById) {
  const userId = projectServerUserId(session);
  const workspace = getWorkspaceState(userId);
  const definitionIds = new Set(userIdeState.projectDefinitions.map((definition) => definition.project_server_id));
  const seededProjects = userIdeState.projectDefinitions.map((definition) => {
    return {
      ...definition,
      project_server_id: catalogProjectIdForDefinition(definition),
      owner_user_id: userId,
      hardware_profile_id: definition.hardware_profile_id,
      build_config: definition.build_config,
      linked_device_id: "",
      linked_device_ids: [],
      project_origin: "catalog",
      status: "catalog_template",
      last_build_status: "",
      source_count: 0,
      build_count: 0,
      access_model: definition.access_model || "subscription",
      view_manifest: projectViewManifest(definition),
      created_at: "",
      updated_at: "",
      last_opened_mode: "",
      last_opened_at: "",
      source_files: [],
    };
  });
  const customProjects = Array.from(projectsById.values())
    .filter((project) => !isRetiredCatalogProject(project))
    .filter((project) => !definitionIds.has(project.project_id) || isEstablishedLearningProject(project))
    .map((project) => mapProjectServerProject(session, project));
  return seededProjects.concat(customProjects)
    .sort((left, right) => String(right.updated_at || "").localeCompare(String(left.updated_at || "")));
}

function mapProjectServerProject(session, project) {
  const userId = projectServerUserId(session);
  const workspace = getWorkspaceState(userId);
  const learningDefinition = userIdeState.projectDefinitions
    .find((definition) => definition.learning_project_id === project.learning_project_id);
  if (learningDefinition && (project.project_id !== learningDefinition.project_server_id || isEstablishedLearningProject(project))) {
    const lessonFocusId = project.view_manifest?.lesson_focus_id || "";
    const focusedLesson = learningDefinition.development_lessons?.find((lesson) => lesson.id === lessonFocusId);
    const focusedSteps = focusedLesson
      ? (project.view_manifest?.views || []).map((view) => ({
          title: view.title,
          text: view.summary || "",
          insight: `Teil der Entwicklungslesson ${focusedLesson.title}.`,
        }))
      : learningDefinition.steps;
    return {
      ...learningDefinition,
      project_server_id: project.project_id,
      title: project.title || learningDefinition.title,
      summary: project.description || learningDefinition.summary,
      project_origin: "account_project",
      owner_user_id: project.user_id || userId,
      repository_binding: project.repository_binding || null,
      hardware_profile_id: project.hardware_profile_id || learningDefinition.hardware_profile_id,
      build_config: project.build_config || learningDefinition.build_config,
      software_units: platformSoftwareUnits(project, learningDefinition.build_config),
      active_software_unit_id: platformActiveSoftwareUnitId(project),
      linked_device_id: project.device_ids?.[0] || project.device_id || "",
      linked_device_ids: project.device_ids || (project.device_id ? [project.device_id] : []),
      status: project.status || "active",
      last_build_status: latestBuildStatus(project),
      source_count: project.source_count || 0,
      source_files: project.source_files || learningDefinition.source_files || [],
      build_count: project.build_count || 0,
      view_manifest: project.view_manifest || projectViewManifest(learningDefinition),
      lesson_id: focusedLesson?.id || learningDefinition.lesson_id,
      steps: focusedSteps,
      entry_mode: project.view_manifest?.entry_mode || "project_story",
      current_lesson_id: focusedLesson?.id || "",
      created_at: project.created_at || "",
      updated_at: project.updated_at || "",
      last_opened_mode: workspace.lastProjectId === project.project_id ? workspace.lastMode : "",
      last_opened_at: workspace.lastProjectId === project.project_id ? workspace.updatedAt : "",
    };
  }
  const manifest = restoreDevelopmentTemplateReference(project.view_manifest || developmentProjectViewManifest({
    title: project.title,
    description: project.description,
    source: initialArchitecturePlantUml(project.title),
  }), project);
  const primarySourcePath = manifest.primary_source_path || "docs/architecture.puml";
  return {
    project_server_id: project.project_id,
    slug: project.project_id,
    title: project.title,
    summary: project.description || "",
    area: project.learning_project_id === "development_project" ? "development_project" : "custom_project",
    project_origin: "account_project",
    course_id: "development",
    lesson_id: `architecture_${project.project_id}`,
    learning_project_id: project.learning_project_id || "",
    owner_user_id: project.user_id || userId,
    repository_binding: project.repository_binding || null,
    hardware_profile_id: project.hardware_profile_id || "architecture.discovery",
    build_config: project.build_config || null,
    software_units: platformSoftwareUnits(project),
    active_software_unit_id: platformActiveSoftwareUnitId(project),
    linked_device_id: project.device_ids?.[0] || project.device_id || "",
    linked_device_ids: project.device_ids || (project.device_id ? [project.device_id] : []),
    status: project.status || "active",
    last_build_status: latestBuildStatus(project),
    source_count: project.source_count || 0,
    build_count: project.build_count || 0,
    view_manifest: manifest,
    created_at: project.created_at || "",
    updated_at: project.updated_at || "",
    last_opened_mode: workspace.lastProjectId === project.project_id ? workspace.lastMode : "",
    last_opened_at: workspace.lastProjectId === project.project_id ? workspace.updatedAt : "",
    source_files: project.source_files || [{ path: primarySourcePath, role: "architecture_model" }],
    steps: [],
    required_capability_ids: [],
    access_model: "owned",
  };
}

function scheduleProjectServerDemoProjects(session) {
  void ensureProjectServerDemoProjects(session).catch((error) => {
    console.warn(`Project-Server-Katalogsynchronisierung fehlgeschlagen: ${error.message || error}`);
  });
}

function ensureProjectServerDemoProjects(session) {
  const userId = projectServerUserId(session);
  if (projectServerSeededUsers.has(userId)) return Promise.resolve();
  if (projectServerSeedPromises.has(userId)) return projectServerSeedPromises.get(userId);
  const promise = seedProjectServerDemoProjects(session, userId)
    .then(() => { projectServerSeededUsers.add(userId); })
    .finally(() => { projectServerSeedPromises.delete(userId); });
  projectServerSeedPromises.set(userId, promise);
  return promise;
}

async function seedProjectServerDemoProjects(session, userId) {
  for (const definition of userIdeState.projectDefinitions) {
    await projectServerJson("/api/projects", {
      method: "POST",
      body: {
        project_id: definition.project_server_id,
        user_id: userId,
        plan_id: accountSubscription(session).plan_id,
        title: definition.title,
        description: definition.summary,
        learning_project_id: definition.learning_project_id,
        hardware_profile_id: definition.hardware_profile_id,
        device_id: definition.default_device_id,
        build_config: definition.build_config,
        view_manifest: projectViewManifest(definition),
        sources: demoProjectSources(definition),
      },
    }).catch((error) => {
      // Ein Seed ist keine Nutzeraktion und darf weder die Projektliste noch das Anlegen eigener Projekte blockieren.
      if (![400, 409].includes(error.status)) throw error;
    });
    await projectServerJson(`/api/projects/${encodeURIComponent(definition.project_server_id)}`, {
      method: "PATCH",
      body: {
        hardware_profile_id: definition.hardware_profile_id,
        device_id: definition.default_device_id || null,
        build_config: definition.build_config || null,
        view_manifest: projectViewManifest(definition),
      },
    }).catch((error) => {
      if (error.status !== 404) throw error;
    });
    for (const source of demoProjectSources(definition)) {
      await projectServerJson(`/api/projects/${encodeURIComponent(definition.project_server_id)}/sources`, {
        method: "PUT",
        body: source,
      });
    }
  }
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

function toPlatformProject(project) {
  const storedHardwareConfiguration = hardwareConfigurationFromManifest(project.view_manifest);
  const hardwareConfiguration = storedHardwareConfiguration
    ? normalizeHardwareConfiguration(storedHardwareConfiguration, project)
    : null;
  const platformProject = {
    detailsLoaded: true,
    id: project.project_server_id,
    ownerUserId: project.owner_user_id || "",
    name: project.title,
    description: project.summary,
    type: project.area || "guided_project",
    projectOrigin: project.project_origin || "account_project",
    sourceFiles: project.source_files || [{ path: "src/main.cpp", role: "user_code" }],
    targetRuntime: project.hardware_profile_id,
    linkedDeviceId: project.linked_device_id || project.default_device_id || "",
    linkedDeviceIds: project.linked_device_ids?.length
      ? project.linked_device_ids
      : project.linked_device_id || project.default_device_id ? [project.linked_device_id || project.default_device_id] : [],
    lastOpenedMode: project.last_opened_mode || "learn",
    lastOpenedAt: project.last_opened_at || "",
    createdAt: project.created_at || "",
    updatedAt: project.updated_at || "",
    slug: project.slug,
    courseId: project.course_id,
    lessonId: project.lesson_id,
    entryMode: project.entry_mode || "project_story",
    currentLessonId: project.current_lesson_id || "",
    entryMode: project.entry_mode || "project_story",
    developmentLessons: project.development_lessons || [],
    projectStory: project.project_story || null,
    projectLessonAssignments: project.project_lesson_assignments || [],
    requiredCapabilityIds: project.required_capability_ids,
    accessModel: project.access_model || "subscription",
    customerEntries: project.customer_entries || [],
    productStage: project.product_stage || "",
    buildConfig: project.build_config,
    softwareUnits: platformSoftwareUnits(project),
    activeSoftwareUnitId: platformActiveSoftwareUnitId(project),
    status: project.status,
    sourceCount: project.source_count,
    buildCount: project.build_count,
    viewManifest: projectViewManifestForClient(project.view_manifest),
    hardwareArchitecture: hardwareConfiguration ? {
      source: hardwareWiringPlantUml(hardwareConfiguration, project.title),
      title: "Hardware-Architektur",
      summary: "Vollstaendige Hardware-Realisierung des Projekts.",
    } : null,
    steps: project.steps,
  };
  if (project.project_origin === "catalog" || project.learning_project_id?.startsWith("learning_project.")) {
    platformProject.learningCategory = project.learning_category;
    platformProject.tags = project.tags || [];
  }
  return platformProject;
}

function projectViewManifestForClient(viewManifest) {
  if (!viewManifest?.architecture_dialog) return viewManifest;
  return {
    ...viewManifest,
    architecture_dialog: {
      ...viewManifest.architecture_dialog,
      messages: Array.isArray(viewManifest.architecture_dialog.messages)
        ? viewManifest.architecture_dialog.messages.slice(-12)
        : [],
    },
  };
}

function toPlatformProjectSummary(project) {
  const summary = {
    id: project.project_server_id,
    detailsLoaded: false,
    ownerUserId: project.owner_user_id || "",
    name: project.title,
    description: project.summary || "",
    type: project.area || "guided_project",
    projectOrigin: project.project_origin || "account_project",
    targetRuntime: project.hardware_profile_id || "",
    linkedDeviceId: project.linked_device_id || "",
    linkedDeviceIds: project.linked_device_ids || [],
    lastOpenedMode: project.last_opened_mode || "",
    lastOpenedAt: project.last_opened_at || "",
    createdAt: project.created_at || "",
    updatedAt: project.updated_at || "",
    slug: project.slug,
    courseId: project.course_id,
    lessonId: project.lesson_id,
    accessModel: project.access_model || "subscription",
    status: project.status,
    hasProjectApp: project.has_project_app === true,
  };
  if (project.project_origin === "catalog" || project.learning_project_id?.startsWith("learning_project.")) {
    summary.learningCategory = project.learning_category;
    summary.tags = project.tags || [];
  }
  return summary;
}

function getWorkspaceState(userId) {
  return userIdeState.workspaceStates.get(userId) || {
    userId,
    lastProjectId: "",
    lastMode: "learn",
    lastRoute: "/app/dashboard/",
    updatedAt: "",
  };
}

function touchWorkspace(session, projectId, mode, route) {
  return updateWorkspaceState(session, {
    lastProjectId: projectId,
    lastMode: mode,
    lastRoute: route,
  });
}

function updateWorkspaceState(session, input = {}) {
  const userId = projectServerUserId(session);
  const current = getWorkspaceState(userId);
  const updated = {
    userId,
    lastProjectId: input.lastProjectId || input.last_project_id || current.lastProjectId || "",
    lastMode: input.lastMode || input.last_mode || current.lastMode || "learn",
    lastRoute: input.lastRoute || input.last_route || current.lastRoute || "/app/dashboard/",
    updatedAt: new Date().toISOString(),
  };
  userIdeState.workspaceStates.set(userId, updated);
  return updated;
}

async function listLearningProgress(userId, projects) {
  return Promise.all(projects.map(async (project) => {
    const fallback = emptyPlatformLearningProgress(userId, project);
    if (project.project_origin !== "account_project" || !project.learning_project_id?.startsWith("learning_project.")) {
      return fallback;
    }
    return projectServerJson(
      `/api/projects/${encodeURIComponent(project.project_server_id)}/learning-progress?user_id=${encodeURIComponent(userId)}`,
    ).then((progress) => toPlatformLearningProgress(progress, project))
      .catch((error) => {
        if ([403, 404].includes(error.status)) return fallback;
        throw error;
      });
  }));
}

async function hasSubmittedLearningFeedback(userId, projectId) {
  const query = new URLSearchParams({ project_id: projectId, user_id: userId });
  const response = await projectServerJson(`/api/learning-feedback?${query}`);
  return (response.items || []).some((feedback) => feedback.category === "learning_experience_rating");
}

async function updateLearningProgress(session, input = {}) {
  const userId = projectServerUserId(session);
  const projectId = requiredField(input.projectId || input.project_id, "projectId");
  const project = await requireSessionProject(session, projectId);
  if (project.project_origin !== "account_project" || !project.learning_project_id?.startsWith("learning_project.")) {
    const error = new Error("Lernfortschritt kann nur fuer ein accountgebundenes Lernprojekt gespeichert werden.");
    error.status = 409;
    throw error;
  }
  const courseId = requiredField(project.course_id || input.courseId || input.course_id, "courseId");
  const lessonId = String(input.currentLessonId || input.current_lesson_id || input.lessonId || input.lesson_id || project.lesson_id || "");
  const currentStep = Number(input.currentStep ?? input.current_step ?? 0);
  const completedSteps = Array.from(new Set((input.completedSteps || input.completed_steps || []).map(Number))).sort((left, right) => left - right);
  const persisted = await projectServerJson(`/api/projects/${encodeURIComponent(projectId)}/learning-progress`, {
    method: "PUT",
    body: {
      user_id: userId,
      course_id: courseId,
      current_lesson_id: lessonId,
      current_step_id: input.currentStepId || input.current_step_id || "",
      current_step_index: currentStep,
      completed_step_indexes: completedSteps,
      completed_step_ids: input.completedStepIds || input.completed_step_ids || [],
      reset_progress: input.resetProgress === true || input.reset_progress === true,
    },
  });
  touchWorkspace(session, projectId, "learn", `/app/learn/?project=${encodeURIComponent(projectId)}`);
  return toPlatformLearningProgress(persisted, project);
}

function emptyPlatformLearningProgress(userId, project) {
  const firstView = project.view_manifest?.views?.[0] || {};
  return {
    id: `account_project_progress.${project.project_server_id}`,
    userId,
    courseId: project.course_id,
    lessonId: firstView.lesson_id || project.lesson_id || "",
    currentLessonId: firstView.lesson_id || "",
    currentStepId: firstView.id || "",
    projectId: project.project_server_id,
    status: "not_started",
    currentStep: 0,
    completedSteps: [],
    completedStepIds: [],
    lessonProgress: [],
    updatedAt: "",
  };
}

function toPlatformLearningProgress(progress, project) {
  return {
    id: progress.progress_id || `account_project_progress.${project.project_server_id}`,
    userId: progress.user_id || project.owner_user_id || "",
    courseId: project.course_id,
    lessonId: progress.current_lesson_id || project.lesson_id || "",
    currentLessonId: progress.current_lesson_id || "",
    currentStepId: progress.current_step_id || "",
    projectId: progress.project_id || project.project_server_id,
    entryMode: progress.entry_mode || project.entry_mode || "project_story",
    status: progress.status || "not_started",
    currentStep: Number(progress.current_step_index || 0),
    completedSteps: progress.completed_step_indexes || [],
    completedStepIds: progress.completed_step_ids || [],
    lessonProgress: (progress.lesson_progress || []).map((lesson) => ({
      lessonId: lesson.lesson_id,
      status: lesson.status,
      currentStepId: lesson.current_step_id,
      currentStep: lesson.current_step_index,
      completedStepIds: lesson.completed_step_ids || [],
      completedSteps: lesson.completed_step_indexes || [],
      globalStepIndex: lesson.global_step_index || 0,
    })),
    startedAt: progress.started_at || "",
    updatedAt: progress.last_seen_at || "",
    completedAt: progress.completed_at || "",
  };
}

async function loadBillingSummary(session, existingAiUsage = null) {
  const aiUsage = existingAiUsage || await loadAiUsageSummary(session);
  const subscription = accountSubscription(session);
  const accountId = projectServerUserId(session);
  const resources = await ensureAccountResourcePlan(session)
    .catch((error) => ({ available: false, error: error.message || String(error) }));
  return {
    account_id: accountId,
    plan: subscription.plan,
    plan_id: subscription.plan_id,
    configured_plan_id: session.account?.subscription_plan || "free",
    plan_valid_until: session.account?.plan_valid_until || null,
    lifecycle_state: session.account?.lifecycle_state || "active",
    grace_until: session.account?.grace_until || null,
    entitlements: subscription.entitlements,
    resources,
    ai_credits: aiUsage.credits,
    ai_credit_packages: aiUsage.credit_packages || [],
  };
}

async function ensureAccountResourcePlan(session) {
  const subscription = accountSubscription(session);
  const accountId = projectServerUserId(session);
  const cacheKey = `${accountId}\u0000${subscription.plan_id}`;
  const cached = accountResourcePlanCache.get(cacheKey);
  if (cached && cached.expires_at > Date.now()) return cached.value;
  if (accountResourcePlanLoads.has(cacheKey)) return accountResourcePlanLoads.get(cacheKey);
  const load = projectServerJson(`/api/internal/accounts/${encodeURIComponent(accountId)}/resource-plan`, {
    method: "PUT",
    body: { plan_id: subscription.plan_id },
  }).then((value) => {
    accountResourcePlanCache.set(cacheKey, { value, expires_at: Date.now() + accountResourcePlanCacheMs });
    return value;
  }).finally(() => accountResourcePlanLoads.delete(cacheKey));
  accountResourcePlanLoads.set(cacheKey, load);
  return load;
}

async function updateAccountProjectSelection(session, input = {}) {
  const subscription = accountSubscription(session);
  const accountId = projectServerUserId(session);
  const activeProjectIds = Array.from(new Set((input.active_project_ids || []).map(String).filter(Boolean)));
  const result = await projectServerJson(`/api/internal/accounts/${encodeURIComponent(accountId)}/resource-plan`, {
    method: "PUT",
    body: {
      plan_id: subscription.plan_id,
      active_project_ids: activeProjectIds,
    },
  });
  for (const key of accountResourcePlanCache.keys()) {
    if (key.startsWith(`${accountId}\u0000`)) accountResourcePlanCache.delete(key);
  }
  accountResourcePlanCache.set(`${accountId}\u0000${subscription.plan_id}`, {
    value: result,
    expires_at: Date.now() + accountResourcePlanCacheMs,
  });
  return result;
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
  updateCachedSessionAccount(req, result.account);
  return result.account;
}

function accountSubscription(session) {
  const account = session?.account || {};
  const configuredPlan = effectiveSubscriptionPlan({
    subscription_plan: account.subscription_plan || account.plan || defaultAccountPlan,
    plan_valid_until: account.plan_valid_until || null,
  });
  const premium = ["premium", "premium_demo", "premium-demo"].includes(configuredPlan);
  return {
    plan_id: premium ? configuredPlan.replace("-", "_") : "free",
    plan: premium ? "Premium" : "Basis",
    entitlements: premium
      ? ["learn_guided_projects", "ide_edit_code", "build_and_flash", "ai_assistant", "web_push", "project_history"]
      : ["ide_edit_code", "build_and_flash"],
  };
}

function hasEntitlements(session, requiredEntitlements = []) {
  const granted = new Set(accountSubscription(session).entitlements);
  return (requiredEntitlements || []).every((entitlement) => granted.has(entitlement));
}

function requireEntitlement(res, session, entitlement) {
  return requireEntitlements(res, session, [entitlement]);
}

function requireEntitlements(res, session, requiredEntitlements = []) {
  if (hasEntitlements(session, requiredEntitlements)) return true;
  sendJson(res, 403, {
    error: "premium_required",
    message: "Diese Funktion ist nur mit einem Premium-Abo verfuegbar.",
    required_entitlements: requiredEntitlements,
    help_url: "/hilfe/#ai-premium",
  });
  return false;
}

async function loadHardwareShopSummary(session) {
  const devices = await loadUserIdeDevices(session);
  const offers = await hardwareShopJson("/api/hardware-shop/offers");
  const projects = userIdeState.projectDefinitions;
  const recommendations = [];
  for (const project of projects) {
    const match = await hardwareShopJson("/api/hardware-shop/match", {
      method: "POST",
      body: {
        required_capability_ids: project.required_capability_ids,
        owned_capability_ids: ownedCapabilityIds(devices),
      },
    });
    recommendations.push({
      project_slug: project.slug,
      project_title: project.title,
      required_capability_ids: project.required_capability_ids,
      matches: match.items.slice(0, 3),
    });
  }
  return {
    base_url: hardwareShopBaseUrl,
    account_id: projectServerUserId(session),
    offers: offers.items,
    recommendations,
  };
}

async function loadUserIdeDevices(session) {
  const accountId = projectServerUserId(session);
  const response = await deviceManagementJson(`/api/device-management/accounts/${encodeURIComponent(accountId)}/devices`);
  return (response.items || []).map(decorateUserIdeDevice);
}

async function loadAccountBoardConfigurations(session) {
  const accountId = projectServerUserId(session);
  const response = await deviceManagementJson(`/api/device-management/accounts/${encodeURIComponent(accountId)}/board-configurations`);
  return response.items || [];
}

async function loadAvailableProcessorBoards(session) {
  const systemBoards = await loadProcessorBoards();
  const accountBoards = await loadAccountBoardConfigurations(session);
  return [
    ...systemBoards.map((board) => ({ ...board, configuration_scope: "gernetix", base_board_profile_id: board.hardware_item_id })),
    ...accountBoards.map((board) => accountBoardAsProcessorBoard(board, systemBoards)).filter(Boolean),
  ];
}

function accountBoardAsProcessorBoard(accountBoard, systemBoards) {
  const base = systemBoards.find((board) => [board.hardware_item_id, board.hardware_profile_id, board.id]
    .filter(Boolean).some((id) => String(id) === String(accountBoard.base_board_profile_id)));
  if (!base) return null;
  const selectionId = `account_board:${accountBoard.account_board_id}:v${accountBoard.version}`;
  return {
    ...base,
    hardware_item_id: selectionId,
    hardware_profile_id: selectionId,
    id: selectionId,
    title: `${accountBoard.name} · Mein Board`,
    configuration_scope: "account",
    account_board_id: accountBoard.account_board_id,
    account_board_version: accountBoard.version,
    base_board_profile_id: accountBoard.base_board_profile_id,
    default_instance_configuration: {
      ...(base.default_instance_configuration || {}),
      board_features: mergeBoardFeatures(
        base.default_instance_configuration?.board_features,
        accountBoard.board_features,
      ),
    },
  };
}

function decorateUserIdeDevice(device) {
  return {
    device_id: device.device_id,
    account_device_id: device.account_device_id,
    display_name: device.display_name,
    node_name: device.node_name || "",
    hostname: device.hostname || device.node_name || "",
    hardware_profile_id: device.hardware_profile_id,
    hardware_class: device.hardware_class || device.instance_configuration?.role || "",
    technical_capability_ids: device.technical_capability_ids || [],
    instance_configuration: device.instance_configuration || {},
    authenticity_status: device.authenticity_status,
    connectivity_status: device.connectivity_status,
    last_seen_at: device.last_seen_at || "",
    firmware_version: device.app_version || device.runtime_version || device.firmware_version || "",
    battery_percent: device.battery_percent ?? device.instance_configuration?.battery_percent ?? null,
    ota_status: device.ota_status,
    usb_flash_supported: isUsbFlashDevice(device),
    upload_port: defaultUploadPort(device),
    build_config: deviceBuildConfig(device),
    build_target_label: buildTargetLabel(device),
    ownership_status: device.ownership_status,
    voice_ai_policy: device.voice_ai_policy || {
      enabled: false,
      age_band: "child_6_12",
      max_recording_seconds: 15,
      max_reply_seconds: 20,
      raw_audio_retention: "transient_only",
      transcript_retention: "disabled",
    },
    purchase_context_id: device.purchase_context_id || "",
    hardware_unit_id: device.instance_configuration?.hardware_unit_id || "",
  };
}

async function handlePlatformFlashboxClaim(req, res, session) {
  try {
    const body = await readJsonBody(req);
    const accountId = projectServerUserId(session);
    const result = await deviceManagementJson(`/api/device-management/accounts/${encodeURIComponent(accountId)}/hardware-unit-claims`, {
      method: "POST",
      body: {
        claim_code: requiredField(body.claim_code || body.claimCode, "claim_code"),
        display_name: body.display_name || body.displayName || "GerNetiX Flashbox",
      },
    });
    sendJson(res, 201, {
      hardware_unit: result.hardware_unit,
      device: decorateUserIdeDevice(result.account_device),
    });
  } catch (error) {
    sendJson(res, error.status || 400, {
      error: error.code || "flashbox_claim_failed",
      message: error.message || "Flashbox konnte nicht inventarisiert werden.",
      details: error.payload || {},
    });
  }
}

async function handleHardwareShopOrder(req, res, session) {
  const body = await readJsonBody(req);
  const offerId = String(body.offer_id || "").trim();
  if (!offerId) {
    sendJson(res, 400, { error: "missing_offer_id", message: "offer_id fehlt." });
    return;
  }
  const cart = await hardwareShopJson("/api/hardware-shop/carts", {
    method: "POST",
    body: { account_id: projectServerUserId(session) },
  });
  await hardwareShopJson(`/api/hardware-shop/carts/${encodeURIComponent(cart.cart_id)}/items`, {
    method: "POST",
    body: { offer_id: offerId, quantity: Number(body.quantity || 1) },
  });
  const order = await hardwareShopJson("/api/hardware-shop/orders", {
    method: "POST",
    body: { cart_id: cart.cart_id, payment_status: "paid" },
  });
  const purchaseContext = await hardwareShopJson(`/api/hardware-shop/orders/${encodeURIComponent(order.order_id)}/purchase-context`);
  const deviceManagementPurchaseContext = await deviceManagementJson(`/api/device-management/accounts/${encodeURIComponent(projectServerUserId(session))}/purchase-contexts`, {
    method: "POST",
    body: {
      order_id: order.order_id,
      ...purchaseContext,
    },
  });
  sendJson(res, 201, {
    order,
    purchase_context: purchaseContext,
    device_management_purchase_context: deviceManagementPurchaseContext,
  });
}

async function loadAiUsageSummary(session) {
  const accountId = projectServerUserId(session);
  try {
    const [credits, rating, dashboard, creditPackages] = await Promise.all([
      aiUsageJson(`/api/ai-usage/accounts/${encodeURIComponent(accountId)}/credits`),
      aiUsageJson(`/api/ai-usage/accounts/${encodeURIComponent(accountId)}/rating`),
      aiUsageJson("/api/ai-usage/admin/dashboard"),
      aiUsageJson("/api/ai-usage/credit-packages"),
    ]);
    return {
      base_url: aiUsageBaseUrl,
      available: true,
      credits,
      credit_packages: creditPackages.items || [],
      rating,
      usage_events: dashboard.summary,
      account_usage: (dashboard.by_account || []).find((item) => item.account_id === accountId) || null,
      model_summary: dashboard.by_model,
    };
  } catch (error) {
    return {
      base_url: aiUsageBaseUrl,
      available: false,
      credits: {
        account_id: accountId,
        available_credits: 0,
        consumed_credits: 0,
      },
      credit_packages: [],
      rating: {
        account_id: accountId,
        used_percent: 0,
        sources: [],
      },
      usage_events: {},
      account_usage: null,
      model_summary: [],
      error: error.message || "AI Usage Service ist nicht erreichbar.",
    };
  }
}

function latestBuildStatus(project) {
  return project && project.build_count > 0 ? `${project.build_count} BuildJob(s)` : "";
}

async function loadBuildDeployJob(jobId, options = {}) {
  const projectJob = await projectServerJson(`/api/build-jobs/${encodeURIComponent(jobId)}`, options).catch(() => null);
  const client = projectJob?.mode === "build_and_flash" ? otaBuildDeployJson : buildDeployJson;
  return client(`/api/build-jobs/${encodeURIComponent(jobId)}`, options);
}

function toBuildDeployPackage(buildPackage, device = {}, project = {}) {
  const files = Object.fromEntries((buildPackage.files || []).map((file) => [file.path, file.content]));
  const buildConfig = resolveBuildConfig(project, device);
  if (buildConfig && !buildConfig.firmware_basis_id && !files["platformio.ini"]) {
    files["platformio.ini"] = renderPlatformioIni(buildConfig);
  }
  return {
    package_id: buildPackage.package_id,
    contract: buildPackage.contract,
    files,
  };
}

function resolveBuildConfig(project = {}, device = {}) {
  if (project.view_manifest?.template_id === "touchscreen_game_collection") return project.build_config || null;
  if (project.slug === "arduino-atmel-bare-metal" && project.build_config) return project.build_config;
  if (project.build_config?.firmware_basis_id) {
    return {
      ...project.build_config,
      board: device.build_config?.board || project.build_config.board,
      environment: device.build_config?.environment || project.build_config.environment,
      firmware_basis_variant: project.build_config.firmware_basis_variant || "comfort",
    };
  }
  return device.build_config || project.build_config || null;
}

function touchscreenGameBuildConfigurationProblems(project = {}, buildConfig = {}) {
  const problems = [];
  const baseBoardProfileId = String(buildConfig?.board_configuration?.base_board_profile_id || project.hardware_profile_id || "");
  if (baseBoardProfileId !== "hardware.processor_board.esp32_s3_es3c28p") problems.push(`Board ${baseBoardProfileId || "nicht gesetzt"}`);
  if (buildConfig?.platform !== "espressif32") problems.push(`Plattform ${buildConfig?.platform || "nicht gesetzt"}`);
  if (buildConfig?.framework !== "espidf") problems.push(`Framework ${buildConfig?.framework || "nicht gesetzt"}`);
  if (buildConfig?.board !== "4d_systems_esp32s3_gen4_r8n16") problems.push(`Build-Board ${buildConfig?.board || "nicht gesetzt"}`);
  if (buildConfig?.environment !== "es3c28p") problems.push(`Umgebung ${buildConfig?.environment || "nicht gesetzt"}`);
  if (Number(buildConfig?.flash_size_mb) !== 16) problems.push(`Flash ${buildConfig?.flash_size_mb || "nicht gesetzt"} MB`);
  if (buildConfig?.firmware_basis_id !== "gernetix-runtime-basissoftware") problems.push(`Basissoftware ${buildConfig?.firmware_basis_id || "nicht gesetzt"}`);
  if (buildConfig?.firmware_basis_variant !== "full") problems.push(`Basisprofil ${buildConfig?.firmware_basis_variant || "nicht gesetzt"}`);
  if (buildConfig?.user_source_path !== "src/user_main.cpp") problems.push(`Einstieg ${buildConfig?.user_source_path || "nicht gesetzt"}`);
  if (buildConfig?.user_target_path !== "src/user/user_app.cpp") problems.push(`Basis-Einstieg ${buildConfig?.user_target_path || "nicht gesetzt"}`);
  return problems;
}

function toProjectBuildResult(buildDeployJob) {
  const artifacts = buildDeployJob.result?.build?.artifacts || {};
  return {
    status: buildDeployJob.status,
    build: buildDeployJob.result?.build || null,
    deploy: buildDeployJob.result?.deploy || null,
    flashbox: buildDeployJob.result?.flashbox || null,
    error: buildDeployJob.error || null,
    artifacts: Object.values(artifacts).map((artifact) => ({
      file_name: artifact.file_name,
      url: artifact.download_url,
      sha256: artifact.sha256,
      size_bytes: artifact.size_bytes,
      artifact_type: artifact.file_name === "build.log" ? "build_log" : "firmware",
    })),
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function createUserIdeState() {
  const projects = [
    project("arduino-blink", "Arduino Blink", "Firmware", "Kleines Blink-Projekt fuer den ersten USB-Flash auf ein Arduino-kompatibles Board.", [
      step("Projekt waehlen", "Arduino Blink ist das kleinste sinnvolle Firmware-Projekt fuer Arduino-kompatible Boards.", "Der Sketch bleibt gleich, das Boardprofil bestimmt die Zielplattform."),
      step("Board anschliessen", "Ein ESP32 DevKit, Arduino Nano oder ein anderes Arduino-kompatibles Board haengt per USB am Rechner.", "USB-Flash ist der schnellste lokale MVP-Nachweis."),
      step("Flash starten", "Die IDE startet Build und Upload ueber den Build-&-Deploy-Server.", "Der Button prueft die Plattformkette Ende zu Ende."),
    ], {
      learning_category: "embedded",
      tags: ["platform:arduino", "platform:esp32", "topic:firmware", "level:beginner"],
    }),
    project("arduino-atmel-bare-metal", "Arduino Atmel/AVR ohne Arduino", "Firmware", "Bare-Metal-Basissoftware fuer Arduino-kompatible AVR-Boards mit avr-libc, Build und USB-Flash.", [
      step("Runtime waehlen", "Dieses Projekt nutzt ein Arduino-kompatibles AVR-Board ohne Arduino-Framework.", "Die Board-Hardware bleibt Arduino-kompatibel, die Software spricht aber direkt AVR-Register an."),
      step("User-Datei bearbeiten", "Deine Logik liegt in src/user/user_app.c; main.c bleibt geschuetzte Basissoftware.", "Basis und User-Code bleiben getrennt."),
      step("Build starten", "Die IDE baut das Projekt mit PlatformIO fuer atmelavr/nanoatmega328.", "Das Ergebnis ist fuer AVR typischerweise eine firmware.hex."),
      step("USB-Flash starten", "Der Flash-Button nutzt den ausgewaehlten Arduino Nano und den COM-Port.", "Build und Upload laufen ueber denselben Build-&-Deploy-Pfad wie andere Firmware-Projekte."),
    ], {
      hardware_profile_id: "hardware.processor_board.arduino_nano_r3_atmega328p",
      default_device_id: "device_arduino_nano_1",
      build_config: {
        environment: "uno",
        platform: "atmelavr",
        board: "uno",
        framework: "",
        monitorSpeed: "9600",
      },
      source_files: [{ path: "src/user/user_app.c", role: "user_code" }],
      learning_category: "embedded",
      tags: ["platform:arduino", "platform:avr", "topic:bare-metal"],
    }),
    tamagotchiEntryCourseModel.createProject(project, step),
    nexiCourseModel.createProject(project, step),
    smartAssistantCourseModel.createProject(project, step),
    buttonToSmartphoneNotificationCourseModel.createProject(project, step),
    homeAutomationNetworkCourseModel.createProject(project, step),
    homeAutomationSensorsCourseModel.createProject(project, step),
    motorControlBasicsCourseModel.createProject(project, step),
    proximitySensorRadarCourseModel.createProject(project, step),
    programmingFundamentalsCourseModel.createProject(project, step),
    microcontrollerFundamentalsCourseModel.createProject(project, step),
    umlFundamentalsCourseModel.createProject(project, step),
    requirementsWorkshopCourseModel.createProject(project, step),
    yamlFundamentalsCourseModel.createProject(project, step),
    storageLearningStoryCourseModel.createProject(project, step),
    radioTechnologiesCourseModel.createProject(project, step),
    measurementToolsBasicsCourseModel.createProject(project, step),
    esp32CameraStreamingCourseModel.createProject(project, step),
    project("plant-watering-control", "Pflanzenbewaesserung", "Sensor und Aktor", "Feuchtigkeit messen und eine Pumpe kontrolliert schalten.", [
      step("Nutzen und Risiko", "Die Pflanze soll Wasser bekommen, ohne Ueberschwemmung.", "Automatisierung braucht Grenzen."),
      step("Sensor lesen", "Bodenfeuchte wird zur Eingangsseite der Steuerung.", "Ein Sensor liefert Hinweise, keine fertige Entscheidung."),
      step("Pumpe schalten", "Die Pumpe ist die Ausgangsseite des Systems.", "Aktorik macht Software in der Welt wirksam."),
      step("Sicherheit", "Laufzeitbegrenzung und Fehlerfaelle gehoeren zur Funktion.", "Sichere Software plant Stoerungen mit ein."),
    ], {
      learning_category: "embedded",
      tags: ["platform:esp32", "topic:sensors", "topic:actuators"],
    }),
  ];

  return {
    projectDefinitions: projects,
    lessonManifestOverrides: new Map(),
    workspaceStates: new Map(),
    devices: [
      {
        device_id: "device_verified_1",
        display_name: "Sven ESP32 DevKit",
        hardware_profile_id: "hardware.processor_board.generic_esp_wroom32",
        authenticity_status: "gernetix_verified",
        connectivity_status: "online",
        ota_status: "ready",
      },
      {
        device_id: "device_community_1",
        display_name: "Keller Sensor ESP32",
        hardware_profile_id: "hardware.processor_board.esp32_unknown",
        authenticity_status: "community_unverified",
        connectivity_status: "offline",
        ota_status: "unknown",
      },
    ],
    builds: [],
  };
}

function project(slug, title, area, summary, steps, options = {}) {
  const requiredCapabilitiesBySlug = {
    "software-engineering-tamagotchi": [],
    "arduino-blink": ["capability.arduino_framework_runtime", "capability.flash_firmware"],
    "arduino-atmel-bare-metal": ["capability.atmel_avr_bare_metal_runtime", "capability.flash_firmware"],
    "plant-watering-control": ["capability.processor_esp32", "capability.wifi", "capability.digital_output"],
  };
  const accessModelsBySlug = {
    "arduino-blink": "free",
    "software-engineering-tamagotchi": "free",
    "arduino-atmel-bare-metal": "subscription",
    "smart-assistant-ai-automation": "subscription",
    "plant-watering-control": "purchased",
  };
  const learningCategory = normalizeLearningProjectCategory(options.learning_category);
  const learningTags = normalizeLearningProjectTags(options.tags);
  const projectLessonAssignments = Array.isArray(options.project_lesson_assignments)
    ? options.project_lesson_assignments
    : [];
  const developmentLessons = projectLessonAssignments.length
    ? developmentLessonCatalog.resolveProjectLessons(projectLessonAssignments)
    : options.development_lessons || [];
  return {
    slug,
    project_server_id: `project_${slug}`,
    learning_project_id: `learning_project.${slug.replace(/-/g, "_")}`,
    course_id: `course.${slug.replace(/-/g, "_")}`,
    lesson_id: `lesson.${slug.replace(/-/g, "_")}.intro`,
    hardware_profile_id: Object.hasOwn(options, "hardware_profile_id") ? options.hardware_profile_id : "hardware.processor_board.generic_esp_wroom32",
    default_device_id: Object.hasOwn(options, "default_device_id") ? options.default_device_id : "device_verified_1",
    build_config: options.build_config || undefined,
    source_files: options.source_files || [{ path: "src/main.cpp", role: "user_code" }],
    required_capability_ids: Object.hasOwn(options, "required_capability_ids")
      ? options.required_capability_ids
      : (requiredCapabilitiesBySlug[slug] || ["capability.processor_esp32"]),
    access_model: options.access_model || accessModelsBySlug[slug] || "subscription",
    customer_entries: Array.isArray(options.customer_entries) ? options.customer_entries : [],
    learning_category: learningCategory,
    product_stage: String(options.product_stage || ""),
    tags: learningTags,
    project_lesson_assignments: projectLessonAssignments,
    development_lessons: developmentLessons,
    project_story: options.project_story || null,
    title,
    area,
    summary,
    status: "bereit",
    last_build_status: "",
    steps,
  };
}

function normalizeLearningProjectCategory(value) {
  const category = String(value || "").trim();
  const knownCategories = ["software_engineering", "desktop", "embedded", "distributed_system", "mobile"];
  if (!knownCategories.includes(category)) {
    throw new Error(`Unknown learning project category: ${category || "(empty)"}`);
  }
  return category;
}

function normalizeLearningProjectTags(value) {
  const knownTags = [
    "client:mobile",
    "level:beginner",
    "platform:arduino",
    "platform:avr",
    "platform:esp32",
    "platform:raspberry-pi",
    "platform:stm32",
    "protocol:mqtt",
    "runtime:browser",
    "topic:actuators",
    "topic:ai",
    "topic:automation",
    "topic:audio",
    "topic:bare-metal",
    "topic:firmware",
    "topic:home-automation",
    "topic:modeling",
    "topic:motor-control",
    "topic:privacy",
    "topic:programming",
    "topic:requirements-engineering",
    "topic:microcontroller",
    "topic:measurement",
    "topic:radar",
    "topic:radio",
    "topic:camera",
    "topic:networking",
    "topic:sensors",
    "topic:data",
    "topic:databases",
    "topic:storage",
    "topic:video",
    "topic:web-push",
    "topic:yaml",
  ];
  const tags = Array.from(new Set((Array.isArray(value) ? value : []).map((item) => String(item).trim()).filter(Boolean)));
  const unknownTag = tags.find((tag) => !knownTags.includes(tag));
  if (unknownTag) throw new Error(`Unknown learning project tag: ${unknownTag}`);
  return tags;
}

function ownedCapabilityIds(devices) {
  const capabilities = new Set();
  for (const device of devices) {
    for (const capability of device.technical_capability_ids || []) capabilities.add(`capability.${capability}`);
    if (device.hardware_profile_id === "hardware.processor_board.generic_esp_wroom32") {
      capabilities.add("capability.processor_esp32");
      capabilities.add("capability.wifi");
      if (device.ota_status === "ready") capabilities.add("capability.ota");
    }
  }
  return Array.from(capabilities);
}

function normalizeCapabilityIds(value) {
  const list = Array.isArray(value)
    ? value
    : String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
  return Array.from(new Set(list.map((item) => String(item).replace(/^capability\./, "")).filter(Boolean)));
}

function step(title, text, insight) {
  return { title, text, insight };
}

function primarySourcePath(project) {
  return project.source_files?.[0]?.path || "src/main.cpp";
}

function projectViewManifest(project, options = {}) {
  const override = userIdeState.lessonManifestOverrides.get(project.slug);

  if (project.slug === tamagotchiEntryCourseModel.slug) {
    return tamagotchiEntryCourseModel.createViewManifest(project, {
      override,
      primarySourcePath,
    });
  }
  if (project.slug === smartAssistantCourseModel.slug) {
    return smartAssistantCourseModel.createViewManifest(project, {
      override,
      primarySourcePath,
    });
  }
  if (project.slug === nexiCourseModel.slug) {
    return nexiCourseModel.createViewManifest(project, {
      override,
      primarySourcePath,
    });
  }
  if (project.slug === homeAutomationNetworkCourseModel.slug) {
    return homeAutomationNetworkCourseModel.createViewManifest(project, {
      override,
      primarySourcePath,
    });
  }
  if (project.slug === homeAutomationSensorsCourseModel.slug) {
    return homeAutomationSensorsCourseModel.createViewManifest(project, {
      override,
      primarySourcePath,
    });
  }
  if (project.slug === motorControlBasicsCourseModel.slug) {
    return motorControlBasicsCourseModel.createViewManifest(project, {
      override,
      primarySourcePath,
    });
  }
  if (project.slug === buttonToSmartphoneNotificationCourseModel.slug) {
    return buttonToSmartphoneNotificationCourseModel.createViewManifest(project, {
      override,
      primarySourcePath,
    });
  }
  if (project.slug === proximitySensorRadarCourseModel.slug) {
    return proximitySensorRadarCourseModel.createViewManifest(project, {
      override,
      primarySourcePath,
    });
  }
  if (project.slug === programmingFundamentalsCourseModel.slug) {
    return programmingFundamentalsCourseModel.createViewManifest(project, {
      override,
      primarySourcePath,
    });
  }
  if (project.slug === microcontrollerFundamentalsCourseModel.slug) {
    return microcontrollerFundamentalsCourseModel.createViewManifest(project, {
      override,
      primarySourcePath,
    });
  }
  if (project.slug === umlFundamentalsCourseModel.slug) {
    return umlFundamentalsCourseModel.createViewManifest(project, {
      override,
      primarySourcePath,
    });
  }
  if (project.slug === requirementsWorkshopCourseModel.slug) {
    return requirementsWorkshopCourseModel.createViewManifest(project, {
      override,
      primarySourcePath,
    });
  }
  if (project.slug === yamlFundamentalsCourseModel.slug) {
    return yamlFundamentalsCourseModel.createViewManifest(project, {
      override,
      primarySourcePath,
    });
  }
  if (project.slug === storageLearningStoryCourseModel.slug) {
    return storageLearningStoryCourseModel.createViewManifest(project, {
      lessonId: options.lessonId || "",
      override,
      primarySourcePath,
    });
  }
  if (project.slug === radioTechnologiesCourseModel.slug) {
    return radioTechnologiesCourseModel.createViewManifest(project, {
      override,
      primarySourcePath,
    });
  }
  if (project.slug === measurementToolsBasicsCourseModel.slug) {
    return measurementToolsBasicsCourseModel.createViewManifest(project, {
      override,
      primarySourcePath,
    });
  }
  if (project.slug === esp32CameraStreamingCourseModel.slug) {
    return esp32CameraStreamingCourseModel.createViewManifest(project, {
      lessonId: options.lessonId || "",
      override,
      primarySourcePath,
    });
  }

  return {
    schema_version: 1,
    title: `${project.title} Projektansicht`,
    summary: project.summary,
    primary_source_path: primarySourcePath(project),
    mode: "guided_ide",
    views: [
      {
        id: "source-analysis",
        type: "source_analysis",
        title: "Quellcode analysieren",
        summary: "Primaere Projektdatei lesen, verstehen und bearbeiten.",
        source_path: primarySourcePath(project),
      },
      {
        id: "implementation-plan",
        type: "implementation_plan",
        title: "Naechste Schritte",
        summary: "Projektmanifest kann spaeter weitere Erklaerungen, Diagramme und Pruefungen enthalten.",
        payload: {
          tasks: project.steps.map((item) => item.title),
        },
      },
    ],
  };
}

function developmentProjectViewManifest({ title, description = "", source = "", diagram = null, buildConfig = null, architectureDialog = null, templateId = "", templateModelVersion = 1, hardwareConfiguration = null, communicationSetup = null, homeAutomationConfiguration = null, gameConfiguration = null, pwaDashboardConfiguration = null, dataLoggerConfiguration = null, eventConfiguration = null }) {
  const buildable = Boolean(buildConfig);
  const usesProjectTemplate = Boolean(templateId && templateId !== "empty");
  const derivedFrom = diagram?.derived_from || (usesProjectTemplate || buildable ? "project_template" : "persisted_project");
  const plantUmlSource = normalizeArchitecturePlantUml(stripPlantUmlNotes(source || diagram?.source || ""), derivedFrom);
  return {
    schema_version: 1,
    title: `${title || "Entwicklungsprojekt"} Architektur`,
    summary: description || "Projektgebundene Architektur-Discovery mit PlantUML-Skizze.",
    template_id: String(templateId || ""),
    ...(templateId ? { template_ref: { template_id: String(templateId), model_schema_version: Number(templateModelVersion) || 1 } } : {}),
    primary_source_path: buildable ? (buildConfig.user_source_path || "Komponenten/IoT-Device 1/src/user_main.cpp") : "docs/architecture.puml",
    hide_source_editor: !buildable,
    mode: "architecture_discovery",
    ...(architectureDialog ? { architecture_dialog: normalizeArchitectureDialog(architectureDialog, diagram || { source: plantUmlSource }) } : {}),
    ...(communicationSetup ? { communication_setup: normalizeProjectCommunicationSetup(communicationSetup) } : {}),
    ...(homeAutomationConfiguration ? { home_automation_configuration: normalizeHomeAutomationConfiguration(homeAutomationConfiguration) } : {}),
    ...(gameConfiguration ? { game_configuration: normalizeTouchscreenGameConfiguration(gameConfiguration) } : {}),
    ...(pwaDashboardConfiguration ? { pwa_dashboard: normalizePwaDashboardConfiguration(pwaDashboardConfiguration) } : {}),
    ...(dataLoggerConfiguration ? { data_logger: normalizeDataLoggerConfiguration(dataLoggerConfiguration) } : {}),
    ...(eventConfiguration ? { event_configuration: eventConfiguration } : {}),
    views: [
      ...(buildable ? [{
        id: "firmware-source",
        type: "source_analysis",
        title: "IoT-Device 1 User Main",
        summary: "Account- und projektgebundene User-Main; die geschuetzte GerNetiX-Basissoftware wird erst im BuildPackage ergaenzt.",
        source_path: buildConfig.user_source_path || "Komponenten/IoT-Device 1/src/user_main.cpp",
      }] : []),
      ...(plantUmlSource ? [{
        id: "architecture-diagram",
        type: "plantuml",
        title: diagram?.title || "Architektur-Skizze",
        summary: diagram?.summary || "Aus Architektur-Discovery gespeicherte PlantUML-Skizze.",
        source_path: "docs/architecture.puml",
        validation: { type: "plantuml_contains", must_contain: ["@startuml", "@enduml"] },
        payload: {
          source: plantUmlSource,
          derived_from: derivedFrom,
          ...(diagram?.function_coverage ? { function_coverage: diagram.function_coverage } : {}),
        },
      }] : []),
      ...(hardwareConfiguration ? [{
        id: "hardware-configuration",
        type: "hardware_configuration",
        title: "Hardware-Architektur",
        summary: "Vollstaendige Zuordnung von Prozessoren, Boards, Inventar-Devices, Sensoren, Aktoren, Messschaltungen und Pins.",
        source_path: "Architektur/verdrahtung/hardware.puml",
        payload: hardwareConfiguration,
      }] : []),
      {
        id: "implementation-plan",
        type: "implementation_plan",
        title: "Naechste Schritte",
        summary: "Aus der Zielarchitektur werden spaeter konkrete Umsetzungsschritte abgeleitet.",
        payload: {
          tasks: [
            "Offene Architekturfragen klaeren",
            "Zielsysteme und Datenfluesse bestaetigen",
            "Technologieentscheidungen erst nach Bestaetigung festlegen",
          ],
        },
      },
    ],
  };
}

function initialArchitecturePlantUml(title) {
  return [
    "@startuml",
    `title Architektur-Skizze: ${String(title || "Neues Entwicklungsprojekt").replace(/"/g, "'")}`,
    "",
    "rectangle \"Projektidee / Anforderungen\" as requirements",
    "@enduml",
  ].join("\n");
}

function provisioningFirmwareRequest(searchParams) {
  const profile = String(searchParams.get("profile") || "").trim().toLowerCase();
  if (!new Set(["full", "medium", "low"]).has(profile)) {
    const error = new Error("Bitte zuerst ein Update- und Speicherprofil auswaehlen.");
    error.status = 400;
    error.code = "invalid_basissoftware_profile";
    throw error;
  }
  const hardwareProfileId = String(searchParams.get("hardware_profile_id") || "").trim();
  const flashSizeMb = Number.parseInt(String(searchParams.get("flash_size_mb") || ""), 10);
  if (!hardwareProfileId || ![4, 8, 16].includes(flashSizeMb)) {
    const error = new Error("Boardmodell und bestaetigte Flashgroesse werden fuer das Provisioning benoetigt.");
    error.status = 400;
    error.code = "provisioning_board_configuration_required";
    throw error;
  }
  return { profile, hardwareProfileId, flashSizeMb };
}

async function resolveProvisioningFirmwareArtifact({ profile, hardwareProfileId, flashSizeMb }) {
  let board;
  try {
    board = await hardwareCatalogJson(`/api/hardware-catalog/hardware-items/${encodeURIComponent(hardwareProfileId)}`);
  } catch (cause) {
    const error = new Error("Das ausgewaehlte Board konnte im Hardware-Katalog nicht fuer das Provisioning aufgeloest werden.");
    error.status = cause.status === 404 ? 404 : 502;
    error.code = "provisioning_hardware_catalog_unavailable";
    throw error;
  }
  const targetId = String(board.firmware_build_target_id || "");
  const target = getFirmwareBuildTarget(targetId);
  if (!target) {
    const error = new Error("Dieses Board besitzt noch kein exakt freigegebenes Firmware-Build-Target. Es wird deshalb nicht provisioniert.");
    error.status = 409;
    error.code = "provisioning_build_target_missing";
    throw error;
  }
  if (target.flash.size_mb !== flashSizeMb) {
    const error = new Error(`Das Board verlangt ${target.flash.size_mb} MB Flash; bestaetigt wurden ${flashSizeMb} MB.`);
    error.status = 409;
    error.code = "provisioning_flash_size_mismatch";
    throw error;
  }
  const release = getFactoryFirmwareRelease({ firmwareBuildTargetId: targetId, basissoftwareProfile: profile });
  if (!release) {
    const error = new Error(`Fuer ${target.title} ist das Profil ${profile.toUpperCase()} noch nicht als Factory-Release freigegeben.`);
    error.status = 409;
    error.code = "provisioning_firmware_variant_not_available";
    throw error;
  }
  const artifactPath = path.join(provisioningFirmwareRoot, release.relative_file_path);
  let sizeBytes = 0;
  let sha256 = "";
  if (fs.existsSync(artifactPath)) {
    const content = await fs.promises.readFile(artifactPath);
    sizeBytes = content.length;
    sha256 = crypto.createHash("sha256").update(content).digest("hex");
  }
  return {
    id: release.artifact_id,
    label: release.label,
    fileName: release.file_name,
    path: artifactPath,
    sizeBytes,
    sha256,
    sourcePath: release.source_path,
    sourceVersion: release.source_version,
    firmwareBuildTargetId: targetId,
    version: release.version || "",
    flashMode: release.flash_mode || "dio",
    flashFreq: release.flash_freq || "40m",
    flashSize: release.flash_size || "keep",
  };
}

function normalizeDataLoggerConfiguration(input = {}) {
  return {
    schema_version: 1,
    enabled: input.enabled !== false,
    storage_scope: "project_private",
    configuration_state: "requires_sensor_configuration",
    user_configuration: Array.isArray(input.userConfiguration || input.user_configuration) ? (input.userConfiguration || input.user_configuration).map(String).slice(0, 8) : [],
  };
}

async function handlePlatformDeviceBasissoftwareProfileUpdate(req, res, session, accountDeviceId) {
  try {
    const body = await readJsonBody(req);
    const accountId = projectServerUserId(session);
    const result = await deviceManagementJson(
      `/api/device-management/accounts/${encodeURIComponent(accountId)}/devices/${encodeURIComponent(accountDeviceId)}`,
      {
        method: "PUT",
        body: { basissoftware_profile: body.basissoftware_profile || body.profile || body.profile_id },
      },
    );
    sendJson(res, 200, {
      device: decorateUserIdeDevice(result.account_device),
      requires_usb_reflash: result.requires_usb_reflash,
      message: result.message,
    });
  } catch (error) {
    sendJson(res, error.status || 400, {
      error: error.code || "basissoftware_profile_update_failed",
      message: error.message || "Basissoftware-Profil konnte nicht gespeichert werden.",
      details: error.payload || {},
    });
  }
}

async function handlePlatformDeviceVoiceAiPolicyUpdate(req, res, session, accountDeviceId) {
  try {
    const body = await readJsonBody(req);
    const accountId = projectServerUserId(session);
    const enabled = body.enabled === true;
    const result = await deviceManagementJson(
      `/api/device-management/accounts/${encodeURIComponent(accountId)}/devices/${encodeURIComponent(accountDeviceId)}/voice-ai-policy`,
      {
        method: "PUT",
        body: {
          enabled,
          consent_version: enabled ? "voice-ai-parent-v1" : "",
          age_band: body.age_band || "child_6_12",
          max_recording_seconds: 15,
          max_reply_seconds: 20,
        },
      },
    );
    sendJson(res, 200, {
      device: decorateUserIdeDevice(result.account_device),
      voice_ai_policy: result.voice_ai_policy,
      message: enabled
        ? "Voice AI ist fuer dieses Device freigegeben. Der Provider bleibt bis zur zentralen GerNetiX-Freigabe deaktiviert."
        : "Voice AI ist fuer dieses Device deaktiviert.",
    });
  } catch (error) {
    sendJson(res, error.status || 400, {
      error: error.code || "voice_ai_policy_update_failed",
      message: error.message || "Voice-AI-Freigabe konnte nicht gespeichert werden.",
      details: error.payload || {},
    });
  }
}

function defaultHomeAutomationConfiguration() {
  return normalizeHomeAutomationConfiguration({
    coordinator: "undecided",
    failure_policy: "local_fallback",
    state_model: { commands: true, desired_state: true, actual_state: true, events: true },
    nodes: [
      { node_id: "node_1", name: "Raumklima", role: "sensor_node", transport: "undecided", sensor_count: 2, actuator_count: 0, board_features: {} },
      { node_id: "node_2", name: "Lichtsteuerung", role: "actuator_node", transport: "undecided", sensor_count: 0, actuator_count: 1, board_features: {} },
      { node_id: "node_3", name: "Touchpanel", role: "control_node", transport: "undecided", sensor_count: 0, actuator_count: 0, board_features: { integrated_display: true, integrated_touchscreen: true } },
    ],
  });
}

function normalizeHomeAutomationConfiguration(input) {
  if (!input || typeof input !== "object") return null;
  const coordinator = ["undecided", "none", "gernetix_home_server", "home_assistant", "gernetix_with_home_assistant"]
    .includes(input.coordinator) ? input.coordinator : "undecided";
  const failurePolicy = ["local_fallback", "safe_state", "central_required", "undecided"]
    .includes(input.failure_policy) ? input.failure_policy : "undecided";
  const roles = new Set(["sensor_node", "actuator_node", "combined_node", "control_node", "gateway"]);
  const transports = new Set(["undecided", "local", "wifi_rest", "wifi_mqtt", "zigbee"]);
  const boardFeatureIds = ["integrated_display", "integrated_touchscreen", "battery_operation", "sd_card", "audio", "many_gpio"];
  const nodes = (Array.isArray(input.nodes) ? input.nodes : []).slice(0, 30).map((node, index) => {
    const boardFeatures = Object.fromEntries(boardFeatureIds.map((id) => [id, node.board_features?.[id] === true]));
    if (Number(node.control_count) > 0) boardFeatures.integrated_touchscreen = true;
    if (boardFeatures.integrated_touchscreen) boardFeatures.integrated_display = true;
    return {
      node_id: String(node.node_id || `node_${index + 1}`).replace(/[^A-Za-z0-9_]/g, "_").slice(0, 60),
      name: String(node.name || `IoT-Device ${index + 1}`).trim().slice(0, 120),
      role: roles.has(node.role) ? node.role : "combined_node",
      transport: transports.has(node.transport) ? node.transport : "undecided",
      sensor_count: Math.max(0, Math.min(20, Number(node.sensor_count) || 0)),
      actuator_count: Math.max(0, Math.min(20, Number(node.actuator_count) || 0)),
      board_features: boardFeatures,
    };
  });
  const stateModel = input.state_model && typeof input.state_model === "object" ? input.state_model : {};
  return {
    schema_version: 2,
    coordinator,
    failure_policy: failurePolicy,
    state_model: {
      commands: stateModel.commands !== false,
      desired_state: stateModel.desired_state !== false,
      actual_state: stateModel.actual_state !== false,
      events: stateModel.events !== false,
    },
    nodes,
    updated_at: new Date().toISOString(),
  };
}

function defaultTouchscreenGameConfiguration() {
  return normalizeTouchscreenGameConfiguration({
    pattern_id: "",
    selected_game_ids: ["nibbles", "frogger"],
    board_profile_id: "hardware.processor_board.esp32_s3_es3c28p",
    inventory_device_id: "",
  });
}

function normalizeTouchscreenGameConfiguration(input) {
  if (!input || typeof input !== "object") return null;
  const patterns = new Set(["", "touchscreen_game_loop", "event_driven_scene_loop", "turn_based_state_machine"]);
  const games = new Set(["nibbles", "snake", "frogger", "tic_tac_toe", "pong", "breakout", "memory"]);
  const selectedGameIds = Array.from(new Set(Array.isArray(input.selected_game_ids) ? input.selected_game_ids : []))
    .filter((id) => games.has(id))
    .slice(0, 7);
  return {
    schema_version: 2,
    pattern_id: patterns.has(input.pattern_id) ? input.pattern_id : "",
    selected_game_ids: selectedGameIds,
    board_profile_id: String(input.board_profile_id || "").slice(0, 180),
    board_configuration: normalizeDevelopmentBoardConfiguration(input.board_configuration, input.board_profile_id),
    inventory_device_id: String(input.inventory_device_id || "").slice(0, 180),
    updated_at: new Date().toISOString(),
  };
}

function isTouchscreenGameBoard(board) {
  const capabilities = new Set(Array.isArray(board?.capability_ids) ? board.capability_ids : []);
  return capabilities.has("capability.touchscreen_input") || /touch/i.test(`${board?.title || ""} ${board?.form_factor || ""}`);
}

function touchscreenGameInventoryMatches(boardProfileId, device) {
  const inventoryProfile = String(device?.hardware_profile_id || "");
  return inventoryProfile === boardProfileId
    || (boardProfileId === "hardware.processor_board.generic_esp32_s3_touch_display" && /touch|display/i.test(inventoryProfile));
}

function restoreDevelopmentTemplateReference(manifest, project) {
  if (manifest?.template_id || project?.learning_project_id !== "development_project") return manifest;
  const architectureView = (manifest?.views || []).find((view) => view.id === "architecture-diagram" || view.type === "plantuml");
  const source = normalizeArchitecturePlantUml(stripPlantUmlNotes(architectureView?.payload?.source || ""), "project_template");
  if (!source) return manifest;
  const match = developmentProjectTemplateCatalog()
    .filter((template) => template.id !== "empty")
    .find((template) => normalizeArchitecturePlantUml(
      templateArchitecturePlantUml(developmentProjectTemplate(template.id), project.title),
      "project_template",
    ) === source);
  if (!match) return manifest;
  return {
    ...manifest,
    template_id: match.id,
    template_ref: { template_id: match.id, model_schema_version: match.model_schema_version || 1 },
  };
}

function normalizeArchitectureDiagram(input = {}) {
  const derivedFrom = String(input.derived_from || input.derivedFrom || "architecture_discovery_ai_response").trim();
  const source = normalizeArchitecturePlantUml(stripPlantUmlNotes(input.source || ""), derivedFrom);
  return {
    type: "plantuml",
    title: String(input.title || "Architektur-Skizze").trim(),
    summary: String(input.summary || "Gespeicherte Architektur-Skizze.").trim(),
    source,
    derived_from: derivedFrom,
    generated_at: String(input.generated_at || input.generatedAt || new Date().toISOString()).trim(),
    confidence: Number(input.confidence || 0),
    detected_blocks: Array.isArray(input.detected_blocks || input.detectedBlocks)
      ? (input.detected_blocks || input.detectedBlocks).map(String)
      : [],
  };
}

function stripPlantUmlNotes(source) {
  const lines = String(source || "").split(/\r?\n/);
  const cleaned = [];
  let inNote = false;
  for (const line of lines) {
    if (/^\s*note\b/i.test(line)) {
      inNote = true;
      continue;
    }
    if (inNote) {
      if (/^\s*end\s+note\b/i.test(line)) inNote = false;
      continue;
    }
    cleaned.push(line);
  }
  return cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function normalizeArchitecturePlantUml(source, derivedFrom = "") {
  const isTemplate = derivedFrom === "project_template" || /Startarchitektur aus Projekttemplate/i.test(source);
  // Logische Architektur bleibt notationsoffen; konkrete UML-Symbole gehoeren in Realisierungssichten.
  let normalized = String(source || "")
    .replace(/^(\s*)(?:node|component|database|cloud|queue|artifact)\s+("[^"]+")(\s+as\s+[A-Za-z_][A-Za-z0-9_]*)?/gmi, "$1rectangle $2$3");
  if (isTemplate) {
    normalized = normalized
      .replace(/ESP32 Datenlogger/g, "IoT-Device Datenlogger")
      .replace(/ESP32 Device/g, "IoT-Device")
      .replace(/ESP32-Device/g, "IoT-Device")
      .replace(/^\s*Startarchitektur aus Projekttemplate;.*$/gmi, "");
  }
  return numberGenericIotDeviceInstances(normalized).replace(/\n{3,}/g, "\n\n").trim();
}

function numberGenericIotDeviceInstances(source) {
  const text = String(source || "");
  const usedNumbers = new Set(Array.from(text.matchAll(/\bIoT[- ]Device\s+(\d+)\b/gi), (match) => Number(match[1])));
  let nextNumber = 1;
  return text.replace(/(\brectangle\s+")IoT[- ]Device(")/gi, (_match, prefix, suffix) => {
    while (usedNumbers.has(nextNumber)) nextNumber += 1;
    const instanceNumber = nextNumber;
    usedNumbers.add(instanceNumber);
    nextNumber += 1;
    return `${prefix}IoT-Device ${instanceNumber}${suffix}`;
  });
}

function architectureDiagramFromManifest(manifest = {}) {
  const view = (Array.isArray(manifest.views) ? manifest.views : [])
    .find((item) => item.id === "architecture-diagram" || item.type === "plantuml");
  return normalizeArchitectureDiagram({
    title: view?.title,
    summary: view?.summary,
    ...(view?.payload || {}),
  });
}

function hardwareConfigurationFromManifest(manifest = {}) {
  const view = (Array.isArray(manifest?.views) ? manifest.views : [])
    .find((item) => item.id === "hardware-configuration");
  return view?.payload && typeof view.payload === "object" ? view.payload : null;
}

function normalizeHardwareConfiguration(input = {}, project = {}) {
  const raw = input && typeof input === "object" ? input : {};
  const rawComponents = Array.isArray(raw.components) ? raw.components.slice(0, 100) : [];
  const embeddedUnits = platformSoftwareUnits(project).filter((unit) => unit.software_kind === "embedded_firmware");
  const usedEmbeddedUnitIds = new Set();
  let deviceIndex = 0;
  const components = rawComponents.map((component) => {
    const abstractType = ["iot_device", "sensor", "actuator", "actor", "structural"].includes(component.abstract_type)
      ? component.abstract_type
      : "structural";
    const concreteType = String(component.concrete_type || "").trim().slice(0, 80);
    const normalized = {
      component_id: requiredField(component.component_id, "component_id").replace(/[^A-Za-z0-9_]/g, "_").slice(0, 80),
      label: requiredField(component.label, "label").slice(0, 160),
      plantuml_type: String(component.plantuml_type || "component").slice(0, 40),
      abstract_type: abstractType,
      concrete_type: concreteType,
      sensor_category: String(component.sensor_category || "").trim().toLowerCase().slice(0, 80),
      signal_type: String(component.signal_type || "").trim().toLowerCase().slice(0, 80),
      processor_family: String(component.processor_family || "").trim().toLowerCase().slice(0, 80),
      processor_variant: String(component.processor_variant || "").trim().slice(0, 120),
      board_profile_id: String(component.board_profile_id || "").slice(0, 180),
      board_configuration: abstractType === "iot_device" ? normalizeDevelopmentBoardConfiguration(component.board_configuration, component.board_profile_id) : null,
      inventory_device_id: String(component.inventory_device_id || "").slice(0, 180),
      inventory_device_label: String(component.inventory_device_label || "").slice(0, 180),
      target_device_id: String(component.target_device_id || "").replace(/[^A-Za-z0-9_]/g, "_").slice(0, 80),
      pin: String(component.pin || "").slice(0, 80),
      secondary_pin: String(component.secondary_pin || "").slice(0, 80),
      properties: normalizeHardwareProperties(component.properties),
      circuit: hardwareCircuitFor(concreteType, component.properties, abstractType, component.label),
    };
    if (abstractType === "iot_device") {
      const matchingUnit = embeddedUnits.find((unit) => !usedEmbeddedUnitIds.has(unit.software_unit_id)
        && unit.hardware_profile_id && unit.hardware_profile_id === normalized.board_profile_id)
        || embeddedUnits.find((unit) => !usedEmbeddedUnitIds.has(unit.software_unit_id)
          && unit.source_root === component.component_path)
        || embeddedUnits.find((unit) => !usedEmbeddedUnitIds.has(unit.software_unit_id));
      if (matchingUnit) usedEmbeddedUnitIds.add(matchingUnit.software_unit_id);
      normalized.component_path = `Komponenten/IoT-Device ${deviceIndex + 1}`;
      deviceIndex += 1;
    }
    return normalized;
  });
  const devicesById = new Map(components
    .filter((component) => component.abstract_type === "iot_device")
    .map((component) => [component.component_id, component]));
  for (const component of components.filter((item) => ["sensor", "actuator"].includes(item.abstract_type))) {
    const boardFeatureId = boardFeatureIdForHardwareComponent(component, devicesById.get(component.target_device_id));
    component.hardware_scope = boardFeatureId ? "board_integrated" : "board_external";
    component.board_feature_id = boardFeatureId;
  }
  return {
    schema_version: 6,
    components,
    updated_at: new Date().toISOString(),
  };
}

function normalizeDevelopmentBoardConfiguration(input, boardProfileId) {
  if (!boardProfileId || !input || typeof input !== "object") return null;
  const source = ["catalog", "account", "project", "custom", "custom_draft"].includes(input.source) ? input.source : "catalog";
  const boardFeatures = {};
  const rawFeatures = input.board_features && typeof input.board_features === "object" && !Array.isArray(input.board_features)
    ? input.board_features
    : {};
  for (const [featureId, value] of Object.entries(rawFeatures).slice(0, 30)) {
    const normalizedId = String(featureId).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
    if (!normalizedId || !value || typeof value !== "object" || Array.isArray(value)) continue;
    const pins = {};
    if (value.pins && typeof value.pins === "object" && !Array.isArray(value.pins)) {
      for (const [signal, pin] of Object.entries(value.pins).slice(0, 30)) {
        const normalizedSignal = String(signal).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
        if (normalizedSignal && Number.isInteger(pin) && pin >= -1 && pin <= 255) pins[normalizedSignal] = pin;
      }
    }
    boardFeatures[normalizedId] = {
      enabled: value.enabled === true,
      hardware: String(value.hardware || "").slice(0, 100),
      driver: String(value.driver || "").slice(0, 100),
      connection: String(value.connection || "").slice(0, 100),
      pins,
      value: String(value.value || "").slice(0, 100),
    };
  }
  return {
    schema_version: 1,
    source,
    name: source === "catalog" ? "" : String(input.name || "").trim().slice(0, 120),
    base_board_profile_id: String(input.base_board_profile_id || boardProfileId).slice(0, 180),
    board_features: boardFeatures,
    saved_at: ["account", "project", "custom"].includes(source) ? String(input.saved_at || "").slice(0, 40) : "",
    account_board_id: String(input.account_board_id || "").slice(0, 180),
    account_board_version: Number.isInteger(Number(input.account_board_version)) ? Number(input.account_board_version) : 0,
  };
}

function compilerBoardConfiguration(configuration, board = null) {
  if (!configuration && !board) return null;
  const source = configuration?.source === "project" || board?.configuration_scope === "project"
    ? "project"
    : configuration?.account_board_id || board?.account_board_id || board?.configuration_scope === "account"
    ? "account"
    : configuration?.source === "catalog" || board?.configuration_scope === "gernetix"
      ? "catalog"
      : "project";
  return {
    schema_version: 1,
    source,
    name: configuration?.name || board?.title || "",
    base_board_profile_id: configuration?.base_board_profile_id || board?.base_board_profile_id || board?.hardware_item_id || "",
    account_board_id: configuration?.account_board_id || board?.account_board_id || "",
    account_board_version: configuration?.account_board_version || board?.account_board_version || 0,
    board_features: mergeBoardFeatures(
      board?.default_instance_configuration?.board_features,
      configuration?.board_features,
    ),
    snapshot_at: new Date().toISOString(),
  };
}

function normalizeHardwareProperties(input = {}) {
  const result = {};
  if (!input || typeof input !== "object") return result;
  for (const [key, value] of Object.entries(input).slice(0, 30)) {
    const normalizedKey = String(key).replace(/[^A-Za-z0-9_]/g, "_").slice(0, 60);
    if (!normalizedKey) continue;
    result[normalizedKey] = String(value ?? "").slice(0, 300);
  }
  return result;
}

function hardwareCircuitFor(concreteType, properties = {}, abstractType = "", componentLabel = "Komponente") {
  if (concreteType === "pt1000") return { type: "pt1000_measurement", label: "PT1000-Messschaltung", stages: ["PT1000", "Konstantstromquelle / Messbruecke", "Messverstaerker", "ADC"] };
  if (["ntc", "ptc"].includes(concreteType)) return { type: "resistive_divider", label: "Widerstands-Messschaltung", stages: [concreteType.toUpperCase(), "Spannungsteiler", "ADC"] };
  const driver = String(properties?.motor_driver_type || "");
  if (concreteType === "dc_motor") return { type: "motor_driver", label: "DC-Motorsteuerung", stages: ["PWM / Richtung", driver === "low_side_mosfet" ? "MOSFET-Treiber" : "H-Bruecke", "DC-Motor"] };
  if (concreteType === "servo") return { type: "servo_driver", label: "Servo-Steuerung", stages: ["Zeitgeber", "Servo-PWM", "Servo"] };
  if (concreteType === "stepper_motor") return { type: "stepper_driver", label: "Schrittmotor-Steuerung", stages: ["Zeitgeber / RMT", driver === "four_phase" ? "4-Phasen-Treiber" : "STEP/DIR-Treiber", "Schrittmotor"] };
  if (concreteType === "synchronous_motor") return { type: "synchronous_motor_driver", label: "Synchronmotor-Steuerung", stages: [driver === "three_phase_six_step" ? "6-Step-Kommutierung" : "FOC", "Motor-PWM / ADC / Rotorlage", "3-Phasen-Leistungstreiber", "BLDC / PMSM"] };
  if (properties?.connection_mode === "additional_circuit") {
    const label = String(properties?.circuit_label || (abstractType === "actuator" ? "Treiber- / Leistungsschaltung" : "Signalaufbereitung / Schutzschaltung"));
    return abstractType === "actuator"
      ? { type: "actuator_interface_circuit", label, stages: ["Prozessorausgang", label, componentLabel] }
      : { type: "sensor_interface_circuit", label, stages: [componentLabel, label, "Prozessoreingang"] };
  }
  return null;
}

function hardwareConfigurationSources(configuration, title) {
  const devices = configuration.components.filter((component) => component.abstract_type === "iot_device");
  const deviceById = new Map(devices.map((component) => [component.component_id, component]));
  const sources = [{
    path: "Architektur/verdrahtung/hardware.puml",
    role: "hardware_architecture_view",
    content_type: "text/plain",
    content: hardwareWiringPlantUml(configuration, title),
  }];
  for (const device of devices) {
    const folder = device.component_path;
    const sensors = configuration.components.filter((component) => component.abstract_type === "sensor"
      && component.target_device_id === device.component_id && component.hardware_scope !== "board_integrated");
    const actuators = configuration.components.filter((component) => component.abstract_type === "actuator"
      && component.target_device_id === device.component_id && component.hardware_scope !== "board_integrated");
    sources.push({
      path: `${folder}/Konfiguration/Hardware/Board/board.md`,
      role: "device_board_config",
      content_type: "text/markdown",
      content: hardwareBoardMarkdown(device),
    });
    sources.push({
      path: `${folder}/Konfiguration/Hardware/Sensoren/in.md`,
      role: "device_sensor_input_config",
      content_type: "text/markdown",
      content: hardwareIoMarkdown("Sensor/in", device, sensors),
    });
    sources.push({
      path: `${folder}/Konfiguration/Hardware/Aktoren/out.md`,
      role: "device_actuator_output_config",
      content_type: "text/markdown",
      content: hardwareIoMarkdown("Aktor/out", device, actuators),
    });
  }
  for (const component of configuration.components.filter((item) => item.circuit)) {
    const device = deviceById.get(component.target_device_id);
    const folder = device?.component_path || primaryHardwareComponentPath(devices);
    sources.push({
      path: `${folder}/Konfiguration/Hardware/Schaltungen/${slugifyHardwareFolder(component.label)}.md`,
      role: "device_measurement_circuit_config",
      content_type: "text/markdown",
      content: hardwareCircuitMarkdown(component, device),
    });
  }
  return sources;
}

function primaryHardwareComponentPath(devices) {
  return devices[0]?.component_path || "Komponenten/IoT-Device";
}

function hardwareBoardMarkdown(device) {
  const boardConfiguration = device.board_configuration || null;
  const lines = [
    `# Board-Konfiguration: ${device.label}`,
    "",
    `- Prozessorfamilie: ${device.processor_family || "noch nicht gewaehlt"}`,
    `- Prozessor: ${device.processor_variant || "noch nicht gewaehlt"}`,
    `- Board-Profil: ${device.board_profile_id || "noch nicht gewaehlt"}`,
    `- Konfiguration: ${boardConfiguration?.source === "custom" ? `Eigenes Board „${boardConfiguration.name}“` : "Katalogstandard"}`,
    `- Abstrakte Komponente: ${device.component_id}`,
  ];
  for (const [featureId, feature] of Object.entries(boardConfiguration?.board_features || {})) {
    if (!feature.enabled) continue;
    const pins = Object.entries(feature.pins || {}).map(([signal, pin]) => `${signal}=GPIO${pin}`).join(", ");
    lines.push(`- ${featureId}: ${[feature.hardware, feature.driver, feature.connection, feature.value, pins].filter(Boolean).join(" · ")}`);
  }
  lines.push(
    "",
    "Diese Auswahl konkretisiert das abstrakte IoT-Device. Sensoren, Aktoren und Pins bleiben in den zugehoerigen Hardware-Sichten getrennt.",
    "",
  );
  return lines.join("\n");
}

function hardwareIoMarkdown(kind, device, components) {
  const lines = [`# ${kind}-Konfiguration: ${device.label}`, ""];
  if (!components.length) lines.push("- Keine Komponente zugeordnet.");
  for (const component of components) {
    lines.push(`## ${component.label}`);
    if (component.abstract_type === "sensor") lines.push(`- Sensorart: ${component.sensor_category || "offen"}`);
    if (component.abstract_type === "sensor") lines.push(`- Erfassung: ${component.signal_type || "offen"}`);
    lines.push(`- Konkreter Typ: ${component.concrete_type || "offen"}`);
    lines.push(`- Anschlussweg: ${component.properties?.connection_mode === "additional_circuit" ? "ueber zusaetzliche Schaltung" : "direkt am Prozessor / Board"}`);
    const boardFeature = boardFeatureForHardwareComponent(component, device);
    lines.push(boardFeature
      ? `- Pin-Zuordnung: ${formatHardwarePins(boardFeature.pins)} (Boardkonfiguration)`
      : `- Pin: ${component.pin || "offen"}`);
    if (component.secondary_pin) lines.push(`- Zweiter Pin: ${component.secondary_pin}`);
    if (component.circuit) lines.push(`- Vorschaltung: ${component.circuit.label}`);
    for (const [key, value] of Object.entries(component.properties || {})) lines.push(`- ${key}: ${value}`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function hardwareCircuitMarkdown(component, device) {
  return [
    `# Schaltung: ${component.label}`,
    "",
    `- Typ: ${component.circuit.label}`,
    `- Signalkette: ${component.circuit.stages.join(" -> ")}`,
    `- Ziel: ${device?.label || component.target_device_id || "IoT-Device"}`,
    `- Ausgang der Schaltung: ${component.pin || "ADC/GPIO noch offen"}`,
    "",
    "Die Vorschaltung ist ein notwendiger Teil der Hardware-Realisierung und keine direkte Sensor-Pin-Verbindung.",
    "",
  ].join("\n");
}

function hardwareWiringPlantUml(configuration, title) {
  const devices = new Map(configuration.components.filter((component) => component.abstract_type === "iot_device").map((component) => [component.component_id, component]));
  const lines = ["@startuml", `title Hardware-Architektur: ${String(title || "Entwicklungsprojekt").replace(/"/g, "'")}`, "left to right direction", "skinparam componentStyle rectangle", ""];
  for (const device of devices.values()) {
    const deviceLabel = plantUmlLabel([
      device.label,
      `Prozessorfamilie: ${device.processor_family || "offen"}`,
      `Prozessor: ${device.processor_variant || "offen"}`,
      `Board: ${device.board_configuration?.source === "custom" ? device.board_configuration.name : device.board_profile_id || "offen"}`,
      ...(device.board_configuration?.source === "custom" ? [`Basisprofil: ${device.board_profile_id}`] : []),
      ...hardwarePropertyLines(device.properties),
    ]);
    lines.push(`node "${deviceLabel}" as hw_${device.component_id}`);
    if (device.inventory_device_id) {
      const inventoryAlias = `inventory_${device.component_id}`;
      lines.push(`node "${plantUmlLabel(["Inventar-Device", device.inventory_device_label || device.inventory_device_id, `ID: ${device.inventory_device_id}`])}" as ${inventoryAlias}`);
      lines.push(`hw_${device.component_id} ..> ${inventoryAlias} : Inventarzuordnung`);
    }
  }
  for (const component of configuration.components.filter((item) => ["sensor", "actuator"].includes(item.abstract_type))) {
    const alias = `hw_${component.component_id}`;
    const detailLines = component.abstract_type === "sensor"
      ? [component.label, `Sensorart: ${component.sensor_category || "offen"}`, `Erfassung: ${component.signal_type || "offen"}`, `Sensor: ${component.concrete_type || "offen"}`]
      : [component.label, `Aktor: ${component.concrete_type || "offen"}`];
    lines.push(`component "${plantUmlLabel([...detailLines, ...hardwarePropertyLines(component.properties)])}" as ${alias}`);
    const boardFeature = boardFeatureForHardwareComponent(component, devices.get(component.target_device_id));
    const pinLabel = [boardFeature ? `Board-Pins: ${formatHardwarePins(boardFeature.pins)}` : component.pin || "Pin offen", component.secondary_pin ? `zweiter Pin: ${component.secondary_pin}` : ""].filter(Boolean).join(" / ");
    if (component.circuit) {
      lines.push(`component "${plantUmlLabel([component.circuit.label, ...component.circuit.stages])}" as ${alias}_circuit`);
      lines.push(`${alias} --> ${alias}_circuit`);
      lines.push(`${alias}_circuit --> hw_${component.target_device_id} : ${plantUmlText(pinLabel)}`);
    } else if (devices.has(component.target_device_id)) {
      lines.push(`${alias} --> hw_${component.target_device_id} : ${plantUmlText(pinLabel)}`);
    }
  }
  lines.push("@enduml");
  return lines.join("\n");
}

function boardFeatureForHardwareComponent(component, device) {
  if (!device) return null;
  const featureId = boardFeatureIdForHardwareComponent(component, device);
  const feature = featureId ? device.board_configuration?.board_features?.[featureId] : null;
  if (!feature?.enabled || !Object.keys(feature.pins || {}).length) return null;
  return feature;
}

function boardFeatureIdForHardwareComponent(component, device) {
  if (!device) return "";
  const features = device.board_configuration?.board_features || {};
  let featureId = "";
  if (component.abstract_type === "sensor" && component.sensor_category === "image") featureId = "camera";
  else if (component.abstract_type === "actuator" && component.concrete_type === "integrated_display") featureId = "display";
  else if (/^integrated_/.test(component.concrete_type || "")) {
    const candidate = String(component.concrete_type).replace(/^integrated_/, "");
    featureId = ({ touchscreen: "touch", touchscreen_controller: "touch", audio: "speaker" })[candidate] || candidate;
  }
  const feature = featureId ? features[featureId] : null;
  if (!feature?.enabled) return "";
  if (featureId === "camera" && component.concrete_type && feature.hardware && component.concrete_type !== "integrated_camera" && component.concrete_type !== feature.hardware) return "";
  return featureId;
}

function formatHardwarePins(pins = {}) {
  return Object.entries(pins).map(([signal, pin]) => `${signal.toUpperCase()}=${pin === -1 ? "nicht verbunden" : `GPIO${pin}`}`).join(", ");
}

function plantUmlLabel(lines) {
  return lines.filter(Boolean).map(plantUmlText).join("\\n");
}

function hardwarePropertyLines(properties = {}) {
  return Object.entries(properties).map(([key, value]) => `${key}: ${value}`);
}

function plantUmlText(value) {
  return String(value || "").replace(/["\\]/g, "'").slice(0, 180);
}

function slugifyHardwareFolder(value) {
  return String(value || "Hardware")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "Hardware";
}

function buildConfigForBoard(boardOrProfileId, existing = null) {
  const boardDefinition = boardOrProfileId && typeof boardOrProfileId === "object" ? boardOrProfileId : null;
  const boardProfileId = String(boardDefinition?.base_board_profile_id || boardDefinition?.hardware_item_id || boardOrProfileId || "");
  const catalogBuild = boardDefinition?.platformio_build;
  const sameCompilerTarget = Boolean(catalogBuild
    && existing?.platform === catalogBuild.platform
    && existing?.board === catalogBuild.board);
  const common = {
    ...(existing || {}),
    libraries: existing?.libraries || [],
    ...(!sameCompilerTarget ? {
      build_flags: [],
      partition_file: "",
      platformio_options: {},
      upload_speed: 0,
      maximum_program_size_bytes: 0,
      maximum_ram_size_bytes: 0,
    } : {}),
  };
  if (/esp32_s3_es3c28p|es3c28p/.test(boardProfileId)
      && existing?.firmware_basis_id === "gernetix-runtime-basissoftware") {
    return {
      ...common,
      platform: "espressif32",
      framework: "espidf",
      board: "4d_systems_esp32s3_gen4_r8n16",
      environment: "es3c28p",
      flash_size_mb: 16,
      libraries: Array.from(new Set([...(catalogBuild?.libraries || []), ...(common.libraries || [])])),
      build_flags: [],
      platformio_options: { "board_build.cmake_extra_args": "-DSDKCONFIG_DEFAULTS=\"sdkconfig.esp32-s3-n16r8\"" },
      firmware_basis_id: "gernetix-runtime-basissoftware",
      firmware_basis_version: existing.firmware_basis_version || "workspace",
      firmware_basis_variant: "full",
      partition_profile_id: "full",
      user_source_path: existing.user_source_path || "src/user_main.cpp",
      user_target_path: "src/user/user_app.cpp",
    };
  }
  if (catalogBuild && typeof catalogBuild === "object" && catalogBuild.platform && catalogBuild.board) {
    const supportedFrameworks = Array.isArray(catalogBuild.supported_frameworks) ? catalogBuild.supported_frameworks : [catalogBuild.framework];
    const keepsFramework = existing?.platform === catalogBuild.platform && supportedFrameworks.includes(existing?.framework);
    const framework = keepsFramework ? existing.framework : catalogBuild.framework;
    const firmwareBasisId = catalogBuild.firmware_basis_id || existing?.firmware_basis_id || "";
    const usesBasissoftware = framework === "espidf" && Boolean(firmwareBasisId);
    const result = {
      ...common,
      ...catalogBuild,
      framework,
      libraries: Array.from(new Set([...(catalogBuild.libraries || []), ...(common.libraries || [])])),
      firmware_basis_id: usesBasissoftware ? firmwareBasisId : "",
      firmware_basis_version: usesBasissoftware ? catalogBuild.firmware_basis_version || existing?.firmware_basis_version || "workspace" : "",
      firmware_basis_variant: usesBasissoftware ? existing?.firmware_basis_variant || catalogBuild.firmware_basis_variant || "full" : "",
      user_source_path: existing?.user_source_path || "Komponenten/IoT-Device 1/src/user_main.cpp",
      user_target_path: usesBasissoftware ? existing?.user_target_path || "src/user/user_app.cpp" : existing?.user_target_path || "src/main.cpp",
    };
    delete result.supported_frameworks;
    return result;
  }
  if (/arduino_nano_r3_atmega328p/.test(boardProfileId)) return { ...common, platform: "atmelavr", framework: "arduino", board: "nanoatmega328", environment: "nanoatmega328", firmware_basis_id: "", firmware_basis_version: "", firmware_basis_variant: "" };
  if (/esp8266|d1_mini/.test(boardProfileId)) return { ...common, platform: "espressif8266", framework: "arduino", board: "d1_mini", environment: "d1_mini", firmware_basis_id: "", firmware_basis_version: "", firmware_basis_variant: "" };
  if (/ai_thinker_esp32_cam/.test(boardProfileId)) return { ...common, platform: "espressif32", framework: "arduino", board: "esp32cam", environment: "esp32cam", firmware_basis_id: "", firmware_basis_version: "", firmware_basis_variant: "", user_source_path: existing?.user_source_path || "src/main.cpp", user_target_path: existing?.user_target_path || "src/main.cpp" };
  if (/esp32_s3_es3c28p|es3c28p/.test(boardProfileId)) return { ...common, platform: "espressif32", framework: "arduino", board: "esp32-s3-devkitc-1", environment: "es3c28p", flash_size_mb: 16, firmware_basis_id: "", firmware_basis_version: "", firmware_basis_variant: "", user_source_path: existing?.user_source_path || "Komponenten/IoT-Device 1/src/user_main.cpp", user_target_path: existing?.user_target_path || "src/main.cpp", libraries: common.libraries.length ? common.libraries : ["lovyan03/LovyanGFX@^1.2.7"] };
  if (/esp32_s3|esp32-s3/.test(boardProfileId)) return { ...common, platform: "espressif32", framework: existing?.framework || "espidf", board: "esp32-s3-devkitc-1", environment: "esp32-s3-devkitc-1", firmware_basis_id: "gernetix-runtime-basissoftware", firmware_basis_version: existing?.firmware_basis_version || "workspace", firmware_basis_variant: existing?.firmware_basis_variant || "comfort", user_source_path: existing?.user_source_path || "Komponenten/IoT-Device 1/src/user_main.cpp", user_target_path: existing?.user_target_path || "src/user/user_app.cpp" };
  if (/esp32|wroom32|nano_esp32/.test(boardProfileId)) return { ...common, platform: "espressif32", framework: existing?.framework || "espidf", board: "esp32dev", environment: "esp32dev", firmware_basis_id: "gernetix-runtime-basissoftware", firmware_basis_version: existing?.firmware_basis_version || "workspace", firmware_basis_variant: existing?.firmware_basis_variant || "comfort", user_source_path: existing?.user_source_path || "Komponenten/IoT-Device 1/src/user_main.cpp", user_target_path: existing?.user_target_path || "src/user/user_app.cpp" };
  return existing;
}

function platformSoftwareUnits(project = {}, fallbackBuildConfig = null) {
  if (Array.isArray(project.software_units) && project.software_units.length) {
    return project.software_units.map((unit) => structuredClone(unit));
  }
  const buildConfig = project.build_config || fallbackBuildConfig;
  return buildConfig ? [{
    software_unit_id: "firmware",
    title: "Firmware",
    software_kind: "embedded_firmware",
    build_system: "platformio",
    source_root: "",
    entrypoint: buildConfig.user_source_path || "",
    device_id: project.device_id || "",
    build_config: structuredClone(buildConfig),
    build_configuration: null,
  }] : [];
}

function platformActiveSoftwareUnitId(project = {}) {
  const units = platformSoftwareUnits(project);
  return units.some((unit) => unit.software_unit_id === project.active_software_unit_id)
    ? project.active_software_unit_id
    : units[0]?.software_unit_id || "";
}

function developmentSoftwareUnits(project = {}, diagram = {}, hardwareConfiguration = null, options = {}) {
  const existingUnits = filterSoftwareUnitsForArchitecture(platformSoftwareUnits(project), hardwareConfiguration);
  const components = softwareArchitectureComponents(
    developmentArchitectureSoftwareComponents(diagram?.source || ""),
    hardwareConfiguration,
  );
  const hardwareComponents = new Map((hardwareConfiguration?.components || []).map((component) => [component.component_id, component]));
  const boards = options.boards || [];
  let embeddedIndex = 0;
  const usedExistingIds = new Set();
  const derivedSoftwareUnitIds = new Set(components.map((component) => `software_${component.component_id}`.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120)));
  const units = components.map((component) => {
    const hardware = hardwareComponents.get(component.component_id) || null;
    const expectedId = `software_${component.component_id}`.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
    let existing = existingUnits.find((unit) => !usedExistingIds.has(unit.software_unit_id)
      && hardware?.board_profile_id && unit.hardware_profile_id === hardware.board_profile_id)
      || existingUnits.find((unit) => !usedExistingIds.has(unit.software_unit_id) && unit.source_root === hardware?.component_path)
      || existingUnits.find((unit) => !usedExistingIds.has(unit.software_unit_id) && unit.software_unit_id === expectedId)
      || existingUnits.find((unit) => unit.title === component.label);
    if (!existing && component.abstract_type === "iot_device" && embeddedIndex === 0) {
      existing = existingUnits.find((unit) => unit.software_kind === "embedded_firmware") || null;
    }
    const softwareUnitId = existing?.software_unit_id || expectedId;
    usedExistingIds.add(softwareUnitId);
    const sourceRoot = hardware?.component_path || existing?.source_root || `Komponenten/${component.label}`;
    if (component.abstract_type === "iot_device") {
      const board = boards.find((item) => [item.hardware_item_id, item.hardware_profile_id, item.id]
        .filter(Boolean).some((id) => String(id) === String(hardware?.board_profile_id || "")));
      const baseBuildConfig = embeddedIndex === 0 && options.primaryBuildConfig
        ? options.primaryBuildConfig
        : buildConfigForBoard(board || hardware?.board_profile_id || "", existing?.build_config || null);
      const resolvedBoardConfiguration = hardware?.board_configuration
        || (board ? compilerBoardConfiguration(null, board) : null);
      const buildConfig = baseBuildConfig && resolvedBoardConfiguration
        ? { ...baseBuildConfig, board_configuration: compilerBoardConfiguration(resolvedBoardConfiguration, board) }
        : baseBuildConfig;
      embeddedIndex += 1;
      return {
        software_unit_id: softwareUnitId,
        title: component.label,
        software_kind: "embedded_firmware",
        build_system: "platformio",
        source_root: sourceRoot,
        entrypoint: buildConfig?.user_source_path || existing?.entrypoint || "src/main.cpp",
        device_id: hardware?.inventory_device_id || existing?.device_id || "",
        build_config: buildConfig || existing?.build_config || null,
        build_configuration: null,
      };
    }
    const kind = {
      mobile_app: "mobile_application",
      smartphone_app: "mobile_application",
      browser_app: "web_application",
      desktop_app: "desktop_application",
      server_api: "server_application",
    }[component.abstract_type] || "application";
    return {
      software_unit_id: softwareUnitId,
      title: component.label,
      software_kind: kind,
      build_system: existing?.build_system || "npm",
      source_root: sourceRoot,
      entrypoint: existing?.entrypoint || "package.json",
      device_id: "",
      build_config: null,
      build_configuration: existing?.build_configuration || {
        install_command: "npm install",
        build_command: "npm run build",
        runner_status: "not_connected",
      },
    };
  });
  existingUnits.forEach((unit) => {
    if (!usedExistingIds.has(unit.software_unit_id) && !derivedSoftwareUnitIds.has(unit.software_unit_id)) units.push(unit);
  });
  return units;
}

function developmentArchitectureSoftwareComponents(source) {
  const result = [];
  String(source || "").split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*(?:actor|node|component|rectangle|database|cloud|queue|artifact)\s+"([^"]+)"\s+as\s+([A-Za-z_][A-Za-z0-9_]*)\b/i);
    if (!match) return;
    const label = match[1].replace(/\\n/g, " ").trim();
    const alias = match[2];
    const signature = `${alias} ${label}`.toLowerCase();
    let abstractType = "";
    if (/^iot_device|iot.?device|esp32|esp8266|arduino|raspberry/.test(signature)) abstractType = "iot_device";
    else if (/^mobile_app|mobile app|ios|iphone|ipad|android/.test(signature)) abstractType = "mobile_app";
    else if (/^smartphone_app|smartphone.pwa|\bpwa\b/.test(signature)) abstractType = "smartphone_app";
    else if (/^browser_app|browser|dashboard/.test(signature)) abstractType = "browser_app";
    else if (/^desktop_app|desktop|windows app|mac(?:os)? app|linux app/.test(signature)) abstractType = "desktop_app";
    else if (/^server_api|server|\bapi\b|backend|webserver|\bvps\b/.test(signature)) abstractType = "server_api";
    if (abstractType) result.push({ component_id: alias, label, abstract_type: abstractType });
  });
  return result;
}

function normalizeArchitectureDialog(input = {}, diagram = null) {
  const messages = Array.isArray(input.messages)
    ? input.messages.slice(-12).map((message) => ({
      role: message.role === "user" ? "user" : "assistant",
      content: String(message.content || "").slice(0, 8000),
      ...(message.usage && typeof message.usage === "object" ? { usage: message.usage } : {}),
      ...(message.routing && typeof message.routing === "object" ? { routing: message.routing } : {}),
    })).filter((message) => message.content)
    : [];
  return {
    messages,
    assistantMode: String(input.assistantMode || input.assistant_mode || "architecture_structure"),
    lastRouting: input.lastRouting || input.last_routing || null,
    architectureDiagram: diagram?.source ? normalizeArchitectureDiagram(diagram) : null,
    updated_at: new Date().toISOString(),
  };
}

function slugifyProjectId(value) {
  return String(value || "projekt")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "projekt";
}

function demoProjectSources(project, options = {}) {
  if (project.slug === tamagotchiEntryCourseModel.slug) {
    return tamagotchiEntryCourseModel.createSources(project, primarySourcePath);
  }
  if (project.slug === smartAssistantCourseModel.slug) {
    return smartAssistantCourseModel.createSources();
  }
  if (project.slug === nexiCourseModel.slug) {
    return nexiCourseModel.createSources();
  }
  if (project.slug === buttonToSmartphoneNotificationCourseModel.slug) {
    return buttonToSmartphoneNotificationCourseModel.createSources(options);
  }
  if (project.slug === homeAutomationNetworkCourseModel.slug) {
    return homeAutomationNetworkCourseModel.createSources();
  }
  if (project.slug === homeAutomationSensorsCourseModel.slug) {
    return homeAutomationSensorsCourseModel.createSources();
  }
  if (project.slug === motorControlBasicsCourseModel.slug) {
    return motorControlBasicsCourseModel.createSources();
  }
  if (project.slug === proximitySensorRadarCourseModel.slug) {
    return proximitySensorRadarCourseModel.createSources();
  }
  if (project.slug === programmingFundamentalsCourseModel.slug) {
    return programmingFundamentalsCourseModel.createSources();
  }
  if (project.slug === microcontrollerFundamentalsCourseModel.slug) {
    return microcontrollerFundamentalsCourseModel.createSources();
  }
  if (project.slug === umlFundamentalsCourseModel.slug) {
    return umlFundamentalsCourseModel.createSources();
  }
  if (project.slug === requirementsWorkshopCourseModel.slug) {
    return requirementsWorkshopCourseModel.createSources();
  }
  if (project.slug === yamlFundamentalsCourseModel.slug) {
    return yamlFundamentalsCourseModel.createSources();
  }
  if (project.slug === storageLearningStoryCourseModel.slug) {
    return storageLearningStoryCourseModel.createSources({ lessonId: options.lessonId || "" });
  }
  if (project.slug === radioTechnologiesCourseModel.slug) {
    return radioTechnologiesCourseModel.createSources();
  }
  if (project.slug === measurementToolsBasicsCourseModel.slug) {
    return measurementToolsBasicsCourseModel.createSources();
  }
  if (project.slug === esp32CameraStreamingCourseModel.slug) {
    return esp32CameraStreamingCourseModel.createSources({ lessonId: options.lessonId || "" });
  }

  if (project.slug === "arduino-atmel-bare-metal") {
    return [
      {
        path: "src/main.c",
        role: "base_runtime",
        content: [
          "#include <avr/io.h>",
          "#include \"user/user_app.h\"",
          "",
          "int main(void) {",
          "  user_setup();",
          "",
          "  while (1) {",
          "    user_loop();",
          "  }",
          "}",
          "",
        ].join("\n"),
      },
      {
        path: "include/user/user_app.h",
        role: "header",
        content: [
          "#pragma once",
          "",
          "void user_setup(void);",
          "void user_loop(void);",
          "",
        ].join("\n"),
      },
      {
        path: primarySourcePath(project),
        role: "user_code",
        content: demoProjectSource(project),
      },
    ];
  }

  return [{
    path: primarySourcePath(project),
    role: "user_code",
    content: demoProjectSource(project),
  }];
}

function demoProjectSource(project) {
  if (project.slug === "arduino-blink") {
    return [
      "#include <Arduino.h>",
      "",
      "const int blinkPin = LED_BUILTIN;",
      "",
      "void setup() {",
      "  pinMode(blinkPin, OUTPUT);",
      "}",
      "",
      "void loop() {",
      "  digitalWrite(blinkPin, HIGH);",
      "  delay(500);",
      "  digitalWrite(blinkPin, LOW);",
      "  delay(500);",
      "}",
      "",
    ].join("\n");
  }

  if (project.slug === "arduino-atmel-bare-metal") {
    return [
      "#include <avr/io.h>",
      "#include <util/delay.h>",
      "",
      "void user_setup(void) {",
      "  DDRB |= _BV(DDB5);",
      "}",
      "",
      "void user_loop(void) {",
      "  PORTB ^= _BV(PORTB5);",
      "  _delay_ms(250);",
      "}",
      "",
    ].join("\n");
  }

  return [
    "#include <Arduino.h>",
    "",
    "void setup() {",
    "  Serial.begin(115200);",
    "}",
    "",
    "void loop() {",
    `  Serial.println("${project.title}");`,
    "  delay(1000);",
    "}",
    "",
  ].join("\n");
}

function readWorkspaceText(relativePath) {
  return fs.readFileSync(path.join(workspaceRoot, relativePath), "utf8");
}

async function readSession(req) {
  const token = readSessionToken(req);
  if (!token) return null;
  const session = sessions.get(token);
  if (session) {
    const resolved = await auth.resolve_session_token(token);
    if (resolved) {
      const refreshedSession = {
        account: resolved.account,
        expiresAt: resolved.session.expires_at,
      };
      sessions.set(token, refreshedSession);
      return refreshedSession;
    }
    sessions.delete(token);
  }
  const resolved = await auth.resolve_session_token(token);
  if (!resolved) return null;
  const restoredSession = {
    account: resolved.account,
    expiresAt: resolved.session.expires_at,
  };
  sessions.set(token, restoredSession);
  return restoredSession;
}

function evictCachedSessionsForUser(userId) {
  for (const [token, session] of sessions.entries()) {
    if (session.account?.user_id === userId) sessions.delete(token);
  }
}

function readSessionToken(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies.gernetix_demo_session || "";
}

function updateCachedSessionAccount(req, account) {
  const token = readSessionToken(req);
  const existing = sessions.get(token);
  if (existing) sessions.set(token, { ...existing, account });
}

async function handleDevLessonPreviewMigration(req, res) {
  const body = await readJsonBody(req);
  const slug = String(body.slug || "").trim();
  const projectId = String(body.project_id || body.projectId || `project_${slug}`).trim();
  const manifest = body.view_manifest || body.viewManifest;

  if (!slug || !projectId || !manifest || typeof manifest !== "object") {
    sendDevJson(res, 400, {
      error: "invalid_lesson_preview_payload",
      message: "slug, project_id und view_manifest werden benoetigt.",
    });
    return;
  }

  const normalizedManifest = {
    schema_version: manifest.schema_version || 1,
    title: String(manifest.title || ""),
    summary: String(manifest.summary || ""),
    primary_source_path: String(manifest.primary_source_path || manifest.primarySourcePath || "model/lesson.json"),
    hide_source_editor: manifest.hide_source_editor !== false,
    mode: manifest.mode || "guided_ide",
    views: Array.isArray(manifest.views) ? manifest.views : [],
  };

  userIdeState.lessonManifestOverrides.set(slug, normalizedManifest);

  let projectServerUpdated = false;
  let projectServerError = "";
  try {
    await projectServerJson(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: "PATCH",
      body: {
        view_manifest: normalizedManifest,
        build_config: null,
      },
    });
    projectServerUpdated = true;
  } catch (error) {
    projectServerError = error.message || String(error);
  }

  sendDevJson(res, 200, {
    ok: true,
    slug,
    project_id: projectId,
    view_count: normalizedManifest.views.length,
    project_server_updated: projectServerUpdated,
    project_server_error: projectServerError,
    preview_url: `/app/ide/?project=${encodeURIComponent(projectId)}`,
  });
}

async function usbSerialHelperDownloads() {
  const files = fs.existsSync(usbSerialHelperDistDir) ? fs.readdirSync(usbSerialHelperDistDir) : [];
  const published = platformDownloadRepository
    ? await platformDownloadRepository.listCurrent("serial-service", { visibility: "authenticated" })
    : [];
  const definitions = [
    {
      platform: "macos",
      architecture: "arm64",
      label: "Für macOS",
      localFilenames: [
        `GerNetiX-Serial-Service-${usbSerialHelperManifest.version}-mac-arm64.pkg`,
        "GerNetiX-Serial-Service-mac-arm64.pkg",
      ],
      detail: "Installationspaket · Apple Silicon",
    },
    {
      platform: "windows",
      architecture: "x64",
      label: "Für Windows",
      localFilenames: ["GerNetiX-Serial-Service-win-x64.exe"],
      detail: "Hintergrunddienst · Windows 10/11 x64",
    },
  ];
  return definitions.map((definition) => {
    const localFilename = definition.localFilenames.find((file) => files.includes(file)) || "";
    const release = published.find((item) =>
      item.platform === definition.platform && item.architecture === definition.architecture);
    const filename = localFilename || release?.file_name || "";
    return {
      platform: definition.platform,
      architecture: definition.architecture,
      label: release?.label || definition.label,
      detail: release?.detail || definition.detail,
      available: Boolean(filename),
      file_name: filename,
      url: filename ? `/downloads/usb-serial-helper/${encodeURIComponent(filename)}` : "",
      source: localFilename ? "local" : release ? "published" : "",
      version: release?.version || (localFilename ? usbSerialHelperManifest.version : ""),
      sha256: release?.sha256 || "",
      size_bytes: release?.size_bytes || (localFilename ? fs.statSync(path.join(usbSerialHelperDistDir, localFilename)).size : 0),
    };
  });
}

async function currentFlashboxInitialFirmware() {
  const releases = platformDownloadRepository
    ? await platformDownloadRepository.listCurrent("flashbox-initial-image", { visibility: "public" })
    : [];
  return releases
    .find((release) => release.platform === "esp32" && release.architecture === "esp32-s3") || null;
}

function publicFlashboxFirmwareMetadata(release) {
  return {
    release_id: "flashbox-initial-image",
    version: release.version,
    file_name: release.file_name,
    size_bytes: release.size_bytes,
    sha256: release.sha256,
    published_at: release.published_at,
    hardware_profile: "ESP32-S3 · Flash- und PSRAM-Werte werden vor dem Flash angezeigt",
    content_url: "/api/public/flashbox/initial-firmware/content",
  };
}

async function servePublicFlashboxFirmware(res, release) {
  const content = await platformDownloadRepository.getContent(
    "flashbox-initial-image",
    release.version,
    "esp32",
    "esp32-s3",
    { visibility: "public" },
  );
  res.writeHead(200, {
    "Content-Type": content.content_type,
    "Content-Disposition": `attachment; filename="${content.file_name.replace(/[\"\\]/g, "")}"`,
    "Content-Length": content.size_bytes,
    "X-Content-SHA256": content.sha256,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(content.content_blob);
}

async function serveUsbSerialHelperDownload(res, filename) {
  const download = (await usbSerialHelperDownloads()).find((item) => item.available && decodeURIComponent(item.url).endsWith(`/${filename}`));
  if (!download) {
    sendJson(res, 404, { error: "download_not_found" });
    return;
  }
  if (download.source === "published") {
    const release = await platformDownloadRepository.getContent(
      "serial-service",
      download.version,
      download.platform,
      download.architecture,
      { visibility: "authenticated" },
    );
    res.writeHead(200, {
      "Content-Type": release.content_type,
      "Content-Disposition": `attachment; filename="${release.file_name.replace(/[\"\\]/g, "")}"`,
      "Content-Length": release.size_bytes,
      "X-Content-SHA256": release.sha256,
      "Cache-Control": "private, no-store",
    });
    res.end(release.content_blob);
    return;
  }
  const filePath = path.join(usbSerialHelperDistDir, filename);
  res.writeHead(200, {
    "Content-Type": filename.endsWith(".pkg") ? "application/vnd.apple.installer+xml" : "application/vnd.microsoft.portable-executable",
    "Content-Disposition": `attachment; filename="${filename.replace(/[\"\\]/g, "")}"`,
    "Content-Length": fs.statSync(filePath).size,
    "Cache-Control": "no-store",
  });
  fs.createReadStream(filePath).pipe(res);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
