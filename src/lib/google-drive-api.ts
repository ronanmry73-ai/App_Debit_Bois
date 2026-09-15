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
import { PENDING_JOURNAL_NAME, type PendingMove } from "./movements.ts";

const DRIVE = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";

/** Délai maximal d'un appel Drive : sans lui, une requête qui pend fige la synchro. */
const REQUEST_TIMEOUT_MS = 30_000;

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

export type DriveFile = { id: string; name: string };

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
    const url = `${DRIVE}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=20&spaces=drive`;
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
    let folder = folders[0]!;
    if (folders.length > 1) {
      for (const f of folders) {
        const last = await findFileInFolder(f.id, MIRROR_NAME);
        if (last) {
          folder = f;
          break;
        }
      }
    }
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
    return getMedia(fileId);
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
      remoteRaw = await getMedia(pendingId);
    }
    const { journal, sentIds } = mergeRemoteJournal(remoteRaw, local);
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
