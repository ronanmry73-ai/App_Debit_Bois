/**
 * Registre des documents : lecture du gabarit d'export, contrôles, fusion.
 *
 * La fixture `EXPORT` est **le format réel** de l'outil de facturation de
 * l'auteur (rapport en trois blocs, tabulé, une facture par fichier) : les
 * tests portent donc sur les vraies données, pas sur un exemple inventé.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  countDocuments,
  detectSeparator,
  documentKey,
  mergeDocuments,
  parseDateFr,
  parseFactureExport,
  parseMontant,
  resolveTaux,
  round2,
  type IndexedDocument,
} from "./documents.ts";

const EXPORT = [
  "Clients\t\t\t\t\t\t",
  "Nom\tPrénom\tAdresse\tTéléphone\tAdresse Mail\t\t",
  "Romain\tRomain\t78 rue de l'arbre; 73100 Aime\t658754815\tdsdsds\t\t",
  "\t\t\t\t\t\t",
  "Factures\t\t\t\t\t\t",
  "Num Facture\tDate\t\t\t\t\t",
  "2\t12/08/2024\t\t\t\t\t",
  "\t\t\t\t\t\t",
  "Produit\t\t\tQuantité\tHT\tTTC\tTotal",
  "Table basse\t\t\t1\t150\t180\t180",
  "Etagère\t\t\t2\t50\t60\t120",
  "\t\t\t\t\t\t",
  "\t\t\t\t\t\tTotal",
  "\t\t\t\t\t\t300",
].join("\n");

function doc(overrides: Partial<IndexedDocument> = {}): IndexedDocument {
  return {
    id: "d-1",
    kind: "facture_client",
    numero: "2",
    dateDocument: "2026-08-12T10:00:00.000Z",
    tiers: { nom: "Romain" },
    lignes: [],
    ht: 250,
    tva: 50,
    ttc: 300,
    avertissements: [],
    fichier: null,
    source: "import_csv",
    importedAt: "2026-09-18T10:00:00.000Z",
    updatedAt: "2026-09-18T10:00:00.000Z",
    ...overrides,
  };
}

test("lit l'export réel et recalcule les totaux", () => {
  const parsed = parseFactureExport(EXPORT);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const f = parsed.facture;
  assert.equal(f.numero, "2");
  assert.equal(new Date(f.dateDocument ?? "").getDate(), 12, "12/08/2024 lu en jj/mm");
  assert.equal(new Date(f.dateDocument ?? "").getMonth(), 7, "août");
  assert.equal(f.tiers.nom, "Romain");
  assert.equal(f.tiers.prenom, "Romain");
  assert.equal(f.tiers.adresse, "78 rue de l'arbre; 73100 Aime");
  assert.equal(f.tiers.email, "dsdsds");
  assert.equal(f.lignes.length, 2);

  const [ligne1, ligne2] = f.lignes;
  assert.equal(ligne1?.designation, "Table basse");
  assert.equal(ligne1?.quantite, 1);
  assert.equal(ligne1?.htUnitaire, 150);
  assert.equal(ligne1?.ttcUnitaire, 180);
  assert.equal(ligne1?.totalTtc, 180);
  assert.equal(ligne1?.taux, 20);

  // Le point qui compte : `HT`/`TTC` sont des prix **unitaires**, `Total` porte
  // le montant de la ligne (2 × 60 = 120), donc le HT de la facture est 250.
  assert.equal(ligne2?.quantite, 2);
  assert.equal(ligne2?.totalTtc, 120);
  assert.equal(f.ht, 250);
  assert.equal(f.tva, 50);
  assert.equal(f.ttc, 300);
  assert.equal(f.totalDeclare, 300);
});

test("refuse un total de pied qui ne correspond pas aux lignes", () => {
  const parsed = parseFactureExport(EXPORT.replace("\t\t\t\t\t\t300", "\t\t\t\t\t\t240"));
  assert.equal(parsed.ok, false);
  if (parsed.ok) return;
  assert.match(parsed.erreurs.join(" "), /pied de tableau/);
});

test("refuse une ligne dont le total ne colle pas à quantité × TTC", () => {
  const parsed = parseFactureExport(
    EXPORT.replace("Etagère\t\t\t2\t50\t60\t120", "Etagère\t\t\t2\t50\t60\t100"),
  );
  assert.equal(parsed.ok, false);
  if (parsed.ok) return;
  assert.match(parsed.erreurs.join(" "), /quantité × TTC unitaire/);
});

test("refuse un taux de TVA qui n'est pas un taux légal", () => {
  const absurde = [
    "Clients\t\t",
    "Nom\tAdresse",
    "Client\tRue",
    "\t",
    "Factures\t",
    "Num Facture\tDate",
    "7\t01/02/2026",
    "\t",
    "Produit\tQuantité\tHT\tTTC\tTotal",
    "Prestation\t1\t100\t150\t150",
    "\tTotal",
    "\t150",
  ].join("\n");
  const parsed = parseFactureExport(absurde);
  assert.equal(parsed.ok, false);
  if (parsed.ok) return;
  assert.match(parsed.erreurs.join(" "), /taux de TVA incohérent/);
});

test("refuse un export dont un bloc manque", () => {
  const parsed = parseFactureExport(
    EXPORT.split("\n")
      .filter((line) => !line.startsWith("Produit\t"))
      .filter((line) => !line.startsWith("Table basse"))
      .filter((line) => !line.startsWith("Etagère"))
      .join("\n"),
  );
  assert.equal(parsed.ok, false);
  if (parsed.ok) return;
  assert.match(parsed.erreurs.join(" "), /Produits » introuvable/);
});

test("gère les centimes", () => {
  const cents = [
    "Clients\t\t",
    "Nom\tAdresse",
    "Client\tRue",
    "\t",
    "Factures\t",
    "Num Facture\tDate",
    "11\t05/03/2026",
    "\t",
    "Produit\tQuantité\tHT\tTTC\tTotal",
    "Panneau\t1\t150,50\t180,60\t180,60",
    "\tTotal",
    "\t180,60",
  ].join("\n");
  const parsed = parseFactureExport(cents);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.facture.ht, 150.5);
  assert.equal(parsed.facture.ttc, 180.6);
  assert.equal(parsed.facture.lignes[0]?.taux, 20);
});

test("détecte le séparateur (tabulation ou point-virgule)", () => {
  assert.equal(detectSeparator(EXPORT), "\t");
  const semi = ["Clients;;", "Nom;Adresse", "Client;Rue"].join("\n");
  assert.equal(detectSeparator(semi), ";");
  const parsed = parseFactureExport(
    [
      "Clients;;",
      "Nom;Adresse",
      "Client;Rue",
      ";;",
      "Factures;;",
      "Num Facture;Date",
      "12;07/04/2026",
      ";;",
      "Produit;Quantité;HT;TTC;Total",
      "Porte;1;200;240;240",
      ";;Total",
      ";;240",
    ].join("\n"),
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.facture.numero, "12");
  assert.equal(parsed.facture.ttc, 240);
});

test("parseMontant comprend les écritures françaises", () => {
  assert.equal(parseMontant("1 234,56"), 1234.56);
  assert.equal(parseMontant("1\u00a0234,56"), 1234.56);
  assert.equal(parseMontant("1.234,56"), 1234.56);
  assert.equal(parseMontant("1234.56"), 1234.56);
  assert.equal(parseMontant("150 €"), 150);
  assert.equal(parseMontant("-42,50"), -42.5);
  assert.equal(parseMontant(""), null);
  assert.equal(parseMontant("Total"), null);
  assert.equal(parseMontant(undefined), null);
});

test("parseDateFr accepte jj/mm/aaaa et aaaa-mm-jj, refuse le reste", () => {
  assert.equal(new Date(parseDateFr("12/08/2024") ?? "").getDate(), 12);
  assert.equal(new Date(parseDateFr("2024-08-12") ?? "").getDate(), 12);
  assert.equal(parseDateFr("32/13/2024"), null);
  assert.equal(parseDateFr(""), null);
  assert.equal(parseDateFr("hier"), null);
});

test("resolveTaux déduit un taux légal, sinon rien", () => {
  assert.equal(resolveTaux(150, 180), 20);
  assert.equal(resolveTaux(100, 110), 10);
  assert.equal(resolveTaux(100, 105.5), 5.5);
  assert.equal(resolveTaux(0, 0), 0);
  assert.equal(resolveTaux(100, 150), null);
  assert.equal(round2(0.1 + 0.2), 0.3);
});

test("mergeDocuments : un ré-import ne duplique pas", () => {
  const first = mergeDocuments([], [doc()]);
  assert.equal(first.added, 1);
  assert.equal(first.documents.length, 1);

  const second = mergeDocuments(first.documents, [doc({ id: "d-2" })]);
  assert.equal(second.added, 0);
  assert.equal(second.unchanged, 1);
  assert.equal(second.documents.length, 1, "toujours une seule facture");
  assert.equal(second.conflits.length, 0);
});

test("mergeDocuments : un montant qui change est un conflit, pas un écrasement", () => {
  const first = mergeDocuments([], [doc()]);
  const second = mergeDocuments(first.documents, [doc({ id: "d-9", ttc: 350, ht: 290 })]);
  assert.equal(second.conflits.length, 1);
  assert.match(second.conflits[0] ?? "", /conservé tel quel/);
  assert.equal(second.documents[0]?.ttc, 300, "l'existant n'est pas réécrit");
  assert.equal(second.documents.length, 1);
});

test("mergeDocuments : le fichier vient compléter un document déjà indexé", () => {
  const first = mergeDocuments([], [doc()]);
  assert.equal(first.documents[0]?.fichier, null);
  const second = mergeDocuments(first.documents, [
    doc({ fichier: { chemin: "factures/2026/FAC-2026-0002.pdf", empreinte: "abc" } }),
  ]);
  assert.equal(second.updated, 1);
  assert.equal(second.documents[0]?.fichier?.chemin, "factures/2026/FAC-2026-0002.pdf");
  assert.equal(second.documents.length, 1);
});

test("mergeDocuments : même fichier sur deux documents → doublon signalé", () => {
  const base = mergeDocuments([], [
    doc({
      numero: "2",
      fichier: { chemin: "factures/2026/FAC-2026-0002.pdf", empreinte: "abc" },
    }),
  ]);
  const second = mergeDocuments(base.documents, [
    doc({
      id: "d-3",
      numero: "3",
      fichier: { chemin: "factures/2026/FAC-2026-0003.pdf", empreinte: "abc" },
    }),
  ]);
  assert.equal(second.documents.length, 2);
  assert.equal(second.doublonsFichier.length, 1, "même empreinte sur deux pièces");
  assert.match(second.doublonsFichier[0] ?? "", /déjà rattaché/);
});

test("documentKey s'appuie sur le numéro, sinon sur l'empreinte", () => {
  assert.equal(documentKey(doc()), "facture_client:2");
  assert.equal(
    documentKey(doc({ numero: "", fichier: { chemin: "x.pdf", empreinte: "e1" } })),
    "fp:e1",
  );
  assert.equal(documentKey(doc({ numero: "", fichier: { chemin: "x.pdf" } })), "f:x.pdf");
});

test("CSV point-virgule : une adresse citée ne décale pas les colonnes", () => {
  const texte = [
    "Clients;;",
    "Nom;Adresse;Téléphone",
    'Romain;"78 rue de l\'arbre; 73100 Aime";658754815',
    ";;",
    "Factures;;",
    "Num Facture;Date",
    "2;12/08/2024",
    ";;",
    "Produit;Quantité;HT;TTC;Total",
    "Table basse;1;150;180;180",
    ";;Total",
    ";;180",
  ].join("\n");
  const parsed = parseFactureExport(texte);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.facture.tiers.nom, "Romain");
  assert.equal(parsed.facture.tiers.adresse, "78 rue de l'arbre; 73100 Aime");
  assert.equal(parsed.facture.tiers.telephone, "658754815");
  assert.equal(parsed.facture.ttc, 180);
});

/**
 * Nouvelle maquette de l'auteur : plus de blocs titrés, des **libellés en
 * colonne** (valeur à droite, ou en dessous), `Produits` au pluriel, et un pied
 * `Total HT | TVA | Total`.
 */
