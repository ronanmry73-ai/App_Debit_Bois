import { app, BrowserWindow, Menu, shell, dialog } from "electron";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEV_URL = process.env.DEBIT_BOIS_URL || "http://127.0.0.1:8080";
const PREVIEW_PORT = Number(process.env.DEBIT_BOIS_PREVIEW_PORT || 8081);

/** @type {import('node:child_process').ChildProcess | null} */
let child = null;
/** @type {BrowserWindow | null} */
let mainWindow = null;

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

function waitForHttp(url, timeoutMs = 90_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url, { redirect: "manual" });
        if (res.status >= 200 && res.status < 500) {
          resolve(undefined);
          return;
        }
      } catch {
        /* server not up yet */
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Timeout: ${url} ne répond pas.`));
        return;
      }
      setTimeout(tick, 400);
    };
    tick();
  });
}

function spawnNpm(script, extraEnv = {}) {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const proc = spawn(npmCmd, ["run", script], {
    cwd: ROOT,
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  proc.on("exit", (code) => {
    if (!app.isQuiting && code && code !== 0) {
      dialog.showErrorBox(
        "Débit Bois",
        `Le serveur interne s'est arrêté (code ${code}).`,
      );
    }
  });
  return proc;
}

async function ensureServer() {
  if (!(await isPortFree(8080))) {
    return DEV_URL;
  }
  if (!(await isPortFree(PREVIEW_PORT))) {
    return `http://127.0.0.1:${PREVIEW_PORT}`;
  }

  child = spawnNpm("preview");
  const previewUrl = `http://127.0.0.1:${PREVIEW_PORT}`;
  try {
    await waitForHttp(previewUrl, 20_000);
    return previewUrl;
  } catch {
    if (child && !child.killed) child.kill();
    child = spawnNpm("dev");
    await waitForHttp(DEV_URL);
    return DEV_URL;
  }
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about", label: "À propos de Débit Bois" },
              { type: "separator" },
              { role: "hide", label: "Masquer" },
              { role: "hideOthers", label: "Masquer les autres" },
              { role: "unhide", label: "Tout afficher" },
              { type: "separator" },
              { role: "quit", label: "Quitter" },
            ],
          },
        ]
      : []),
    {
      label: "Fichier",
      submenu: [
        {
          label: "Imprimer / PDF…",
          accelerator: "CmdOrCtrl+P",
          click: () => mainWindow?.webContents.print({ printBackground: true }),
        },
        { type: "separator" },
        isMac
          ? { role: "close", label: "Fermer" }
          : { role: "quit", label: "Quitter" },
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
        { role: "forceReload", label: "Forcer le rechargement" },
        { role: "toggleDevTools", label: "Outils de développement" },
        { type: "separator" },
        { role: "resetZoom", label: "Zoom réel" },
        { role: "zoomIn", label: "Zoom avant" },
        { role: "zoomOut", label: "Zoom arrière" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Plein écran" },
      ],
    },
    {
      label: "Aide",
      submenu: [
        {
          label: "Dépôt GitHub",
          click: () =>
            shell.openExternal("https://github.com/ronanmry73-ai/App_Debit_Bois"),
        },
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
    autoHideMenuBar: process.platform === "win32",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target);
    return { action: "deny" };
  });

  await mainWindow.loadURL(url);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.setName("Débit Bois");

app.whenReady().then(async () => {
  buildMenu();
  try {
    const url = process.env.DEBIT_BOIS_URL
      ? process.env.DEBIT_BOIS_URL
      : await ensureServer();
    await createWindow(url);
  } catch (err) {
    dialog.showErrorBox(
      "Débit Bois — démarrage impossible",
      `${err instanceof Error ? err.message : String(err)}\n\n` +
        "Lancez d'abord dans un terminal :\n  npm install\n  npm run dev\n\n" +
        "Puis relancez : npm run desktop",
    );
    app.quit();
  }

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const url = process.env.DEBIT_BOIS_URL || DEV_URL;
      await createWindow(url);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  app.isQuiting = true;
  if (child && !child.killed) child.kill();
});
