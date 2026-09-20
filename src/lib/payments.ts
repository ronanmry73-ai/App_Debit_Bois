/**
 * Trésorerie — mouvements d'argent, lettrage, soldes (partie pure, sans disque).
 *
 * Deux principes non négociables :
 *
 *  1. **Un règlement n'est pas une case à cocher.** Une facture peut être réglée
 *     en plusieurs fois, un virement peut couvrir plusieurs factures : le lien se
 *     fait par **affectations** (mouvement → document, avec un montant).
 *  2. **Une facture émise n'est pas une entrée d'argent.** Facturer crée une
 *     créance ; l'argent arrive au mouvement. Le « reste dû » est calculé, jamais
 *     saisi : `montant du document − Σ affectations`.
 */
import type { DocumentKind, IndexedDocument } from "./documents.ts";

export type MouvementSens = "entree" | "sortie";

export const MOUVEMENT_SENS_LABELS: Record<MouvementSens, string> = {
  entree: "Encaissement",
  sortie: "Décaissement",
};

/** Moyens de paiement proposés (champ libre côté données). */
export const MOYENS = [
  "Virement",
  "Chèque",
  "CB",
  "Espèces",
  "Prélèvement",
  "Autre",
] as const;

export type CompteType = "banque" | "caisse";

export type Compte = {
  id: string;
  libelle: string;
  type: CompteType;
  /** Solde au premier jour suivi (peut être négatif). */
  soldeOuverture: number;
};

export type Mouvement = {
  id: string;
  sens: MouvementSens;
  /** Date du mouvement (ISO, calée à midi local). */
  date: string;
  /** Toujours positif : le sens porte le signe. */
  montant: number;
  compteId: string | null;
  moyen: string;
  /** N° de chèque, libellé du virement… (facultatif). */
  reference?: string;
  note?: string;
  createdAt: string;
};

export type Affectation = {
  id: string;
  mouvementId: string;
  documentId: string;
  /** Montant affecté, strictement positif. */
  montant: number;
  at: string;
};

/** Tolérance d'arrondi sur les montants. */
export const CENT = 0.02;

/** Délai de paiement par défaut quand la pièce n'en porte pas. */
export const DELAI_PAIEMENT_JOURS = 30;

/* ------------------------------------------------------------------ */
/* Comptes                                                             */
/* ------------------------------------------------------------------ */

/** Deux comptes par défaut, pour ne pas commencer sur une page blanche. */
export function comptesParDefaut(): Compte[] {
  return [
    { id: "compte-banque", libelle: "Compte bancaire", type: "banque", soldeOuverture: 0 },
    { id: "compte-caisse", libelle: "Caisse", type: "caisse", soldeOuverture: 0 },
  ];
}

export function compteLabel(comptes: Compte[], compteId: string | null): string {
  if (!compteId) return "Sans compte";
  return comptes.find((compte) => compte.id === compteId)?.libelle ?? "Compte inconnu";
}

/* ------------------------------------------------------------------ */
/* Montants et reste dû                                                */
/* ------------------------------------------------------------------ */

/** Un avoir client **réduit** ce qu'on attend ; les autres pièces l'augmentent. */
export function documentSign(kind: DocumentKind): 1 | -1 {
  return kind === "avoir_client" ? -1 : 1;
}

/** Montant signé d'un document (TTC). */
export function documentMontant(doc: Pick<IndexedDocument, "kind" | "ttc">): number {
  return documentSign(doc.kind) * doc.ttc;
}

export function montantAffecteAuMouvement(
  mouvementId: string,
  affectations: readonly Affectation[],
): number {
  return round2(
    affectations
      .filter((affectation) => affectation.mouvementId === mouvementId)
      .reduce((sum, affectation) => sum + affectation.montant, 0),
  );
}

export function montantRegle(
  documentId: string,
  affectations: readonly Affectation[],
): number {
  return round2(
    affectations
      .filter((affectation) => affectation.documentId === documentId)
      .reduce((sum, affectation) => sum + affectation.montant, 0),
  );
}

/** Ce qu'il reste à percevoir (positif) ou à rembourser (négatif) sur une pièce. */
export function resteDuDocument(
  doc: Pick<IndexedDocument, "id" | "kind" | "ttc">,
  affectations: readonly Affectation[],
): number {
  return round2(documentMontant(doc) - montantRegle(doc.id, affectations));
}