const EXPORT_V2 = [
  "",
  "",
  "\t73700 Bourg-Saint-Maurice; 961 rue de pinon\t\t\t\t",
  "\tTelephone\t631857577\t\t\t",
  "\tMail:\tdsdsdsds@gmail.com\t\t\t",
  "\t\t\t\t\t",
  "\tClient\t\t\t\tN° Facture\t",
  "\tNom\tPrénom\t\t\t2\t",
  "\tGentil\tRobert\t\t\tDate\t",
  "\tAdresse\t25 rue du poirier\t\t\t19/09/2026\t",
  "\tTéléphone\t06 32 52 45 85\t\t\t\t",
  "\tAdresse mail\tGnagna@gmail.com\t\t\t\t",
  "\t\t\t\t\t",
  "\t\t\t\t\t",
  "Produits\t\t\tQuantité\tHT\tTTC\tTotal",
  "Table basse\t\t\t3\t150\t180\t540",
  "Etagère\t\t\t2\t50\t60\t120",
  "\t\t\t\t\t\t",
  "\t\t\t\tTotal HT\tTVA\tTotal",
  "\t\t\t\t 200,00 € \t20%\t 660,00 €",
].join("\n");

test("nouvelle maquette : libellés en colonne, valeurs à droite ou en dessous", () => {
  const parsed = parseFactureExport(EXPORT_V2);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const f = parsed.facture;

  assert.equal(f.numero, "2", "N° Facture lu sous son libellé");
  assert.equal(new Date(f.dateDocument ?? "").getDate(), 19);
  assert.equal(new Date(f.dateDocument ?? "").getMonth(), 8, "septembre");

  // Le bloc émetteur en haut ne doit pas être confondu avec le client.
  assert.equal(f.tiers.nom, "Gentil");
  assert.equal(f.tiers.prenom, "Robert");
  assert.equal(f.tiers.adresse, "25 rue du poirier");
  assert.equal(f.tiers.telephone, "06 32 52 45 85");
  assert.equal(f.tiers.email, "Gnagna@gmail.com");

  assert.equal(f.lignes.length, 2);
  assert.equal(f.lignes[0]?.designation, "Table basse");
  assert.equal(f.lignes[0]?.quantite, 3);
  assert.equal(f.lignes[0]?.totalTtc, 540);
  assert.deepEqual(
    f.lignes.map((line) => line.taux),
    [20, 20],
  );

  // 3 × 150 + 2 × 50 = 550 HT ; 540 + 120 = 660 TTC ; TVA 110.
  assert.equal(f.ht, 550);
  assert.equal(f.tva, 110);
  assert.equal(f.ttc, 660);
  assert.equal(f.totalDeclare, 660);

  // La feuille annonce « Total HT 200,00 € » alors que les lignes font 550 :
  // on le signale sans refuser la pièce, et les totaux retenus sont recalculés.
  assert.ok(
    f.avertissements.some((line) => /Total HT de la feuille \(200\)/.test(line)),
    `avertissement attendu, reçu : ${f.avertissements.join(" | ")}`,
  );
});

test("countDocuments répartit l'index", () => {
  const stats = countDocuments([
    doc({ id: "a" }),
    doc({ id: "b", numero: "3", kind: "facture_fournisseur", fichier: { chemin: "f.pdf" } }),
    doc({ id: "c", numero: "4", kind: "ticket", avertissements: ["Nom absent"] }),
  ]);
  assert.deepEqual(stats, {
    total: 3,
    facturesClients: 1,
    fournisseurs: 1,
    tickets: 1,
    // Deux pièces sans justificatif : la facture client et le ticket.
    sansFichier: 2,
    avecAvertissement: 1,
  });
});
