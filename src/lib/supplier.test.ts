import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePriceInput, createRef, seedCatalog, packingSpecs, updateRef } from "./catalog.ts";
import { supplierCostFromCounts } from "./supplier.ts";

test("saisie prix : vide, virgule, négatif, non numérique", () => {
  assert.deepEqual(parsePriceInput(""), { ok: true, value: null });
  assert.deepEqual(parsePriceInput("18,50"), { ok: true, value: 18.5 });
  assert.equal(parsePriceInput("-2").ok, false);
  assert.equal(parsePriceInput("abc").ok, false);
  assert.equal(parsePriceInput("0").ok, false);
  assert.deepEqual(parsePriceInput(20), { ok: true, value: 20 });
});

test("moyenne pondérée 4 m² à 20 € et 2 m² à 30 € → 23,33 €/m²", () => {
  const specs = [
    {
      id: "A",
      length: 2000,
      width: 1000,
      label: "A",
      familyId: "f",
      familyName: "Tilly",
      pricePerM2: 20,
    },
    {
      id: "B",
      length: 2000,
      width: 1000,
      label: "B",
      familyId: "f",
      familyName: "Tilly",
      pricePerM2: 30,
    },
  ];
  // 2000×1000 = 2 m²/panneau → 2 panneaux A = 4 m², 1 panneau B = 2 m²
  const cost = supplierCostFromCounts({ A: 2, B: 1 }, specs);
  assert.equal(cost.totalAreaM2, 6);
  assert.equal(cost.lines.find((l) => l.specId === "A")?.cost, 80);
  assert.equal(cost.lines.find((l) => l.specId === "B")?.cost, 60);
  assert.equal(cost.totalCost, 140);
  assert.equal(cost.weightedPricePerM2, 23.33);
  assert.equal(cost.missing.length, 0);
});

test("référence sans prix : pas d’invention, liste les manquants", () => {
  const specs = packingSpecs(seedCatalog());
  const cost = supplierCostFromCounts({ A: 1, B: 1 }, specs);
  assert.equal(cost.totalCost, null);
  assert.equal(cost.weightedPricePerM2, null);
  assert.ok(cost.missing.some((m) => m.specId === "A"));
  assert.ok(cost.missing.some((m) => m.specId === "B"));
});

test("modifier le prix catalogue ne change pas un instantané déjà calculé", () => {
  let cat = seedCatalog();
  cat = updateRef(cat, "A", { pricePerM2: 18.5 }).catalog;
  const snap = supplierCostFromCounts({ A: 2 }, packingSpecs(cat));
  assert.equal(snap.lines[0]?.pricePerM2, 18.5);
  cat = updateRef(cat, "A", { pricePerM2: 40 }).catalog;
  assert.equal(snap.lines[0]?.pricePerM2, 18.5);
  const live = supplierCostFromCounts({ A: 2 }, packingSpecs(cat));
  assert.equal(live.lines[0]?.pricePerM2, 40);
});

test("créer une référence avec prix 18,50 €/m²", () => {
  const famId = seedCatalog().families[0]!.id;
  const out = createRef(seedCatalog(), {
    familyId: famId,
    length: 3000,
    width: 600,
    pricePerM2: "18,50",
  });
  assert.equal(out.error, undefined);
  assert.equal(out.ref?.pricePerM2, 18.5);
});
