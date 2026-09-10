import { newId } from "@/lib/utils";
import type { AppSettings, HardwareItem, PieceRow, QuoteIdentity } from "@/lib/types";

export const STORAGE_KEY = "debit-bois-v4";

export function exampleRows(): PieceRow[] {
  return [
    { id: "ex-1", name: "Montant", length: "1800", width: "380", qty: "2" },
    { id: "ex-2", name: "Montant large", length: "1800", width: "560", qty: "2" },
    { id: "ex-3", name: "Traverse", length: "800", width: "90", qty: "6" },
    { id: "ex-4", name: "Tablette", length: "800", width: "380", qty: "3" },
    { id: "ex-5", name: "Tablette large", length: "800", width: "560", qty: "2" },
    { id: "ex-6", name: "Côté", length: "400", width: "350", qty: "4" },
  ];
}

/** Débit de 2 m² (2 × 2500 × 400) pour l’exemple devis 40 €/m². */
export function exampleQuoteRows(): PieceRow[] {
  return [
    { id: "q-1", name: "Tablette", length: "2500", width: "400", qty: "2" },
  ];
}

export function emptyRow(): PieceRow {
  return { id: newId(), name: "", length: "", width: "", qty: "1" };
}

export function emptyHardwareItem(): HardwareItem {
  return { id: newId(), name: "", qty: "1", unitPrice: "" };
}

export function exampleHardwareItems(): HardwareItem[] {
  return [
    { id: "hw-1", name: "Charnières invisibles", qty: "4", unitPrice: "4.5" },
    { id: "hw-2", name: "Poignées inox", qty: "2", unitPrice: "6" },
  ];
}

export function defaultQuoteIdentity(): QuoteIdentity {
  const year = new Date().getFullYear();
  const today = new Date().toISOString().slice(0, 10);
  return {
    companyName: "Atelier Bois Clair",
    companyAddress: "12 rue des Ateliers\n69003 Lyon",
    companyPhone: "04 78 12 34 56",
    companyEmail: "contact@atelier-bois-clair.fr",
    companySiret: "123 456 789 00012",
    clientName: "M. et Mme Martin",
    quoteDate: today,
    quoteNumber: `DEVIS-${year}-001`,
    furnitureDescription: "Meuble sur mesure — bibliothèque salon",
    validity: "Devis valable 30 jours.",
    payment: "Acompte 30 % à la commande, solde à la livraison.",
    legal: "Réserve de propriété jusqu’au paiement intégral. TVA applicable selon le taux indiqué.",
    vatPct: 20,
    logoDataUrl: "",
  };
}

export const METHOD_OPTIONS = [
  { value: "auto", label: "Automatique (meilleur rendement)" },
  { value: "guillotine", label: "Guillotine (coupes droites)" },
  { value: "maxrects", label: "Rectangles maximaux (densité)" },
] as const;

export function exampleQuotePatch(): Partial<AppSettings> {
  return {
    ...defaultQuoteIdentity(),
    pricePerM2: 40,
    wastePct: 15,
    laborHours: 2.5,
    hourlyRate: 40,
    hardwareItems: exampleHardwareItems(),
    marginPct: 30,
    surfaceOverrideM2: 2,
  };
}
