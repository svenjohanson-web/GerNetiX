/*
 * Der gemeinsame Zustand der angemeldeten Plattform.
 *
 * Lag zuvor in app.js. Das ist die Kompositionswurzel: dort werden die
 * Bausteine verdrahtet, dort steht also die oberste Schicht. 17 Dateien
 * griffen mit 653 Verwendungen von unten darauf zu -- jede dieser Kanten lief
 * verkehrt herum und hielt einen Teil der 15 gegenseitigen Abhaengigkeiten am
 * Leben.
 *
 * Als eigene Datei ohne eigene Abhaengigkeiten liegt der Zustand unten und
 * wird von oben gelesen. Die Datei wird direkt nach serial-service-client.js
 * geladen, weil serialService dessen Fabrik beim Anlegen aufruft.
 */
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
  serialService: null, // wird in app.js gesetzt, siehe dort
  ideLayoutPersistenceReady: false,
};

/*
 * Geteilte veraenderliche Werte. Sie standen in app.js, der Verdrahtung, und
 * wurden von Controllern und Router von unten gelesen und geschrieben --
 * 14 Zugriffe, alle verkehrt herum. Es ist Zustand, also gehoert er hierher.
 * Die Namen bleiben, damit keine Aufrufstelle sich aendert.
 */
let lastRenderedRoute = "";
let processorBoardCatalogLoadPromise = null;
let boardFeatureCatalogLoadPromise = null;
let platformI18n = null;
