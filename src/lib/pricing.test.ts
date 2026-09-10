import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyVat,
  computeSellingPrice,
  hardwareLines,
  laborCost,
  sellingFromInputs,
  sumHardware,
} from "./pricing.ts";

test("exemple chiffré : 40 €/m², 2 m², 15 %, 2,5 h × 40 €, quincaillerie 30 €, marge 30 %", () => {
  const items = [
    { id: "a", name: "Charnières invisibles", qty: "4", unitPrice: "4.5" },
    { id: "b", name: "Poignées inox", qty: "2", unitPrice: "6" },
  ];
  assert.equal(laborCost(2.5, 40), 100);
  assert.equal(sumHardware(items), 30);

  const r = sellingFromInputs(2, 40, 15, 2.5, 40, items, 30);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.prixM2Reel, 47.06);
  assert.equal(r.coutMatiere, 94.12);
  assert.equal(r.labor, 100);
  assert.equal(r.hardware, 30);
  assert.equal(r.coutRevient, 224.12);
  assert.equal(r.prixVente, 320.17);
  assert.equal(r.margeEuros, 96.05);

  const vat = applyVat(r.prixVente, 20);
  assert.equal(vat.tva, 64.03);
  assert.equal(vat.ttc, 384.2);
});

test("sous-totaux quincaillerie", () => {
  const lines = hardwareLines([
    { id: "1", name: "Vis", qty: "20", unitPrice: "0.15" },
  ]);
  assert.equal(lines[0].subtotal, 3);
});

test("taux de perte ≥ 100 % est rejeté", () => {
  const r = computeSellingPrice({
    pricePerM2: 40,
    surfaceM2: 2,
    wastePct: 100,
    labor: 0,
    hardware: 0,
    marginPct: 20,
  });
  assert.equal(r.ok, false);
});

test("marge ≥ 100 % est rejetée", () => {
  const r = computeSellingPrice({
    pricePerM2: 40,
    surfaceM2: 2,
    wastePct: 15,
    labor: 0,
    hardware: 0,
    marginPct: 100,
  });
  assert.equal(r.ok, false);
});
