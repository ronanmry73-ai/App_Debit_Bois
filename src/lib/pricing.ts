/**
 * Prix de vente du meuble (matière valorisée + MO + quincaillerie + marge).
 *
 * ACHAT = mécanique (p_moyen × S_achetée), voir supplier.ts.
 * VENTE = jugement : τ est saisi par l’utilisateur.
 *
 *   p_valorisé = p_moyen / (1 − τ/100)
 *   C_matière  = S_utile × p_valorisé
 *
 *   τ = chute du plan  → C_matière ≈ C_achat = p_moyen × S_achetée
 *   τ < chute du plan  → C_matière < C_achat (chute réutilisable)
 *   τ > chute du plan  → C_matière > C_achat (chute morte / fil)
 *
 * Puis :
 *   C_revient = C_matière + MO + quincaillerie
 *   HT        = C_revient / (1 − marge/100)
 *
 * p_moyen et les lignes d’achat viennent du catalogue (prix PAR référence).
 * Aucun tarif unique inventé. Si une référence consommée n’a pas de prix,
 * C_matière / C_achat restent incomplets.
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
  /** Prix catalogue manquant : aucun euro n’est inventé. */
  incomplete?: boolean;
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
  pricePerM2: number | null;
  unitPrice: number | null;
  subtotal: number | null;
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

/** Chute du plan τ% = 100 × (1 − S_utile / S_achetée). */
export function planWastePct(usefulM2: number, purchasedM2: number): number {
  if (!(purchasedM2 > 0)) return 0;
  return roundCents(100 * Math.max(0, 1 - usefulM2 / purchasedM2));
}

/**
 * Lignes d’achat : un prix par référence (catalogue), jamais un tarif unique.
 * subtotal null si le prix de la référence manque.
 */
export function panelBuyLines(
  counts: Record<string, number>,
  specs: PanelSpec[] = DEFAULT_SPECS,
): PanelBuyLine[] {
  const out: PanelBuyLine[] = [];
  const seen = new Set<string>();
  for (const spec of specs) {
    const qty = counts[spec.id] ?? 0;
    if (qty <= 0) continue;
    seen.add(spec.id);
    const areaOne = (spec.length * spec.width) / 1_000_000;
    const areaM2 = areaOne * qty;
    const price = spec.pricePerM2 != null && spec.pricePerM2 > 0 ? spec.pricePerM2 : null;
    const unitPrice = price != null ? roundCents(areaOne * price) : null;
    out.push({
      format: spec.id,
      label: `Panneau ${spec.label}`,
      dims: `${spec.length} × ${spec.width} mm`,
      qty,
      areaM2,
      pricePerM2: price,
      unitPrice,
      subtotal: unitPrice != null ? roundCents(qty * unitPrice) : null,
    });
  }
  for (const [id, qty] of Object.entries(counts)) {
    if (qty <= 0 || seen.has(id)) continue;
    out.push({
      format: id,
      label: `Panneau ${id}`,
      dims: id,
      qty,
      areaM2: 0,
      pricePerM2: null,
      unitPrice: null,
      subtotal: null,
    });
  }
  return out;
}

/** Total d’achat de la stratégie, ou null si un prix manque. */
export function packPurchaseTotal(
  strategy: StrategyResult,
  specs: PanelSpec[] = DEFAULT_SPECS,
): number | null {
  const lines = panelBuyLines(strategy.counts, specs);
  if (lines.length === 0) return 0;
  if (lines.some((l) => l.subtotal == null)) return null;
  return roundCents(lines.reduce((s, l) => s + (l.subtotal ?? 0), 0));
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

export const INCOMPLETE_PRICE_ERROR =
  "Prix incomplet : renseignez le prix au m² de chaque référence consommée.";

export function incompleteSelling(): SellingErr {
  return {
    ok: false,
    incomplete: true,
    error: INCOMPLETE_PRICE_ERROR,
  };
}

export function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

function finiteOrZero(n: number): number {
  return Number.isFinite(n) ? n : 0;
}
