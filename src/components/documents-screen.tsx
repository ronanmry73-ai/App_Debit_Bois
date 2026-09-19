import { ArrowLeft, FileText, FolderOpen, Inbox, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { desktopApi, type DocumentsInboxFile } from "@/lib/desktop";
import {
  DOCUMENT_KIND_LABELS,
  countDocuments,
  factureToDocument,
  manualDocument,
  mergeDocuments,
  parseFactureExport,
  parseMontant,
  round2,
  type DocumentKind,
  type IndexedDocument,
} from "@/lib/documents";
import { formatDay } from "@/lib/projects";

type Filter = "tous" | "clients" | "fournisseurs" | "tickets";

type Props = {
  documents: IndexedDocument[];
  onDocuments: (next: IndexedDocument[]) => void;
  /** Contexte transmis à Electron (dossier de sauvegarde choisi par l'utilisateur). */
  hintJson: string;
  onBack: () => void;
};

type ImportReport = {
  /** Dossier réellement choisi : affiché, pour savoir quoi corriger s'il est vide. */
  dossier: string;
  lus: number;
  ajoutes: number;
  inchanges: number;
  misAJour: number;
  conflits: string[];
  erreurs: { fichier: string; erreurs: string[] }[];
  /** Fichiers présents dans le dossier mais d'une extension non reconnue. */
  ignores: string[];
};

/** Extension en minuscules, avec le point (`.csv`), ou chaîne vide. */
function extensionOf(name: string): string {
  const at = name.lastIndexOf(".");
  return at >= 0 ? name.slice(at).toLowerCase() : "";
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Date du jour au format d'un champ `<input type="date">`. */
function todayInput(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/** `aaaa-mm-jj` → ISO calé à midi local (pas de bascule de jour). */
function inputToIso(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

const EXPORT_EXTENSIONS = [".csv", ".tsv", ".txt", ".xlsx"];
const JUSTIFICATIF_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];

function matchesFilter(doc: IndexedDocument, filter: Filter): boolean {
  if (filter === "tous") return true;
  if (filter === "clients") return doc.kind === "facture_client" || doc.kind === "avoir_client";
  if (filter === "fournisseurs") return doc.kind === "facture_fournisseur";
  return doc.kind === "ticket" || doc.kind === "autre";
}

function sortKey(doc: IndexedDocument): string {
  return doc.dateDocument ?? doc.importedAt;
}

/**
 * Écran **Registre des documents** (PC) : import du dossier d'exports de
 * facturation, index, file « à classer » des justificatifs, ouverture des copies.
 *
 * L'index vit dans l'instantané persisté ; les fichiers vivent dans le dossier
 * Drive `factures/`. Le rendu ne fait que de l'orchestration : toute la logique
 * de lecture et de contrôle est dans `src/lib/documents.ts`.
 */
export function DocumentsScreen({ documents, onDocuments, hintJson, onBack }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [filter, setFilter] = useState<Filter>("tous");
  const [query, setQuery] = useState("");
  const [inbox, setInbox] = useState<DocumentsInboxFile[]>([]);
  const [inboxDir, setInboxDir] = useState("");
  const [assocFor, setAssocFor] = useState<string | null>(null);
  const [assocDocId, setAssocDocId] = useState("");
  const [excluded, setExcluded] = useState<string[]>([]);
  const [form, setForm] = useState<{
    kind: DocumentKind;
    numero: string;
    date: string;
    tiers: string;
    ttc: string;
    taux: string;
    designation: string;
  }>({
    kind: "facture_fournisseur",
    numero: "",
    date: todayInput(),
    tiers: "",
    ttc: "",
    taux: "20",
    designation: "",
  });

  const stats = useMemo(() => countDocuments(documents), [documents]);

  const refreshInbox = useCallback(async () => {
    const api = desktopApi();
    if (!api?.documentsListInbox) return;
    const res = await api.documentsListInbox(hintJson);
    setInbox(res?.files ?? []);
    setInboxDir(res?.dir ?? "");
    if (res && res.ok === false) setMessage(res.error ?? "Dossier de dépôt illisible.");
  }, [hintJson]);

  useEffect(() => {
    void refreshInbox();
  }, [refreshInbox]);

  const list = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return documents
      .filter((doc) => matchesFilter(doc, filter))
      .filter((doc) => {
        if (!needle) return true;
        return `${doc.numero} ${doc.tiers.nom} ${doc.tiers.prenom ?? ""} ${doc.lignes
          .map((l) => l.designation)
          .join(" ")}`
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
  }, [documents, filter, query]);

  /** Import d'un dossier d'exports : un fichier = une facture. */
  async function importFolder() {
    const api = desktopApi();
    if (!api?.documentsPickFolder || !api.documentsListFolder || !api.documentsReadText) {
      setMessage("Import réservé à l'application PC (les documents se consultent ici).");
      return;
    }
    const folder = await api.documentsPickFolder();
    if (!folder) return;
    setBusy(true);
    setReport(null);
    try {
      // On liste **tout** le dossier : ce qui n'est pas un export est signalé,
      // au lieu de disparaître sans explication.
      const all = (await api.documentsListFolder(folder, []))?.files ?? [];
      const files = all.filter((item) =>
        EXPORT_EXTENSIONS.includes(extensionOf(item.name)),
      );
      const ignores = all
        .filter((item) => !EXPORT_EXTENSIONS.includes(extensionOf(item.name)))
        .map((item) => item.name);
      const pdfs = (await api.documentsListFolder(folder, [".pdf"]))?.files ?? [];

      if (files.length === 0) {
        setReport({
          dossier: folder,
          lus: 0,
          ajoutes: 0,
          inchanges: 0,
          misAJour: 0,
          conflits: [],
          erreurs: [],
          ignores,
        });
        return;
      }

      const incoming: IndexedDocument[] = [];
      const erreurs: { fichier: string; erreurs: string[] }[] = [];

      for (const file of files) {
        const read = await api.documentsReadText(file.path);
        if (!read?.ok) {
          erreurs.push({ fichier: file.name, erreurs: [read?.error ?? "Lecture impossible"] });
          continue;
        }
        const parsed = parseFactureExport(read.text);
        if (!parsed.ok) {
          erreurs.push({ fichier: file.name, erreurs: parsed.erreurs });
          continue;
        }
        const doc = factureToDocument(parsed.facture);
        // Justificatif homonyme (même nom, en PDF) : on le classe au passage.
        const pdfName = file.name.replace(/\.[^.]+$/, ".pdf").toLowerCase();
        const pdf = pdfs.find((candidate) => candidate.name.toLowerCase() === pdfName);
        if (pdf && api.documentsStoreFile) {
          const stored = await api.documentsStoreFile({
            hintJson,
            sourcePath: pdf.path,
            kind: doc.kind,
            numero: doc.numero,
            dateDocument: doc.dateDocument,
          });
          if (stored?.ok && stored.chemin) {
            doc.fichier = {
              chemin: stored.chemin,
              empreinte: stored.empreinte,
              taille: stored.taille,
            };
          }
        }
        incoming.push(doc);
      }

      const outcome = mergeDocuments(documents, incoming);
      onDocuments(outcome.documents);
      setReport({
        dossier: folder,
        lus: files.length,
        ajoutes: outcome.added,
        inchanges: outcome.unchanged,
        misAJour: outcome.updated,
        conflits: outcome.conflits,
        erreurs,
        ignores,
      });
      await refreshInbox();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Import impossible.");
    } finally {
      setBusy(false);
    }
  }

  /** Rattache un justificatif déposé au document choisi. */
  async function associate(file: DocumentsInboxFile) {
    const api = desktopApi();
    const doc = documents.find((d) => d.id === assocDocId);
    if (!api?.documentsStoreFile || !doc) {
      setMessage("Choisis d'abord le document à rattacher.");
      return;
    }
    setBusy(true);
    try {
      const stored = await api.documentsStoreFile({
        hintJson,
        sourcePath: file.path,
        kind: doc.kind,
        numero: doc.numero,
        dateDocument: doc.dateDocument,
      });
      if (!stored?.ok || !stored.chemin) {
        setMessage(stored?.error ?? "Classement impossible.");
        return;
      }
      onDocuments(
        documents.map((candidate) =>
          candidate.id === doc.id
            ? {
                ...candidate,
                fichier: {
                  chemin: stored.chemin as string,
                  empreinte: stored.empreinte,
                  taille: stored.taille,
                },
                updatedAt: new Date().toISOString(),
              }
            : candidate,
        ),
      );
      setMessage(`« ${file.name} » rattaché à ${DOCUMENT_KIND_LABELS[doc.kind]} ${doc.numero || ""}.`);
      setAssocFor(null);
      setAssocDocId("");
      await refreshInbox();
    } finally {
      setBusy(false);
    }
  }

  async function openCopy(doc: IndexedDocument) {
    const api = desktopApi();
    if (!doc.fichier || !api?.documentsOpenFile) {
      setMessage("Aucun justificatif classé pour ce document.");
      return;
    }
    const opened = await api.documentsOpenFile({ hintJson, chemin: doc.fichier.chemin });
    if (!opened) setMessage(`Copie introuvable : ${doc.fichier.chemin}`);
  }

  function ecarter(doc: IndexedDocument) {
    setExcluded((prev) => (prev.includes(doc.id) ? prev : [...prev, doc.id]));
    setMessage(
      `${DOCUMENT_KIND_LABELS[doc.kind]} ${doc.numero || "(sans numéro)"} écarté — le fichier reste archivé.`,
    );
  }

  /**
   * Ajout manuel : facture fournisseur, ticket, avoir… Le HT est déduit du TTC et
   * du taux choisi, et l'identité du document suit les mêmes règles que l'import
   * (numéro, sinon identifiant interne) — donc pas de doublon possible.
   */
  function addManual() {
    const ttc = parseMontant(form.ttc);
    if (ttc === null || ttc <= 0) {
      setMessage("Indique un montant TTC valide (par exemple 42,50).");
      return;
    }
    const taux = Number(form.taux) || 0;
    const ht = round2(ttc / (1 + taux / 100));
    const doc = manualDocument({
      kind: form.kind,
      numero: form.numero.trim(),
      dateDocument: inputToIso(form.date),
      tiersNom: form.tiers.trim(),
      ttc,
      ht,
      designation: form.designation.trim() || DOCUMENT_KIND_LABELS[form.kind],
    });
    const outcome = mergeDocuments(documents, [doc]);
    onDocuments(outcome.documents);
    setMessage(
      outcome.added > 0
        ? `${DOCUMENT_KIND_LABELS[doc.kind]} ajouté${doc.numero ? ` (n° ${doc.numero})` : ""} — ${ht.toFixed(2)} € HT · ${ttc.toFixed(2)} € TTC.`
        : (outcome.conflits[0] ?? "Ce document est déjà au registre : rien ajouté."),
    );
    setForm((current) => ({ ...current, numero: "", ttc: "", designation: "" }));
  }

  /** Ouvre le dossier de dépôt dans l'explorateur Windows. */
  async function openInbox() {
    const api = desktopApi();
    if (!api?.documentsOpenInbox) {
      setMessage("Ouverture du dossier réservée à l’application PC.");
      return;
    }
    const opened = await api.documentsOpenInbox(hintJson);
    if (!opened) {
      setMessage(
        "Dossier de dépôt introuvable — vérifie que le dossier de sauvegarde Drive est accessible.",
      );
    }
  }

  return (
    <section id="documents" aria-labelledby="documents-title" className="no-print">
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2
                id="documents-title"
                className="font-display text-xl font-medium tracking-tight"
              >
                Registre des documents
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {stats.total} pièce{stats.total > 1 ? "s" : ""} · {stats.facturesClients} client
                {stats.facturesClients > 1 ? "s" : ""} · {stats.fournisseurs} fournisseur
                {stats.fournisseurs > 1 ? "s" : ""} · {stats.tickets} ticket
                {stats.tickets > 1 ? "s" : ""}
                {stats.sansFichier > 0 ? ` · ${stats.sansFichier} sans justificatif` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void importFolder()} disabled={busy}>
                <FolderOpen />
                Importer un dossier d’exports
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void refreshInbox()}
                disabled={busy}
              >
                <RefreshCw />
                Rafraîchir la file
              </Button>
              <Button type="button" variant="outline" onClick={onBack}>
                <ArrowLeft />
                Retour
              </Button>
            </div>
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            Un fichier d’export = une facture. Chaque export est contrôlé (total de ligne, taux de
            TVA légal, total de pied) : un fichier incohérent est refusé avec son motif, les autres
            sont importés quand même.
          </p>

          {message ? (
            <p className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              {message}
            </p>
          ) : null}

          {report ? (
            <div className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-3 text-sm">
              <p className="text-xs text-muted-foreground">
                Dossier : <code>{report.dossier}</code>
              </p>
              {report.lus === 0 ? (
                <p className="mt-2 font-medium">
                  Aucun export reconnu. Extensions lues : {EXPORT_EXTENSIONS.join(", ")} — les
                  sous-dossiers ne sont pas parcourus.
                </p>
              ) : null}
              {report.ignores.length > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {report.ignores.length} fichier{report.ignores.length > 1 ? "s" : ""} ignoré
                  {report.ignores.length > 1 ? "s" : ""} (extension non reconnue) :{" "}
                  {report.ignores.slice(0, 8).join(", ")}
                  {report.ignores.length > 8 ? "…" : ""}
                </p>
              ) : null}
              <p className="mt-2 font-medium">
                Import : {report.lus} fichier{report.lus > 1 ? "s" : ""} lu
                {report.lus > 1 ? "s" : ""} → {report.ajoutes} ajouté
                {report.ajoutes > 1 ? "s" : ""}, {report.inchanges} inchangé
                {report.inchanges > 1 ? "s" : ""}
                {report.misAJour > 0 ? `, ${report.misAJour} complété${report.misAJour > 1 ? "s" : ""}` : ""}
              </p>
              {report.conflits.length > 0 ? (
                <ul className="mt-2 list-disc pl-5 text-xs text-destructive">
                  {report.conflits.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
              {report.erreurs.length > 0 ? (
                <div className="mt-2">
                  <p className="text-xs font-medium">
                    {report.erreurs.length} fichier{report.erreurs.length > 1 ? "s" : ""} refusé
                    {report.erreurs.length > 1 ? "s" : ""} :
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-xs text-destructive">
                    {report.erreurs.map((item) => (
                      <li key={item.fichier}>
                        <span className="font-medium">{item.fichier}</span> — {item.erreurs.join(" ")}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {(
              [
                ["tous", `Tous (${stats.total})`],
                ["clients", `Clients (${stats.facturesClients})`],
                ["fournisseurs", `Fournisseurs (${stats.fournisseurs})`],
                ["tickets", `Tickets (${stats.tickets})`],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={filter === key ? "default" : "outline"}
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="relative mt-3">
            <Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Rechercher un numéro, un client, un article…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Rechercher un document"
            />
          </div>

          {list.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {stats.total === 0
                ? "Aucun document indexé. Commence par « Importer un dossier d’exports »."
                : "Aucun document dans ce filtre."}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
              {list.map((doc) => {
                const ecarte = excluded.includes(doc.id);
                return (
                  <li key={doc.id} className="flex flex-col gap-2 bg-card px-3 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {DOCUMENT_KIND_LABELS[doc.kind]}{" "}
                          {doc.numero ? `n° ${doc.numero}` : "(sans numéro)"}
                          {ecarte ? (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              (écarté)
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {doc.dateDocument ? `${formatDay(doc.dateDocument)} · ` : ""}
                          {doc.tiers.nom || "Client inconnu"}
                          {doc.tiers.prenom ? ` ${doc.tiers.prenom}` : ""} ·{" "}
                          {doc.ttc.toFixed(2)} € TTC ({doc.ht.toFixed(2)} HT · {doc.tva.toFixed(2)}{" "}
                          TVA)
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {doc.lignes.length} ligne{doc.lignes.length > 1 ? "s" : ""}
                          {doc.lignes.length > 0
                            ? ` : ${doc.lignes.map((l) => l.designation).join(", ")}`
                            : ""}
                          {doc.fichier
                            ? ` · copie : ${doc.fichier.chemin}`
                            : " · aucun justificatif classé"}
                        </p>
                        {doc.avertissements.length > 0 ? (
                          <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                            {doc.avertissements.map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!doc.fichier}
                          onClick={() => void openCopy(doc)}
                        >
                          <FileText />
                          Ouvrir la copie
                        </Button>
                        {!ecarte ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => ecarter(doc)}
                          >
                            Écarter
                          </Button>
                        ) : null}
                      </div>
                    </div>
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
            Saisir une pièce
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Pour ce que l’application n’émet pas : facture fournisseur, ticket de caisse, avoir.
            Le justificatif (photo, scan) se rattache ensuite depuis « À classer ».
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="doc-kind">Type</Label>
              <select
                id="doc-kind"
                className="mt-1 flex h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
                value={form.kind}
                onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as DocumentKind }))}
              >
                {(Object.keys(DOCUMENT_KIND_LABELS) as DocumentKind[]).map((kind) => (
                  <option key={kind} value={kind}>
                    {DOCUMENT_KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="doc-numero">Numéro (facultatif)</Label>
              <Input
                id="doc-numero"
                className="mt-1"
                value={form.numero}
                placeholder="F-2026-0042"
                onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="doc-date">Date</Label>
              <Input
                id="doc-date"
                type="date"
                className="mt-1"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="doc-tiers">Fournisseur / client</Label>
              <Input
                id="doc-tiers"
                className="mt-1"
                value={form.tiers}
                placeholder="Panneaux SARL"
                onChange={(e) => setForm((f) => ({ ...f, tiers: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="doc-ttc">Montant TTC</Label>
              <Input
                id="doc-ttc"
                className="mt-1"
                value={form.ttc}
                placeholder="120,00"
                onChange={(e) => setForm((f) => ({ ...f, ttc: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="doc-taux">TVA</Label>
              <select
                id="doc-taux"
                className="mt-1 flex h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
                value={form.taux}
                onChange={(e) => setForm((f) => ({ ...f, taux: e.target.value }))}
              >
                {["0", "2.1", "5.5", "10", "20"].map((rate) => (
                  <option key={rate} value={rate}>
                    {rate.replace(".", ",")} %
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="doc-designation">Désignation</Label>
              <Input
                id="doc-designation"
                className="mt-1"
                value={form.designation}
                placeholder="Quincaillerie"
                onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
              />
            </div>
            <div className="flex items-end">
              <Button type="button" onClick={addManual}>
                Ajouter au registre
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-medium tracking-tight">
                À classer
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {inbox.length} fichier{inbox.length > 1 ? "s" : ""} dans le dossier de dépôt —
                dépose tes justificatifs là, puis rattache-les à une pièce.
              </p>
              {inboxDir ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  <code>{inboxDir}</code>
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void openInbox()}
                disabled={!inboxDir}
              >
                <FolderOpen />
                Ouvrir le dossier
              </Button>
            </div>
          </div>

          {inbox.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              <Inbox className="mr-1 inline size-4" />
              File vide. Les justificatifs déposés dans le dossier de dépôt apparaîtront ici.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
              {inbox.map((file) => (
                <li key={file.path} className="flex flex-col gap-2 bg-card px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.taille / 1024).toFixed(0)} Ko · déposé le{" "}
                        {formatDay(file.mtime)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAssocFor(file.path);
                        setAssocDocId("");
                      }}
                    >
                      Rattacher à…
                    </Button>
                  </div>
                  {assocFor === file.path ? (
                    <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-muted/40 p-3">
                      <div className="min-w-64 flex-1">
                        <Label htmlFor={`assoc-${file.name}`}>Document à rattacher</Label>
                        <select
                          id={`assoc-${file.name}`}
                          className="mt-1 flex h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
                          value={assocDocId}
                          onChange={(e) => setAssocDocId(e.target.value)}
                        >
                          <option value="">— choisir une pièce —</option>
                          {documents.map((doc) => (
                            <option key={doc.id} value={doc.id}>
                              {DOCUMENT_KIND_LABELS[doc.kind]} {doc.numero || "(sans numéro)"}
                              {doc.tiers.nom ? ` — ${doc.tiers.nom}` : ""} — {doc.ttc.toFixed(2)} €
                            </option>
                          ))}
                        </select>
                      </div>
                      <Button
                        type="button"
                        disabled={busy || !assocDocId}
                        onClick={() => void associate(file)}
                      >
                        Rattacher
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setAssocFor(null)}>
                        Annuler
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
