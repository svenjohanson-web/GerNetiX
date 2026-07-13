const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gernetixHelper", {
  openPlatform: (target) => ipcRenderer.invoke("open-platform", target),
});
