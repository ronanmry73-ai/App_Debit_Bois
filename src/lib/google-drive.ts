/**
 * Pont Drive téléphone (PWA) ↔ PC (Electron / H:\).
 *
 * Règle d’or :
 *   debit-bois-dernier.json  → le PC seul l’écrit ; le téléphone le LIT.
 *   mouvements-pending.json  → le téléphone l’écrit (merge des items) ;
 *                              le PC le lit, applique, archive.
 * Jamais le téléphone ne fait write sur dernier.json.
 */

import {
  mergePendingMoves,
  parseMovementJournal,
  PENDING_JOURNAL_NAME,
  serializeMovementJournal,
  type MovementJournal,
  type PendingMove,
} from "./movements.ts";

export const DRIVE_FOLDER_NAME = "Sauvegarde Débit Bois ERP";
export const MIRROR_NAME = "debit-bois-dernier.json";
export const DRIVE_LINK_KEY = "debit-bois-drive-link";

/**
 * Portée OAuth **complète** (`auth/drive`), assumée explicitement (R8.1).
 *
 * `drive.file` (accès limité aux fichiers créés par l'application) serait
 * préférable, mais il est inutilisable ici : le miroir `debit-bois-dernier.json`
 * et le dossier « Sauvegarde Débit Bois ERP » sont **créés par le PC**, pas par
 * cette application web. Le téléphone doit donc lire/écrire des fichiers qu'il
 * n'a pas créés, ce que `drive.file` interdit.
 *
 * Conséquence à assumer : un jeton d'accès qui fuite donne accès à **tout** le
 * Drive du compte. Mitigations en place : jeton uniquement en mémoire (jamais
 * persisté), durée de vie courte (~1 h), révocation à la déconnexion
 * (`revokeAccessToken()`), et client ID public sans secret.
 */
export const GOOGLE_DRIVE_SCOPES = "https://www.googleapis.com/auth/drive";

/** Fichiers que le téléphone a le droit d’écrire. Uniquement le carnet. */
export const PHONE_WRITE_FILES: readonly string[] = [PENDING_JOURNAL_NAME];

export type DriveLink = {
  folderId: string;
  lastFileId: string | null;
  pendingFileId: string | null;
  email?: string;
  folderName: string;
};

export function assertPhoneWritable(name: string): void {
  if (!PHONE_WRITE_FILES.includes(name)) {
    throw new Error(
      "Le téléphone n’écrit pas debit-bois-dernier.json (écriture PC seulement).",
    );
  }
}

export function parseDriveLink(raw: unknown): DriveLink | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const folderId = typeof o.folderId === "string" ? o.folderId.trim() : "";
  if (!folderId) return null;
  return {
    folderId,
    lastFileId:
      typeof o.lastFileId === "string" && o.lastFileId.trim()
        ? o.lastFileId.trim()
        : null,
    pendingFileId:
      typeof o.pendingFileId === "string" && o.pendingFileId.trim()
        ? o.pendingFileId.trim()
        : null,
    email: typeof o.email === "string" && o.email.trim() ? o.email.trim() : undefined,
    folderName:
      typeof o.folderName === "string" && o.folderName.trim()
        ? o.folderName.trim()
        : DRIVE_FOLDER_NAME,
  };
}

export function readStoredDriveLink(): DriveLink | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return parseDriveLink(JSON.parse(localStorage.getItem(DRIVE_LINK_KEY) ?? "null"));
  } catch {
    return null;
  }
}

export function writeStoredDriveLink(link: DriveLink | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (!link) localStorage.removeItem(DRIVE_LINK_KEY);
    else localStorage.setItem(DRIVE_LINK_KEY, JSON.stringify(link));
  } catch {
    /* quota */
  }
}

export function remainingPendingAfterPush(
  local: PendingMove[],
  sentIds: readonly string[],
): PendingMove[] {
  if (sentIds.length === 0) return local;
  const sent = new Set(sentIds);
  return local.filter((m) => !sent.has(m.id));
}

export function mergeRemoteJournal(
  remoteRaw: string | null,
  local: PendingMove[],
): { journal: MovementJournal; sentIds: string[] } {
  let remoteItems: PendingMove[] = [];
  if (remoteRaw && remoteRaw.trim()) {
    const parsed = parseMovementJournal(remoteRaw);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }
    remoteItems = parsed.journal.items;
  }
  const merged = mergePendingMoves(remoteItems, local);
  const mergedIds = new Set(merged.map((m) => m.id));
  const sentIds = local.map((m) => m.id).filter((id) => mergedIds.has(id));
  return {
    journal: {
      version: 1,
      createdAt: new Date().toISOString(),
      items: merged,
    },
    sentIds,
  };
}

export function pendingJournalBody(journal: MovementJournal): string {
  return serializeMovementJournal(journal.items, journal.createdAt);
}

export function driveFolderQuery(name = DRIVE_FOLDER_NAME): string {
  return `name='${escapeDriveQuery(name)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
}

export function driveFileInFolderQuery(folderId: string, name: string): string {
  return `name='${escapeDriveQuery(name)}' and '${folderId}' in parents and trashed=false`;
}

export function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
