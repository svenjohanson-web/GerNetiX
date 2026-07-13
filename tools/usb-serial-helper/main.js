const { app, BrowserWindow, ipcMain, session, shell } = require("electron");
const path = require("node:path");

const defaultPlatformUrl = process.env.GERNETIX_PLATFORM_URL || "http://127.0.0.1:4300/app/development-platform/";

app.setName("GerNetiX USB Serial Helper");

function platformOrigin() {
  try {
    return new URL(defaultPlatformUrl).origin;
  } catch {
    return "http://127.0.0.1:4300";
  }
}

function allowGerNetiXPermission(webContents, permission, requestingOrigin) {
  return permission === "serial" && String(requestingOrigin || "").startsWith(platformOrigin());
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "GerNetiX USB Serial Helper",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  window.loadFile(path.join(__dirname, "helper.html"), { query: { target: defaultPlatformUrl } });
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionCheckHandler(allowGerNetiXPermission);
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    callback(allowGerNetiXPermission(webContents, permission, details.requestingUrl || ""));
  });
  session.defaultSession.on("select-serial-port", (event, portList, webContents, callback) => {
    event.preventDefault();
    callback(portList[0]?.portId || "");
  });
  ipcMain.handle("open-platform", (_event, target) => {
    const window = BrowserWindow.getFocusedWindow();
    if (window && String(target).startsWith(platformOrigin())) window.loadURL(target);
  });
  createWindow();
  app.on("activate", () => BrowserWindow.getAllWindows().length || createWindow());
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

module.exports = { allowGerNetiXPermission };
