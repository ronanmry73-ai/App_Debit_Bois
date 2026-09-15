import { newId } from "./utils.ts";
import type { AppSettings, HardwareItem, PieceRow, QuoteIdentity } from "./types.ts";

export const STORAGE_KEY = "debit-bois-v5";
export const LEGACY_STORAGE_KEY = "debit-bois-v4";

/** Identité d’exemple (jeu chargeable uniquement — jamais un projet neuf). */
export const DEMO_COMPANY_NAME = "Atelier Bois Clair";
export const DEMO_CLIENT_NAME = "M. et Mme Martin";

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

/** Débit de 2 m² (2 × 2500 × 400) pour le jeu d’exemple devis. */
export function exampleQuoteRows(): PieceRow[] {
  return [
    { id: "q-1", name: "Tablette", length: "2500", width: "400", qty: "2" },
  ];
}

export function emptyRow(): PieceRow {
  return {
    id: newId(),
    name: "",
    length: "",
    width: "",
    qty: "1",
    familyId: "",
    grain: "default",
    group: "",
  };
}

/** Rangée initiale SSR-stable (évite un décalage d’hydratation). */
export const INITIAL_EMPTY_ROW: PieceRow = {
  id: "row-blank",
  name: "",
  length: "",
  width: "",
  qty: "1",
  familyId: "",
  grain: "default",
  group: "",
};

export function emptyHardwareItem(): HardwareItem {
  return { id: newId(), name: "", qty: "1", unitPrice: "" };
}

export function exampleHardwareItems(): HardwareItem[] {
  return [
    { id: "hw-1", name: "Charnières invisibles", qty: "4", unitPrice: "4.5" },
    { id: "hw-2", name: "Poignées inox", qty: "2", unitPrice: "6" },
  ];
}

/** Identité atelier + client d’exemple — jeu chargeable, pas un projet neuf. */
export function defaultQuoteIdentity(): QuoteIdentity {
  const year = new Date().getFullYear();
  const today = new Date().toISOString().slice(0, 10);
  return {
    companyName: DEMO_COMPANY_NAME,
    companyAddress: "12 rue des Ateliers\n69003 Lyon",
    companyPhone: "04 78 12 34 56",
    companyEmail: "contact@atelier-bois-clair.fr",
    companySiret: "123 456 789 00012",
    clientName: DEMO_CLIENT_NAME,
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

/** Projet neuf : valeurs vides. Les libellés d’exemple restent des placeholders CSS. */
export function emptyQuoteIdentity(): QuoteIdentity {
  const today = new Date().toISOString().slice(0, 10);
  return {
    companyName: "",
    companyAddress: "",
    companyPhone: "",
    companyEmail: "",
    companySiret: "",
    clientName: "",
    quoteDate: today,
    quoteNumber: "",
    furnitureDescription: "",
    validity: "",
    payment: "",
    legal: "",
    vatPct: 20,
    logoDataUrl: "",
  };
}

/** @deprecated alias — un projet neuf n’embarque plus l’identité démo. */
export function blankProjectIdentity(): QuoteIdentity {
  return emptyQuoteIdentity();
}

export function isDemoCompany(name: string): boolean {
  return name.trim() === DEMO_COMPANY_NAME;
}

export type WorkshopPrefs = {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companySiret: string;
  logoDataUrl: string;
  hourlyRate: number;
  vatPct: number;
  validity: string;
  payment: string;
  legal: string;
  /** Dossier miroir Drive Desktop. Vide = défaut Electron (H:\\Mon Drive\\…). */
  driveBackupPath?: string;
  /** Adresse de l'application déployée, à ouvrir sur le téléphone. */
  phoneUrl?: string;
};

export function emptyWorkshopPrefs(): WorkshopPrefs {
  return {
    companyName: "",
    companyAddress: "",
    companyPhone: "",
    companyEmail: "",
    companySiret: "",
    logoDataUrl: "",
    hourlyRate: 45,
    vatPct: 20,
    validity: "",
    payment: "",
    legal: "",
    driveBackupPath: "",
    phoneUrl: "",
  };
}

export function workshopPrefsFromSettings(s: AppSettings): WorkshopPrefs {
  return {
    companyName: s.companyName,
    companyAddress: s.companyAddress,
    companyPhone: s.companyPhone,
    companyEmail: s.companyEmail,
    companySiret: s.companySiret,
    logoDataUrl: s.logoDataUrl,
    hourlyRate: s.hourlyRate,
    vatPct: s.vatPct,
    validity: s.validity,
    payment: s.payment,
    legal: s.legal,
  };
}

export function settingsFromWorkshopPrefs(prefs: WorkshopPrefs): AppSettings {
  return {
    ...emptyQuoteIdentity(),
    ...prefs,
    clientName: "",
    furnitureDescription: "",
    quoteNumber: "",
    kerf: 3,
    allowRotation: true,
    method: "auto",
    pricePerM2: null,
    forcePricePerM2: false,
    wastePct: 0,
    marginPct: 20,
    surfaceOverrideM2: null,
    laborHours: 0,
    hardwareItems: [{ id: "hw-empty-1", name: "", qty: "1", unitPrice: "" }],
  };
}

export function migrateWorkshopPrefs(
  raw: unknown,
  settings: AppSettings,
): WorkshopPrefs {
  if (raw && typeof raw === "object") {
    const o = raw as Partial<WorkshopPrefs>;
    return {
      ...emptyWorkshopPrefs(),
      ...o,
      companyName: typeof o.companyName === "string" ? o.companyName : "",
      driveBackupPath:
        typeof o.driveBackupPath === "string" ? o.driveBackupPath.trim() : "",
      phoneUrl: typeof o.phoneUrl === "string" ? o.phoneUrl.trim() : "",
    };
  }
  if (settings.companyName && !isDemoCompany(settings.companyName)) {
    return workshopPrefsFromSettings(settings);
  }
  return emptyWorkshopPrefs();
}

export const METHOD_OPTIONS = [
  { value: "auto", label: "Automatique (meilleur rendement)" },
  { value: "guillotine", label: "Guillotine (coupes droites)" },
  { value: "maxrects", label: "Rectangles maximaux (densité)" },
] as const;

/** Jeu d’exemple chargeable (formule 40 € / 15 % / 2 m²), pas les défauts d’un projet neuf. */
export function exampleQuotePatch(): Partial<AppSettings> {
  return {
    ...defaultQuoteIdentity(),
    pricePerM2: 40,
    forcePricePerM2: true,
    wastePct: 15,
    laborHours: 2.5,
    hourlyRate: 40,
    hardwareItems: exampleHardwareItems(),
    marginPct: 30,
    surfaceOverrideM2: 2,
  };
}
