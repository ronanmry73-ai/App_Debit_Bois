/**
 * Client Drive REST (navigateur). Aucune écriture de debit-bois-dernier.json.
 */

import {
  assertPhoneWritable,
  driveFileInFolderQuery,
  driveFolderQuery,
  DRIVE_FOLDER_NAME,
  MIRROR_NAME,
  mergeRemoteJournal,
  pendingJournalBody,
  type DriveLink,
} from "./google-drive.ts";
import {
  isPersistSnapshot,
  parseMovementJournal,
  PENDING_JOURNAL_NAME,
  type PendingMove,
} from "./movements.ts";

const DRIVE = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";

/** Délai maximal d'un appel Drive : sans lui, une requête qui pend fige la synchro. */
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Relectures d'un fichier dont le contenu semble tronqué (R4).
 *
 * L'API Drive écrit **en place** (`PATCH ?uploadType=media`) : un lecteur peut
 * tomber sur un fichier partiel. Plutôt que de conclure tout de suite à un
 * carnet illisible (et de bloquer le push, cf. R5), on relit quelques fois.
 */
const READ_ATTEMPTS = 3;
const READ_RETRY_MS = 150;

/** Un carnet distant est exploitable s'il est vide ou lisible en entier. */
function isCompleteJournal(raw: string): boolean {
  return raw.trim() === "" || parseMovementJournal(raw).ok;
}

/** Un miroir est exploitable s'il est un instantané complet. */
function isCompleteSnapshot(raw: string): boolean {
  try {
    return isPersistSnapshot(JSON.parse(raw));
  } catch {
    return false;
  }
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message.trim() ? err.message : fallback;
}

export class DriveAuthError extends Error {
  constructor() {
    super("Session Google expirée.");
    this.name = "DriveAuthError";
  }
}

export class DriveApiError extends Error {
  status: number;
  constructor(status: number, detail = "") {
    super(detail || `Drive HTTP ${status}`);
    this.name = "DriveApiError";
    this.status = status;
  }
}

export type DriveFile = { id: string; name: string; modifiedTime?: string };

type FetchLike = typeof fetch;

