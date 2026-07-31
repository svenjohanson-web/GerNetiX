const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gernetixProcesses", {
  list: () => ipcRenderer.invoke("processes:list"),
  listVps: () => ipcRenderer.invoke("processes:list-vps"),
  interfaceStatistics: (hours) => ipcRenderer.invoke("interfaces:statistics", hours),
  runtimeAlerts: (hours) => ipcRenderer.invoke("runtime:alerts", hours),
  securityRules: (force) => ipcRenderer.invoke("security:rules", force),
  linkIntegrity: (force) => ipcRenderer.invoke("link-integrity:status", force),
  openPlatform: () => ipcRenderer.invoke("platform:open"),
  vpnStatus: () => ipcRenderer.invoke("vpn:status"),
  vpnConnect: () => ipcRenderer.invoke("vpn:connect"),
  vpnDisconnect: () => ipcRenderer.invoke("vpn:disconnect"),
  tunnelStatus: () => ipcRenderer.invoke("tunnel:status"),
  tunnelStart: () => ipcRenderer.invoke("tunnel:start"),
  tunnelStop: () => ipcRenderer.invoke("tunnel:stop")
});
