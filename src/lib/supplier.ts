/**
 * Coût d’achat fournisseur d’un débit : moyenne pondérée par la surface
 * des panneaux réellement consommés (quantité × L × l), pas une moyenne
 * arithmétique des prix catalogue.
 *
 *   Prix_moyen = Σ (surface_réf × prix_réf) / Σ surface_réf
 *   Prix_total = Σ (surface_réf × prix_réf)
 */

import type { PanelSpec } from "./catalog.ts";
import { roundCents } from "./pricing.ts";

export type SupplierLine = {
  specId: string;
  familyId: string;
  familyName: string;
  name: string;
  length: number;
  width: number;
  qty: number;
  areaM2: number;
  pricePerM2: number | null;
  cost: number | null;
};

export type SupplierCost = {
  lines: SupplierLine[];
  totalAreaM2: number;
  /** null si au moins une référence n’a pas de prix. */
  weightedPricePerM2: number | null;
  totalCost: number | null;
  missing: { specId: string; label: string }[];
  calculatedAt: string;
};

export function panelAreaM2(length: number, width: number, qty: number): number {
  return (Math.max(0, length) * Math.max(0, width) * Math.max(0, qty)) / 1_000_000;
}

export function supplierCostFromCounts(
  counts: Record<string, number>,
  specs: PanelSpec[],
  priceOverride?: Record<string, number | null>,
  calculatedAt = new Date().toISOString(),
): SupplierCost {
  const lines: SupplierLine[] = [];
  const missing: { specId: string; label: string }[] = [];

  for (const [specId, rawQty] of Object.entries(counts)) {
    const qty = Math.max(0, rawQty);
    if (qty <= 0) continue;
    const spec = specs.find((s) => s.id === specId);
    const length = spec?.length ?? 0;
    const width = spec?.width ?? 0;
    const areaM2 = panelAreaM2(length, width, qty);
    const override = priceOverride && specId in priceOverride
      ? priceOverride[specId]!
      : undefined;
    const pricePerM2 =
      override !== undefined ? override : (spec?.pricePerM2 ?? null);
    const label = spec?.label ?? specId;
    const cost =
      pricePerM2 != null && pricePerM2 > 0
        ? roundCents(areaM2 * pricePerM2)
        : null;
    if (cost == null) {
      missing.push({ specId, label });
    }
    lines.push({
      specId,
      familyId: spec?.familyId ?? "",
      familyName: spec?.familyName ?? "",
      name: label,
      length,
      width,
      qty,
      areaM2: roundCents(areaM2 * 1) === areaM2 ? areaM2 : roundCents(areaM2),
      pricePerM2,
      cost,
    });
  }

  const totalAreaM2 = lines.reduce((s, l) => s + l.areaM2, 0);
  const complete = missing.length === 0 && lines.length > 0;
  const totalCost = complete
    ? roundCents(lines.reduce((s, l) => s + (l.cost ?? 0), 0))
    : null;
  const weightedPricePerM2 =
    complete && totalAreaM2 > 0 ? roundCents(totalCost! / totalAreaM2) : null;

  return {
    lines,
    totalAreaM2: roundCents(totalAreaM2),
    weightedPricePerM2,
    totalCost,
    missing,
    calculatedAt,
  };
}

export function snapshotDiffers(
  live: SupplierCost | null,
  saved: SupplierCost | null,
): boolean {
  if (!live || !saved) return false;
  if (live.lines.length !== saved.lines.length) return true;
  if (live.weightedPricePerM2 !== saved.weightedPricePerM2) return true;
  if (live.totalCost !== saved.totalCost) return true;
  for (const line of live.lines) {
    const prev = saved.lines.find((l) => l.specId === line.specId);
    if (!prev) return true;
    if (prev.pricePerM2 !== line.pricePerM2) return true;
    if (prev.qty !== line.qty) return true;
  }
  return false;
}
