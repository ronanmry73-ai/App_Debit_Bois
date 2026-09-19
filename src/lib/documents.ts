/**
 * Registre des documents — factures clients, factures fournisseurs, tickets.
 *
 * L'application **n'émet pas** les factures : elle importe les pièces produites
 * ailleurs, les indexe et les conserve. Ce module est la partie **pure** (aucun
 * accès disque, aucun réseau) :
 *
 *   - lecture du **gabarit d'export** de l'outil de facturation (rapport en trois
 *     blocs `Clients` / `Factures` / `Produit`) ;
 *   - **trois contrôles** avant d'accepter un fichier (ligne, taux légal, total de
 *     pied) — un export tronqué ou retouché est refusé, jamais importé de travers ;
 *   - **fusion idempotente** : un ré-import met à jour, il n'empile pas, et un
 *     montant qui change est signalé comme conflit au lieu d'être réécrit.
 *
 * Les fichiers eux-mêmes (classement dans `factures/`, empreintes) sont gérés
 * côté Electron.
 */

import { newId } from "./utils.ts";

export type DocumentKind =
  | "facture_client"
  | "avoir_client"
  | "facture_fournisseur"
  | "ticket"
  | "autre";

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  facture_client: "Facture client",
  avoir_client: "Avoir client",
  facture_fournisseur: "Facture fournisseur",
  ticket: "Ticket",
  autre: "Autre pièce",
};

export type DocumentSource = "import_csv" | "import_fichier" | "photo" | "manuel";

/** Ligne d'une facture telle que lue dans l'export. */
export type DocumentLine = {
  designation: string;
  quantite: number;
  /** Prix unitaire HT. */
  htUnitaire: number;
  /** Prix unitaire TTC. */
  ttcUnitaire: number;
  /** Total de la ligne TTC = quantité × TTC unitaire. */
  totalTtc: number;
  /** Taux de TVA déduit de la ligne (0 · 2,1 · 5,5 · 8,5 · 10 · 20). */
  taux: number;
};

export type DocumentFile = {
  /** Chemin relatif dans le dossier Drive `factures/`. */
  chemin: string;
  /** Empreinte du fichier (détection de doublon). */
  empreinte?: string;
  taille?: number;
};

export type DocumentTiers = {
  nom: string;
  prenom?: string;
  adresse?: string;
  telephone?: string;
  email?: string;
};

export type IndexedDocument = {
  id: string;
  kind: DocumentKind;
  /** Numéro tel qu'écrit sur la pièce (vide pour un ticket). */
  numero: string;
  /** Date de la pièce (ISO, calée à midi local). */
  dateDocument: string | null;
  tiers: DocumentTiers;
  lignes: DocumentLine[];
  /** Totaux calculés depuis les lignes. */
  ht: number;
  tva: number;
  ttc: number;
  /** Remarques non bloquantes : complétude, conflits, lignes ignorées. */
  avertissements: string[];
  fichier: DocumentFile | null;
  source: DocumentSource;
  importedAt: string;
  updatedAt: string;
};

/** Taux de TVA légaux en France. */
export const TVA_RATES: readonly number[] = [0, 2.1, 5.5, 8.5, 10, 20];

/** Tolérance sur les montants : un centime, pas plus. */
export const MONEY_TOLERANCE = 0.02;
/** Tolérance sur le taux déduit, en points de pourcentage. */
export const RATE_TOLERANCE = 0.5;

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* Lectures de champs                                                  */
/* ------------------------------------------------------------------ */

/**
 * Montant « à la française » : `1 234,56`, `1.234,56`, `1234.56`, `150 €`.
 * Renvoie `null` si rien d'exploitable — jamais `NaN` silencieux.
 */
