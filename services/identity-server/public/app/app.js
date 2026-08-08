const state = {
  account: null,
  projects: [],
  devices: [],
  usbPorts: [],
  discoveredDevices: [],
  selectedProvisioningDiscoveryIds: [],
  avrBootloaderResult: null,
  processorBoards: [],
  processorBoardCatalogStatus: { state: "idle", message: "" },
  boardFeatureCatalog: [],
  boardFeatureCatalogStatus: { state: "idle", message: "" },
  provisioningBoardConfigurationMode: "",
  provisioningKnownBoardId: "",
  provisioningFeatureSelections: {},
  provisioningDatasheetUrl: "",
  provisioningUpdateProfile: "",
  provisioningFirmwareAvailability: { state: "idle", requestKey: "", message: "", artifact: null },
  provisioningUsbFlashSucceeded: false,
  provisioningUsbFlashRunning: false,
  provisioningPairingToken: "",
  provisioningBinding: "",
  provisioningWifiNetworks: [],
  provisioningWifiSetupRunning: false,
  provisioningWifiSetupSucceeded: false,
  provisioningSerialScanCompleted: false,
  provisioningSerialScanRunning: false,
  provisioningSerialPort: null,
  provisioningSerialServicePorts: [],
  serialServiceAvailable: false,
  platformDownloads: [],
  sensorCatalog: [],
  sensorCatalogStatus: { state: "idle", message: "" },
  builds: [],
  billing: null,
  community: { questions: [], activeQuestionId: "", answers: [] },
  marketplace: { items: [], loading: false, loaded: false, error: "" },
  projectIdeas: { items: [], loading: false, loaded: false, error: "" },
  projectShowcases: { items: [], loading: false, loaded: false, error: "" },
  messages: { folder: "inbox", threads: [], activeThreadId: "", activeThread: null },
  communitySummary: { available: false, total: 0, public: { open: 0, closed: 0 }, private: { open: 0, closed: 0 }, messages: { unread: 0, threads: 0 } },
  knowledgeUpdates: [],
  knowledgeHistory: [],
  aiUsage: null,
  progress: [],
  workspace: null,
  serviceStatus: {},
  activeProjectId: "",
  activeSoftwareUnitIds: {},
  pendingFlashAction: "",
  pendingUsbFlash: null,
  activeDeviceId: "",
  activeFlashboxDeviceId: "",
  activeRecoveryDeviceId: "",
  recoveryCheckResult: null,
  activeLearnTab: "catalog",
  projectFilter: "all",
  learningCatalogCategory: "all",
  learningCatalogTag: "all",
  inventoryEsp32Method: "",
  activeStep: 0,
  activeIdeStep: 0,
  guidedCodeChats: {},
  sourcePath: "src/main.cpp",
  ideTreeSelectionPath: "",
  projectSourcesByProjectId: {},
  ideDirtySources: {},
  ideViewMode: "file",
  ideDebugSessions: {},
  projectDebugSessions: {},
  webInterfaceTab: "configuration",
  activeIdeComponentId: "",
  flashboxMockOrder: null,
  developmentPlatform: null,
  esptoolModule: null,
  activeSerialTransport: null,
  serialService: GerNetiXSerialService.create(),
  ideLayoutPersistenceReady: false,
};

const routeMap = {
  dashboard: "dashboardView",
  "hardware-lab": "hardwareLabView",
  about: "aboutView",
  "development-platform": "developmentPlatformView",
  "development-hardware": "developmentHardwareView",
  learn: "learnView",
  applications: "applicationsView",
  nexi: "nexiView",
  "learning-project-overview": "learningProjectOverviewView",
  "learning-project": "learningProjectView",
  "project-app": "projectAppView",
  quiz: "quizView",
  ide: "ideView",
  debug: "debugView",
  "device-management": "deviceManagementView",
  "device-provisioning": "deviceProvisioningView",
  "device-recovery": "deviceRecoveryView",
  "device-inventory": "devicesView",
  downloads: "downloadsView",
  shop: "shopView",
  billing: "billingView",
  community: "communityView",
  messages: "messagesView",
  nachschlagewerke: "referenceLibraryView",
  help: "informationView",
  knowledge: "informationView",
  "account-setup": "accountSetupView",
  auth: "dashboardView",
};
const isPublicHelpPage = /^\/hilfe\/?$/.test(window.location.pathname);
const isPublicKnowledgePage = /^\/wissen\/?$/.test(window.location.pathname);
const isPublicInformationPage = isPublicHelpPage || isPublicKnowledgePage;
const isServerAuthenticatedAppShell = /^\/app\/(?!auth(?:\/|$))/.test(window.location.pathname);
if (isPublicInformationPage) document.body.classList.add("public-help-page");

let deviceOnboardingController = null;
let guidedProjectViewController = null;
let developmentPlatformController = null;
let projectRepositoryCardController = null;
let learningProjectController = null;
let projectAppController = null;
let quizController = null;
let lastRenderedRoute = "";
let processorBoardCatalogLoadPromise = null;
let boardFeatureCatalogLoadPromise = null;
let platformI18n = null;

function deviceOnboarding() {
  if (!deviceOnboardingController) {
    deviceOnboardingController = DeviceOnboardingController.create({
      state,
      model: DeviceOnboardingModel,
      getJson,
      postJson,
      loadProcessorBoardCatalog,
      deleteJson,
      delay,
      loadIdeEsptoolModule,
      loadProcessorBoardCatalog,
      loadBoardFeatureCatalog,
      renderDashboard,
      renderDevices,
      renderIdeShell: (...args) => typeof renderIdeShell === "function" ? renderIdeShell(...args) : undefined,
      escapeHtml,
      meta,
      openHelpTopic: InformationView.openDialog,
      showSerialServiceChoiceDialog,
    });
  }
  return deviceOnboardingController;
}

function guidedProjectView() {
  if (!guidedProjectViewController) {
    guidedProjectViewController = GuidedProjectView.create({
      state,
      getJson,
      postJson,
      putJson,
      waitForCompletedBuild: typeof waitForCompletedBuild === "function" ? waitForCompletedBuild : null,
      progressFor,
      escapeHtml,
      escapeAttribute,
      meta,
      openHelpTopic: InformationView.openDialog,
    });
  }
  return guidedProjectViewController;
}

function developmentPlatform() {
  if (!developmentPlatformController) {
    developmentPlatformController = DevelopmentPlatform.create({
      state,
      postJson,
      deleteJson,
      loadProcessorBoardCatalog,
      openProjectInIde,
      loadProjectDetail,
      navigate,
      escapeHtml,
      escapeAttribute,
      openHelpTopic: InformationView.openDialog,
      repositoryCard: projectRepositoryCard(),
    });
  }
  return developmentPlatformController;
}

function projectRepositoryCard() {
  if (!projectRepositoryCardController) {
    projectRepositoryCardController = ProjectRepositoryCard.create({ getJson, escapeHtml, escapeAttribute });
  }
  return projectRepositoryCardController;
}

function projectApp() {
  if (!projectAppController) {
    projectAppController = ProjectAppController.create({
      getJson,
      putJson,
      renderer: ProjectAppRenderer,
      escapeHtml,
      escapeAttribute,
      onDevicesChanged(projectId, deviceIds) {
        const project = state.projects.find((item) => item.id === projectId);
        if (!project) return;
        project.linkedDeviceIds = [...deviceIds];
        project.linkedDeviceId = deviceIds[0] || "";
      },
    });
  }
  return projectAppController;
}
