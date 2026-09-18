import { ArrowLeft, CheckCircle2, RotateCcw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ChantierStatusBadge } from "@/components/chantier-status-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { JobStatusBadge } from "@/components/job-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  countProjectsByStatus,
  formatDay,
  isProjectFinished,
  type JobStatusInput,
  type Project,
} from "@/lib/projects";

type Filter = "tous" | "en_cours" | "termine";
type SortKey = "finishedAt" | "updatedAt" | "name" | "clientName";

type Props = {
  projects: Project[];
  currentId: string | null;
  /** Téléphone : consultation seule, aucune clôture ni réouverture possible. */
  readOnly?: boolean;
  /** Projet dont le formulaire de clôture doit être ouvert d'emblée. */
  initialFinishId?: string | null;
  onBack: () => void;
  onOpen: (id: string) => void;
  onFinish: (id: string, opts: { at: string; note: string }) => void;
  onReopen: (id: string) => void;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Date du jour au format `aaaa-mm-jj` d'un champ `<input type="date">`. */
function todayInput(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/** ISO → `aaaa-mm-jj` (pour pré-remplir le champ de date). */
function isoToInput(iso?: string): string {
  if (!iso) return todayInput();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return todayInput();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** `aaaa-mm-jj` → ISO, calé à midi local pour ne pas basculer de jour. */
function inputToIso(value: string): string {
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Statut métier du dossier, recalculé depuis un projet enregistré. */
function jobInfoFor(p: Project): JobStatusInput {
  return {
    hasValidPack: Boolean(p.calculatedAt),
    calculatedAt: p.calculatedAt ?? null,
    stockDeductedAt: p.stockDeductedAt ?? null,
    quoteIssuedAt: p.quoteIssuedAt ?? null,
    stockDeduction: p.stockDeduction ?? null,
  };
}

/**
 * Écran **Historique des chantiers** : ce qui est en cours, ce qui est terminé,
 * et de quoi clôturer (ou rouvrir) un chantier — sur le PC uniquement.
 */
export function ProjectsHistory({
  projects,
  currentId,
  readOnly = false,
  initialFinishId = null,
  onBack,
  onOpen,
  onFinish,
  onReopen,
}: Props) {
  const [filter, setFilter] = useState<Filter>("tous");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("finishedAt");
  const [finishId, setFinishId] = useState<string | null>(initialFinishId);
  const [finishDate, setFinishDate] = useState(todayInput());
  const [finishNote, setFinishNote] = useState("");
  const [reopenId, setReopenId] = useState<string | null>(null);

  // Ouverture directe du formulaire quand on arrive avec une cible (bouton
  // « Terminer le chantier » de la section Projets).
  useEffect(() => {
    if (!initialFinishId) return;
    setFinishId(initialFinishId);
    setFinishDate(todayInput());
    setFinishNote("");
  }, [initialFinishId]);

  const counts = useMemo(() => countProjectsByStatus(projects), [projects]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = projects.filter((p) => {
      const done = isProjectFinished(p);
      if (filter === "en_cours" && done) return false;
      if (filter === "termine" && !done) return false;
      if (!needle) return true;
      return `${p.name} ${p.clientName} ${p.description}`
        .toLowerCase()
        .includes(needle);
    });
    rows.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "fr");
      if (sort === "clientName") {
        return (a.clientName || "").localeCompare(b.clientName || "", "fr");
      }
      if (sort === "finishedAt") {
        const av = a.finishedAt ?? "";
        const bv = b.finishedAt ?? "";
        // Les chantiers terminés les plus récents d'abord, puis l'activité.
        if (av !== bv) return bv.localeCompare(av);
        return b.updatedAt.localeCompare(a.updatedAt);
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    return rows;
  }, [projects, filter, q, sort]);

  const reopenTarget = projects.find((p) => p.id === reopenId) ?? null;

  function startFinish(id: string) {
    setFinishId(id);
    setFinishDate(todayInput());
    setFinishNote("");
  }

  function submitFinish(id: string) {
    onFinish(id, { at: inputToIso(finishDate), note: finishNote });
    setFinishId(null);
    setFinishNote("");
  }

  return (
    <section id="historique" aria-labelledby="historique-title" className="no-print">
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2
                id="historique-title"
                className="font-display text-xl font-medium tracking-tight"
              >
                Historique des chantiers
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {counts.enCours} chantier{counts.enCours > 1 ? "s" : ""} en cours ·{" "}
                {counts.termines} terminé{counts.termines > 1 ? "s" : ""} · {counts.total} au
                total
              </p>
            </div>
            <Button type="button" variant="outline" onClick={onBack}>
              <ArrowLeft />
              Retour
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(
              [
                ["tous", `Tous (${counts.total})`],
                ["en_cours", `En cours (${counts.enCours})`],
                ["termine", `Terminés (${counts.termines})`],
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

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Rechercher un chantier…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Rechercher un chantier"
              />
            </div>
            <select
              className="flex h-11 rounded-md border border-input bg-card px-3 text-sm"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Trier les chantiers"
            >
              <option value="finishedAt">Date de fin</option>
              <option value="updatedAt">Dernière modification</option>
              <option value="name">Nom</option>
              <option value="clientName">Client</option>
            </select>
          </div>

          {list.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {counts.total === 0
                ? "Aucun chantier enregistré pour l’instant."
                : "Aucun chantier dans cet état."}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
              {list.map((p) => {
                const done = isProjectFinished(p);
                return (
                  <li key={p.id} className="flex flex-col gap-2 bg-card px-3 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {p.name}
                          {p.id === currentId ? (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              (ouvert)
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.clientName ? `${p.clientName} · ` : ""}
                          {done && p.finishedAt
                            ? `Terminé le ${formatDay(p.finishedAt)} · `
                            : ""}
                          Modifié {formatDateTime(p.updatedAt)}
                        </p>
                        {done && p.finishedNote ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            « {p.finishedNote} »
                          </p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <ChantierStatusBadge project={p} />
                          <JobStatusBadge info={jobInfoFor(p)} />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Button type="button" size="sm" onClick={() => onOpen(p.id)}>
                          Ouvrir
                        </Button>
                        {!readOnly && !done && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => startFinish(p.id)}
                          >
                            <CheckCircle2 />
                            Terminer
                          </Button>
                        )}
                        {!readOnly && done && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setReopenId(p.id)}
                          >
                            <RotateCcw />
                            Rouvrir
                          </Button>
                        )}
                      </div>
                    </div>

                    {!readOnly && finishId === p.id ? (
                      <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-muted/40 p-3">
                        <div>
                          <Label htmlFor={`fin-date-${p.id}`}>Date de fin</Label>
                          <Input
                            id={`fin-date-${p.id}`}
                            type="date"
                            className="mt-1"
                            value={finishDate}
                            onChange={(e) => setFinishDate(e.target.value)}
                          />
                        </div>
                        <div className="min-w-48 flex-1">
                          <Label htmlFor={`fin-note-${p.id}`}>Remarque (facultatif)</Label>
                          <Input
                            id={`fin-note-${p.id}`}
                            className="mt-1"
                            value={finishNote}
                            placeholder="Pose terminée, reprise des plinthes à faire"
                            onChange={(e) => setFinishNote(e.target.value)}
                          />
                        </div>
                        <Button type="button" onClick={() => submitFinish(p.id)}>
                          Marquer terminé
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setFinishId(null)}
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

      <ConfirmDialog
        open={reopenTarget !== null}
        title="Rouvrir ce chantier ?"
        message={
          reopenTarget
            ? `« ${reopenTarget.name} » repassera « en cours » et sa date de clôture sera effacée.`
            : ""
        }
        actions={[
          { label: "Annuler", variant: "outline", onClick: () => setReopenId(null) },
          {
            label: "Rouvrir",
            onClick: () => {
              if (reopenTarget) onReopen(reopenTarget.id);
              setReopenId(null);
            },
          },
        ]}
      />
    </section>
  );
}
