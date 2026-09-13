import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  atomicWriteFile,
  archivePendingJournalFile,
  DEFAULT_DRIVE_BACKUP_DIR,
  driveLocationAvailable,
  emptyPendingJournalJson,
  formatDriveStatusLabel,
  historyFilesToDelete,
  historyStamp,
  mirrorToDrive,
  parseHistoryStamp,
  PENDING_JOURNAL_NAME,
  readPendingJournalFile,
  resetDriveBackupState,
  resolveBackupDir,
  shouldSnapshot,
  SNAPSHOT_MIN_MS,
} from "./drive-backup.mjs";

test("chemin Drive Windows absent hors Windows", () => {
  assert.equal(driveLocationAvailable(DEFAULT_DRIVE_BACKUP_DIR), false);
  assert.equal(driveLocationAvailable(""), false);
});

test("resolveBackupDir : défaut, puis override workshopPrefs", () => {
  assert.equal(resolveBackupDir("{}"), DEFAULT_DRIVE_BACKUP_DIR);
  assert.equal(resolveBackupDir("pas json"), DEFAULT_DRIVE_BACKUP_DIR);
  assert.equal(
    resolveBackupDir(
      JSON.stringify({ workshopPrefs: { driveBackupPath: " /tmp/sauve-debit " } }),
    ),
    "/tmp/sauve-debit",
  );
});

test("shouldSnapshot : premier puis toutes les 10 minutes", () => {
  assert.equal(shouldSnapshot(0, 1_000), true);
  assert.equal(shouldSnapshot(1_000, 1_000 + SNAPSHOT_MIN_MS - 1), false);
  assert.equal(shouldSnapshot(1_000, 1_000 + SNAPSHOT_MIN_MS), true);
});

test("historique : garder 30, supprimer les plus vieux", () => {
  const names = [];
  for (let i = 1; i <= 32; i++) {
    names.push(`debit-bois-2026-09-${String(i).padStart(2, "0")}_120000.json`);
  }
  names.push("autre.txt");
  names.push("debit-bois-dernier.json");
  const extra = historyFilesToDelete(names, 30);
  assert.equal(extra.length, 2);
  assert.ok(extra.includes("debit-bois-2026-09-01_120000.json"));
  assert.ok(extra.includes("debit-bois-2026-09-02_120000.json"));
});

test("historyStamp / parseHistoryStamp aller-retour", () => {
  const d = new Date(2026, 8, 12, 16, 2, 5);
  const stamp = historyStamp(d);
  assert.equal(stamp, "2026-09-12_160205");
  assert.equal(parseHistoryStamp(`debit-bois-${stamp}.json`), d.getTime());
});

test("atomicWriteFile : crée le fichier, pas de .tmp, remplace sans couper", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "debit-drive-"));
  const dest = path.join(dir, "debit-bois-dernier.json");
  await atomicWriteFile(dest, '{"a":1}');
  assert.equal(await readFile(dest, "utf8"), '{"a":1}');
  await atomicWriteFile(dest, '{"a":2}');
  assert.equal(await readFile(dest, "utf8"), '{"a":2}');
  const names = await readdir(dir);
  assert.equal(names.some((n) => n.endsWith(".tmp")), false);
});

