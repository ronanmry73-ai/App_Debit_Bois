import { app, BrowserWindow, Menu, shell, dialog, ipcMain } from "electron";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_DRIVE_BACKUP_DIR,
  archivePendingJournalFile,
  driveLocationAvailable,
  lastKnownBackupDir,
  mirrorToDrive,
  readPendingJournalFile,
  resolveBackupDir,
} from "./drive-backup.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEV_URL = process.env.DEBIT_BOIS_URL || "http://127.0.0.1:8080";

let child = null;
let mainWindow = null;
let expectingChildExit = false;
let lastDriveStatus = null;
let driveCopyChain = Promise.resolve();

function isPortFree(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = createServer()
      .once("error", () => resolve(false))
      .once("listening", () => {
        socket.close(() => resolve(true));
      })
      .listen(port, host);
  });
}

function waitForHttp(url, timeoutMs = 120_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url, { redirect: "manual" });
        if (res.status >= 200 && res.status < 500) {
          resolve(undefined);
          return;
        }
      } catch {}
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Timeout: ${url} ne répond pas.`));
        return;
      }
      setTimeout(tick, 400);
    };
    tick();
  });
}

function findNode() {
  const fromNpm = process.env.npm_node_execpath;
  if (fromNpm && existsSync(fromNpm)) return fromNpm;
  const home = process.env.USERPROFILE || process.env.HOME || "";
  const candidates = [
    process.env.NODE_EXE,
    "C:\\Program Files\\nodejs\\node.exe",
    path.join(home, "AppData\\Local\\Programs\\nodejs\\node.exe"),
    "node",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate === "node" || existsSync(candidate)) return candidate;
  }
  return "node";
}

function withNodeOnPath(env) {
  const nodeDir = path.dirname(findNode());
  const bin = path.join(ROOT, "node_modules", ".bin");
  const current = env.Path || env.PATH || "";
  const sep = process.platform === "win32" ? ";" : ":";
  return { ...env, PATH: `${bin}${sep}${nodeDir}${sep}${current}`, Path: `${bin}${sep}${nodeDir}${sep}${current}` };
}

function startDevServer() {
  const node = findNode();
  const wrapper = path.join(ROOT, "scripts", "with-app-env.mjs");
  const viteJs = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");
  if (!existsSync(path.join(ROOT, "node_modules", "vite"))) {
    throw new Error("Lance npm install dans VS Code.");
  }
  const args = existsSync(viteJs)
    ? [wrapper, node, viteJs, "dev", "--host", "127.0.0.1", "--port", "8080"]
    : [wrapper, "vite", "dev", "--host", "127.0.0.1", "--port", "8080"];
  const proc = spawn(node, args, {
    cwd: ROOT,
    env: withNodeOnPath(process.env),
    stdio: "inherit",
    windowsHide: true,
  });
  proc.on("exit", (code) => {
    if (expectingChildExit || app.isQuiting) return;
    if (code && code !== 0) {
      dialog.showErrorBox("Débit Bois", `Le serveur interne s'est arrêté (code ${code}).`);
    }
  });
  return proc;
}

