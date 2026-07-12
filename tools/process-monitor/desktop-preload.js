const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gernetixProcesses", {
  list: () => ipcRenderer.invoke("processes:list"),
  listVps: () => ipcRenderer.invoke("processes:list-vps"),
  start: (id) => ipcRenderer.invoke("processes:start", id),
  stop: (id) => ipcRenderer.invoke("processes:stop", id)
});
