import type { PackMethod, StrategyId } from "./packing.ts";

export type PieceRow = {
  id: string;
  name: string;
  length: string;
  width: string;
  qty: string;
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
  pricePerM2: number;
  wastePct: number;
  marginPct: number;
  surfaceOverrideM2: number | null;
  laborHours: number;
  hourlyRate: number;
  hardwareItems: HardwareItem[];
};

export type ViewStrategy = StrategyId;