export function parseMontant(raw: unknown): number | null {
  const text = String(raw ?? "")
    .replace(/\u00a0|\u202f/g, " ")
    .replace(/€/g, "")
    .replace(/[^0-9,.\-]/g, "")
    .replace(/\s/g, "");
  if (!text || text === "-" || text === "." || text === ",") return null;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  let normalized = text;
  if (lastComma >= 0 && lastDot >= 0) {
    normalized =
      lastComma > lastDot
        ? text.replace(/\./g, "").replace(",", ".")
        : text.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = text.replace(",", ".");
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Date `12/08/2024` ou `2024-08-12` → ISO à midi local (pas de bascule de jour). */
export function parseDateFr(raw: unknown): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const fr = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(value);
  if (fr) {
    const day = Number(fr[1]);
    const month = Number(fr[2]);
    let year = Number(fr[3]);
    if (year < 100) year += 2000;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(year, month - 1, day, 12, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

/** Taux de TVA déduit d'un couple HT / TTC, ou `null` si hors des taux légaux. */
export function resolveTaux(ht: number, ttc: number): number | null {
  if (!Number.isFinite(ht) || !Number.isFinite(ttc)) return null;
  if (ht === 0) return ttc === 0 ? 0 : null;
  const taux = (ttc / ht - 1) * 100;
  let best: number | null = null;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const rate of TVA_RATES) {
    const gap = Math.abs(rate - taux);
    if (gap < bestGap) {
      bestGap = gap;
      best = rate;
    }
  }
  return best !== null && bestGap <= RATE_TOLERANCE ? best : null;
}

/* ------------------------------------------------------------------ */
/* Lecture du gabarit d'export                                         */
/* ------------------------------------------------------------------ */

export type ParsedFacture = {
  numero: string;
  dateDocument: string | null;
  tiers: DocumentTiers;
  lignes: DocumentLine[];
  ht: number;
  tva: number;
  ttc: number;
  /** Total lu dans le pied de tableau (contrôle), `null` s'il est absent. */
  totalDeclare: number | null;
  avertissements: string[];
};

export type ParseFactureResult =
  | { ok: true; facture: ParsedFacture }
  | { ok: false; erreurs: string[] };

/** Séparateur dominant : l'export est tabulé, mais on ne s'y fie pas aveuglément. */
export function detectSeparator(text: string): string {
  const tabs = (text.match(/\t/g) ?? []).length;
  const semicolons = (text.match(/;/g) ?? []).length;
  return tabs >= semicolons ? "\t" : ";";
}

/**
 * Découpe une ligne en cellules en **respectant les guillemets**.
 *
 * Indispensable pour les exports point-virgule : une adresse comme
 * « 78 rue de l'arbre; 73100 Aime » y est citée, et un découpage naïf sur `;`
 * décalerait toutes les colonnes suivantes.
 */
export function splitDelimitedLine(line: string, separator: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === separator) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function normalizeCell(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/** Ligne non vide suivante à partir de `from` (-1 s'il n'y en a plus). */
function rowsNonEmptyFrom(rows: string[][], from: number): number {
  for (let i = from; i < rows.length; i += 1) {
    if ((rows[i] ?? []).some((cell) => cell !== "")) return i;
  }
  return -1;
}

/** Première ligne contenant toutes les amorces demandées (en-tête de colonnes). */
function rowsFindHeader(rows: string[][], from: number, required: string[]): number {
  for (let i = from; i < rows.length; i += 1) {
    const cells = (rows[i] ?? []).map(normalizeCell);
    if (required.every((needle) => cells.some((cell) => cell.startsWith(needle)))) {
      return i;
    }
  }
  return -1;
}

/** Ligne d'un titre de bloc (« Clients », « Factures », « Produit »). */
function rowsIndexOfBlock(rows: string[][], label: string): number {
  return rows.findIndex((row) => row.some((cell) => normalizeCell(cell) === label));
}

/**
 * Index d'une colonne : correspondance **exacte** d'abord, pour qu'« Adresse »
 * ne capture pas « Adresse Mail » quand l'ordre des colonnes change.
 */
function columnIndex(header: string[], needles: string[]): number {
  for (const needle of needles) {
    const exact = header.findIndex((cell) => cell === needle);
    if (exact >= 0) return exact;
  }
  for (const needle of needles) {
    const prefix = header.findIndex((cell) => cell.startsWith(needle));
    if (prefix >= 0) return prefix;
  }
  return -1;
}

function cellOfRow(row: string[], index: number): string {
  return index >= 0 ? (row[index] ?? "") : "";
}

/** Dernier montant exploitable d'une ligne (le total de pied, par exemple). */
function lastMontantOf(row: string[]): number | null {
  for (let i = row.length - 1; i >= 0; i -= 1) {
    const value = parseMontant(row[i]);
    if (value !== null) return value;
  }
  return null;
}

/** Bloc « Clients » : identité du client facturé. */
function readClientsBlock(rows: string[][]): {
  tiers: DocumentTiers;
  erreurs: string[];
  avertissements: string[];
} {
  const erreurs: string[] = [];
  const avertissements: string[] = [];
  const headerAt = rowsFindHeader(rows, rowsIndexOfBlock(rows, "clients") + 1, ["nom"]);
  if (headerAt < 0) {
    erreurs.push("En-tête du bloc « Clients » introuvable (colonne « Nom »).");
    return { tiers: { nom: "" }, erreurs, avertissements };
  }
  const header = (rows[headerAt] ?? []).map(normalizeCell);
  const dataAt = rowsNonEmptyFrom(rows, headerAt + 1);
  const data = dataAt >= 0 ? (rows[dataAt] ?? []) : [];
  const tiers: DocumentTiers = {
    nom: cellOfRow(data, columnIndex(header, ["nom"])),
    prenom: cellOfRow(data, columnIndex(header, ["prenom"])) || undefined,
    adresse: cellOfRow(data, columnIndex(header, ["adresse"])) || undefined,
    telephone: cellOfRow(data, columnIndex(header, ["telephone", "tel"])) || undefined,
    email:
      cellOfRow(data, columnIndex(header, ["adresse mail", "mail", "email", "e-mail"])) ||
      undefined,
  };
  if (!tiers.nom) avertissements.push("Nom du client absent de l'export.");
  return { tiers, erreurs, avertissements };
}

/** Bloc « Factures » : numéro et date de la pièce. */
function readFacturesBlock(rows: string[][]): {
  numero: string;
  dateDocument: string | null;
  erreurs: string[];
  avertissements: string[];
} {
  const erreurs: string[] = [];
  const avertissements: string[] = [];
  const headerAt = rowsFindHeader(rows, rowsIndexOfBlock(rows, "factures") + 1, ["num"]);
  if (headerAt < 0) {
    erreurs.push("En-tête du bloc « Factures » introuvable (colonne « Num Facture »).");
    return { numero: "", dateDocument: null, erreurs, avertissements };
  }
  const header = (rows[headerAt] ?? []).map(normalizeCell);
  const dataAt = rowsNonEmptyFrom(rows, headerAt + 1);
  const data = dataAt >= 0 ? (rows[dataAt] ?? []) : [];
  const numero = cellOfRow(data, columnIndex(header, ["num"])).trim();
  const rawDate = cellOfRow(data, columnIndex(header, ["date"]));
  const dateDocument = parseDateFr(rawDate);
  if (!numero) avertissements.push("Numéro de facture absent de l'export.");
  if (!dateDocument) {
    avertissements.push(
      rawDate ? `Date de facture illisible (« ${rawDate} »).` : "Date de facture absente.",
    );
  }
  return { numero, dateDocument, erreurs, avertissements };
}

/**
 * Bloc « Produit » : les lignes et le total de pied.
 * `HT` / `TTC` sont des **prix unitaires**, `Total` porte le montant de la ligne.
 */
function readProduitBlock(rows: string[][]): {
  lignes: DocumentLine[];
  totalDeclare: number | null;
  erreurs: string[];
  avertissements: string[];
} {
  const erreurs: string[] = [];
  const avertissements: string[] = [];
  const lignes: DocumentLine[] = [];
  let totalDeclare: number | null = null;
  const headerAt = rowsFindHeader(rows, rowsIndexOfBlock(rows, "produit"), ["quantite"]);
  if (headerAt < 0) {
    erreurs.push("En-tête du bloc « Produit » introuvable (colonne « Quantité »).");
    return { lignes, totalDeclare, erreurs, avertissements };
  }
  const header = (rows[headerAt] ?? []).map(normalizeCell);
  const iDesignation = columnIndex(header, ["produit", "designation"]);
  const iQuantite = columnIndex(header, ["quantite", "qte"]);
  const iHt = columnIndex(header, ["ht"]);
  const iTtc = columnIndex(header, ["ttc"]);
  const iTotal = columnIndex(header, ["total"]);

  for (let i = headerAt + 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    if (row.every((cell) => cell === "")) continue;
    const normalized = row.map(normalizeCell);
    const isFooter = normalized.some(
      (cell) => cell === "total" || cell.startsWith("total "),
    );
    if (isFooter) {
      totalDeclare = lastMontantOf(row);
      if (totalDeclare === null) {
        const next = rowsNonEmptyFrom(rows, i + 1);
        if (next >= 0) totalDeclare = lastMontantOf(rows[next] ?? []);
      }
      break;
    }

    const designation = cellOfRow(row, iDesignation) || "Article";
    const quantite = parseMontant(cellOfRow(row, iQuantite));
    const htUnitaire = parseMontant(cellOfRow(row, iHt));
    const ttcUnitaire = parseMontant(cellOfRow(row, iTtc));
    const totalLigne = iTotal >= 0 ? parseMontant(cellOfRow(row, iTotal)) : null;

    if (quantite === null || htUnitaire === null || ttcUnitaire === null || quantite <= 0) {
      avertissements.push(
        `Ligne ignorée (montants illisibles) : ${row.filter(Boolean).join(" · ")}`,
      );
      continue;
    }

    const attendu = round2(quantite * ttcUnitaire);
    if (totalLigne !== null && Math.abs(totalLigne - attendu) > MONEY_TOLERANCE) {
      erreurs.push(
        `Ligne « ${designation} » : total ${totalLigne} ≠ quantité × TTC unitaire (${attendu}).`,
      );
    }
    const totalTtc = totalLigne ?? attendu;

    // Taux déduit sur la ligne (plus robuste qu'un prix unitaire arrondi).
    const surLigne = quantite * htUnitaire;
    const taux = resolveTaux(surLigne, totalTtc) ?? resolveTaux(htUnitaire, ttcUnitaire);
    if (taux === null) {
      erreurs.push(
        `Ligne « ${designation} » : taux de TVA incohérent (HT ${htUnitaire} / TTC ${ttcUnitaire}).`,
      );
      continue;
    }

    lignes.push({ designation, quantite, htUnitaire, ttcUnitaire, totalTtc, taux });
  }

  return { lignes, totalDeclare, erreurs, avertissements };
}

/**
 * Assemble le résultat : totaux recalculés depuis les lignes, puis contrôles de
 * cohérence du pied de tableau. Séparé de la lecture pour rester lisible.
 */
function buildFactureResult(
  clients: { tiers: DocumentTiers },
  factures: { numero: string; dateDocument: string | null },
  produit: { lignes: DocumentLine[]; totalDeclare: number | null },
  erreurs: string[],
  avertissements: string[],
): ParseFactureResult {
  const { lignes } = produit;
  if (lignes.length === 0) erreurs.push("Aucune ligne de produit exploitable.");

  const ttc = round2(lignes.reduce((sum, line) => sum + line.totalTtc, 0));
  const ht = round2(
    lignes.reduce((sum, line) => sum + line.quantite * line.htUnitaire, 0),
  );
  const tva = round2(ttc - ht);

  if (
    produit.totalDeclare !== null &&
    Math.abs(produit.totalDeclare - ttc) > MONEY_TOLERANCE
  ) {
    erreurs.push(
      `Total du pied de tableau (${produit.totalDeclare}) ≠ somme des lignes (${ttc}) — export tronqué ou retouché.`,
    );
  }
  if (produit.totalDeclare === null) {
    avertissements.push("Total de pied absent : contrôle de somme non vérifiable.");
  }

  if (erreurs.length > 0) return { ok: false, erreurs };

  return {
    ok: true,
    facture: {
      numero: factures.numero,
      dateDocument: factures.dateDocument,
      tiers: clients.tiers,
      lignes,
      ht,
      tva,
      ttc,
      totalDeclare: produit.totalDeclare,
      avertissements,
    },
  };
}

/**
 * Lit l'export d'une facture (un fichier = une facture).
 *
 * Refuse le fichier si un bloc manque, si une ligne est incohérente
 * (`Total ≠ Quantité × TTC`), si le taux déduit n'est pas un taux légal, ou si
 * le total de pied ne correspond pas à la somme des lignes.
 */
export function parseFactureExport(text: string): ParseFactureResult {
  const erreurs: string[] = [];
  const avertissements: string[] = [];
  const separator = detectSeparator(text);
  const rows = text
    .split(/\r?\n/)
    .map((line) => splitDelimitedLine(line, separator));

  const hasBlock = (label: string): boolean =>
    rows.some((row) => row.some((cell) => normalizeCell(cell) === label));

  for (const [label, human] of [
    ["clients", "Clients"],
    ["factures", "Factures"],
    ["produit", "Produit"],
  ] as const) {
    if (!hasBlock(label)) erreurs.push(`Bloc « ${human} » introuvable dans l'export.`);
  }
  if (erreurs.length > 0) return { ok: false, erreurs };

  const clients = readClientsBlock(rows);
  const factures = readFacturesBlock(rows);
  const produit = readProduitBlock(rows);
  erreurs.push(...clients.erreurs, ...factures.erreurs, ...produit.erreurs);
  avertissements.push(
    ...clients.avertissements,
    ...factures.avertissements,
    ...produit.avertissements,
  );
  return buildFactureResult(clients, factures, produit, erreurs, avertissements);
}

/* ------------------------------------------------------------------ */
/* Construction d'un document indexé                                   */
/* ------------------------------------------------------------------ */

/** Transforme une facture lue dans un export en document du registre. */
export function factureToDocument(
  facture: ParsedFacture,
  opts: {
    id?: string;
    kind?: DocumentKind;
    source?: DocumentSource;
    fichier?: DocumentFile | null;
    now?: string;
  } = {},
): IndexedDocument {
  const now = opts.now ?? new Date().toISOString();
  return {
    id: opts.id ?? newId(),
    kind: opts.kind ?? "facture_client",
    numero: facture.numero,
    dateDocument: facture.dateDocument,
    tiers: facture.tiers,
    lignes: facture.lignes,
    ht: facture.ht,
    tva: facture.tva,
    ttc: facture.ttc,
    avertissements: [...facture.avertissements],
    fichier: opts.fichier ?? null,
    source: opts.source ?? "import_csv",
    importedAt: now,
    updatedAt: now,
  };
}

/** Document minimal créé à la main (ticket, pièce sans export). */
export function manualDocument(opts: {
  id?: string;
  kind?: DocumentKind;
  numero?: string;
  dateDocument?: string | null;
  tiersNom?: string;
  ttc: number;
  ht?: number;
  designation?: string;
  fichier?: DocumentFile | null;
  now?: string;
}): IndexedDocument {
  const now = opts.now ?? new Date().toISOString();
  const ttc = round2(opts.ttc);
  const ht = opts.ht !== undefined ? round2(opts.ht) : ttc;
  const taux = resolveTaux(ht, ttc) ?? 0;
  return {
    id: opts.id ?? newId(),
    kind: opts.kind ?? "ticket",
    numero: opts.numero ?? "",
    dateDocument: opts.dateDocument ?? now,
    tiers: { nom: opts.tiersNom ?? "" },
    lignes: [
      {
        designation: opts.designation ?? "Ticket",
        quantite: 1,
        htUnitaire: ht,
        ttcUnitaire: ttc,
        totalTtc: ttc,
        taux,
      },
    ],
    ht,
    tva: round2(ttc - ht),
    ttc,
    avertissements: [],
    fichier: opts.fichier ?? null,
    source: "manuel",
    importedAt: now,
    updatedAt: now,
  };
}

/* ------------------------------------------------------------------ */
/* Fusion idempotente                                                  */
/* ------------------------------------------------------------------ */

/** Clé d'identité d'un document : son numéro, sinon l'empreinte de son fichier. */
export function documentKey(
  doc: Pick<IndexedDocument, "kind" | "numero" | "fichier">,
): string {
  const numero = String(doc.numero ?? "").trim();
  if (numero) return `${doc.kind}:${numero}`;
  const empreinte = doc.fichier?.empreinte;
  if (empreinte) return `fp:${empreinte}`;
  return `f:${doc.fichier?.chemin ?? ""}`;
}

export type MergeOutcome = {
  documents: IndexedDocument[];
  added: number;
  updated: number;
  unchanged: number;
  /** Montants ou date déjà indexés qui diffèrent : on conserve l'existant. */
  conflits: string[];
  /** Même fichier déjà rattaché à un autre document. */
  doublonsFichier: string[];
};

/**
 * Fusionne des documents entrants dans l'index.
 *
 * Un ré-import **met à jour** l'existant (clé = type + numéro) au lieu d'empiler
 * des doublons. Si un montant ou une date déjà indexés changent, on **conserve
 * l'existant** et on signale un conflit : une facture ne se réécrit pas en
 * silence.
 */
export function mergeDocuments(
  existing: IndexedDocument[],
  incoming: IndexedDocument[],
): MergeOutcome {
  const documents = [...existing];
  const byKey = new Map<string, number>();
  documents.forEach((doc, index) => byKey.set(documentKey(doc), index));

  const empreintes = new Map<string, string>();
  for (const doc of documents) {
    const empreinte = doc.fichier?.empreinte;
    if (empreinte) empreintes.set(empreinte, documentKey(doc));
  }

  const outcome: MergeOutcome = {
    documents,
    added: 0,
    updated: 0,
    unchanged: 0,
    conflits: [],
    doublonsFichier: [],
  };

  for (const doc of incoming) {
    const key = documentKey(doc);
    const empreinte = doc.fichier?.empreinte;
    if (empreinte) {
      const other = empreintes.get(empreinte);
      if (other && other !== key) {
        outcome.doublonsFichier.push(
          `Fichier déjà rattaché à ${other} — nouveau rattachement proposé pour ${key}.`,
        );
      }
    }

    const at = byKey.get(key);
    if (at === undefined) {
      documents.push(doc);
      byKey.set(key, documents.length - 1);
      if (empreinte) empreintes.set(empreinte, key);
      outcome.added += 1;
      continue;
    }

    const current = documents[at]!;
    const memeMontant =
      Math.abs(current.ttc - doc.ttc) <= MONEY_TOLERANCE &&
      Math.abs(current.ht - doc.ht) <= MONEY_TOLERANCE;
    const memeDate =
      !current.dateDocument ||
      !doc.dateDocument ||
      current.dateDocument === doc.dateDocument;

    // Le fichier peut compléter un document déjà indexé sans son justificatif.
    const gagneFichier = !current.fichier && doc.fichier !== null;

    if (!memeMontant || !memeDate) {
      outcome.conflits.push(
        `${key} : déjà indexé (${current.ttc} €) — nouveau import à ${doc.ttc} €, conservé tel quel.`,
      );
      continue;
    }
    if (gagneFichier) {
      documents[at] = { ...current, fichier: doc.fichier, updatedAt: doc.updatedAt };
      outcome.updated += 1;
      continue;
    }
    outcome.unchanged += 1;
  }

  return outcome;
}

/** Statistiques d'index, pour l'écran. */
export function countDocuments(documents: IndexedDocument[]): {
  total: number;
  facturesClients: number;
  fournisseurs: number;
  tickets: number;
  sansFichier: number;
  avecAvertissement: number;
} {
  let facturesClients = 0;
  let fournisseurs = 0;
  let tickets = 0;
  let sansFichier = 0;
  let avecAvertissement = 0;
  for (const doc of documents) {
    if (doc.kind === "facture_client" || doc.kind === "avoir_client") facturesClients += 1;
    else if (doc.kind === "facture_fournisseur") fournisseurs += 1;
    else if (doc.kind === "ticket") tickets += 1;
    if (!doc.fichier) sansFichier += 1;
    if (doc.avertissements.length > 0) avecAvertissement += 1;
  }
  return {
    total: documents.length,
    facturesClients,
    fournisseurs,
    tickets,
    sansFichier,
    avecAvertissement,
  };
}
