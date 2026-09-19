import { ArrowLeft, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DOCUMENT_KIND_LABELS, parseMontant, type IndexedDocument } from "@/lib/documents";
import {
	CENT,
	MOYENS,
	MOUVEMENT_SENS_LABELS,
	STATUT_REGLEMENT_LABELS,
	affecter,
	compteLabel,
	construireEcheancier,
	formatEuros,
	montantRegle,
	mouvementsNonAffectes,
	resteDuDocument,
	resteDuMouvement,
	soldesSuivis,
	statutReglement,
	tableauTresorerie,
	type Affectation,
	type Compte,
	type Mouvement,
	type MouvementSens,
} from "@/lib/payments";
import { formatDay } from "@/lib/projects";
import { newId } from "@/lib/utils";

type Props = {
	documents: IndexedDocument[];
	mouvements: Mouvement[];
	affectations: Affectation[];
	comptes: Compte[];
	onMouvements: (next: Mouvement[]) => void;
	onAffectations: (next: Affectation[]) => void;
	onBack: () => void;
};

function pad2(value: number): string {
	return String(value).padStart(2, "0");
}

function todayInput(): string {
	const now = new Date();
	return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function inputToIso(value: string): string {
	const date = new Date(`${value}T12:00:00`);
	return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

/** Sens du mouvement qui règle une pièce : entrée pour un client, sortie sinon. */
function sensAttendu(doc: Pick<IndexedDocument, "kind">): MouvementSens {
	return doc.kind === "facture_client" || doc.kind === "avoir_client" ? "entree" : "sortie";
}

/**
 * Écran **Trésorerie** : ce qui est facturé, ce qui est réellement encaissé, ce
 * qu'il reste à percevoir ou à payer, et le **lettrage** (relier un mouvement
 * d'argent à une ou plusieurs pièces).
 *
 * Aucun solde n'est saisi : le reste dû est toujours recalculé depuis les pièces
 * et les affectations.
 */
export function TreasuryScreen({
	documents,
	mouvements,
	affectations,
	comptes,
	onMouvements,
	onAffectations,
	onBack,
}: Props) {
	const [message, setMessage] = useState<string | null>(null);
	const [form, setForm] = useState<{
		sens: MouvementSens;
		date: string;
		montant: string;
		compteId: string;
		moyen: string;
		reference: string;
	}>({
		sens: "entree",
		date: todayInput(),
		montant: "",
		compteId: comptes[0]?.id ?? "",
		moyen: "Virement",
		reference: "",
	});
	const [lettrageDocId, setLettrageDocId] = useState<string | null>(null);
	const [lettrageMouvementId, setLettrageMouvementId] = useState("");
	const [lettrageMontant, setLettrageMontant] = useState("");
	const [suppressionId, setSuppressionId] = useState<string | null>(null);

	const tableau = useMemo(
		() => tableauTresorerie(documents, mouvements, affectations, comptes),
		[documents, mouvements, affectations, comptes],
	);
	const echeancier = useMemo(
		() => construireEcheancier(documents, affectations),
		[documents, affectations],
	);
	const soldes = useMemo(() => soldesSuivis(comptes, mouvements), [comptes, mouvements]);
	const libres = useMemo(
		() => mouvementsNonAffectes(mouvements, affectations),
		[mouvements, affectations],
	);
	const docEnLettrage = documents.find((doc) => doc.id === lettrageDocId) ?? null;
	/**
	 * On ne propose que les mouvements du **bon sens** : on n'encaisse pas une
	 * facture fournisseur, on ne paie pas une facture client.
	 */
	const candidats = docEnLettrage
		? libres.filter((mouvement) => mouvement.sens === sensAttendu(docEnLettrage))
		: libres;
	const mouvementASupprimer =
		mouvements.find((mouvement) => mouvement.id === suppressionId) ?? null;

	function enregistrerMouvement() {
		const montant = parseMontant(form.montant);
		if (montant === null || montant <= 0) {
			setMessage("Indique un montant valide (par exemple 660,00).");
			return;
		}
		const mouvement: Mouvement = {
			id: newId(),
			sens: form.sens,
			date: inputToIso(form.date),
			montant: Math.round(montant * 100) / 100,
			compteId: form.compteId || null,
			moyen: form.moyen,
			reference: form.reference.trim() || undefined,
			createdAt: new Date().toISOString(),
		};
		onMouvements([...mouvements, mouvement]);
		setMessage(
			`${MOUVEMENT_SENS_LABELS[mouvement.sens]} de ${formatEuros(mouvement.montant)} enregistré — à affecter à une pièce.`,
		);
		setForm((current) => ({ ...current, montant: "", reference: "" }));
	}

	/** Prépare le lettrage : montant par défaut = le plus petit des deux restes. */
	function demarrerLettrage(doc: IndexedDocument) {
		const reste = resteDuDocument(doc, affectations);
		const premier =
			libres.find((mouvement) => mouvement.sens === sensAttendu(doc)) ?? null;
		setLettrageDocId(doc.id);
		setLettrageMouvementId(premier?.id ?? "");
		if (premier) {
			const max = Math.min(reste, resteDuMouvement(premier, affectations));
			setLettrageMontant(formatEuros(max).replace(" €", "").replace(/\s/g, ""));
		} else {
			setLettrageMontant("");
		}
	}

	function validerLettrage(doc: IndexedDocument) {
		const mouvement = mouvements.find((m) => m.id === lettrageMouvementId);
		if (!mouvement) {
			setMessage("Choisis le mouvement à affecter (ou enregistre-le d'abord).");
			return;
		}
		const montant = parseMontant(lettrageMontant);
		const resultat = affecter({
			id: newId(),
			mouvement,
			document: doc,
			montant: montant ?? 0,
			affectations,
		});
		if (!resultat.ok) {
			setMessage(resultat.error);
			return;
		}
		onAffectations([...affectations, resultat.affectation]);
		setMessage(
			`${formatEuros(resultat.affectation.montant)} affecté à ${DOCUMENT_KIND_LABELS[doc.kind]} ${doc.numero || "(sans numéro)"}.`,
		);
		setLettrageDocId(null);
	}

	function supprimerMouvement() {
		if (!suppressionId) return;
		onMouvements(mouvements.filter((mouvement) => mouvement.id !== suppressionId));
		onAffectations(
			affectations.filter((affectation) => affectation.mouvementId !== suppressionId),
		);
		setMessage("Mouvement supprimé, avec ses affectations.");
		setSuppressionId(null);
	}

	const tuiles: { label: string; valeur: string; alerte?: boolean }[] = [
		{ label: "Facturé aux clients", valeur: formatEuros(tableau.factureClients) },
		{ label: "Encaissé", valeur: formatEuros(tableau.encaisse) },
		{
			label: "Reste à encaisser",
			valeur: formatEuros(tableau.resteAEncaisser),
			alerte: tableau.resteAEncaisser > CENT,
		},
		{ label: "Dont en retard", valeur: formatEuros(tableau.enRetard), alerte: tableau.enRetard > CENT },
		{ label: "Sorties", valeur: formatEuros(tableau.depenses) },
		{ label: "Solde suivi", valeur: formatEuros(tableau.soldeTotal) },
	];

	return (
		<section id="tresorerie" aria-labelledby="tresorerie-title" className="no-print">
			<Card>
				<CardContent className="p-5">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div>
							<h2
								id="tresorerie-title"
								className="font-display text-xl font-medium tracking-tight"
							>
								Trésorerie
							</h2>
							<p className="mt-1 text-sm text-muted-foreground">
								{mouvements.length} mouvement{mouvements.length > 1 ? "s" : ""} ·{" "}
								{affectations.length} affectation{affectations.length > 1 ? "s" : ""} ·{" "}
								{echeancier.aEncaisser.length} pièce
								{echeancier.aEncaisser.length > 1 ? "s" : ""} à encaisser
							</p>
						</div>
						<Button type="button" variant="outline" onClick={onBack}>
							<ArrowLeft />
							Retour
						</Button>
					</div>

					<div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
						{tuiles.map((tuile) => (
							<div
								key={tuile.label}
								className="rounded-lg border border-border bg-card px-3 py-2"
							>
								<p className="text-xs text-muted-foreground">{tuile.label}</p>
								<p
									className={
										tuile.alerte
											? "mt-1 font-medium text-destructive"
											: "mt-1 font-medium"
									}
								>
									{tuile.valeur}
								</p>
							</div>
						))}
					</div>

					{message ? (
						<p className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
							{message}
						</p>
					) : null}
				</CardContent>
			</Card>

			<Card className="mt-4">
				<CardContent className="p-5">
					<h3 className="font-display text-lg font-medium tracking-tight">
						Enregistrer un mouvement
					</h3>
					<p className="mt-1 text-sm text-muted-foreground">
						L’argent qui bouge réellement : virement reçu, chèque, espèces, prélèvement. Le
						lettrage (à quelle facture il se rapporte) se fait juste en dessous.
					</p>
					<div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						<div>
							<Label htmlFor="mvt-sens">Sens</Label>
							<select
								id="mvt-sens"
								className="mt-1 flex h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
								value={form.sens}
								onChange={(event) =>
									setForm((f) => ({ ...f, sens: event.target.value as MouvementSens }))
								}
							>
								<option value="entree">Encaissement (entrée)</option>
								<option value="sortie">Décaissement (sortie)</option>
							</select>
						</div>
						<div>
							<Label htmlFor="mvt-date">Date</Label>
							<Input
								id="mvt-date"
								type="date"
								className="mt-1"
								value={form.date}
								onChange={(event) => setForm((f) => ({ ...f, date: event.target.value }))}
							/>
						</div>
						<div>
							<Label htmlFor="mvt-montant">Montant</Label>
							<Input
								id="mvt-montant"
								className="mt-1"
								value={form.montant}
								placeholder="660,00"
								onChange={(event) => setForm((f) => ({ ...f, montant: event.target.value }))}
							/>
						</div>
						<div>
							<Label htmlFor="mvt-compte">Compte</Label>
							<select
								id="mvt-compte"
								className="mt-1 flex h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
								value={form.compteId}
								onChange={(event) => setForm((f) => ({ ...f, compteId: event.target.value }))}
							>
								{comptes.map((compte) => (
									<option key={compte.id} value={compte.id}>
										{compte.libelle}
										{compte.type === "caisse" ? " (espèces)" : ""}
									</option>
								))}
								<option value="">Sans compte</option>
							</select>
						</div>
						<div>
							<Label htmlFor="mvt-moyen">Moyen</Label>
							<select
								id="mvt-moyen"
								className="mt-1 flex h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
								value={form.moyen}
								onChange={(event) => setForm((f) => ({ ...f, moyen: event.target.value }))}
							>
								{MOYENS.map((moyen) => (
									<option key={moyen} value={moyen}>
										{moyen}
									</option>
								))}
							</select>
						</div>
						<div className="sm:col-span-2">
							<Label htmlFor="mvt-reference">Référence (facultatif)</Label>
							<Input
								id="mvt-reference"
								className="mt-1"
								value={form.reference}
								placeholder="N° de chèque, libellé du virement…"
								onChange={(event) =>
									setForm((f) => ({ ...f, reference: event.target.value }))
								}
							/>
						</div>
						<div className="flex items-end">
							<Button type="button" onClick={enregistrerMouvement}>
								Enregistrer
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card className="mt-4">
				<CardContent className="p-5">
					<h3 className="font-display text-lg font-medium tracking-tight">
						À encaisser
					</h3>
					{echeancier.aEncaisser.length === 0 ? (
						<p className="mt-2 text-sm text-muted-foreground">
							Rien en attente : toutes les pièces clients sont réglées.
						</p>
					) : (
						<ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
							{echeancier.aEncaisser.map((ligne) => {
								const doc = ligne.document;
								const statut = statutReglement(doc, affectations);
								return (
									<li key={doc.id} className="flex flex-col gap-2 bg-card px-3 py-3">
										<div className="flex flex-wrap items-start justify-between gap-2">
											<div>
												<p className="font-medium">
													{DOCUMENT_KIND_LABELS[doc.kind]}{" "}
													{doc.numero ? `n° ${doc.numero}` : "(sans numéro)"}
													{doc.tiers.nom ? ` — ${doc.tiers.nom}` : ""}
												</p>
												<p className="text-xs text-muted-foreground">
													{doc.dateDocument ? `${formatDay(doc.dateDocument)} · ` : ""}
													{STATUT_REGLEMENT_LABELS[statut]} · réglé{" "}
													{formatEuros(montantRegle(doc.id, affectations))} sur{" "}
													{formatEuros(doc.ttc)}
													{ligne.echeance ? ` · échéance ${formatDay(ligne.echeance)}` : ""}
													{ligne.enRetard && ligne.jours !== null
														? ` · ${ligne.jours} jour${ligne.jours > 1 ? "s" : ""} de retard`
														: ""}
												</p>
											</div>
											<div className="flex flex-wrap items-center gap-2">
												<span className="font-medium">{formatEuros(ligne.reste)}</span>
												<Button
													type="button"
													size="sm"
													variant="outline"
													onClick={() => demarrerLettrage(doc)}
												>
													Lettrer
												</Button>
											</div>
										</div>

										{lettrageDocId === doc.id ? (
											<div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-muted/40 p-3">
												<div className="min-w-56 flex-1">
													<Label htmlFor={`lettrage-${doc.id}`}>Mouvement à affecter</Label>
													<select
														id={`lettrage-${doc.id}`}
														className="mt-1 flex h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
														value={lettrageMouvementId}
														onChange={(event) => setLettrageMouvementId(event.target.value)}
													>
														<option value="">— choisir un mouvement —</option>
														{candidats.map((mouvement) => (
															<option key={mouvement.id} value={mouvement.id}>
																{formatDay(mouvement.date)} ·{" "}
																{MOUVEMENT_SENS_LABELS[mouvement.sens]} ·{" "}
																{formatEuros(resteDuMouvement(mouvement, affectations))}{" "}
																disponible
															</option>
														))}
													</select>
												</div>
												<div>
													<Label htmlFor={`montant-${doc.id}`}>Montant</Label>
													<Input
														id={`montant-${doc.id}`}
														className="mt-1"
														value={lettrageMontant}
														onChange={(event) => setLettrageMontant(event.target.value)}
													/>
												</div>
												<Button type="button" onClick={() => validerLettrage(doc)}>
													Affecter
												</Button>
												<Button
													type="button"
													variant="ghost"
													onClick={() => setLettrageDocId(null)}
												>
													Annuler
												</Button>
											</div>
										) : null}
									</li>
								);
							})}
						</ul>
					)}
				</CardContent>
			</Card>

			<Card className="mt-4">
				<CardContent className="p-5">
					<h3 className="font-display text-lg font-medium tracking-tight">
						À payer
					</h3>
					<p className="mt-1 text-sm text-muted-foreground">
						Factures fournisseurs et tickets non réglés — on n’y affecte que des
						décaissements.
					</p>
					{echeancier.aPayer.length === 0 ? (
						<p className="mt-2 text-sm text-muted-foreground">
							Rien à payer : toutes les pièces fournisseurs sont réglées.
						</p>
					) : (
						<ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
							{echeancier.aPayer.map((ligne) => {
								const doc = ligne.document;
								return (
									<li key={doc.id} className="flex flex-col gap-2 bg-card px-3 py-3">
										<div className="flex flex-wrap items-start justify-between gap-2">
											<div>
												<p className="font-medium">
													{DOCUMENT_KIND_LABELS[doc.kind]}{" "}
													{doc.numero ? `n° ${doc.numero}` : "(sans numéro)"}
													{doc.tiers.nom ? ` — ${doc.tiers.nom}` : ""}
												</p>
												<p className="text-xs text-muted-foreground">
													{doc.dateDocument ? `${formatDay(doc.dateDocument)} · ` : ""}
													réglé {formatEuros(montantRegle(doc.id, affectations))} sur{" "}
													{formatEuros(doc.ttc)}
													{ligne.echeance ? ` · échéance ${formatDay(ligne.echeance)}` : ""}
													{ligne.enRetard && ligne.jours !== null
														? ` · ${ligne.jours} jour${ligne.jours > 1 ? "s" : ""} de retard`
														: ""}
												</p>
											</div>
											<div className="flex flex-wrap items-center gap-2">
												<span className="font-medium">{formatEuros(ligne.reste)}</span>
												<Button
													type="button"
													size="sm"
													variant="outline"
													onClick={() => demarrerLettrage(doc)}
												>
													Lettrer
												</Button>
											</div>
										</div>

										{lettrageDocId === doc.id ? (
											<div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-muted/40 p-3">
												<div className="min-w-56 flex-1">
													<Label htmlFor={`lettrage-payer-${doc.id}`}>
														Décaissement à affecter
													</Label>
													<select
														id={`lettrage-payer-${doc.id}`}
														className="mt-1 flex h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
														value={lettrageMouvementId}
														onChange={(event) => setLettrageMouvementId(event.target.value)}
													>
														<option value="">— choisir un mouvement —</option>
														{candidats.map((mouvement) => (
															<option key={mouvement.id} value={mouvement.id}>
																{formatDay(mouvement.date)} ·{" "}
																{formatEuros(resteDuMouvement(mouvement, affectations))}{" "}
																disponible
															</option>
														))}
													</select>
												</div>
												<div>
													<Label htmlFor={`montant-payer-${doc.id}`}>Montant</Label>
													<Input
														id={`montant-payer-${doc.id}`}
														className="mt-1"
														value={lettrageMontant}
														onChange={(event) => setLettrageMontant(event.target.value)}
													/>
												</div>
												<Button type="button" onClick={() => validerLettrage(doc)}>
													Affecter
												</Button>
												<Button
													type="button"
													variant="ghost"
													onClick={() => setLettrageDocId(null)}
												>
													Annuler
												</Button>
											</div>
										) : null}
									</li>
								);
							})}
						</ul>
					)}
				</CardContent>
			</Card>

			<Card className="mt-4">
				<CardContent className="p-5">
					<h3 className="font-display text-lg font-medium tracking-tight">Mouvements</h3>
					{mouvements.length === 0 ? (
						<p className="mt-2 text-sm text-muted-foreground">
							Aucun mouvement enregistré pour l’instant.
						</p>
					) : (
						<ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
							{[...mouvements]
								.sort((a, b) => b.date.localeCompare(a.date))
								.map((mouvement) => {
									const reste = resteDuMouvement(mouvement, affectations);
									return (
										<li
											key={mouvement.id}
											className="flex flex-wrap items-center justify-between gap-2 bg-card px-3 py-3"
										>
											<div>
												<p className="font-medium">
													{MOUVEMENT_SENS_LABELS[mouvement.sens]} ·{" "}
													{formatEuros(mouvement.montant)}
												</p>
												<p className="text-xs text-muted-foreground">
													{formatDay(mouvement.date)} · {mouvement.moyen} ·{" "}
													{compteLabel(comptes, mouvement.compteId)}
													{mouvement.reference ? ` · ${mouvement.reference}` : ""}
													{reste > CENT
														? ` · ${formatEuros(reste)} non affecté`
														: " · entièrement affecté"}
												</p>
											</div>
											<Button
												type="button"
												size="sm"
												variant="ghost"
												className="text-destructive"
												onClick={() => setSuppressionId(mouvement.id)}
											>
												<Trash2 />
												Supprimer
											</Button>
										</li>
									);
								})}
						</ul>
					)}
				</CardContent>
			</Card>

			<Card className="mt-4">
				<CardContent className="p-5">
					<h3 className="font-display text-lg font-medium tracking-tight">
						Comptes suivis
					</h3>
					<p className="mt-1 text-sm text-muted-foreground">
						Solde d’ouverture + entrées − sorties. C’est un solde **suivi** : il ne connaît
						que ce que tu saisis (le pointage viendra plus tard).
					</p>
					<ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
						{soldes.parCompte.map((ligne) => (
							<li
								key={ligne.compte.id}
								className="flex flex-wrap items-center justify-between gap-2 bg-card px-3 py-3"
							>
								<div>
									<p className="font-medium">{ligne.compte.libelle}</p>
									<p className="text-xs text-muted-foreground">
										Ouverture {formatEuros(ligne.compte.soldeOuverture)} · entrées{" "}
										{formatEuros(ligne.entrees)} · sorties {formatEuros(ligne.sorties)}
									</p>
								</div>
								<span className="font-medium">{formatEuros(ligne.solde)}</span>
							</li>
						))}
					</ul>
				</CardContent>
			</Card>

			<ConfirmDialog
				open={mouvementASupprimer !== null}
				title="Supprimer ce mouvement ?"
				message={
					mouvementASupprimer
						? `${MOUVEMENT_SENS_LABELS[mouvementASupprimer.sens]} de ${formatEuros(mouvementASupprimer.montant)} — ses affectations seront retirées et les pièces redeviendront « à encaisser ».`
						: ""
				}
				actions={[
					{ label: "Annuler", variant: "outline", onClick: () => setSuppressionId(null) },
					{ label: "Supprimer", variant: "destructive", onClick: supprimerMouvement },
				]}
			/>
		</section>
	);
}
