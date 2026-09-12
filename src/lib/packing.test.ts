import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertValidLayout,
  canSwapOnPanel,
  DEFAULT_SPECS,
  isStockableOffcut,
  leftoverRects,
  optimizeCutting,
  stockableLeftovers,
  swapOnPanel,
  type PieceDef,
} from "./packing.ts";
import { createFamily, createRef, seedCatalog, packingSpecs } from "./catalog.ts";
import { supplierCostFromCounts } from "./supplier.ts";

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

test("pièce locked n’est jamais tournée, même si le job autorise la rotation", () => {
  const locked: PieceDef[] = [
    {
      id: "t",
      name: "T",
      length: 380,
      width: 500,
      qty: 1,
      canRotate: false,
    },
  ];
  const out = optimizeCutting(locked, {
    kerf: 3,
    allowRotation: true,
    method: "maxrects",
  });
  const a = out.strategies.find((s) => s.id === "all-A")!;
  assert.ok(a.unplaced.length >= 1, "ne rentre pas sans tourner");
  for (const p of a.panels) {
    for (const pl of p.placements) {
      assert.equal(pl.rotated, false);
      assert.equal(pl.w, 380);
      assert.equal(pl.h, 500);
    }
  }
});

test("pièce free peut tourner même si le job l’interdit", () => {
  const free: PieceDef[] = [
    {
      id: "t",
      name: "T",
      length: 380,
      width: 500,
      qty: 1,
      canRotate: true,
    },
  ];
  const out = optimizeCutting(free, {
    kerf: 3,
    allowRotation: false,
    method: "guillotine",
  });
  const a = out.strategies.find((s) => s.id === "all-A")!;
  assert.equal(a.unplaced.length, 0);
  assert.equal(a.panels[0]!.placements[0]!.rotated, true);
});

test("seuil chute : petit côté ≥ 300 mm ou surface ≥ 0,05 m²", () => {
  assert.equal(isStockableOffcut(300, 400), true);
  assert.equal(isStockableOffcut(200, 250), true);
  assert.equal(isStockableOffcut(200, 249), false);
  assert.equal(isStockableOffcut(299, 100), false);
});

test("job A : pièce 1300×400 laisse une chute stockable ~1200×400", () => {
  const out = optimizeCutting(defs([["Long", 1300, 400, 1]]), {
    kerf: 3,
    allowRotation: false,
    method: "maxrects",
  });
  const a = out.strategies.find((s) => s.id === "all-A")!;
  assert.equal(a.unplaced.length, 0);
  const left = leftoverRects(a.panels[0]!, 3);
  const stockable = stockableLeftovers(a.panels[0]!, 3);
  assert.ok(left.some((r) => r.w >= 1100 && r.h >= 380));
  assert.ok(stockable.length >= 1);
  assert.ok(stockable.every((r) => isStockableOffcut(r.w, r.h)));
});

test("job B : pièce 800×350 sur chute 1200×380 → 0 feuille neuve", () => {
  const offcuts = [
    {
      id: "oc-job-a",
      length: 1200,
      width: 380,
      familyId: "fam-standard",
      familyName: "Standard",
      name: "Chute 1200×380",
      qty: 1,
    },
  ];
  const out = optimizeCutting(
    [
      {
        id: "t",
        name: "Tablette",
        length: 800,
        width: 350,
        qty: 1,
        familyId: "fam-standard",
        familyName: "Standard",
      },
    ],
    { kerf: 3, allowRotation: true, method: "auto", offcuts },
  );
  const best = out.strategies.find((s) => s.id === out.bestId)!;
  assert.equal(best.unplaced.length, 0);
  assert.equal(best.purchasedArea, 0);
  assert.equal(best.counts.A ?? 0, 0);
  assert.equal(best.counts.B ?? 0, 0);
  assert.equal(best.offcutsUsed?.length, 1);
  assert.equal(best.offcutsUsed?.[0]?.stockItemId, "oc-job-a");
  assert.ok(best.panels.some((p) => p.source === "offcut"));
  const cost = supplierCostFromCounts(best.counts, DEFAULT_SPECS);
  assert.equal(cost.lines.length, 0);
  assert.equal(cost.totalCost, null);
  assert.equal(cost.weightedPricePerM2, null);
});

test("chute autre famille ignorée", () => {
  const offcuts = [
    {
      id: "oc-std",
      length: 1200,
      width: 380,
      familyId: "fam-standard",
      familyName: "Standard",
      name: "Chute Standard",
      qty: 1,
    },
  ];
  const out = optimizeCutting(
    [
      {
        id: "t",
        name: "Côté Tilly",
        length: 800,
        width: 350,
        qty: 1,
        familyId: "fam-tilly",
        familyName: "Tilly",
      },
    ],
    { kerf: 3, allowRotation: true, method: "auto", offcuts },
  );
  for (const s of out.strategies) {
    assert.equal((s.offcutsUsed ?? []).length, 0, `${s.id} ne doit pas prendre la chute Standard`);
    assert.ok(
      s.panels.every((p) => p.source !== "offcut"),
      `${s.id} ne pose pas Tilly sur chute Standard`,
    );
  }
});

test("pièce plus grande que les chutes → feuille neuve, chutes intactes", () => {
  const offcuts = [
    {
      id: "oc-small",
      length: 1200,
      width: 380,
      familyId: "fam-standard",
      familyName: "Standard",
      name: "Chute 1200×380",
      qty: 1,
    },
  ];
  const out = optimizeCutting(
    [
      {
        id: "big",
        name: "Grand",
        length: 2000,
        width: 390,
        qty: 1,
        familyId: "fam-standard",
        familyName: "Standard",
      },
    ],
    { kerf: 3, allowRotation: false, method: "auto", offcuts },
  );
  const best = out.strategies.find((s) => s.id === out.bestId)!;
  assert.equal(best.unplaced.length, 0);
  assert.ok((best.counts.A ?? 0) >= 1);
  assert.equal((best.offcutsUsed ?? []).length, 0);
  assert.ok(best.purchasedArea > 0);
});

test("échanger deux pièces de même taille, refuser si rectangles incompatibles", () => {
  const out = optimizeCutting(defs([["A", 800, 350, 1], ["B", 800, 350, 1]]), {
    kerf: 3,
    allowRotation: false,
    method: "maxrects",
  });
  const a = out.strategies.find((s) => s.id === "all-A")!;
  const panel = a.panels[0]!;
  assert.ok(panel.placements.length >= 2);
  const p0 = panel.placements[0]!;
  const p1 = panel.placements[1]!;
  const ok = canSwapOnPanel(p0, p1);
  assert.equal(ok.ok, true);
  const swapped = swapOnPanel(panel, p0.instanceId, p1.instanceId);
  assert.equal(swapped.ok, true);
  if (swapped.ok) {
    const n0 = swapped.panel.placements.find((p) => p.instanceId === p0.instanceId)!;
    const n1 = swapped.panel.placements.find((p) => p.instanceId === p1.instanceId)!;
    assert.equal(n0.x, p1.x);
    assert.equal(n0.y, p1.y);
    assert.equal(n1.x, p0.x);
    assert.equal(n1.y, p0.y);
    assert.equal(assertValidLayout(swapped.panel, 3).length, 0);
  }
  const refuse = canSwapOnPanel(
    { ...p0, w: 400, h: 300 },
    { ...p1, w: 800, h: 350 },
  );
  assert.equal(refuse.ok, false);
});
