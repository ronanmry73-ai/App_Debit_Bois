/**
 * Scénarios d'après-correctif côté PC — dossier Drive monté (H:\).
 *
 *   SC5  lettre de lecteur absente : échec propre, aucune exception
 *   R1   disponibilité ≠ fraîcheur : seule la lettre de lecteur est vérifiée
 *   SC3  carnet tronqué sur le disque : lu tel quel, le parseur le refuse
 *   R4   archivage : précédent conservé dans historique/, aucun fichier temporaire
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
	archivePendingJournalFile,
	atomicWriteFile,
	driveLocationAvailable,
	emptyPendingJournalJson,
	PENDING_JOURNAL_NAME,
	readPendingJournalFile,
	resetDriveBackupState,
} from "./drive-backup.mjs";

const JOURNAL = JSON.stringify(
	{
		version: 1,
		createdAt: "2026-09-15T10:00:00.000Z",
		items: [
			{
				id: "m-1",
				at: "2026-09-15T10:00:00.000Z",
				refId: "REF-1",
				delta: -2,
				reason: "Sortie chantier",
			},
		],
	},
	null,
	2,
);

async function tempDir() {
	return mkdtemp(path.join(tmpdir(), "debit-bois-sync-"));
}

test("SC5 — lettre de lecteur absente : échec propre, aucune exception", async () => {
	const libre = "ZYXWVUTSRQPONMKJIHGFED".split("").find((l) => !existsSync(`${l}:\\`));
	if (!libre) {
		assert.ok(true, "toutes les lettres de lecteur sont montées sur cette machine");
		return;
	}
	const dir = `${libre}:\\Mon Drive\\Sauvegarde Débit Bois ERP`;
	assert.equal(driveLocationAvailable(dir), false);
	const res = await readPendingJournalFile(dir);
	assert.equal(res.ok, false);
	assert.equal(res.error, "Drive indisponible");
	const archived = await archivePendingJournalFile({ dir });
	assert.equal(archived.ok, false);
	assert.equal(archived.error, "Drive indisponible");
});

test("R1 — la disponibilité ne regarde que la lettre : un dossier absent est « disponible »", async () => {
	const dir = path.join(await tempDir(), "dossier-absent");
	assert.equal(existsSync(dir), false);
	// Seule l'existence de la lettre C: est vérifiée — jamais celle du dossier.
	assert.equal(driveLocationAvailable(dir), true);
	const res = await readPendingJournalFile(dir);
	assert.equal(res.ok, true);
	assert.equal(res.raw, null);
	assert.equal(res.missing, true);
});

test("R1b — carnet absent d'un dossier existant : le PC conclut « rien à appliquer »", async () => {
	const dir = await tempDir();
	const res = await readPendingJournalFile(dir);
	assert.equal(res.ok, true);
	assert.equal(res.raw, null);
	assert.equal(res.missing, true);
	// Indiscernable d'un Drive qui n'a pas encore rapatrié l'upload du téléphone :
	// d'où l'accusé de réception (appliedMoveIds) avant de vider la file mobile.
});

test("SC3 — carnet tronqué sur le disque : lu tel quel, refusé par le parseur", async () => {
	const dir = await tempDir();
	const torn = JOURNAL.slice(0, 40);
	await writeFile(path.join(dir, PENDING_JOURNAL_NAME), torn, "utf8");
	const res = await readPendingJournalFile(dir);
	assert.equal(res.ok, true);
	assert.equal(res.raw, torn);
	assert.throws(() => JSON.parse(torn));
});

test("R4 — archivage : précédent conservé dans historique/, aucun fichier temporaire", async () => {
	resetDriveBackupState();
	const dir = await tempDir();
	const now = new Date("2026-09-15T11:00:00.000Z");
	await writeFile(path.join(dir, PENDING_JOURNAL_NAME), JOURNAL, "utf8");
	const archived = await archivePendingJournalFile({ dir, now });
	assert.equal(archived.ok, true);
	assert.ok(archived.archived);
	assert.equal(await readFile(archived.archived, "utf8"), JOURNAL);
	assert.equal(
		await readFile(path.join(dir, PENDING_JOURNAL_NAME), "utf8"),
		emptyPendingJournalJson(now),
	);
	// Écriture directe assumée (rename cassé par Drive Desktop) : aucun .tmp laissé.
	const names = await readdir(dir);
	assert.deepEqual(names.sort(), ["historique", PENDING_JOURNAL_NAME]);
});

test("R4b — atomicWriteFile écrit directement la destination, sans fichier temporaire", async () => {
	const dir = await tempDir();
	const dest = path.join(dir, "debit-bois-dernier.json");
	await atomicWriteFile(dest, "{}");
	assert.equal(await readFile(dest, "utf8"), "{}");
	assert.deepEqual(await readdir(dir), ["debit-bois-dernier.json"]);
});
