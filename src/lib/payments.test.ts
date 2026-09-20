/**
 * Trésorerie : lettrage, reste dû, échéancier, soldes.
 *
 * Les scénarios reproduisent la vraie vie d'un atelier : acompte puis solde,
 * un virement qui couvre deux factures, une pièce en retard, une caisse.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { manualDocument, type IndexedDocument } from "./documents.ts";
import {
	affecter,
	comptesParDefaut,
	construireEcheancier,
	documentMontant,
	echeanceDuDocument,
	estimerTva,
	joursDeRetard,
	montantAffecteAuMouvement,
	montantRegle,
	mouvementsNonAffectes,
	resteDuDocument,
	resteDuMouvement,
	retirerAffectation,
	soldesSuivis,
	statutReglement,
	tableauTresorerie,
	type Affectation,
	type Mouvement,
} from "./payments.ts";

const NOW = new Date("2026-09-20T12:00:00.000Z");

function facture(overrides: Partial<IndexedDocument> = {}): IndexedDocument {
	return {
		...manualDocument({
			id: overrides.id ?? "doc-1",
			kind: overrides.kind ?? "facture_client",
			numero: overrides.numero ?? "1",
			ttc: overrides.ttc ?? 660,
			ht: overrides.ht ?? 550,
			tiersNom: overrides.tiers?.nom ?? "Gentil",
			dateDocument: overrides.dateDocument ?? "2026-09-19T12:00:00.000Z",
			now: "2026-09-19T12:00:00.000Z",
		}),
		...overrides,
	};
}

function mouvement(overrides: Partial<Mouvement> = {}): Mouvement {
	return {
		id: overrides.id ?? "mvt-1",
		sens: overrides.sens ?? "entree",
		date: overrides.date ?? "2026-09-19T12:00:00.000Z",
		montant: overrides.montant ?? 660,
		compteId: overrides.compteId ?? "compte-banque",
		moyen: overrides.moyen ?? "Virement",
		createdAt: overrides.createdAt ?? "2026-09-19T12:00:00.000Z",
		...overrides,
	};
}

function affectation(overrides: Partial<Affectation> = {}): Affectation {
	return {
		id: overrides.id ?? "aff-1",
		mouvementId: overrides.mouvementId ?? "mvt-1",
		documentId: overrides.documentId ?? "doc-1",
		montant: overrides.montant ?? 660,
		at: overrides.at ?? "2026-09-19T12:00:00.000Z",
	};
}

test("une facture émise n'est pas de l'argent : reste dû et statut", () => {
	const doc = facture();
	assert.equal(documentMontant(doc), 660);
	assert.equal(resteDuDocument(doc, []), 660);
	assert.equal(statutReglement(doc, []), "impaye");
});

test("acompte puis solde : partiel, puis réglé", () => {
	const doc = facture();
	const acompte = affectation({ id: "aff-acompte", montant: 200 });
	assert.equal(resteDuDocument(doc, [acompte]), 460);
	assert.equal(statutReglement(doc, [acompte]), "partiel");

	const solde = affectation({ id: "aff-solde", montant: 460 });
	const lesDeux = [acompte, solde];
	assert.equal(montantRegle(doc.id, lesDeux), 660);
	assert.equal(resteDuDocument(doc, lesDeux), 0);
	assert.equal(statutReglement(doc, lesDeux), "regle");
});

test("un virement peut couvrir plusieurs factures", () => {
	const a = facture({ id: "doc-1", numero: "1", ttc: 300 });
	const b = facture({ id: "doc-2", numero: "2", ttc: 200 });
	const virement = mouvement({ id: "mvt-1", montant: 500 });
	const affectations = [
		affectation({ id: "aff-1", documentId: "doc-1", montant: 300 }),
		affectation({ id: "aff-2", documentId: "doc-2", montant: 200 }),
	];
	assert.equal(montantAffecteAuMouvement(virement.id, affectations), 500);
	assert.equal(resteDuMouvement(virement, affectations), 0);
	assert.equal(resteDuDocument(a, affectations), 0);
	assert.equal(resteDuDocument(b, affectations), 0);
});

test("affecter refuse de dépasser le mouvement ou la pièce", () => {
	const doc = facture({ ttc: 300 });
	const virement = mouvement({ montant: 200 });
	const trop = affecter({
		id: "aff-x",
		mouvement: virement,
		document: doc,
		montant: 250,
		affectations: [],
		now: NOW.toISOString(),
	});
	assert.equal(trop.ok, false);
	if (!trop.ok) assert.match(trop.error, /n'a plus que 200,00 €/);

	const ok = affecter({
		id: "aff-ok",
		mouvement: virement,
		document: doc,
		montant: 200,
		affectations: [],
		now: NOW.toISOString(),
	});
	assert.equal(ok.ok, true);
	if (!ok.ok) return;

	const ensuite = affecter({
		id: "aff-trop",
		mouvement: mouvement({ montant: 500 }),
		document: doc,
		montant: 200,
		affectations: [ok.affectation],
		now: NOW.toISOString(),
	});
	assert.equal(ensuite.ok, false);
	if (!ensuite.ok) assert.match(ensuite.error, /ne reste que 100,00 €/);});

test("affecter refuse un montant nul ou négatif", () => {
	const refus = affecter({
		id: "aff-0",
		mouvement: mouvement(),
		document: facture(),
		montant: 0,
		affectations: [],
	});
	assert.equal(refus.ok, false);
});

test("trop-perçu signalé, jamais caché", () => {
	const doc = facture({ ttc: 100 });
	const trop = [affectation({ montant: 120 })];
	assert.equal(resteDuDocument(doc, trop), -20);
	assert.equal(statutReglement(doc, trop), "trop_percu");
});

test("un avoir client réduit ce qu'il reste à encaisser", () => {
	const vente = facture({ id: "doc-vente", numero: "10", ttc: 100 });
	const avoir = facture({ id: "doc-avoir", numero: "AV-1", kind: "avoir_client", ttc: 30 });
	const echeancier = construireEcheancier([vente, avoir], [], NOW);
	assert.equal(echeancier.totalAEncaisser, 70);
	assert.equal(echeancier.aEncaisser.length, 2);
});

test("échéance par défaut à 30 jours, retard calculé", () => {
	const recente = facture({ dateDocument: "2026-09-19T12:00:00.000Z" });
	const echeance = echeanceDuDocument(recente);
	assert.ok(echeance);
	assert.equal(joursDeRetard(echeance, NOW), -29, "échéance dans 29 jours");

	const vieille = facture({ id: "doc-vieux", dateDocument: "2026-07-01T12:00:00.000Z" });
	const echeancier = construireEcheancier([vieille], [], NOW);
	assert.equal(echeancier.aEncaisser[0]?.enRetard, true);
	assert.ok(echeancier.totalEnRetard > 0);

	const avecEcheance = facture({ echeance: "2026-12-31T12:00:00.000Z" });
	assert.equal(echeanceDuDocument(avecEcheance), "2026-12-31T12:00:00.000Z");
});

test("échéancier : les pièces soldées sortent de la liste", () => {
	const doc = facture();
	const regle = [affectation({ montant: 660 })];
	assert.equal(construireEcheancier([doc], regle, NOW).aEncaisser.length, 0);
	assert.equal(construireEcheancier([doc], [], NOW).aEncaisser.length, 1);
});

test("une facture fournisseur se range dans « à payer »", () => {
	const achat = facture({ id: "doc-ff", numero: "F-1", kind: "facture_fournisseur", ttc: 120 });
	const echeancier = construireEcheancier([achat], [], NOW);
	assert.equal(echeancier.aPayer.length, 1);
	assert.equal(echeancier.aEncaisser.length, 0);
	assert.equal(echeancier.totalAPayer, 120);
});

test("soldes suivis par compte, caisse comprise", () => {
	const comptes = comptesParDefaut();
	comptes[0]!.soldeOuverture = 1000;
	const mouvements = [
		mouvement({ id: "m-1", sens: "entree", montant: 500 }),
		mouvement({ id: "m-2", sens: "sortie", montant: 200 }),
		mouvement({ id: "m-3", sens: "sortie", montant: 40, compteId: "compte-caisse", moyen: "Espèces" }),
	];
	const { parCompte, total } = soldesSuivis(comptes, mouvements);
	assert.equal(parCompte[0]?.entrees, 500);
	assert.equal(parCompte[0]?.sorties, 200);
	assert.equal(parCompte[0]?.solde, 1300);
	assert.equal(parCompte[1]?.solde, -40);
	assert.equal(total, 1260);
});

test("tableau de bord : facturé, encaissé, reste, sorties, solde", () => {
	const doc = facture({ ttc: 660 });
	const achat = facture({ id: "doc-ff", numero: "F-1", kind: "facture_fournisseur", ttc: 120 });
	const comptes = comptesParDefaut();
	comptes[0]!.soldeOuverture = 0;
	const mouvements = [
		mouvement({ id: "m-1", sens: "entree", montant: 200 }),
		mouvement({ id: "m-2", sens: "sortie", montant: 120 }),
	];
	const affectations = [
		affectation({ id: "aff-1", mouvementId: "m-1", documentId: doc.id, montant: 200 }),
		affectation({ id: "aff-2", mouvementId: "m-2", documentId: achat.id, montant: 120 }),
	];
	const tableau = tableauTresorerie([doc, achat], mouvements, affectations, comptes, NOW);
	assert.equal(tableau.factureClients, 660);
	assert.equal(tableau.encaisse, 200);
	assert.equal(tableau.resteAEncaisser, 460);
	assert.equal(tableau.depenses, 120);
	assert.equal(tableau.soldeTotal, 80);
});

test("retirer une affectation rend le reste dû", () => {
	const doc = facture();
	const lesDeux = [affectation({ id: "aff-1", montant: 200 })];
	assert.equal(resteDuDocument(doc, lesDeux), 460);
	const apres = retirerAffectation(lesDeux, "aff-1");
	assert.equal(resteDuDocument(doc, apres), 660);
});

test("TVA estimée : collectée, déductible, et les deux lectures", () => {
	const vente = facture({ id: "doc-vente", numero: "1", ttc: 660, ht: 550 });
	const achat = facture({
		id: "doc-achat",
		numero: "F-1",
		kind: "facture_fournisseur",
		ttc: 120,
		ht: 100,
	});

	const sansAffectation = estimerTva([vente, achat], []);
	assert.equal(sansAffectation.collectee, 110);
	assert.equal(sansAffectation.deductible, 20);
	assert.equal(sansAffectation.solde, 90, "facturé : 110 − 20");
	// Régime des encaissements : rien n'est encore rentré ni payé.
	assert.equal(sansAffectation.collecteeEncaissements, 0);
	assert.equal(sansAffectation.soldeEncaissements, 0);

	// Un acompte de la moitié de la facture fait entrer la moitié de la TVA.
	const acompte = [affectation({ id: "aff-1", documentId: "doc-vente", montant: 330 })];
	const avecAcompte = estimerTva([vente, achat], acompte);
	assert.equal(avecAcompte.collectee, 110, "la lecture « débits » ne bouge pas");
	assert.equal(avecAcompte.collecteeEncaissements, 55);
	assert.equal(avecAcompte.soldeEncaissements, 55);
});

test("TVA estimée : un avoir en déduction, les pièces sans TVA signalées", () => {
	const vente = facture({ id: "doc-vente", numero: "1", ttc: 660, ht: 550 });
	const avoir = facture({
		id: "doc-avoir",
		numero: "AV-1",
		kind: "avoir_client",
		ttc: 60,
		ht: 50,
	});
	const ticket = manualDocument({
		id: "doc-ticket",
		kind: "ticket",
		ttc: 30,
		ht: 30,
		tiersNom: "Point P",
	});

	const estimation = estimerTva([vente, avoir, ticket], []);
	assert.equal(estimation.collectee, 100, "110 − 10 d'avoir");
	assert.equal(estimation.deductible, 0, "le ticket est à taux 0");
	assert.equal(estimation.solde, 100);
	assert.equal(estimation.piecesSansTva, 1, "le ticket est signalé");
});

test("mouvements non affectés : ceux qui ont encore du reste, du plus ancien au plus récent", () => {
	const mouvements = [
		mouvement({ id: "m-2", date: "2026-09-20T12:00:00.000Z", montant: 100 }),
		mouvement({ id: "m-1", date: "2026-09-10T12:00:00.000Z", montant: 500 }),
		mouvement({ id: "m-3", date: "2026-09-15T12:00:00.000Z", montant: 300 }),
	];
	const affectations = [
		affectation({ id: "aff-1", mouvementId: "m-1", montant: 500 }),
		affectation({ id: "aff-2", mouvementId: "m-3", montant: 100 }),
	];
	const restants = mouvementsNonAffectes(mouvements, affectations);
	assert.deepEqual(
		restants.map((m) => m.id),
		["m-3", "m-2"],
		"triés du plus ancien au plus récent",
	);
});
