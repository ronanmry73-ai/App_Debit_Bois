/**
 * Miroir de secours vers un dossier Drive Desktop (H:).
 * Jamais la source de vérité : userData / localStorage restent le fichier de travail.
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_DRIVE_BACKUP_DIR =
  "H:\\Mon Drive\\Sauvegarde Débit Bois ERP";
export const MIRROR_NAME = "debit-bois-dernier.json";
export const PENDING_JOURNAL_NAME = "mouvements-pending.json";
export const HISTORY_DIR_NAME = "historique";
export const HISTORY_KEEP = 30;
export const SNAPSHOT_MIN_MS = 10 * 60 * 1000;
export const HISTORY_NAME_RE =
  /^debit-bois-(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})(\d{2})\.json$/;

/** @type {number} */
let lastSnapshotAt = 0;
/** @type {string | null} */
let lastResolvedDir = null;
/**
 * Contenu du carnet lu lors de la dernière lecture réussie (R4).
 * Sert de « compare-and-swap » à l'archivage : si le fichier ne contient plus
 * ce que l'on vient d'appliquer, c'est que le téléphone a poussé un nouveau
 * carnet entre-temps — on ne l'écrase donc pas.
 * @type {string | null}
 */
let lastReadRaw = null;

export function resetDriveBackupState() {
  lastSnapshotAt = 0;
  lastResolvedDir = null;
  lastReadRaw = null;
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

/**
 * Écriture directe — **volontairement non atomique** (R4).
 *
 * Drive Desktop refuse souvent `rename(fichier.tmp → .json)` et laisse alors le
 * dossier vide : le nom `atomicWriteFile` est historique et trompeur, il n'y a
 * pas d'atomicité. On compense ailleurs :
 *   - les lecteurs relisent après un court délai (`readJsonFileTolerant`) ;
 *   - l'archivage ne vide le carnet que s'il n'a pas changé (`lastReadRaw`).
 *
 * Le contrôle de taille final évite de laisser un fichier vidé par une écriture
 * interrompue : mieux vaut signaler l'échec que publier un fichier vide.
 */
export async function atomicWriteFile(dest, content) {
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, content, "utf8");
  const info = await stat(dest);
  if (info.size === 0 && String(content).length > 0) {
    throw new Error(`écriture incomplète (${dest})`);
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

export function emptyPendingJournalJson(now = new Date()) {
  return JSON.stringify(
    { version: 1, createdAt: now.toISOString(), items: [] },
    null,
    2,
  );
}

/** Attente courte, sans bloquer la boucle d'événements. */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Un JSON complet est-il lisible ? (un fichier tronqué ne l'est pas) */
export function isParsableJson(raw) {
  try {
    JSON.parse(String(raw));
    return true;
  } catch {
    return false;
  }
}

/**
 * Lecture tolérante à une écriture en cours (R4).
 *
 * L'écriture se fait en place : un lecteur concurrent peut tomber sur un JSON
 * tronqué. On relit alors après un court délai — le temps que Drive Desktop
 * finisse d'écrire — au lieu de conclure tout de suite à un fichier corrompu.
 * La dernière lecture est retournée telle quelle : l'appelant garde le dernier
 * mot (refus net et message explicite), on ne masque jamais un vrai fichier
 * illisible.
 *
 * @param {string} file
 * @param {{ attempts?: number, delayMs?: number, isValid?: (raw: string) => boolean }} [opts]
 */
export async function readJsonFileTolerant(file, opts = {}) {
  const attempts = Math.max(1, Number(opts.attempts) || 3);
  const delayMs = Math.max(0, Number(opts.delayMs) ?? 200);
  const isValid = opts.isValid ?? isParsableJson;
  let raw = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    raw = await readFile(file, "utf8");
    if (isValid(raw)) return { raw, attempts: attempt, valid: true };
    if (attempt < attempts) await delay(delayMs);
  }
  return { raw, attempts, valid: false };
}

/**
 * Lecture seule du carnet téléphone. Ne touche jamais debit-bois-dernier.json.
 *
 * Relit si le contenu est tronqué (`valid: false` après épuisement des essais) :
 * l'appelant peut alors parler d'« écriture en cours » plutôt que de corruption.
 *
 * @param {string} [dir]
 * @param {{ attempts?: number, delayMs?: number }} [opts]
 */
export async function readPendingJournalFile(dir = lastKnownBackupDir(), opts = {}) {
  const folder = dir || DEFAULT_DRIVE_BACKUP_DIR;
  const file = path.join(folder, PENDING_JOURNAL_NAME);
  if (!driveLocationAvailable(folder)) {
    return {
      ok: false,
      raw: null,
      missing: true,
      path: file,
      error: "Drive indisponible",
      attempts: 0,
      valid: true,
    };
  }
  if (!existsSync(file)) {
    lastReadRaw = null;
    return {
      ok: true,
      raw: null,
      missing: true,
      path: file,
      error: null,
      attempts: 0,
      valid: true,
    };
  }
  try {
    const read = await readJsonFileTolerant(file, opts);
    lastReadRaw = read.valid ? read.raw : null;
    if (!read.valid) {
      console.warn(
        `[Débit Bois] Carnet Drive illisible après ${read.attempts} lecture(s) — écriture en cours ?`,
      );
    }
    return {
      ok: true,
      raw: read.raw,
      missing: false,
      path: file,
      error: null,
      attempts: read.attempts,
      valid: read.valid,
    };
  } catch (err) {
    const message =
      err && typeof err === "object" && "message" in err
        ? String(err.message)
        : String(err);
    console.warn("[Débit Bois] Lecture carnet Drive impossible :", message);
    return {
      ok: false,
      raw: null,
      missing: false,
      path: file,
      error: "Drive indisponible",
      attempts: 0,
      valid: true,
    };
  }
}

/**
 * Copie le carnet vers historique/ puis laisse un fichier vide.
 * Pas de rename() : Drive Desktop le casse souvent.
 *
 * Garde anti-écrasement (R4) : le carnet n'est vidé que si son contenu est
 * encore celui qui a été lu pour appliquer les mouvements. Si le téléphone a
 * poussé un nouveau carnet entre-temps, on le laisse intact (`changed: true`) —
 * il sera appliqué au cycle suivant, et les identifiants déjà appliqués sont
 * dédupliqués par `appliedMoveIds`. Sans cette garde, l'écriture non atomique
 * transformait une course en perte silencieuse.
 *
 * @param {{ dir?: string, now?: Date }} [opts]
 */
export async function archivePendingJournalFile(opts = {}) {
  const now = opts.now ?? new Date();
  const folder = opts.dir || lastKnownBackupDir() || DEFAULT_DRIVE_BACKUP_DIR;
  const src = path.join(folder, PENDING_JOURNAL_NAME);
  if (!driveLocationAvailable(folder)) {
    return { ok: false, path: src, archived: null, changed: false, error: "Drive indisponible" };
  }
  try {
    const historyDir = path.join(folder, HISTORY_DIR_NAME);
    await mkdir(historyDir, { recursive: true });
    let previous = "";
    if (existsSync(src)) {
      try {
        previous = await readFile(src, "utf8");
      } catch {
        previous = "";
      }
    }
    if (lastReadRaw !== null && previous !== lastReadRaw) {
      console.warn(
        "[Débit Bois] Carnet Drive modifié pendant l'application — conservé tel quel.",
      );
      return { ok: true, path: src, archived: null, changed: true, error: null };
    }
    let archived = null;
    if (previous.trim()) {
      archived = path.join(
        historyDir,
        `mouvements-applique-${historyStamp(now)}.json`,
      );
      await atomicWriteFile(archived, previous);
    }
    await atomicWriteFile(src, emptyPendingJournalJson(now));
    lastReadRaw = null;
    return { ok: true, path: src, archived, changed: false, error: null };
  } catch (err) {
    const message =
      err && typeof err === "object" && "message" in err
        ? String(err.message)
        : String(err);
    console.warn("[Débit Bois] Archive carnet Drive impossible :", message);
    return { ok: false, path: src, archived: null, changed: false, error: "Drive indisponible" };
  }
}

