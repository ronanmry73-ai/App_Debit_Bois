import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyVat,
  computeSellingPrice,
  hardwareLines,
  laborCost,
  packPurchaseTotal,
  panelBuyLines,
  planWastePct,
  sellingFromInputs,
  sumHardware,
} from "./pricing.ts";
import type { PanelSpec } from "./packing.ts";

test("formule : p_valorisé = p / (1−τ), C_matière = S_utile × p_valorisé", () => {
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

test("τ = chute du plan → C_matière ≈ C_achat ; τ plus bas → matière plus basse", () => {
  const purchased = 1.5;
  const useful = 0.88;
  const pMoyen = 35;
  const tauPlan = planWastePct(useful, purchased);
  assert.equal(tauPlan, 41.33);

  const atPlan = computeSellingPrice({
    pricePerM2: pMoyen,
    surfaceM2: useful,
    wastePct: tauPlan,
    labor: 0,
    hardware: 0,
    marginPct: 0,
  });
  assert.equal(atPlan.ok, true);
  if (!atPlan.ok) return;
  assert.equal(atPlan.coutMatiere, 52.5);
  assert.equal(atPlan.coutMatiere, Math.round(pMoyen * purchased * 100) / 100);

  const lower = computeSellingPrice({
    pricePerM2: pMoyen,
    surfaceM2: useful,
    wastePct: 20,
    labor: 0,
    hardware: 0,
    marginPct: 0,
  });
  assert.equal(lower.ok, true);
  if (!lower.ok) return;
  assert.ok(lower.coutMatiere < atPlan.coutMatiere);
});

test("lignes d’achat : prix par référence, pas un tarif unique", () => {
  const specs: PanelSpec[] = [
    {
      id: "A",
      length: 2500,
      width: 400,
      label: "2500 × 400 mm",
      familyId: "fam-standard",
      familyName: "Standard",
      pricePerM2: 20,
    },
    {
      id: "B",
      length: 2500,
      width: 600,
      label: "2500 × 600 mm",
      familyId: "fam-standard",
      familyName: "Standard",
      pricePerM2: 35,
    },
  ];
  const lines = panelBuyLines({ A: 1, B: 1 }, specs);
  const a = lines.find((l) => l.format === "A");
  const b = lines.find((l) => l.format === "B");
  assert.equal(a?.pricePerM2, 20);
  assert.equal(b?.pricePerM2, 35);
  assert.equal(a?.subtotal, 20);
  assert.equal(b?.subtotal, 52.5);
  const total = packPurchaseTotal(
    {
      id: "mixed",
      label: "Mixte",
      panels: [],
      counts: { A: 1, B: 1 },
      purchasedArea: 2_500_000,
      usedArea: 0,
      wastePercent: 0,
      unplaced: [],
      method: "mixte",
    },
    specs,
  );
  assert.equal(total, 72.5);
});

test("prix manquant → total d’achat null, pas 40 €/m²", () => {
  const specs: PanelSpec[] = [
    {
      id: "B",
      length: 2500,
      width: 600,
      label: "2500 × 600 mm",
      familyId: "fam-standard",
      familyName: "Standard",
      pricePerM2: null,
    },
  ];
  const lines = panelBuyLines({ B: 1 }, specs);
  assert.equal(lines[0]?.subtotal, null);
  const total = packPurchaseTotal(
    {
      id: "all-B",
      label: "B",
      panels: [],
      counts: { B: 1 },
      purchasedArea: 1_500_000,
      usedArea: 0,
      wastePercent: 0,
      unplaced: [],
      method: "maxrects",
    },
    specs,
  );
  assert.equal(total, null);
});

test("sous-totaux quincaillerie", () => {
  const lines = hardwareLines([
    { id: "1", name: "Vis", qty: "20", unitPrice: "0.15" },
  ]);
  assert.equal(lines[0].subtotal, 3);
});

test("taux de perte ≥ 100 % est rejeté", () => {
  const r = computeSellingPrice({
    pricePerM2: 35,
    surfaceM2: 0.88,
    wastePct: 100,
    labor: 0,
    hardware: 0,
    marginPct: 20,
  });
  assert.equal(r.ok, false);
});

test("marge ≥ 100 % est rejetée", () => {
  const r = computeSellingPrice({
    pricePerM2: 35,
    surfaceM2: 0.88,
    wastePct: 10,
    labor: 0,
    hardware: 0,
    marginPct: 100,
  });
  assert.equal(r.ok, false);
});