/** Ce qu'il reste à affecter sur un mouvement. */
export function resteDuMouvement(
  mouvement: Pick<Mouvement, "id" | "montant">,
  affectations: readonly Affectation[],
): number {
  return round2(mouvement.montant - montantAffecteAuMouvement(mouvement.id, affectations));
}

export type StatutReglement = "impaye" | "partiel" | "regle" | "trop_percu";

export function statutReglement(
  doc: Pick<IndexedDocument, "id" | "kind" | "ttc">,
  affectations: readonly Affectation[],
): StatutReglement {
  const montant = documentMontant(doc);
  const regle = montantRegle(doc.id, affectations);
  if (Math.abs(regle) <= CENT && Math.abs(montant) > CENT) return "impaye";
  const reste = round2(montant - regle);
  if (reste > CENT) return regle > CENT ? "partiel" : "impaye";
  if (reste < -CENT) return "trop_percu";
  return "regle";
}

export const STATUT_REGLEMENT_LABELS: Record<StatutReglement, string> = {
  impaye: "Impayé",
  partiel: "Partiellement réglé",
  regle: "Réglé",
  trop_percu: "Trop-perçu",
};

/* ------------------------------------------------------------------ */
/* Échéances                                                           */
/* ------------------------------------------------------------------ */

/** Échéance d'une pièce : celle saisie, sinon la date + délai de paiement. */
export function echeanceDuDocument(
  doc: Pick<IndexedDocument, "dateDocument" | "echeance">,
  delaiJours = DELAI_PAIEMENT_JOURS,
): string | null {
  if (doc.echeance) return doc.echeance;
  const base = doc.dateDocument ? new Date(doc.dateDocument) : null;
  if (!base || Number.isNaN(base.getTime())) return null;
  const due = new Date(base.getTime() + delaiJours * 86_400_000);
  return due.toISOString();
}

/** Jours de retard (positif) ou avant échéance (négatif) ; `null` sans échéance. */
export function joursDeRetard(
  echeance: string | null,
  now = new Date(),
): number | null {
  if (!echeance) return null;
  const due = new Date(echeance);
  if (Number.isNaN(due.getTime())) return null;
  return Math.floor((now.getTime() - due.getTime()) / 86_400_000);
}

export type LigneEcheance = {
  document: IndexedDocument;
  /** Reste dû signé (positif = à percevoir, négatif = à rembourser). */
  reste: number;
  echeance: string | null;
  jours: number | null;
  enRetard: boolean;
};

export type Echeancier = {
  /** Créances clients (factures en attente de règlement). */
  aEncaisser: LigneEcheance[];
  /** Dettes fournisseurs et tickets. */
  aPayer: LigneEcheance[];
  totalAEncaisser: number;
  totalAPayer: number;
  totalEnRetard: number;
};

function ligneEcheance(
  document: IndexedDocument,
  affectations: readonly Affectation[],
  now: Date,
): LigneEcheance {
  // Un avoir se compense avec les autres pièces du même client : le reste d'un
  // avoir seul est négatif (on doit de l'argent au client).
  const affecte = montantRegle(document.id, affectations);
  const reste = round2(documentMontant(document) - affecte);
  const echeance = echeanceDuDocument(document);
  const jours = joursDeRetard(echeance, now);
  return {
    document,
    reste,
    echeance,
    jours,
    enRetard: reste > CENT && jours !== null && jours > 0,
  };
}

/**
 * Échéancier : ce qu'il reste à encaisser et à payer, trié par échéance.
 * `documents` sert à ignorer les pièces déjà soldées.
 */
