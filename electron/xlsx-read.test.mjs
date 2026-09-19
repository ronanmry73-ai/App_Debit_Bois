/**
 * Lecture des classeurs `.xlsx` (sans dépendance).
 *
 * Les fixtures sont construites **à la main** (ZIP + XML minimaux conformes à ce
 * qu'Excel produit) : le test ne dépend donc pas d'un fichier externe, et il
 * vérifie le lecteur contre la structure réelle du format.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { deflateRawSync } from "node:zlib";
import {
	cellFormatIds,
	columnIndexOf,
	dateFormatIds,
	excelSerialToDay,
	firstSheetPath,
	parseSharedStrings,
	unzipEntries,
	xlsxToTabbedText,
} from "./xlsx-read.mjs";

/* ------------------------------------------------------------------ */
/* Écriture d'une archive ZIP minimale (ce que fait Excel)             */
/* ------------------------------------------------------------------ */

function crc32(buffer) {
	let crc = 0xffffffff;
	for (const byte of buffer) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit += 1) {
			crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
		}
	}
	return (crc ^ 0xffffffff) >>> 0;
}

/** Construit un .xlsx valide à partir d'une liste de fichiers texte. */
function makeXlsx(files) {
	const locals = [];
	const central = [];
	let offset = 0;
	for (const [name, content] of Object.entries(files)) {
		const nameBuf = Buffer.from(name, "utf8");
		const raw = Buffer.from(content, "utf8");
		const compressed = deflateRawSync(raw);
		const crc = crc32(raw);

		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(20, 4);
		local.writeUInt16LE(8, 8); // deflate
		local.writeUInt32LE(crc, 14);
		local.writeUInt32LE(compressed.length, 18);
		local.writeUInt32LE(raw.length, 22);
		local.writeUInt16LE(nameBuf.length, 26);
		locals.push(local, nameBuf, compressed);

		const cd = Buffer.alloc(46);
		cd.writeUInt32LE(0x02014b50, 0);
		cd.writeUInt16LE(20, 6);
		cd.writeUInt16LE(8, 10);
		cd.writeUInt32LE(crc, 16);
		cd.writeUInt32LE(compressed.length, 20);
		cd.writeUInt32LE(raw.length, 24);
		cd.writeUInt16LE(nameBuf.length, 28);
		cd.writeUInt32LE(offset, 42);
		central.push(cd, nameBuf);

		offset += local.length + nameBuf.length + compressed.length;
	}
	const cdBuffer = Buffer.concat(central);
	const eocd = Buffer.alloc(22);
	eocd.writeUInt32LE(0x06054b50, 0);
	eocd.writeUInt16LE(Object.keys(files).length, 8);
	eocd.writeUInt16LE(Object.keys(files).length, 10);
	eocd.writeUInt32LE(cdBuffer.length, 12);
	eocd.writeUInt32LE(offset, 16);
	return Buffer.concat([...locals, cdBuffer, eocd]);
}