test("mirrorToDrive : miroir à chaque save, 1 historique / 10 min, prune 30", async () => {
  resetDriveBackupState();
  const dir = await mkdtemp(path.join(tmpdir(), "debit-drive-"));
  const t0 = new Date(2026, 8, 12, 16, 0, 0);

  const first = await mirrorToDrive('{"n":1}', { dir, now: t0 });
  assert.equal(first.ok, true);
  assert.equal(
    await readFile(path.join(dir, "debit-bois-dernier.json"), "utf8"),
    '{"n":1}',
  );
  let hist = await readdir(path.join(dir, "historique"));
  assert.equal(hist.length, 1);

  const t1 = new Date(t0.getTime() + 60_000);
  await mirrorToDrive('{"n":2}', { dir, now: t1 });
  assert.equal(
    await readFile(path.join(dir, "debit-bois-dernier.json"), "utf8"),
    '{"n":2}',
  );
  hist = await readdir(path.join(dir, "historique"));
  assert.equal(hist.length, 1, "pas d’instantané avant 10 min");

  const t2 = new Date(t0.getTime() + SNAPSHOT_MIN_MS);
  await mirrorToDrive('{"n":3}', { dir, now: t2 });
  hist = await readdir(path.join(dir, "historique"));
  assert.equal(hist.length, 2);

  for (let i = 0; i < 35; i++) {
    const t = new Date(t2.getTime() + (i + 1) * SNAPSHOT_MIN_MS);
    await mirrorToDrive(`{"n":${i + 10}}`, { dir, now: t });
  }
  hist = (await readdir(path.join(dir, "historique"))).filter((n) =>
    n.endsWith(".json"),
  );
  assert.equal(hist.length, 30);
});

test("mirrorToDrive : dossier impossible → ko, pas d’exception", async () => {
  resetDriveBackupState();
  const out = await mirrorToDrive("{}", {
    dir: "H:\\Mon Drive\\Sauvegarde Débit Bois ERP",
  });
  assert.equal(out.ok, false);
  assert.equal(out.error, "Drive indisponible");
});

test("libellé statut", () => {
  assert.equal(
    formatDriveStatusLabel({ ok: false, at: null }),
    "Drive indisponible — données locales OK",
  );
  const label = formatDriveStatusLabel({
    ok: true,
    at: new Date(2026, 8, 12, 16, 2, 0).toISOString(),
  });
  assert.match(label, /Sauvegarde Drive :/);
  assert.match(label, /12\/09/);
  assert.match(label, /16:02/);
});

test("carnet Drive : lecture, archive historique, pending vide", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "debit-pending-"));
  const missing = await readPendingJournalFile(dir);
  assert.equal(missing.ok, true);
  assert.equal(missing.missing, true);
  assert.equal(missing.raw, null);

  const journal = {
    version: 1,
    createdAt: "2026-09-13T20:00:00.000Z",
    items: [{ id: "t1", at: "2026-09-13T20:00:00.000Z", refId: "A", delta: 5, reason: "réception" }],
  };
  await atomicWriteFile(
    path.join(dir, PENDING_JOURNAL_NAME),
    JSON.stringify(journal, null, 2),
  );
  const read = await readPendingJournalFile(dir);
  assert.equal(read.ok, true);
  assert.match(read.raw ?? "", /"t1"/);

  const now = new Date(2026, 8, 13, 22, 5, 7);
  const archived = await archivePendingJournalFile({ dir, now });
  assert.equal(archived.ok, true);
  const pending = JSON.parse(await readFile(path.join(dir, PENDING_JOURNAL_NAME), "utf8"));
  assert.equal(pending.version, 1);
  assert.deepEqual(pending.items, []);
  const histName = "mouvements-applique-2026-09-13_220507.json";
  const hist = JSON.parse(
    await readFile(path.join(dir, "historique", histName), "utf8"),
  );
  assert.equal(hist.items[0]?.id, "t1");
  assert.equal(await readFile(path.join(dir, "debit-bois-dernier.json"), "utf8").catch(() => "absent"), "absent");
});

test("carnet Drive : H: absent → ko sans exception", async () => {
  const out = await readPendingJournalFile(DEFAULT_DRIVE_BACKUP_DIR);
  assert.equal(out.ok, false);
  assert.equal(out.error, "Drive indisponible");
  const arch = await archivePendingJournalFile({
    dir: DEFAULT_DRIVE_BACKUP_DIR,
  });
  assert.equal(arch.ok, false);
});

test("carnet vide sérialisé", () => {
  const raw = emptyPendingJournalJson(new Date("2026-09-13T20:00:00.000Z"));
  const o = JSON.parse(raw);
  assert.equal(o.version, 1);
  assert.deepEqual(o.items, []);
});
