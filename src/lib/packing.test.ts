import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertValidLayout,
  DEFAULT_SPECS,
  optimizeCutting,
  type PieceDef,
} from "./packing.ts";
import { createFamily, createRef, seedCatalog, packingSpecs } from "./catalog.ts";

function defs(rows: Array<[string, number, number, number]>): PieceDef[] {
  return rows.map(([name, length, width, qty], i) => ({
    id: `p${i}`,
    name,
    length,
    width,
    qty,
  }));
}

test("une pièce pile à la taille du panneau A tient avec kerf", () => {
  const out = optimizeCutting(defs([["Plein", 2500, 400, 1]]), {
    kerf: 3,
    allowRotation: false,
    method: "auto",
  });
  const a = out.strategies.find((s) => s.id === "all-A")!;
  assert.equal(a.counts.A, 1);
  assert.equal(a.unplaced.length, 0);
  assert.equal(assertValidLayout(a.panels[0]!, 3).length, 0);
});

test("pièce trop large pour 400 va sur 600", () => {
  const out = optimizeCutting(defs([["Large", 1800, 560, 1]]), {
    kerf: 3,
    allowRotation: true,
    method: "auto",
  });
  const a = out.strategies.find((s) => s.id === "all-A")!;
  const b = out.strategies.find((s) => s.id === "all-B")!;
  assert.ok(a.unplaced.length >= 1);
  assert.equal(b.unplaced.length, 0);
  assert.equal(b.counts.B, 1);
});

test("deux pièces 1200×390 tiennent sur un 2500×400", () => {
  const out = optimizeCutting(defs([["A", 1200, 390, 2]]), {
    kerf: 3,
    allowRotation: false,
    method: "auto",
  });
  const a = out.strategies.find((s) => s.id === "all-A")!;
  assert.equal(a.counts.A, 1);
  assert.equal(a.panels[0]!.placements.length, 2);
  assert.equal(assertValidLayout(a.panels[0]!, 3).length, 0);
});

test("rotation 90° nécessaire pour 380×500 sur panneau 400", () => {
  const noRot = optimizeCutting(defs([["T", 380, 500, 1]]), {
    kerf: 3,
    allowRotation: false,
    method: "maxrects",
  });
  const aNo = noRot.strategies.find((s) => s.id === "all-A")!;
  assert.ok(aNo.unplaced.length >= 1);

  const rot = optimizeCutting(defs([["T", 380, 500, 1]]), {
    kerf: 3,
    allowRotation: true,
    method: "guillotine",
  });
  const aYes = rot.strategies.find((s) => s.id === "all-A")!;
  assert.equal(aYes.unplaced.length, 0);
  assert.equal(aYes.panels[0]!.placements[0]!.rotated, true);
});

test("exemple étagère : mixte place tout", () => {
  const out = optimizeCutting(
    defs([
      ["Montant", 1800, 380, 2],
      ["Montant large", 1800, 560, 2],
      ["Traverse", 800, 90, 6],
      ["Tablette", 800, 380, 3],
      ["Tablette large", 800, 560, 2],
      ["Côté", 400, 350, 4],
    ]),
    { kerf: 3, allowRotation: true, method: "auto" },
  );
  const mixed = out.strategies.find((s) => s.id === "mixed")!;
  assert.equal(mixed.unplaced.length, 0);
  assert.ok(mixed.counts.B >= 1, "doit utiliser au moins un 600");
  for (const p of mixed.panels) {
    assert.equal(assertValidLayout(p, 3).length, 0);
  }
});

test("famille Tilly : pièce trop grande → message, pas d’autre famille", () => {
  let cat = seedCatalog();
  const fam = createFamily(cat, "Tilly");
  cat = fam.catalog;
  const ref = createRef(cat, {
    familyId: fam.family!.id,
    name: "P-3000-600",
    length: 3000,
    width: 600,
  });
  cat = ref.catalog;
  const specs = packingSpecs(cat);
  const out = optimizeCutting(
    [
      {
        id: "cote",
        name: "Côté gauche",
        length: 800,
        width: 350,
        qty: 1,
        familyId: fam.family!.id,
        familyName: "Tilly",
      },
    ],
    { kerf: 3, allowRotation: true, method: "auto", specs },
  );
  assert.equal(out.warnings.length, 0);
  const mixed = out.strategies.find((s) => s.id === "mixed")!;
  assert.equal(mixed.unplaced.length, 0);
  assert.ok(
    mixed.panels.every((p) => p.format === ref.ref!.id),
    "la pièce Tilly ne doit pas aller sur Standard",
  );

  const tooBig = optimizeCutting(
    [
      {
        id: "xx",
        name: "Côté gauche",
        length: 2900,
        width: 700,
        qty: 1,
        familyId: fam.family!.id,
        familyName: "Tilly",
      },
    ],
    { kerf: 3, allowRotation: true, method: "auto", specs },
  );
  assert.ok(tooBig.warnings.length >= 1);
  assert.match(tooBig.warnings[0]!.message, /Tilly/);
  assert.match(tooBig.warnings[0]!.message, /Côté gauche/);
  for (const s of tooBig.strategies) {
    assert.ok(s.unplaced.length >= 1, `${s.id} ne doit pas replacer silencieusement`);
  }
});

test("référence 3000×600 utilisable dynamiquement", () => {
  const specs = [
    ...DEFAULT_SPECS,
    {
      id: "C",
      length: 3000,
      width: 600,
      label: "3000 × 600 mm",
      familyId: "fam-standard",
      familyName: "Standard",
    },
  ];
  const out = optimizeCutting(defs([["Long", 2900, 580, 1]]), {
    kerf: 3,
    allowRotation: false,
    method: "auto",
    specs,
  });
  const allC = out.strategies.find((s) => s.id === "all-C")!;
  assert.equal(allC.unplaced.length, 0);
  assert.equal(allC.counts.C, 1);
  const allA = out.strategies.find((s) => s.id === "all-A")!;
  assert.ok(allA.unplaced.length >= 1);
});