export function construireEcheancier(
  documents: readonly IndexedDocument[],
  affectations: readonly Affectation[],
  now = new Date(),
): Echeancier {
  const aEncaisser: LigneEcheance[] = [];
  const aPayer: LigneEcheance[] = [];

  for (const document of documents) {
    const ligne = ligneEcheance(document, affectations, now);
    if (Math.abs(ligne.reste) <= CENT) continue;
    const versClient = document.kind === "facture_client" || document.kind === "avoir_client";
    if (versClient) aEncaisser.push(ligne);
    else aPayer.push(ligne);
  }

  const parEcheance = (a: LigneEcheance, b: LigneEcheance): number =>
    (a.echeance ?? "9999").localeCompare(b.echeance ?? "9999");
  aEncaisser.sort(parEcheance);
  aPayer.sort(parEcheance);

  return {
    aEncaisser,
    aPayer,
    totalAEncaisser: round2(aEncaisser.reduce((sum, ligne) => sum + ligne.reste, 0)),
    totalAPayer: round2(aPayer.reduce((sum, ligne) => sum + ligne.reste, 0)),
    totalEnRetard: round2(
      aEncaisser.filter((ligne) => ligne.enRetard).reduce((sum, ligne) => sum + ligne.reste, 0),
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Soldes suivis                                                       */
/* ------------------------------------------------------------------ */

export type SoldeCompte = {
  compte: Compte;
  entrees: number;
  sorties: number;
  /** Solde d'ouverture + entrées − sorties (théorique, à pointer). */
  solde: number;
};

export function soldesSuivis(
  comptes: readonly Compte[],
  mouvements: readonly Mouvement[],
): { parCompte: SoldeCompte[]; total: number } {
  const parCompte = comptes.map((compte) => {
    const dedans = mouvements.filter((mouvement) => mouvement.compteId === compte.id);
    const entrees = round2(
      dedans.filter((m) => m.sens === "entree").reduce((sum, m) => sum + m.montant, 0),
    );
    const sorties = round2(
      dedans.filter((m) => m.sens === "sortie").reduce((sum, m) => sum + m.montant, 0),
    );
    return {
      compte,
      entrees,
      sorties,
      solde: round2(compte.soldeOuverture + entrees - sorties),
    };
  });
  return {
    parCompte,
    total: round2(parCompte.reduce((sum, ligne) => sum + ligne.solde, 0)),
  };
}

/* ------------------------------------------------------------------ */
/* Letttrage                                                           */
/* ------------------------------------------------------------------ */

export type ResultatAffectation =
  | { ok: true; affectation: Affectation }
  | { ok: false; error: string };

/**
 * Crée une affectation mouvement → document après vérification des deux côtés :
 * on n'affecte ni plus que le reste du mouvement, ni plus que le reste de la
 * pièce (le trop-perçu reste possible via un montant explicite plus tard).
 */
export function affecter(input: {
  id: string;
  mouvement: Mouvement;
  document: Pick<IndexedDocument, "id" | "kind" | "ttc" | "numero">;
  montant: number;
  affectations: readonly Affectation[];
  now?: string;
}): ResultatAffectation {
  const montant = round2(input.montant);
  if (!Number.isFinite(montant) || montant <= 0) {
    return { ok: false, error: "Indique un montant supérieur à zéro." };
  }
  const resteMouvement = resteDuMouvement(input.mouvement, input.affectations);
  if (montant > resteMouvement + CENT) {
    return {
      ok: false,
      error: `Ce mouvement n'a plus que ${formatEuros(resteMouvement)} à affecter.`,
    };
  }
  const resteDocument = resteDuDocument(input.document, input.affectations);
  if (montant > resteDocument + CENT) {
    return {
      ok: false,
      error: `Il ne reste que ${formatEuros(resteDocument)} sur ${input.document.numero || "cette pièce"}.`,
    };
  }
  return {
    ok: true,
    affectation: {
      id: input.id,
      mouvementId: input.mouvement.id,
      documentId: input.document.id,
      montant,
      at: input.now ?? new Date().toISOString(),
    },
  };
}

/** Retire une affectation (on ne modifie jamais un montant : on remplace). */
export function retirerAffectation(
  affectations: readonly Affectation[],
  affectationId: string,
): Affectation[] {
  return affectations.filter((affectation) => affectation.id !== affectationId);
}

/** Mouvements encore partiellement ou pas affectés, du plus ancien au plus récent. */
export function mouvementsNonAffectes(
  mouvements: readonly Mouvement[],
  affectations: readonly Affectation[],
): Mouvement[] {
  return mouvements
    .filter((mouvement) => resteDuMouvement(mouvement, affectations) > CENT)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/* ------------------------------------------------------------------ */
/* TVA estimée                                                         */
/* ------------------------------------------------------------------ */

export type EstimationTva = {
  /** TVA sur les pièces clients (lecture « sur les débits », c'est-à-dire facturé). */
  collectee: number;
  /** TVA sur les achats justifiés (factures fournisseurs, tickets). */
  deductible: number;
  solde: number;
  /** TVA au rythme des règlements reçus (lecture « sur les encaissements »). */
  collecteeEncaissements: number;
  deductibleDecaissements: number;
  soldeEncaissements: number;
  /** Pièces sans TVA (taux 0) : à vérifier, ce sont souvent des oublis. */
  piecesSansTva: number;
};

function tvaDuDocument(doc: IndexedDocument): number {
  return round2(Math.max(0, doc.ttc - doc.ht)) * documentSign(doc.kind);
}

/** Part réglée d'une pièce, bornée à 1 (un trop-perçu ne crée pas de TVA en plus). */
function partReglee(doc: IndexedDocument, affectations: readonly Affectation[]): number {
  if (Math.abs(doc.ttc) <= CENT) return 0;
  const regle = montantRegle(doc.id, affectations);
  return Math.min(1, Math.max(0, regle / doc.ttc));
}

/**
 * Estimation de TVA — **indicative**, jamais une déclaration.
 *
 * Deux lectures, parce que le régime change tout : **sur les débits** (ce qui est
 * facturé) et **sur les encaissements** (ce qui est réellement rentré). Le montant
 * exact dépend du régime, des taux appliqués et des justificatifs d'achat : la
 * déclaration reste au comptable.
 */
export function estimerTva(
  documents: readonly IndexedDocument[],
  affectations: readonly Affectation[],
): EstimationTva {
  let collectee = 0;
  let deductible = 0;
  let collecteeEncaissements = 0;
  let deductibleDecaissements = 0;
  let piecesSansTva = 0;

  for (const doc of documents) {
    const tva = tvaDuDocument(doc);
    if (Math.abs(tva) <= CENT) piecesSansTva += 1;
    const part = partReglee(doc, affectations);
    const coteClient = doc.kind === "facture_client" || doc.kind === "avoir_client";
    if (coteClient) {
      collectee = round2(collectee + tva);
      collecteeEncaissements = round2(collecteeEncaissements + tva * part);
    } else {
      deductible = round2(deductible + tva);
      deductibleDecaissements = round2(deductibleDecaissements + tva * part);
    }
  }

  return {
    collectee,
    deductible,
    solde: round2(collectee - deductible),
    collecteeEncaissements,
    deductibleDecaissements,
    soldeEncaissements: round2(collecteeEncaissements - deductibleDecaissements),
    piecesSansTva,
  };
}

/* ------------------------------------------------------------------ */
/* Tableau de bord                                                     */
/* ------------------------------------------------------------------ */

export type TableauTresorerie = {
  factureClients: number;
  encaisse: number;
  resteAEncaisser: number;
  enRetard: number;
  depenses: number;
  soldeTotal: number;
};

export function tableauTresorerie(
  documents: readonly IndexedDocument[],
  mouvements: readonly Mouvement[],
  affectations: readonly Affectation[],
  comptes: readonly Compte[],
  now = new Date(),
): TableauTresorerie {
  const factureClients = round2(
    documents
      .filter((doc) => doc.kind === "facture_client" || doc.kind === "avoir_client")
      .reduce((sum, doc) => sum + documentMontant(doc), 0),
  );
  const encaisse = round2(
    mouvements.filter((m) => m.sens === "entree").reduce((sum, m) => sum + m.montant, 0),
  );
  const echeancier = construireEcheancier(documents, affectations, now);
  return {
    factureClients,
    encaisse,
    resteAEncaisser: echeancier.totalAEncaisser,
    enRetard: echeancier.totalEnRetard,
    depenses: round2(
      mouvements.filter((m) => m.sens === "sortie").reduce((sum, m) => sum + m.montant, 0),
    ),
    soldeTotal: soldesSuivis(comptes, mouvements).total,
  };
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Montant lisible à la française : `1 234,56 €`. */
export function formatEuros(value: number): string {
  const [entier, decimales] = round2(Math.abs(value)).toFixed(2).split(".");
  const groupes = (entier ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const signe = value < 0 ? "-" : "";
  return `${signe}${groupes},${decimales ?? "00"} €`;
}
