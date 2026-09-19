/**
 * Classement des justificatifs dans le registre `factures/`.
 * Tout se passe dans des dossiers temporaires : aucun accès au vrai Drive.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
	documentFileName,
	documentRelativePath,
	documentsRoot,
	empreinteFichier,
	inboxPath,
	listFolder,
	listInbox,
	readTextSmart,
	storeDocumentFile,
} from "./documents-files.mjs";

const PDF = "%PDF-1.4\nfacture 2 - table basse 150 / 180\n";
const DATE = "2026-08-12T10:00:00.000Z";

async function tempDir() {
	return mkdtemp(path.join(tmpdir(), "debit-bois-docs-"));
}

test("nom de fichier normalisé par type et par année", () => {
	assert.equal(
		documentFileName({ kind: "facture_client", numero: "2", dateDocument: DATE }),
		"FAC-2026-0002.pdf",
	);
	assert.equal(
		documentFileName({ kind: "avoir_client", numero: "3", dateDocument: DATE }),
		"AV-2026-0003.pdf",
	);
	assert.equal(
		documentFileName({ kind: "facture_fournisseur", numero: "17", dateDocument: DATE }),
		"FF-2026-0017.pdf",
	);
	assert.equal(
		documentFileName({
			kind: "ticket",
			numero: "",
			dateDocument: DATE,
			extension: ".jpg",
			empreinte: "abcdef123456",
		}),
		"TCK-2026-abcdef.jpg",
	);
});

test("chemin relatif : clients à la racine de l'année, fournisseurs à part", () => {
	assert.equal(
		documentRelativePath({
			kind: "facture_client",
			dateDocument: DATE,
			fileName: "FAC-2026-0002.pdf",
		}),
		"factures/2026/FAC-2026-0002.pdf",
	);
	assert.equal(
		documentRelativePath({
			kind: "facture_fournisseur",
			dateDocument: DATE,
			fileName: "FF-2026-0017.pdf",
		}),
		"factures/fournisseurs/2026/FF-2026-0017.pdf",
	);
});

test("classement d'un justificatif, puis idempotence sur le même contenu", async () => {
	const dir = await tempDir();
	const source = path.join(dir, "export-facture-2.pdf");
	await writeFile(source, PDF, "utf8");

	const first = await storeDocumentFile({
		dir,
		sourcePath: source,
		kind: "facture_client",
		numero: "2",
		dateDocument: DATE,
	});
	assert.equal(first.ok, true);
	assert.equal(first.created, true);
	assert.equal(first.chemin, "factures/2026/FAC-2026-0002.pdf");
	const stored = await readFile(path.join(dir, "factures", "2026", "FAC-2026-0002.pdf"), "utf8");
	assert.equal(stored, PDF);

	// Même fichier reclassé : on ne duplique pas, on renvoie le chemin existant.
	const again = await storeDocumentFile({
		dir,
		sourcePath: source,
		kind: "facture_client",
		numero: "2",
		dateDocument: DATE,
	});
	assert.equal(again.created, false);
	assert.equal(again.chemin, first.chemin);
	assert.equal(again.empreinte, first.empreinte);
});

test("deux justificatifs différents pour la même référence ne s'écrasent pas", async () => {
	const dir = await tempDir();
	const a = path.join(dir, "a.pdf");
	const b = path.join(dir, "b.pdf");
	await writeFile(a, `${PDF}version A`, "utf8");
	await writeFile(b, `${PDF}version B`, "utf8");

	const first = await storeDocumentFile({
		dir,
		sourcePath: a,
		kind: "facture_client",
		numero: "9",
		dateDocument: DATE,
	});
	const second = await storeDocumentFile({
		dir,
		sourcePath: b,
		kind: "facture_client",
		numero: "9",
		dateDocument: DATE,
	});
	assert.equal(first.chemin, "factures/2026/FAC-2026-0009.pdf");
	assert.equal(second.chemin, "factures/2026/FAC-2026-0009-2.pdf");
	assert.notEqual(first.empreinte, second.empreinte);
});

test("dossier de dépôt : liste des fichiers en attente", async () => {
	const dir = await tempDir();
	const empty = await listInbox(dir);
	assert.equal(empty.ok, true);
	assert.deepEqual(empty.files, []);

	await mkdir(inboxPath(dir), { recursive: true });
	await writeFile(path.join(inboxPath(dir), "a-classer.pdf"), PDF, "utf8");
	const filled = await listInbox(dir);
	assert.equal(filled.files.length, 1);
	assert.equal(filled.files[0]?.name, "a-classer.pdf");
	assert.ok((filled.files[0]?.taille ?? 0) > 0);
});

test("lecture de texte : UTF-8, BOM, et repli Windows-1252", async () => {
	const dir = await tempDir();

	const utf8 = path.join(dir, "utf8.csv");
	await writeFile(utf8, "Prénom\tAdresse\nRomain\tAime\n", "utf8");
	const readUtf8 = await readTextSmart(utf8);
	assert.equal(readUtf8.ok, true);
	assert.equal(readUtf8.encoding, "utf-8");
	assert.match(readUtf8.text, /Prénom/);

	const bom = path.join(dir, "bom.csv");
	await writeFile(bom, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("Nom\n", "utf8")]));
	const readBom = await readTextSmart(bom);
	assert.equal(readBom.text, "Nom\n", "BOM retiré");

	// « Etagère » en Windows-1252 : è = 0xE8, invalide en UTF-8.
	const cp1252 = path.join(dir, "cp1252.csv");
	await writeFile(cp1252, Buffer.from([0x45, 0x74, 0x61, 0x67, 0xe8, 0x72, 0x65]));
	const readCp = await readTextSmart(cp1252);
	assert.equal(readCp.encoding, "windows-1252");
	assert.equal(readCp.text, "Etagère");
});

test("listFolder filtre par extension", async () => {
	const dir = await tempDir();
	await writeFile(path.join(dir, "a.csv"), "x", "utf8");
	await writeFile(path.join(dir, "b.pdf"), "x", "utf8");
	await writeFile(path.join(dir, "c.txt"), "x", "utf8");

	const exports = await listFolder(dir, [".csv", ".txt"]);
	assert.deepEqual(exports.files.map((f) => f.name), ["a.csv", "c.txt"]);
	const justifs = await listFolder(dir);
	assert.deepEqual(justifs.files.map((f) => f.name), ["b.pdf"]);
});

test("empreinte stable et racine cohérente", async () => {
	const dir = await tempDir();
	const file = path.join(dir, "x.pdf");
	await writeFile(file, PDF, "utf8");
	const one = await empreinteFichier(file);
	const two = await empreinteFichier(file);
	assert.equal(one.empreinte, two.empreinte);
	assert.equal(one.taille, Buffer.byteLength(PDF));
	assert.equal(one.empreinte.length, 32);
	assert.equal(documentsRoot(dir), path.join(dir, "factures"));
	assert.equal(existsSync(documentsRoot(dir)), false, "rien n'est créé sans classement");
});
