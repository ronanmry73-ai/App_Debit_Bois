/**
 * Scénarios d'après-correctif — synchronisation Drive (téléphone ↔ PC).
 *
 * Encodent les scénarios de la note de risque du 2026-09-15 :
 *   SC1  hors-ligne puis retour du réseau : envoyé une fois, appliqué une fois
 *   SC1b renvoi répété du même carnet : aucun doublon sur Drive
 *   SC2  carnet vidé par le PC juste après l'envoi : le mouvement n'est pas perdu
 *   SC3  carnet tronqué : refus net, file locale préservée
 *   SC4  référence inconnue : mouvement conservé et rejouable
 *   SC6  plafond de 500 identifiants : risque résiduel documenté
 *
 * Les fonctions testées sont celles réellement appelées par l'écran.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createDriveClient } from "./google-drive-api.ts";
import { mergeRemoteJournal, remainingPendingAfterPush } from "./google-drive.ts";
import {
	acknowledgePendingMoves,
	mergeAppliedIds,
	mergePendingMoves,
	PENDING_JOURNAL_NAME,
	parseMovementJournal,
	planJournalApplication,
	serializeMovementJournal,
	type PendingMove,
} from "./movements.ts";
import type { StockItem } from "./stock.ts";

function stockItem(overrides: Partial<StockItem> = {}): StockItem {
	return {
		id: "it-1",
		kind: "panel-A",
		name: "Panneau CP peuplier",
		sku: "CP-18",
		qty: 10,
		unit: "u",
		unitCost: 12,
		minQty: 2,
		refId: "REF-1",
		...overrides,
	};
}

function pendingMove(overrides: Partial<PendingMove> = {}): PendingMove {
	return {
		id: "m-1",
		at: "2026-09-15T10:00:00.000Z",
		refId: "REF-1",
		delta: -2,
		reason: "Sortie chantier",
		...overrides,
	};
}

/** Serveur Drive minimal : un seul fichier, le carnet des mouvements. */
function fakeDriveServer(initialPending: string | null) {
	const state = { pending: initialPending, writes: 0, renamed: [] as string[] };
	const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		const method = init?.method ?? "GET";
		if (url.includes("/files?q=")) {
			const files =
				state.pending === null
					? []
					: [{ id: "pending-id", name: PENDING_JOURNAL_NAME }];
			return new Response(JSON.stringify({ files }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}
		if (method === "GET" && url.includes("alt=media")) {
			return new Response(state.pending ?? "", { status: 200 });
		}
		if (method === "POST") {
			return new Response(JSON.stringify({ id: "pending-id" }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}
		if (method === "PATCH" && url.includes("/upload/")) {
			state.pending = String(init?.body ?? "");
			state.writes += 1;
			return new Response("{}", { status: 200 });
		}
		if (method === "PATCH") {
			const body = JSON.parse(String(init?.body ?? "{}")) as { name?: string };
			state.renamed.push(body.name ?? "");
			state.pending = null;
			return new Response("{}", { status: 200 });
		}
		return new Response("{}", { status: 200 });
	}) as typeof fetch;
	return { state, fetchImpl };
}

const LINK = {
	folderId: "fld-1",
	lastFileId: "mirror-id",
	pendingFileId: "pending-id",
	folderName: "Sauvegarde Débit Bois ERP",
};

test("acknowledgePendingMoves : aucune nouvelle référence quand rien n'est confirmé", () => {
	const queue = [pendingMove({ id: "m-1" })];
	assert.equal(acknowledgePendingMoves(queue, []), queue);
	assert.equal(acknowledgePendingMoves(queue, ["un-autre-id"]), queue);
	const remaining = acknowledgePendingMoves(queue, ["m-1"]);
	assert.notEqual(remaining, queue);
	assert.deepEqual(remaining, []);
});

test("SC1 — hors-ligne puis réseau : retiré de la file seulement après application", () => {
	let queue = [pendingMove({ id: "m-1" }), pendingMove({ id: "m-2", delta: -3 })];
	// 1. Aucun accusé de réception : la file reste intacte.
	assert.equal(acknowledgePendingMoves(queue, []), queue);
	// 2. Le PC applique le carnet.
	const plan = planJournalApplication([stockItem()], [], queue, []);
	assert.equal(plan.stock[0]?.qty, 5);
	assert.deepEqual(plan.appliedMoveIds, ["m-1", "m-2"]);
	// 3. Le miroir du PC publie ces identifiants : la file se vide.
	queue = acknowledgePendingMoves(queue, plan.appliedMoveIds);
	assert.deepEqual(queue, []);
	// 4. Rejouer le même carnet ne re-compte rien.
	const replay = planJournalApplication(
		plan.stock,
		plan.moves,
		[pendingMove({ id: "m-1" }), pendingMove({ id: "m-2", delta: -3 })],
		plan.appliedMoveIds,
	);
	assert.equal(replay.stock[0]?.qty, 5);
	assert.deepEqual(replay.applied, []);
});

test("SC1b — renvoi répété du même carnet : aucun doublon sur Drive", async () => {
	const { state, fetchImpl } = fakeDriveServer(serializeMovementJournal([]));
	const api = createDriveClient({ accessToken: "jeton", fetchImpl });
	const local = [pendingMove({ id: "m-1" })];
	await api.pushPending(LINK, local);
	await api.pushPending(LINK, local);
	await api.pushPending(LINK, local);
	const journal = JSON.parse(String(state.pending)) as { items: PendingMove[] };
	assert.equal(journal.items.length, 1);
	assert.equal(journal.items[0]?.id, "m-1");
});

test("SC2 — carnet vidé par le PC après l'envoi : le mouvement reste en file et repart", async () => {
	const { state, fetchImpl } = fakeDriveServer(serializeMovementJournal([]));
	const api = createDriveClient({ accessToken: "jeton", fetchImpl });
	const local = [pendingMove({ id: "m-1" })];
	const { sentIds } = await api.pushPending(LINK, local);
	assert.deepEqual(sentIds, ["m-1"]);
	// Simule la course : le PC a lu l'ancien contenu puis archivé (= carnet vide).
	state.pending = serializeMovementJournal([]);
	// Le miroir ne confirme pas m-1 : le téléphone le conserve et le repoussera.
	assert.deepEqual(
		acknowledgePendingMoves(local, []).map((m) => m.id),
		["m-1"],
	);
	// L'ancien comportement (vidage sur envoi réussi) l'aurait perdu :
	assert.deepEqual(remainingPendingAfterPush(local, sentIds), []);
});

test("SC3 — carnet tronqué : refus net, file locale préservée", () => {
	const full = serializeMovementJournal([pendingMove({ id: "m-1" })]);
	const torn = full.slice(0, Math.floor(full.length / 2));
	assert.equal(parseMovementJournal(torn).ok, false);
	assert.throws(
		() => mergeRemoteJournal(torn, [pendingMove({ id: "m-2" })]),
		/JSON valide/,
	);
	// Un carnet absent, lui, n'empêche pas de pousser.
	const merged = mergeRemoteJournal(null, [pendingMove({ id: "m-2" })]);
	assert.equal(merged.journal.items.length, 1);
	// L'échec ne retire rien de la file locale.
	const queue = [pendingMove({ id: "m-2" })];
	assert.equal(acknowledgePendingMoves(queue, []), queue);
});

test("SC4 — référence inconnue : conservé et rejouable, jamais marqué appliqué", () => {
	const orphan = pendingMove({ id: "m-orphelin", refId: "REF-ABSENTE", delta: -2 });
	const first = planJournalApplication([stockItem()], [], [orphan], []);
	assert.deepEqual(first.applied, []);
	assert.deepEqual(
		first.skipped.map((m) => m.id),
		["m-orphelin"],
	);
	assert.deepEqual(first.appliedMoveIds, []);
	assert.deepEqual(
		first.remaining.map((m) => m.id),
		["m-orphelin"],
	);
	assert.equal(first.stock[0]?.qty, 10);
	// La référence est créée plus tard à l'atelier : le mouvement s'applique enfin.
	const later = [stockItem(), stockItem({ id: "it-2", refId: "REF-ABSENTE", qty: 4 })];
	const second = planJournalApplication(
		later,
		first.moves,
		first.remaining,
		first.appliedMoveIds,
	);
	assert.deepEqual(
		second.applied.map((m) => m.id),
		["m-orphelin"],
	);
	assert.equal(second.stock.find((i) => i.id === "it-2")?.qty, 2);
	assert.deepEqual(second.remaining, []);
});

test("ingestion PC répétée du même carnet : pas de doublon en file", () => {
	const items = [pendingMove({ id: "m-1" })];
	const first = mergePendingMoves([], items);
	const second = mergePendingMoves(first, items);
	assert.equal(second.length, 1);
});

test("SC5b — carnet illisible : la réparation l'écarte et un carnet neuf est créé", async () => {
	const { state, fetchImpl } = fakeDriveServer("{ ceci n'est pas un carnet");
	const api = createDriveClient({ accessToken: "jeton", fetchImpl });
	const local = [pendingMove({ id: "m-1" })];
	await assert.rejects(() => api.pushPending(LINK, local), /JSON valide/);
	const { archivedName } = await api.repairPending(LINK);
	assert.equal(archivedName?.startsWith("mouvements-pending.illisible-"), true);
	assert.deepEqual(state.renamed, [archivedName]);
	assert.equal(state.pending, null);
	const fresh = await api.pushPending({ ...LINK, pendingFileId: null }, local);
	assert.deepEqual(fresh.sentIds, ["m-1"]);
	const journal = JSON.parse(String(state.pending)) as { items: PendingMove[] };
	assert.equal(journal.items.length, 1);
});

test("SC6 — au-delà de 500 confirmations, un identifiant ancien est évincé (risque résiduel)", () => {
	const flood = Array.from({ length: 500 }, (_, i) => `remplissage-${i}`);
	const first = mergeAppliedIds(flood, ["m-ancien"]);
	assert.equal(first.length, 500);
	assert.equal(first.includes("m-ancien"), true);
	const evicted = mergeAppliedIds(
		first,
		Array.from({ length: 500 }, (_, i) => `suite-${i}`),
	);
	assert.equal(evicted.length, 500);
	assert.equal(evicted.includes("m-ancien"), false);
	// Conséquence : un carnet encore présent sur Drive serait rejoué → double comptage.
	const replay = planJournalApplication(
		[stockItem()],
		[],
		[pendingMove({ id: "m-ancien", delta: -2 })],
		evicted,
	);
	assert.deepEqual(
		replay.applied.map((m) => m.id),
		["m-ancien"],
	);
	assert.equal(replay.stock[0]?.qty, 8);
});
