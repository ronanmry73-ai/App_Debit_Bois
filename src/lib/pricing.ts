/**
 * Prix de vente du meuble (matière valorisée + MO + quincaillerie + marge).
 *
 * Formule :
 *   1. Prix_m²_réel   = Prix_achat_m² / (1 − Taux_perte / 100)
 *   2. Coût_matière   = Surface_m²_nécessaire × Prix_m²_réel
 *   3. Coût_MO        = Temps_h × Taux_horaire
 *   4. Coût_quincaillerie = Σ (qté × prix unitaire)
 *   5. Coût_revient   = Coût_matière + Coût_MO + Coût_quincaillerie
 *   6. Prix_vente_HT  = Coût_revient / (1 − Marge% / 100)
 *   7. TVA            = Prix_vente_HT × Taux_TVA / 100
 *   8. Prix_vente_TTC = Prix_vente_HT + TVA
 *
 * ------------------------------------------------------------------
 * Exemple chiffré :
 *
 *   Prix d'achat fournisseur : 40 €/m²
 *   Surface nécessaire       : 2 m²
 *   Taux de perte            : 15 %
 *   Main d'œuvre             : 2,5 h × 40 €/h = 100 €
 *   Quincaillerie            : 4 × 4,50 € + 2 × 6,00 € = 30 €
 *   Marge souhaitée          : 30 %
 *
 *   Prix réel/m²   = 40 / 0,85 = 47,06 €
 *   Coût matière   = 2 × 47,06 = 94,12 €
 *   Coût de revient = 94,12 + 100 + 30 = 224,12 €
 *   Prix de vente HT = 224,12 / 0,70 = 320,17 €
 *   Marge          = 320,17 − 224,12 = 96,05 €
 *   TVA 20 %       = 64,03 €
 *   Prix TTC       = 384,20 €
 * ------------------------------------------------------------------
 */

import { DEFAULT_SPECS, type PanelSpec, type StrategyResult } from "./packing.ts";
import type { HardwareItem } from "./types.ts";

export type SellingInput = {
  pricePerM2: number;
  surfaceM2: number;
  wastePct: number;
  labor: number;
  hardware: number;
  marginPct: number;
};

export type SellingOk = {
  ok: true;
  pricePerM2: number;
  surfaceM2: number;
  wastePct: number;
  prixM2Reel: number;
  coutMatiere: number;
  labor: number;
  hardware: number;
  coutRevient: number;
  marginPct: number;
  margeEuros: number;
  prixVente: number;
};

export type SellingErr = {
  ok: false;
  error: string;
};

export type SellingResult = SellingOk | SellingErr;

export type HardwareLine = {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
};

export type PanelBuyLine = {
  format: string;
  label: string;
  dims: string;
  qty: number;
  areaM2: number;
  unitPrice: number;
  subtotal: number;
};

export function parseAmount(s: string | number): number {
  const n = typeof s === "number" ? s : Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function laborCost(hours: number, hourlyRate: number): number {
  return roundCents(Math.max(0, hours) * Math.max(0, hourlyRate));
}

export function hardwareLines(items: HardwareItem[]): HardwareLine[] {
  return items.map((item) => {
    const qty = Math.max(0, parseAmount(item.qty));
    const unitPrice = Math.max(0, parseAmount(item.unitPrice));
    return {
      id: item.id,
      name: item.name.trim(),
      qty,
      unitPrice,
      subtotal: roundCents(qty * unitPrice),
    };
  });
}

export function sumHardware(items: HardwareItem[]): number {
  return roundCents(
    hardwareLines(items).reduce((s, line) => s + line.subtotal, 0),
  );
}

export function panelBuyLines(
  counts: Record<string, number>,
  pricePerM2: number,
  specs: PanelSpec[] = DEFAULT_SPECS,
): PanelBuyLine[] {
  const price = Math.max(0, pricePerM2);
  const out: PanelBuyLine[] = [];
  for (const spec of specs) {
    const qty = counts[spec.id] ?? 0;
    if (qty <= 0) continue;
    const areaM2 = (spec.length * spec.width) / 1_000_000;
    const unitPrice = roundCents(areaM2 * price);
    out.push({
      format: spec.id,
      label: `Panneau ${spec.label}`,
      dims: `${spec.length} × ${spec.width} mm`,
      qty,
      areaM2,
      unitPrice,
      subtotal: roundCents(qty * unitPrice),
    });
  }
  for (const [id, qty] of Object.entries(counts)) {
    if (qty <= 0 || specs.some((s) => s.id === id)) continue;
    out.push({
      format: id,
      label: `Panneau ${id}`,
      dims: id,
      qty,
      areaM2: 0,
      unitPrice: 0,
      subtotal: 0,
    });
  }
  return out;
}

export function applyVat(
  ht: number,
  vatPct: number,
): { tva: number; ttc: number } {
  const tva = roundCents(ht * Math.max(0, vatPct) / 100);
  return { tva, ttc: roundCents(ht + tva) };
}

export function computeSellingPrice(input: SellingInput): SellingResult {
  const pricePerM2 = finiteOrZero(input.pricePerM2);
  const surfaceM2 = finiteOrZero(input.surfaceM2);
  const wastePct = finiteOrZero(input.wastePct);
  const labor = finiteOrZero(input.labor);
  const hardware = finiteOrZero(input.hardware);
  const marginPct = finiteOrZero(input.marginPct);

  if (wastePct >= 100) {
    return {
      ok: false,
      error:
        "Le taux de perte doit être inférieur à 100 % (sinon le bois utile est nul).",
    };
  }
  if (wastePct < 0) {
    return { ok: false, error: "Le taux de perte ne peut pas être négatif." };
  }
  if (marginPct >= 100) {
    return {
      ok: false,
      error:
        "La marge doit être inférieure à 100 % du prix de vente (division impossible).",
    };
  }
  if (marginPct < 0) {
    return { ok: false, error: "La marge ne peut pas être négative." };
  }

  const prixM2Reel = roundCents(pricePerM2 / (1 - wastePct / 100));
  const coutMatiere = roundCents(surfaceM2 * prixM2Reel);
  const coutRevient = roundCents(coutMatiere + labor + hardware);
  const prixVente = roundCents(coutRevient / (1 - marginPct / 100));
  const margeEuros = roundCents(prixVente - coutRevient);

  return {
    ok: true,
    pricePerM2: roundCents(pricePerM2),
    surfaceM2,
    wastePct,
    prixM2Reel,
    coutMatiere,
    labor: roundCents(labor),
    hardware: roundCents(hardware),
    coutRevient,
    marginPct,
    margeEuros,
    prixVente,
  };
}

export function sellingFromInputs(
  surfaceM2: number,
  pricePerM2: number,
  wastePct: number,
  laborHours: number,
  hourlyRate: number,
  items: HardwareItem[],
  marginPct: number,
): SellingResult {
  return computeSellingPrice({
    pricePerM2,
    surfaceM2,
    wastePct,
    labor: laborCost(laborHours, hourlyRate),
    hardware: sumHardware(items),
    marginPct,
  });
}

export function packPurchaseTotal(strategy: StrategyResult, pricePerM2: number): number {
  return roundCents(
    panelBuyLines(strategy.counts, pricePerM2).reduce((s, l) => s + l.subtotal, 0),
  );
}

export function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

function finiteOrZero(n: number): number {
  return Number.isFinite(n) ? n : 0;
}
