const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const control = require("./desktop-process-control");

app.setName("GerNetiX Prozess-Monitor");
let mainWindow = null;

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }
  const window = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 760,
    minHeight: 520,
    title: "GerNetiX Prozess-Monitor",
    backgroundColor: "#070b12",
    webPreferences: {
      preload: path.join(__dirname, "desktop-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  mainWindow = window;
  window.on("closed", () => { mainWindow = null; });
  window.setMenuBarVisibility(false);
  window.loadFile(path.join(__dirname, "public", "desktop.html"));
  return window;
}

ipcMain.handle("processes:list", () => control.processStates());
ipcMain.handle("processes:list-vps", () => control.remoteProcessStates());
ipcMain.handle("database:start-vps", () => control.startRemoteAccountDatabase());
ipcMain.handle("interfaces:statistics", (_event, hours) => control.interfaceStatistics(hours));
ipcMain.handle("runtime:alerts", (_event, hours) => control.operationsAlerts(hours));
ipcMain.handle("security:rules", (_event, force) => control.securityRuleStates({ force:Boolean(force) }));
ipcMain.handle("link-integrity:status", (_event, force) => control.remoteLinkIntegrity({ force:Boolean(force) }));
ipcMain.handle("processes:start-all", () => control.startAllServices());
ipcMain.handle("processes:start", (_event, id) => control.startService(id));
ipcMain.handle("processes:stop", (_event, id) => control.stopService(id));
ipcMain.handle("vpn:status", () => control.vpnState());
ipcMain.handle("vpn:connect", () => control.setVpnConnected(true));
ipcMain.handle("vpn:disconnect", () => control.setVpnConnected(false));
ipcMain.handle("tunnel:status", () => control.stagingTunnelState());
ipcMain.handle("tunnel:start", () => control.startStagingTunnel());
ipcMain.handle("tunnel:stop", () => control.stopStagingTunnel());
ipcMain.handle("postgres-db:status", () => control.identityDbTunnelState());
ipcMain.handle("postgres-db:restore", () => control.restoreIdentityDbAccess());

app.whenReady().then(() => {
  const workspace = resolveWorkspace();
  if (!workspace) return;
  control.configureWorkspace(workspace);
  createWindow();
  app.on("activate", createWindow);
});

function resolveWorkspace() {
  const settingsPath = path.join(app.getPath("userData"), "workspace.json");
  const candidates = [process.env.GERNETIX_WORKSPACE, path.resolve(__dirname, "../.."), readStoredWorkspace(settingsPath)].filter(Boolean);
  const existing = candidates.find((candidate) => fs.existsSync(path.join(candidate, "services", "identity-server")));
  if (existing) return existing;
  const selection = dialog.showOpenDialogSync({ title:"GerNetiX Projektordner auswählen", properties:["openDirectory"] })?.[0];
  if (!selection || !fs.existsSync(path.join(selection, "services", "identity-server"))) {
    dialog.showErrorBox("GerNetiX Prozess-Monitor", "Bitte den GerNetiX-Projektordner auswählen.");
    app.quit();
    return "";
  }
  fs.mkdirSync(path.dirname(settingsPath), { recursive:true });
  fs.writeFileSync(settingsPath, JSON.stringify({ workspace:selection }));
  return selection;
}

function readStoredWorkspace(settingsPath) {
  try { return JSON.parse(fs.readFileSync(settingsPath, "utf8")).workspace || ""; } catch { return ""; }
}

app.on("window-all-closed", () => {
  control.stopStagingTunnel().catch(()=>{});
  app.quit();
});
