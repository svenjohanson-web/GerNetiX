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
  messages: { folder: "inbox", threads: [], activeThreadId: "", activeThread: null },
  communitySummary: { available: false, total: 0, public: { open: 0, closed: 0 }, private: { open: 0, closed: 0 } },
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
  about: "aboutView",
  "development-platform": "developmentPlatformView",
  "development-hardware": "developmentHardwareView",
  learn: "learnView",
  "learning-project-overview": "learningProjectOverviewView",
  "learning-project": "learningProjectView",
  quiz: "quizView",
  ide: "ideView",
  "device-management": "deviceManagementView",
  "device-provisioning": "deviceProvisioningView",
  "device-recovery": "deviceRecoveryView",
  "device-inventory": "devicesView",
  downloads: "downloadsView",
  shop: "shopView",
  billing: "billingView",
  community: "communityView",
  messages: "messagesView",
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
let learningProjectController = null;
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
      renderIdeShell,
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
      waitForCompletedBuild,
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
      navigate,
      escapeHtml,
      escapeAttribute,
      openHelpTopic: InformationView.openDialog,
    });
  }
  return developmentPlatformController;
}