async function ensureServer() {
  if (!(await isPortFree(8080))) return DEV_URL;
  child = startDevServer();
  await waitForHttp(DEV_URL);
  return DEV_URL;
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac ? [{ label: app.name, submenu: [{ role: "about" }, { role: "quit", label: "Quitter" }] }] : []),
    {
      label: "Fichier",
      submenu: [
        {
          label: "Imprimer / PDF…",
          accelerator: "CmdOrCtrl+P",
          click: () => mainWindow?.webContents.print({ printBackground: true }),
        },
        { type: "separator" },
        { label: "Restaurer une sauvegarde Drive…", click: () => { void restoreDriveBackup(); } },
        { type: "separator" },
        isMac ? { role: "close", label: "Fermer" } : { role: "quit", label: "Quitter" },
      ],
    },
    {
      label: "Édition",
      submenu: [
        { role: "undo", label: "Annuler" },
        { role: "redo", label: "Rétablir" },
        { type: "separator" },
        { role: "cut", label: "Couper" },
        { role: "copy", label: "Copier" },
        { role: "paste", label: "Coller" },
        { role: "selectAll", label: "Tout sélectionner" },
      ],
    },
    {
      label: "Affichage",
      submenu: [
        { role: "reload", label: "Recharger" },
        { role: "toggleDevTools", label: "Outils de développement" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Plein écran" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    title: "Débit Bois",
    backgroundColor: "#f4f1ea",
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target);
    return { action: "deny" };
  });
  await mainWindow.loadURL(url);
  mainWindow.on("focus", () => {
    try {
      mainWindow?.webContents.send("debit-bois:pending-journal-check");
    } catch {}
  });
  mainWindow.webContents.on("did-finish-load", () => {
    try {
      mainWindow?.webContents.send("debit-bois:pending-journal-check");
    } catch {}
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.setName("Débit Bois");

function storePath() {
  return path.join(app.getPath("userData"), "debit-bois-store.json");
}

function probeDriveStatus(dir = lastKnownBackupDir()) {
  if (lastDriveStatus) return lastDriveStatus;
  if (!driveLocationAvailable(dir)) {
    return { ok: false, at: null, path: dir, error: "Drive indisponible" };
  }
  return { ok: true, at: null, path: dir, error: null };
}

function emitDriveStatus(event, status) {
  lastDriveStatus = status;
  try { event?.sender?.send("debit-bois:drive-status", status); } catch {}
  const win = BrowserWindow.getFocusedWindow() || mainWindow;
  if (win && win.webContents !== event?.sender) {
    try { win.webContents.send("debit-bois:drive-status", status); } catch {}
  }
}

async function copyStoreToDrive(json, event) {
  const run = async () => {
    const status = await mirrorToDrive(json);
    emitDriveStatus(event, status);
    return status;
  };
  const pending = driveCopyChain.then(run, run);
  driveCopyChain = pending.then(() => undefined, () => undefined);
  return pending;
}

async function restoreDriveBackup() {
  const win = BrowserWindow.getFocusedWindow() || mainWindow;
  const dir = lastKnownBackupDir() || DEFAULT_DRIVE_BACKUP_DIR;
  const defaultPath = existsSync(dir) ? dir : undefined;
  const { canceled, filePaths } = await dialog.showOpenDialog(win ?? undefined, {
    title: "Restaurer une sauvegarde Drive",
    defaultPath,
    properties: ["openFile"],
    filters: [{ name: "Sauvegarde Débit Bois", extensions: ["json"] }],
  });
  if (canceled || !filePaths?.[0]) return { restored: false };
  let raw;
  try {
    raw = await readFile(filePaths[0], "utf8");
    JSON.parse(raw);
  } catch {
    await dialog.showMessageBox(win ?? undefined, {
      type: "error",
      title: "Fichier invalide",
      message: "Ce fichier n’est pas une sauvegarde Débit Bois lisible.",
    });
    return { restored: false };
  }
  const { response } = await dialog.showMessageBox(win ?? undefined, {
    type: "warning",
    buttons: ["Annuler", "Restaurer"],
    defaultId: 0,
    cancelId: 0,
    title: "Restaurer une sauvegarde Drive",
    message: "Remplacer l’état local par ce fichier ?",
  });
  if (response !== 1) return { restored: false };
  await mkdir(path.dirname(storePath()), { recursive: true });
  await writeFile(storePath(), raw, "utf8");
  try { (win ?? mainWindow)?.webContents.send("debit-bois:store-restored", raw); } catch {}
  return { restored: true };
}

function registerStoreIpc() {
  ipcMain.handle("debit-bois:read-store", async () => {
    try { return await readFile(storePath(), "utf8"); } catch { return null; }
  });
  ipcMain.handle("debit-bois:write-store", async (event, json) => {
    if (typeof json !== "string") return false;
    await mkdir(path.dirname(storePath()), { recursive: true });
    await writeFile(storePath(), json, "utf8");
    void copyStoreToDrive(json, event).catch((err) => {
      console.warn("[Débit Bois] Copie Drive :", err);
      emitDriveStatus(event, { ok: false, at: null, path: resolveBackupDir(json), error: "Drive indisponible" });
    });
    return true;
  });
  ipcMain.handle("debit-bois:get-drive-status", () => probeDriveStatus());
  ipcMain.handle("debit-bois:restore-drive-backup", async () => restoreDriveBackup());
  ipcMain.handle("debit-bois:read-pending-journal", async (_event, hintJson) => {
    const dir = resolveBackupDir(
      typeof hintJson === "string" && hintJson.trim()
        ? hintJson
        : lastKnownBackupDir(),
    );
    return readPendingJournalFile(dir);
  });
  ipcMain.handle("debit-bois:archive-pending-journal", async (_event, hintJson) => {
    const dir = resolveBackupDir(
      typeof hintJson === "string" && hintJson.trim()
        ? hintJson
        : lastKnownBackupDir(),
    );
    return archivePendingJournalFile({ dir });
  });
  ipcMain.handle("debit-bois:export-file", async (_event, suggestedName, content) => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow;
    const defaultName = typeof suggestedName === "string" && suggestedName.trim() ? suggestedName.trim() : "projet-debit-bois.json";
    const { canceled, filePath } = await dialog.showSaveDialog(win ?? undefined, {
      title: "Exporter le projet",
      defaultPath: defaultName.endsWith(".json") ? defaultName : `${defaultName}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (canceled || !filePath) return false;
    await writeFile(filePath, String(content ?? ""), "utf8");
    return true;
  });
  ipcMain.handle("debit-bois:import-file", async () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow;
    const { canceled, filePaths } = await dialog.showOpenDialog(win ?? undefined, {
      title: "Importer un projet",
      properties: ["openFile"],
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (canceled || !filePaths?.[0]) return null;
    try { return await readFile(filePaths[0], "utf8"); } catch { return null; }
  });
  ipcMain.handle("debit-bois:set-title", (_event, title) => {
    const t = typeof title === "string" && title.trim() ? title.trim() : "Débit Bois";
    (BrowserWindow.getFocusedWindow() || mainWindow)?.setTitle(t);
    return true;
  });
}

app.whenReady().then(async () => {
  registerStoreIpc();
  buildMenu();
  try {
    const url = process.env.DEBIT_BOIS_URL ? process.env.DEBIT_BOIS_URL : await ensureServer();
    await createWindow(url);
  } catch (err) {
    dialog.showErrorBox("Débit Bois — démarrage impossible", err instanceof Error ? err.message : String(err));
    app.quit();
  }
  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow(process.env.DEBIT_BOIS_URL || DEV_URL);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  app.isQuiting = true;
  expectingChildExit = true;
  if (child && !child.killed) child.kill();
});
