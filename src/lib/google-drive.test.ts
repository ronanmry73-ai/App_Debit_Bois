import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertPhoneWritable,
  DRIVE_FOLDER_NAME,
  driveFileInFolderQuery,
  driveFolderQuery,
  mergeRemoteJournal,
  MIRROR_NAME,
  parseDriveLink,
  PHONE_WRITE_FILES,
  remainingPendingAfterPush,
} from "./google-drive.ts";
import { createDriveClient, DriveAuthError } from "./google-drive-api.ts";
import {
  PENDING_JOURNAL_NAME,
  serializeMovementJournal,
  isPersistSnapshot,
  type PendingMove,
} from "./movements.ts";

const local: PendingMove[] = [
  {
    id: "t1",
    at: "2026-09-13T20:00:00.000Z",
    refId: "stock-panel-A",
    sku: "P-400",
    delta: 5,
    reason: "réception",
  },
];

test("le téléphone n’a le droit d’écrire que mouvements-pending.json", () => {
  assert.deepEqual(PHONE_WRITE_FILES, [PENDING_JOURNAL_NAME]);
  assert.equal(PHONE_WRITE_FILES.includes(MIRROR_NAME), false);
  assert.doesNotThrow(() => assertPhoneWritable(PENDING_JOURNAL_NAME));
  assert.throws(() => assertPhoneWritable(MIRROR_NAME), /dernier\.json/);
  assert.throws(() => assertPhoneWritable("debit-bois-dernier.json"));
});

test("merge carnet : concat ids absents, pas de doublon", () => {
  const remote = serializeMovementJournal([
    {
      id: "old",
      at: "2026-09-13T10:00:00.000Z",
      refId: "A",
      delta: 2,
      reason: "déjà là",
    },
  ]);
  const { journal, sentIds } = mergeRemoteJournal(remote, [
    ...local,
    {
      id: "old",
      at: "2026-09-13T11:00:00.000Z",
      refId: "A",
      delta: 9,
      reason: "doublon",
    },
  ]);
  assert.equal(journal.items.length, 2);
  assert.equal(journal.items[0]?.id, "old");
  assert.equal(journal.items[0]?.delta, 2);
  assert.equal(journal.items[1]?.id, "t1");
  assert.deepEqual(sentIds.sort(), ["old", "t1"].sort());
});

test("GET illisible (sauvegarde v5) : pas de PUT", () => {
  const persist = JSON.stringify({
    version: 5,
    stock: [],
    catalog: { families: [], refs: [] },
  });
  assert.equal(isPersistSnapshot(JSON.parse(persist)), true);
  assert.throws(() => mergeRemoteJournal(persist, local), /sauvegarde complète/);
});

test("après PUT : ne garder que les ids non envoyés", () => {
  const extra: PendingMove = {
    id: "t2",
    at: "2026-09-13T21:00:00.000Z",
    refId: "A",
    delta: -1,
    reason: "pendant l’envoi",
  };
  const left = remainingPendingAfterPush([...local, extra], ["t1"]);
  assert.equal(left.length, 1);
  assert.equal(left[0]?.id, "t2");
});

test("parseDriveLink exige un folderId", () => {
  assert.equal(parseDriveLink(null), null);
  assert.equal(parseDriveLink({ lastFileId: "x" }), null);
  const link = parseDriveLink({
    folderId: "fld1",
    lastFileId: "last",
    pendingFileId: "pend",
    email: "a@b.c",
  });
  assert.equal(link?.folderId, "fld1");
  assert.equal(link?.lastFileId, "last");
  assert.equal(link?.folderName, DRIVE_FOLDER_NAME);
});

test("requêtes Drive : dossier par nom, fichier dans le dossier", () => {
  assert.match(driveFolderQuery(), /Sauvegarde Débit Bois ERP/);
  assert.match(driveFolderQuery(), /trashed=false/);
  assert.match(
    driveFileInFolderQuery("abc", MIRROR_NAME),
    /debit-bois-dernier\.json/,
  );
});

test("client Drive : GET dernier + PUT carnet (merge), jamais write dernier", async () => {
  const calls: { method: string; url: string; body?: string }[] = [];
  const files: Record<string, string> = {
    last1: JSON.stringify({
      version: 5,
      stock: [{ id: "stock-panel-A", qty: 10 }],
      catalog: { families: [], refs: [] },
    }),
    pend1: serializeMovementJournal([
      {
        id: "old",
        at: "2026-09-13T10:00:00.000Z",
        refId: "A",
        delta: 1,
        reason: "déjà",
      },
    ]),
  };

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({ method, url, body: typeof init?.body === "string" ? init.body : undefined });
    if (url.includes("/about")) {
      return jsonRes({ user: { emailAddress: "atelier@example.com" } });
    }
    if (url.includes("q=") && url.includes("folder")) {
      return jsonRes({
        files: [{ id: "fld1", name: DRIVE_FOLDER_NAME }],
      });
    }
    if (url.includes("q=") && url.includes(encodeURIComponent(MIRROR_NAME))) {
      return jsonRes({ files: [{ id: "last1", name: MIRROR_NAME }] });
    }
    if (url.includes("q=") && url.includes(PENDING_JOURNAL_NAME)) {
      return jsonRes({ files: [{ id: "pend1", name: PENDING_JOURNAL_NAME }] });
    }
    if (url.includes("alt=media") && url.includes("last1")) {
      return new Response(files.last1, { status: 200 });
    }
    if (url.includes("alt=media") && url.includes("pend1")) {
      return new Response(files.pend1, { status: 200 });
    }
    if (method === "PATCH" && url.includes("/upload/") && url.includes("pend1")) {
      files.pend1 = String(init?.body ?? "");
      return new Response("{}", { status: 200 });
    }
    if (method === "PATCH" && url.includes("last1")) {
      return new Response("should not write dernier", { status: 500 });
    }
    return new Response(`unexpected ${method} ${url}`, { status: 404 });
  };

  const client = createDriveClient({ accessToken: "tok", fetchImpl });
  const link = await client.resolveLink();
  assert.equal(link.folderId, "fld1");
  assert.equal(link.lastFileId, "last1");
  assert.equal(link.pendingFileId, "pend1");
  assert.equal(link.email, "atelier@example.com");

  const raw = await client.readDernier(link);
  assert.equal(JSON.parse(raw).version, 5);

  const pushed = await client.pushPending(link, local);
  assert.deepEqual(pushed.sentIds.sort(), ["t1"].sort());
  const stored = JSON.parse(files.pend1) as { items: PendingMove[] };
  assert.equal(stored.items.length, 2);
  assert.ok(stored.items.some((m) => m.id === "old"));
  assert.ok(stored.items.some((m) => m.id === "t1" && m.delta === 5));

  assert.equal(
    calls.some((c) => c.method !== "GET" && c.url.includes("last1")),
    false,
    "aucune écriture sur debit-bois-dernier.json",
  );
});

test("updateMedia refuse dernier.json", async () => {
  const client = createDriveClient({
    accessToken: "tok",
    fetchImpl: async () => new Response("{}", { status: 200 }),
  });
  await assert.rejects(
    () => client.updateMedia("last1", MIRROR_NAME, "{}"),
    /dernier\.json/,
  );
});

test("401 → DriveAuthError", async () => {
  const client = createDriveClient({
    accessToken: "expired",
    fetchImpl: async () => new Response("nope", { status: 401 }),
  });
  await assert.rejects(() => client.aboutEmail(), DriveAuthError);
});

function jsonRes(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
