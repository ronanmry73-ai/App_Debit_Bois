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
  readPendingJournal: (hintJson) =>
    ipcRenderer.invoke("debit-bois:read-pending-journal", hintJson),
  archivePendingJournal: (hintJson) =>
    ipcRenderer.invoke("debit-bois:archive-pending-journal", hintJson),
  documentsListInbox: (hintJson) =>
    ipcRenderer.invoke("debit-bois:documents-list-inbox", hintJson),
  documentsPickFolder: () => ipcRenderer.invoke("debit-bois:documents-pick-folder"),
  documentsListFolder: (folder, extensions) =>
    ipcRenderer.invoke("debit-bois:documents-list-folder", folder, extensions),
  documentsReadText: (file) =>
    ipcRenderer.invoke("debit-bois:documents-read-text", file),
  documentsStoreFile: (payload) =>
    ipcRenderer.invoke("debit-bois:documents-store-file", payload),
  documentsOpenFile: (payload) =>
    ipcRenderer.invoke("debit-bois:documents-open-file", payload),
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
  onPendingJournalCheck: (cb) => {
    if (typeof cb !== "function") return () => {};
    const wrapped = () => cb();
    ipcRenderer.on("debit-bois:pending-journal-check", wrapped);
    return () =>
      ipcRenderer.removeListener("debit-bois:pending-journal-check", wrapped);
  },
});