/** Classeur témoin : en-têtes, chaînes partagées, nombre, date, cellule vide. */
function sampleWorkbook() {
	return makeXlsx({
		"xl/workbook.xml":
			'<?xml version="1.0"?><workbook><sheets><sheet name="Facture" sheetId="1" r:id="rId1"/></sheets></workbook>',
		"xl/_rels/workbook.rels":
			'<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
		"xl/sharedStrings.xml":
			'<?xml version="1.0"?><sst><si><t>Clients</t></si><si><t>Nom</t></si><si><t>Romain</t></si><si><t>Etag&#232;re</t></si><si><r><t>Table</t></r><r><t> basse</t></r></si></sst>',
		"xl/styles.xml":
			'<?xml version="1.0"?><styleSheet><numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts><cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="164"/></cellXfs></styleSheet>',
		"xl/worksheets/sheet1.xml":
			'<?xml version="1.0"?><worksheet><sheetData>' +
			'<row r="1"><c r="A1" t="s"><v>0</v></c></row>' +
			'<row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2" t="s"><v>2</v></c></row>' +
			'<row r="3"><c r="A3" t="inlineStr"><is><t>Prix</t></is></c><c r="C3"><v>150</v></c></row>' +
			'<row r="4"><c r="A4" t="s"><v>4</v></c><c r="B4" t="s"><v>3</v></c></row>' +
			'<row r="5"><c r="A5" s="1"><v>45516</v></c><c r="B5" s="2"><v>45517</v></c></row>' +
			"</sheetData></worksheet>",
	});
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

test("columnIndexOf : références de cellules", () => {
	assert.equal(columnIndexOf("A1"), 0);
	assert.equal(columnIndexOf("B10"), 1);
	assert.equal(columnIndexOf("Z1"), 25);
	assert.equal(columnIndexOf("AA1"), 26);
	assert.equal(columnIndexOf("AB12"), 27);
	assert.equal(columnIndexOf(""), -1);
});

test("excelSerialToDay : sérial Excel → date française", () => {
	assert.equal(excelSerialToDay(45516), "12/08/2024");
	assert.equal(excelSerialToDay(45517), "13/08/2024");
	assert.equal(excelSerialToDay(1), "01/01/1900");
});

test("styles : identifiants de format et formats de date", () => {
	const styles =
		'<styleSheet><numFmts><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="0.00"/></numFmts>' +
		'<cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="164"/></cellXfs></styleSheet>';
	assert.deepEqual(cellFormatIds(styles), [0, 164]);
	const ids = dateFormatIds(styles);
	assert.equal(ids.has(14), true, "format de date intégré");
	assert.equal(ids.has(164), true, "format personnalisé dd/mm/yyyy");
	assert.equal(ids.has(165), false, "format numérique non date");
});

test("décompression et chaînes partagées", () => {
	const entries = unzipEntries(sampleWorkbook());
	assert.equal(entries.has("xl/worksheets/sheet1.xml"), true);
	assert.equal(
		firstSheetPath(entries),
		"xl/worksheets/sheet1.xml",
		"feuille résolue via workbook.rels",
	);
	const shared = parseSharedStrings(entries.get("xl/sharedStrings.xml").toString("utf8"));
	assert.deepEqual(shared, ["Clients", "Nom", "Romain", "Etagère", "Table basse"]);
	assert.equal(shared[3], "Etagère", "entité XML décodée");
	assert.equal(shared[4], "Table basse", "chaîne en plusieurs morceaux recomposée");
});

test("classeur → texte tabulé, colonnes conservées", () => {
	const text = xlsxToTabbedText(sampleWorkbook());
	const lines = text.split("\n");
	assert.equal(lines[0], "Clients");
	assert.equal(lines[1], "Nom\tRomain");
	assert.equal(lines[2], "Prix\t\t150", "cellule vide conservée en colonne B");
	assert.equal(lines[3], "Table basse\tEtagère");
	assert.equal(lines[4], "12/08/2024\t13/08/2024", "dates rendues en jj/mm/aaaa");
});

test("un fichier non-xlsx est refusé proprement", () => {
	assert.throws(() => xlsxToTabbedText(Buffer.from("ceci n'est pas un zip")));
});

test("lecture de la vraie facture, si elle est présente sur la machine", (t) => {
	const file = "G:\\Menuiserie Emery\\Factures Clients\\Export\\2026-0001-Romain.xlsx";
	if (!existsSync(file)) {
		t.skip("facture réelle absente de cette machine");
		return;
	}
	const text = xlsxToTabbedText(readFileSync(file));
	assert.match(text, /^Clients/m);
	assert.match(text, /Romain\tRomain\t78 rue de l'arbre; 73100 Aime/);
	assert.match(text, /Num Facture\tDate/);
	assert.match(text, /Table basse\t\t\t1\t150\t180\t180/);
	assert.match(text, /Total[\s\S]*?300/, "total de pied présent");
});
