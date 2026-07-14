const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gernetixProcesses", {
  list: () => ipcRenderer.invoke("processes:list"),
  listVps: () => ipcRenderer.invoke("processes:list-vps"),
  interfaceStatistics: (hours) => ipcRenderer.invoke("interfaces:statistics", hours),
  runtimeAlerts: (hours) => ipcRenderer.invoke("runtime:alerts", hours),
  startAll: () => ipcRenderer.invoke("processes:start-all"),
  start: (id) => ipcRenderer.invoke("processes:start", id),
  stop: (id) => ipcRenderer.invoke("processes:stop", id)
});
