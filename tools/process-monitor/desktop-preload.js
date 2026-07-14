const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gernetixProcesses", {
  list: () => ipcRenderer.invoke("processes:list"),
  listVps: () => ipcRenderer.invoke("processes:list-vps"),
  interfaceStatistics: (hours) => ipcRenderer.invoke("interfaces:statistics", hours),
  runtimeAlerts: (hours) => ipcRenderer.invoke("runtime:alerts", hours),
  securityRules: (force) => ipcRenderer.invoke("security:rules", force),
  startAll: () => ipcRenderer.invoke("processes:start-all"),
  start: (id) => ipcRenderer.invoke("processes:start", id),
  stop: (id) => ipcRenderer.invoke("processes:stop", id),
  vpnStatus: () => ipcRenderer.invoke("vpn:status"),
  vpnConnect: () => ipcRenderer.invoke("vpn:connect"),
  vpnDisconnect: () => ipcRenderer.invoke("vpn:disconnect")
});
