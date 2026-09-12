const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("debitBoisDesktop", {
  isDesktop: true,
  platform: process.platform,
  readStore: () => ipcRenderer.invoke("debit-bois:read-store"),
  writeStore: (json) => ipcRenderer.invoke("debit-bois:write-store", json),
  exportFile: (suggestedName, content) =>
    ipcRenderer.invoke("debit-bois:export-file", suggestedName, content),
  importFile: () => ipcRenderer.invoke("debit-bois:import-file"),
  setTitle: (title) => ipcRenderer.invoke("debit-bois:set-title", title),
  getDriveStatus: () => ipcRenderer.invoke("debit-bois:get-drive-status"),
  restoreDriveBackup: () => ipcRenderer.invoke("debit-bois:restore-drive-backup"),
  onDriveStatus: (cb) => {
    if (typeof cb !== "function") return () => {};
    const wrapped = (_event, status) => cb(status);
    ipcRenderer.on("debit-bois:drive-status", wrapped);
    return () => ipcRenderer.removeListener("debit-bois:drive-status", wrapped);
  },
  onStoreRestored: (cb) => {
    if (typeof cb !== "function") return () => {};
    const wrapped = (_event, json) => cb(json);
    ipcRenderer.on("debit-bois:store-restored", wrapped);
    return () => ipcRenderer.removeListener("debit-bois:store-restored", wrapped);
  },
});
