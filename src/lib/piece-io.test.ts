import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyPiecePaste,
  looksLikeTablePaste,
  migratePieceRow,
  parseGrainCell,
  parsePiecePaste,
  pieceCanRotate,
  rowHasContent,
} from "./piece-io.ts";
import { emptyRow } from "./presets.ts";

test("pièces anciennes sans grain ni groupe → default / vide", () => {
  const r = migratePieceRow({
    id: "1",
    name: "Montant",
    length: "1800",
    width: "380",
    qty: "2",
  });
  assert.equal(r.grain, "default");
  assert.equal(r.group, "");
  assert.equal(r.name, "Montant");
});

test("fil par pièce : locked jamais, free toujours, default suit le job", () => {
  assert.equal(pieceCanRotate("locked", true), false);
  assert.equal(pieceCanRotate("locked", false), false);
  assert.equal(pieceCanRotate("free", false), true);
  assert.equal(pieceCanRotate("free", true), true);
  assert.equal(pieceCanRotate("default", true), true);
  assert.equal(pieceCanRotate("default", false), false);
  assert.equal(pieceCanRotate(undefined, true), true);
});

test("coller 3 lignes TSV sans en-tête", () => {
  const text = "Montant\t1800\t380\t2\nTraverse\t800\t90\t6\nTablette\t800\t380\t3";
  assert.equal(looksLikeTablePaste(text), true);
  const parsed = parsePiecePaste(text);
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0]?.name, "Montant");
  assert.equal(parsed[0]?.length, "1800");
  assert.equal(parsed[0]?.width, "380");
  assert.equal(parsed[0]?.qty, "2");
  assert.equal(parsed[1]?.name, "Traverse");
  assert.equal(parsed[2]?.qty, "3");
  assert.equal(parsed[0]?.grain, "default");
});

test("coller CSV point-virgule avec en-tête et fil", () => {
  const text = [
    "Nom;Longueur;Largeur;Qté;Famille;Groupe;Fil",
    "Côté;800;350;2;Tilly;Caisson;oui",
    "Tablette;800;380;3;;Étagères;non",
  ].join("\n");
  const parsed = parsePiecePaste(text);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0]?.name, "Côté");
  assert.equal(parsed[0]?.family, "Tilly");
  assert.equal(parsed[0]?.group, "Caisson");
  assert.equal(parsed[0]?.grain, "locked");
  assert.equal(parsed[1]?.grain, "default");
  assert.equal(parsed[1]?.group, "Étagères");
});

test("fil : oui / imposé / 1 = locked ; non / 0 / vide = default", () => {
  assert.equal(parseGrainCell("oui"), "locked");
  assert.equal(parseGrainCell("imposé"), "locked");
  assert.equal(parseGrainCell("1"), "locked");
  assert.equal(parseGrainCell("non"), "default");
  assert.equal(parseGrainCell("0"), "default");
  assert.equal(parseGrainCell(""), "default");
  assert.equal(parseGrainCell("libre"), "free");
});

test("appliquer le collage à partir de la ligne active", () => {
  const rows = [
    { ...emptyRow(), name: "Ancien", length: "100", width: "50", qty: "1" },
    emptyRow(),
  ];
  const parsed = parsePiecePaste("A\t200\t80\t2\nB\t300\t90\t1");
  const next = applyPiecePaste({
    rows,
    startIndex: 1,
    parsed,
    familyIdByName: () => "",
  });
  assert.equal(next[0]?.name, "Ancien");
  assert.equal(next[1]?.name, "A");
  assert.equal(next[1]?.length, "200");
  assert.equal(next[2]?.name, "B");
  assert.equal(next.length, 3);
});

test("ligne vide vs ligne remplie", () => {
  assert.equal(rowHasContent(emptyRow()), false);
  assert.equal(
    rowHasContent({ ...emptyRow(), name: "x" }),
    true,
  );
});
