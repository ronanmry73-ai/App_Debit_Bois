import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("debitBoisDesktop", {
  isDesktop: true,
  platform: process.platform,
  readStore: () => ipcRenderer.invoke("debit-bois:read-store"),
  writeStore: (json) => ipcRenderer.invoke("debit-bois:write-store", json),
  exportFile: (suggestedName, content) =>
    ipcRenderer.invoke("debit-bois:export-file", suggestedName, content),
  importFile: () => ipcRenderer.invoke("debit-bois:import-file"),
  setTitle: (title) => ipcRenderer.invoke("debit-bois:set-title", title),
});
