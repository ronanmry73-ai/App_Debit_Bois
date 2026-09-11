import type { PackMethod, StrategyId } from "./packing.ts";

export type PieceRow = {
  id: string;
  name: string;
  length: string;
  width: string;
  qty: string;
  /** Famille prioritaire, vide = règles générales. */
  familyId?: string;
};

export type HardwareItem = {
  id: string;
  name: string;
  qty: string;
  unitPrice: string;
};

export type QuoteIdentity = {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companySiret: string;
  clientName: string;
  quoteDate: string;
  quoteNumber: string;
  furnitureDescription: string;
  validity: string;
  payment: string;
  legal: string;
  vatPct: number;
  logoDataUrl: string;
};

export type AppSettings = QuoteIdentity & {
  kerf: number;
  allowRotation: boolean;
  method: PackMethod;
  /**
   * Override optionnel du prix d’achat €/m².
   * Source réelle = p_moyen fournisseur (surfaces achetées), sauf
   * si `forcePricePerM2` est vrai.
   */
  pricePerM2: number | null;
  /** Si vrai, `pricePerM2` remplace p_moyen. */
  forcePricePerM2?: boolean;
  /**
   * Taux de perte / chute τ, manuel.
   * 0 tant qu’il n’y a pas de plan ; prérempli à la chute du plan.
   */
  wastePct: number;
  marginPct: number;
  /** Override manuel de la surface utile (m²). null = pièces du plan. */
  surfaceOverrideM2: number | null;
  laborHours: number;
  hourlyRate: number;
  hardwareItems: HardwareItem[];
};

export type ViewStrategy = StrategyId;