export function createDriveClient(opts: {
  accessToken: string;
  fetchImpl?: FetchLike;
}) {
  const $fetch = opts.fetchImpl ?? fetch;
  const token = opts.accessToken;

  async function req(url: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    const res = await $fetch(url, {
      ...init,
      headers,
      // Les verrous pull/push ne se relâchent qu'à la résolution de la requête :
      // un appel sans délai maximal bloquerait la synchronisation pour de bon.
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (res.status === 401) throw new DriveAuthError();
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new DriveApiError(res.status, text.slice(0, 240));
    }
    return res;
  }

  async function list(q: string): Promise<DriveFile[]> {
    // modifiedTime sert à départager des dossiers homonymes (R8.2) : le plus
    // récemment modifié est celui que le PC alimente.
    const url = `${DRIVE}/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=20&spaces=drive`;
    const res = await req(url);
    const data = (await res.json()) as { files?: DriveFile[] };
    return Array.isArray(data.files) ? data.files : [];
  }

  async function aboutEmail(): Promise<string | null> {
    const res = await req(`${DRIVE}/about?fields=user(emailAddress)`);
    const data = (await res.json()) as { user?: { emailAddress?: string } };
    return data.user?.emailAddress?.trim() || null;
  }

  async function findFolderByName(name = DRIVE_FOLDER_NAME): Promise<DriveFile[]> {
    return list(driveFolderQuery(name));
  }

  async function findFileInFolder(
    folderId: string,
    name: string,
  ): Promise<DriveFile | null> {
    const files = await list(driveFileInFolderQuery(folderId, name));
    return files[0] ?? null;
  }

  async function getMedia(fileId: string): Promise<string> {
    const res = await req(`${DRIVE}/files/${encodeURIComponent(fileId)}?alt=media`);
    return res.text();
  }

  /** Attente courte entre deux lectures (voir READ_ATTEMPTS). */
  function readDelay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Lecture avec réessais : renvoie la dernière version lue, même incomplète —
   * c'est l'appelant qui décide de refuser (R5) et de proposer la réparation.
   */
  async function getMediaTolerant(
    fileId: string,
    isComplete: (raw: string) => boolean,
  ): Promise<string> {
    let raw = "";
    for (let attempt = 1; attempt <= READ_ATTEMPTS; attempt += 1) {
      raw = await getMedia(fileId);
      if (isComplete(raw)) return raw;
      if (attempt < READ_ATTEMPTS) await readDelay(READ_RETRY_MS);
    }
    return raw;
  }

  async function updateMedia(fileId: string, name: string, body: string): Promise<void> {
    assertPhoneWritable(name);
    await req(
      `${UPLOAD}/files/${encodeURIComponent(fileId)}?uploadType=media`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body,
      },
    );
  }

  async function createJsonInFolder(
    folderId: string,
    name: string,
    body: string,
  ): Promise<string> {
    assertPhoneWritable(name);
    const metaRes = await req(`${DRIVE}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        parents: [folderId],
        mimeType: "application/json",
      }),
    });
    const meta = (await metaRes.json()) as { id?: string };
    const id = meta.id?.trim();
    if (!id) throw new DriveApiError(500, "Création Drive sans id.");
    await updateMedia(id, name, body);
    return id;
  }

  async function resolveLink(): Promise<DriveLink> {
    const folders = await findFolderByName();
    if (folders.length === 0) {
      throw new Error(
        `Dossier « ${DRIVE_FOLDER_NAME} » introuvable sur Drive. Vérifie le nom (le PC y écrit déjà).`,
      );
    }
    // R8.2 : ne jamais lier un dossier homonyme au hasard. On ne retient que les
    // dossiers contenant réellement le miroir ; s'il y en a plusieurs, le plus
    // récemment modifié gagne. Si aucun ne contient le miroir et qu'il existe
    // des doublons, on refuse au lieu de lier le mauvais dossier.
    const withMirror: DriveFile[] = [];
    for (const f of folders) {
      const last = await findFileInFolder(f.id, MIRROR_NAME);
      if (last) withMirror.push(f);
    }
    if (withMirror.length === 0 && folders.length > 1) {
      throw new Error(
        `Plusieurs dossiers « ${DRIVE_FOLDER_NAME} » existent et aucun ne contient ${MIRROR_NAME} — écarte les doublons sur Drive puis réessaie.`,
      );
    }
    const candidates = withMirror.length > 0 ? withMirror : folders;
    const folder = [...candidates].sort((a, b) =>
      String(b.modifiedTime ?? "").localeCompare(String(a.modifiedTime ?? "")),
    )[0]!;
    const last = await findFileInFolder(folder.id, MIRROR_NAME);
    const pending = await findFileInFolder(folder.id, PENDING_JOURNAL_NAME);
    const email = await aboutEmail();
    return {
      folderId: folder.id,
      lastFileId: last?.id ?? null,
      pendingFileId: pending?.id ?? null,
      email: email ?? undefined,
      folderName: folder.name || DRIVE_FOLDER_NAME,
    };
  }

  async function readDernier(link: DriveLink): Promise<string> {
    let fileId = link.lastFileId;
    if (!fileId) {
      const found = await findFileInFolder(link.folderId, MIRROR_NAME);
      fileId = found?.id ?? null;
    }
    if (!fileId) {
      throw new Error(
        `${MIRROR_NAME} absent du dossier Drive — enregistre depuis le PC.`,
      );
    }
    return getMediaTolerant(fileId, isCompleteSnapshot);
  }

  async function pushPending(
    link: DriveLink,
    local: PendingMove[],
  ): Promise<{ sentIds: string[]; pendingFileId: string }> {
    if (local.length === 0) {
      return { sentIds: [], pendingFileId: link.pendingFileId ?? "" };
    }
    let pendingId = link.pendingFileId;
    let remoteRaw: string | null = null;
    if (!pendingId) {
      const found = await findFileInFolder(link.folderId, PENDING_JOURNAL_NAME);
      pendingId = found?.id ?? null;
    }
    if (pendingId) {
      remoteRaw = await getMediaTolerant(pendingId, isCompleteJournal);
    }
    let merged: ReturnType<typeof mergeRemoteJournal>;
    try {
      merged = mergeRemoteJournal(remoteRaw, local);
    } catch (err) {
      // R5 : on refuse toujours d'écraser un carnet inconnu — c'est délibéré —
      // mais seulement après relecture, et en indiquant la sortie de secours.
      throw new Error(
        `${errorMessage(err, "Carnet distant illisible.")} Relu ${READ_ATTEMPTS} fois — utilise « Réparer le carnet » s’il reste illisible.`,
      );
    }
    const { journal, sentIds } = merged;
    const body = pendingJournalBody(journal);
    if (pendingId) {
      await updateMedia(pendingId, PENDING_JOURNAL_NAME, body);
      return { sentIds, pendingFileId: pendingId };
    }
    const created = await createJsonInFolder(
      link.folderId,
      PENDING_JOURNAL_NAME,
      body,
    );
    return { sentIds, pendingFileId: created };
  }

  /**
   * Écarte un carnet illisible en le renommant — rien n'est détruit, et un
   * carnet neuf sera créé au prochain envoi.
   */
  async function repairPending(link: DriveLink): Promise<{ archivedName: string | null }> {
    let pendingId = link.pendingFileId;
    if (!pendingId) {
      const found = await findFileInFolder(link.folderId, PENDING_JOURNAL_NAME);
      pendingId = found?.id ?? null;
    }
    if (!pendingId) return { archivedName: null };
    const archivedName = "mouvements-pending.illisible-" + new Date().toISOString().slice(0, 10) + ".json";
    await req(DRIVE + "/files/" + encodeURIComponent(pendingId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: archivedName }),
    });
    return { archivedName };
  }

  return {
    aboutEmail,
    findFolderByName,
    findFileInFolder,
    getMedia,
    updateMedia,
    createJsonInFolder,
    resolveLink,
    readDernier,
    pushPending,
    repairPending,
  };
}

export type DriveClient = ReturnType<typeof createDriveClient>;
