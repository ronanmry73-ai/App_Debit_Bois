/**
 * Miroir de secours vers un dossier Drive Desktop (H:).
 * Jamais la source de vérité : userData / localStorage restent le fichier de travail.
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_DRIVE_BACKUP_DIR =
  "H:\\Mon Drive\\Sauvegarde Débit Bois ERP";
export const MIRROR_NAME = "debit-bois-dernier.json";
export const HISTORY_DIR_NAME = "historique";
export const HISTORY_KEEP = 30;
export const SNAPSHOT_MIN_MS = 10 * 60 * 1000;
export const HISTORY_NAME_RE =
  /^debit-bois-(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})(\d{2})\.json$/;

/** @type {number} */
let lastSnapshotAt = 0;
/** @type {string | null} */
let lastResolvedDir = null;

export function resetDriveBackupState() {
  lastSnapshotAt = 0;
  lastResolvedDir = null;
}

export function lastKnownBackupDir() {
  return lastResolvedDir || DEFAULT_DRIVE_BACKUP_DIR;
}

export function pad2(n) {
  return String(n).padStart(2, "0");
}

export function historyStamp(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

export function parseHistoryStamp(name) {
  const m = HISTORY_NAME_RE.exec(name);
  if (!m) return 0;
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6]),
  ).getTime();
}

export function shouldSnapshot(lastMs, nowMs = Date.now()) {
  if (!lastMs) return true;
  return nowMs - lastMs >= SNAPSHOT_MIN_MS;
}

export function historyFilesToDelete(names, keep = HISTORY_KEEP) {
  const sorted = names.filter((n) => HISTORY_NAME_RE.test(n)).sort().reverse();
  return sorted.slice(keep);
}

export function isWindowsDrivePath(dir) {
  return /^[A-Za-z]:[\\/]/.test(String(dir || ""));
}

/** Sur un PC sans la lettre (Drive fermé, Linux de dev) : ne pas mkdir. */
export function driveLocationAvailable(dir) {
  const raw = String(dir || "").trim();
  if (!raw) return false;
  if (isWindowsDrivePath(raw)) {
    if (process.platform !== "win32") return false;
    const letter = raw.slice(0, 2);
    return existsSync(`${letter}\\`);
  }
  const parent = path.dirname(raw);
  return existsSync(raw) || existsSync(parent) || parent === path.sep;
}

export function resolveBackupDir(json) {
  if (typeof json === "string") {
    try {
      const o = JSON.parse(json);
      const p = o?.workshopPrefs?.driveBackupPath;
      if (typeof p === "string" && p.trim()) return p.trim();
    } catch {
      /* ignore */
    }
  } else if (json && typeof json === "object") {
    const p = json.workshopPrefs?.driveBackupPath;
    if (typeof p === "string" && p.trim()) return p.trim();
  }
  return DEFAULT_DRIVE_BACKUP_DIR;
}

export async function atomicWriteFile(dest, content) {
  await mkdir(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, content, "utf8");
  try {
    await rename(tmp, dest);
  } catch {
    await rm(dest, { force: true });
    await rename(tmp, dest);
  }
}

async function newestHistoryMs(historyDir) {
  try {
    const names = await readdir(historyDir);
    let newest = 0;
    for (const name of names) {
      const t = parseHistoryStamp(name);
      if (t > newest) newest = t;
    }
    return newest;
  } catch {
    return 0;
  }
}

async function pruneHistory(historyDir) {
  let names = [];
  try {
    names = await readdir(historyDir);
  } catch {
    return;
  }
  const extra = historyFilesToDelete(names, HISTORY_KEEP);
  for (const name of extra) {
    await rm(path.join(historyDir, name), { force: true }).catch(() => {});
  }
}

/**
 * Recopie json vers le miroir Drive. N’échoue jamais vers l’appelant
 * avec une exception : retourne { ok: false } si le dossier n’est pas là.
 *
 * @param {string} json
 * @param {{ now?: Date, dir?: string }} [opts]
 */
export async function mirrorToDrive(json, opts = {}) {
  const now = opts.now ?? new Date();
  const dir = opts.dir ?? resolveBackupDir(json);
  lastResolvedDir = dir;

  if (!driveLocationAvailable(dir)) {
    return {
      ok: false,
      at: null,
      path: dir,
      error: "Drive indisponible",
    };
  }

  try {
    await mkdir(dir, { recursive: true });
    const historyDir = path.join(dir, HISTORY_DIR_NAME);
    await mkdir(historyDir, { recursive: true });
    await atomicWriteFile(path.join(dir, MIRROR_NAME), json);

    if (!lastSnapshotAt) {
      lastSnapshotAt = await newestHistoryMs(historyDir);
    }
    if (shouldSnapshot(lastSnapshotAt, now.getTime())) {
      const stamp = historyStamp(now);
      await atomicWriteFile(
        path.join(historyDir, `debit-bois-${stamp}.json`),
        json,
      );
      lastSnapshotAt = now.getTime();
      await pruneHistory(historyDir);
    }

    return {
      ok: true,
      at: now.toISOString(),
      path: dir,
      error: null,
    };
  } catch (err) {
    const message =
      err && typeof err === "object" && "message" in err
        ? String(err.message)
        : String(err);
    console.warn("[Débit Bois] Copie Drive impossible :", message);
    return {
      ok: false,
      at: null,
      path: dir,
      error: "Drive indisponible",
    };
  }
}

export function formatDriveStatusLabel(status) {
  if (!status) return "";
  if (status.ok && status.at) {
    const d = new Date(status.at);
    if (!Number.isNaN(d.getTime())) {
      const day = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
      const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
      return `Sauvegarde Drive : ${day} ${time}`;
    }
    return "Sauvegarde Drive : OK";
  }
  if (status.ok) return "Sauvegarde Drive : prête";
  return "Drive indisponible — données locales OK";
}
