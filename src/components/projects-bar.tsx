import { Copy, FolderOpen, Save, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Project, ProjectSummary } from "@/lib/projects";
import type { ProjectMeta } from "@/lib/persist";

type SortKey = "name" | "createdAt" | "updatedAt";

type Props = {
  meta: ProjectMeta;
  onMeta: (patch: Partial<ProjectMeta>) => void;
  currentId: string | null;
  dirty: boolean;
  projects: Project[];
  onNew: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onOpen: (id: string) => void;
  onClose: () => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: () => void;
  onImport: () => void;
};

function formatDate(iso: string): string {
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

export function ProjectsBar({
  meta,
  onMeta,
  currentId,
  dirty,
  projects,
  onNew,
  onSave,
  onSaveAs,
  onOpen,
  onClose,
  onDuplicate,
  onRename,
  onDelete,
  onExport,
  onImport,
}: Props) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("updatedAt");
  const [openList, setOpenList] = useState(false);

  const list: ProjectSummary[] = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = projects.filter((p) => {
      if (!needle) return true;
      return `${p.name} ${p.clientName} ${p.description}`.toLowerCase().includes(needle);
    });
    rows.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "fr");
      const av = sort === "createdAt" ? a.createdAt : a.updatedAt;
      const bv = sort === "createdAt" ? b.createdAt : b.updatedAt;
      return bv.localeCompare(av);
    });
    return rows;
  }, [projects, q, sort]);

  const current = projects.find((p) => p.id === currentId);

  return (
    <section id="projets" aria-labelledby="projets-title" className="no-print">
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="projets-title" className="font-display text-xl font-medium tracking-tight">
                Projets
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {current
                  ? `${current.name}${dirty ? " — modifications non enregistrées" : ""}`
                  : `${meta.name.trim() || "Sans titre"}${
                      dirty ? " — modifications non enregistrées" : " — pas encore enregistré"
                    }`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={onNew}>
                Nouveau projet
              </Button>
              <Button type="button" onClick={onSave}>
                <Save />
                Enregistrer le projet
              </Button>
              <Button type="button" variant="outline" onClick={onSaveAs}>
                Enregistrer sous
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpenList((v) => !v)}>
                <FolderOpen />
                Ouvrir un projet
              </Button>
              <Button type="button" variant="ghost" onClick={onClose} disabled={!currentId && !dirty}>
                Fermer le projet
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="proj-name">Nom du projet</Label>
              <Input
                id="proj-name"
                className="mt-1"
                value={meta.name}
                onChange={(e) => onMeta({ name: e.target.value })}
                placeholder="Étagère salon"
              />
            </div>
            <div>
              <Label htmlFor="proj-client">Client (facultatif)</Label>
              <Input
                id="proj-client"
                className="mt-1"
                value={meta.clientName}
                onChange={(e) => onMeta({ clientName: e.target.value })}
                placeholder="Nom du client"
              />
            </div>
            <div>
              <Label htmlFor="proj-desc">Description (facultatif)</Label>
              <Input
                id="proj-desc"
                className="mt-1"
                value={meta.description}
                onChange={(e) => onMeta({ description: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="proj-notes">Notes (facultatif)</Label>
              <Input
                id="proj-notes"
                className="mt-1"
                value={meta.notes}
                onChange={(e) => onMeta({ notes: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onExport} disabled={!current && !dirty}>
              Exporter
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onImport}>
              Importer
            </Button>
          </div>

          {openList && (
            <div className="mt-5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-48 flex-1">
                  <Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Rechercher un projet…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    aria-label="Rechercher un projet"
                  />
                </div>
                <select
                  className="flex h-11 rounded-md border border-input bg-card px-3 text-sm"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  aria-label="Trier les projets"
                >
                  <option value="updatedAt">Dernière modification</option>
                  <option value="createdAt">Date de création</option>
                  <option value="name">Nom</option>
                </select>
              </div>
              {list.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Aucun projet enregistré.</p>
              ) : (
                <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
                  {list.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 bg-card px-3 py-2.5"
                    >
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
                          Modifié {formatDate(p.updatedAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Button type="button" size="sm" onClick={() => onOpen(p.id)}>
                          Ouvrir
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onDuplicate(p.id)}
                        >
                          <Copy />
                          Dupliquer
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onRename(p.id)}
                        >
                          Renommer
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => onDelete(p.id)}
                        >
                          Supprimer
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
