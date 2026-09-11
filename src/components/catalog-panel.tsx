import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  activeFamilies,
  createFamily,
  createRef,
  deleteFamily,
  deleteRef,
  refsOfFamily,
  renameFamily,
  setFamilyActive,
  setRefActive,
  updateRef,
  type Catalog,
  type PanelFamily,
} from "@/lib/catalog";

type Props = {
  catalog: Catalog;
  onChange: (catalog: Catalog, error?: string) => void;
  usedRefIds: string[];
};

export function CatalogPanel({ catalog, onChange, usedRefIds }: Props) {
  const [q, setQ] = useState("");
  const [familyFilter, setFamilyFilter] = useState<"all" | string>("all");
  const [newFamily, setNewFamily] = useState("");
  const [draft, setDraft] = useState({
    familyId: catalog.families[0]?.id ?? "",
    length: "3000",
    width: "600",
    name: "",
  });

  const families = catalog.families;
  const visibleRefs = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return catalog.refs.filter((r) => {
      if (familyFilter !== "all" && r.familyId !== familyFilter) return false;
      if (!needle) return true;
      const fam = families.find((f) => f.id === r.familyId)?.name ?? "";
      return `${r.length}x${r.width} ${r.name} ${fam}`.toLowerCase().includes(needle);
    });
  }, [catalog.refs, families, familyFilter, q]);

  return (
    <section id="catalogue" aria-labelledby="catalogue-title" className="no-print">
      <Card>
        <CardContent className="p-5">
          <h2 id="catalogue-title" className="font-display text-xl font-medium tracking-tight">
            Familles et références de panneaux
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Les formats 2500 × 400 et 2500 × 600 restent disponibles. Ajoutez les vôtres
            (3000 × 600, 2500 × 800…). Les références inactives ne servent plus aux
            nouveaux débits.
          </p>

          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="font-display text-base font-medium">Familles</h3>
              <div className="mt-3 flex gap-2">
                <Input
                  placeholder="Tilly, Egger, Médium…"
                  value={newFamily}
                  onChange={(e) => setNewFamily(e.target.value)}
                  aria-label="Nom de la nouvelle famille"
                />
                <Button
                  type="button"
                  onClick={() => {
                    const out = createFamily(catalog, newFamily);
                    onChange(out.catalog, out.error);
                    if (!out.error && out.family) {
                      setNewFamily("");
                      setDraft((d) => ({ ...d, familyId: out.family!.id }));
                    }
                  }}
                >
                  <Plus />
                  Créer
                </Button>
              </div>
              <ul className="mt-3 space-y-2">
                {families.map((f) => (
                  <FamilyRow
                    key={f.id}
                    family={f}
                    count={refsOfFamily(catalog, f.id).length}
                    onRename={(name) => {
                      const out = renameFamily(catalog, f.id, name);
                      onChange(out.catalog, out.error);
                    }}
                    onToggle={() => onChange(setFamilyActive(catalog, f.id, !f.active))}
                    onDelete={() => {
                      const out = deleteFamily(catalog, f.id);
                      onChange(out.catalog, out.error);
                    }}
                  />
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-display text-base font-medium">Nouvelle référence</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <Label htmlFor="ref-fam">Famille</Label>
                  <select
                    id="ref-fam"
                    className="mt-1 flex h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
                    value={draft.familyId}
                    onChange={(e) => setDraft((d) => ({ ...d, familyId: e.target.value }))}
                  >
                    {activeFamilies(catalog).map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="ref-l">Longueur (mm)</Label>
                  <Input
                    id="ref-l"
                    className="mt-1 tabular-nums"
                    value={draft.length}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, length: e.target.value.replace(/[^\d]/g, "") }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="ref-w">Largeur (mm)</Label>
                  <Input
                    id="ref-w"
                    className="mt-1 tabular-nums"
                    value={draft.width}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, width: e.target.value.replace(/[^\d]/g, "") }))
                    }
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="ref-n">Nom / référence (facultatif)</Label>
                  <Input
                    id="ref-n"
                    className="mt-1"
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder="P-3000-600"
                  />
                </div>
                <Button
                  type="button"
                  className="col-span-2"
                  onClick={() => {
                    const out = createRef(catalog, {
                      familyId: draft.familyId || catalog.families[0]?.id || "",
                      name: draft.name,
                      length: Number(draft.length),
                      width: Number(draft.width),
                    });
                    onChange(out.catalog, out.error);
                  }}
                >
                  <Plus />
                  Ajouter la référence
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Input
              className="max-w-xs"
              placeholder="Rechercher une référence…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="flex h-11 rounded-md border border-input bg-card px-3 text-sm"
              value={familyFilter}
              onChange={(e) => setFamilyFilter(e.target.value)}
              aria-label="Filtrer par famille"
            >
              <option value="all">Toutes les familles</option>
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-left text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Dimensions</th>
                  <th className="px-3 py-2.5 font-medium">Nom</th>
                  <th className="px-3 py-2.5 font-medium">Famille</th>
                  <th className="px-3 py-2.5 font-medium">Statut</th>
                  <th className="px-3 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRefs.map((r) => {
                  const fam = families.find((f) => f.id === r.familyId);
                  return (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1">
                          <Input
                            className="w-20 tabular-nums"
                            aria-label="Longueur"
                            defaultValue={String(r.length)}
                            key={`${r.id}-l-${r.length}`}
                            onBlur={(e) => {
                              const length = Number(e.target.value.replace(/[^\d]/g, ""));
                              const out = updateRef(catalog, r.id, { length });
                              onChange(out.catalog, out.error);
                            }}
                          />
                          <span className="text-muted-foreground">×</span>
                          <Input
                            className="w-20 tabular-nums"
                            aria-label="Largeur"
                            defaultValue={String(r.width)}
                            key={`${r.id}-w-${r.width}`}
                            onBlur={(e) => {
                              const width = Number(e.target.value.replace(/[^\d]/g, ""));
                              const out = updateRef(catalog, r.id, { width });
                              onChange(out.catalog, out.error);
                            }}
                          />
                          <span className="text-xs text-muted-foreground">mm</span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          value={r.name}
                          aria-label="Nom de la référence"
                          onChange={(e) => {
                            const out = updateRef(catalog, r.id, { name: e.target.value });
                            onChange(out.catalog, out.error);
                          }}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          className="flex h-11 w-full rounded-md border border-input bg-card px-2 text-sm"
                          value={r.familyId}
                          aria-label="Famille"
                          onChange={(e) => {
                            const out = updateRef(catalog, r.id, { familyId: e.target.value });
                            onChange(out.catalog, out.error);
                          }}
                        >
                          {families.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        {r.active && fam?.active ? (
                          <Badge variant="good">Active</Badge>
                        ) : (
                          <Badge variant="warn">Inactive</Badge>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex flex-wrap gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => onChange(setRefActive(catalog, r.id, !r.active))}
                          >
                            {r.active ? "Désactiver" : "Réactiver"}
                          </Button>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Supprimer la référence"
                            onClick={() => {
                              const out = deleteRef(catalog, r.id, usedRefIds);
                              onChange(out.catalog, out.error);
                            }}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function FamilyRow({
  family,
  count,
  onRename,
  onToggle,
  onDelete,
}: {
  family: PanelFamily;
  count: number;
  onRename: (name: string) => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
      <Input
        value={family.name}
        onChange={(e) => onRename(e.target.value)}
        aria-label="Nom de la famille"
        className="max-w-48"
      />
      <span className="text-xs text-muted-foreground">
        {count} réf.
      </span>
      {family.active ? <Badge variant="good">Active</Badge> : <Badge variant="warn">Inactive</Badge>}
      <Button type="button" size="sm" variant="outline" onClick={onToggle}>
        {family.active ? "Désactiver" : "Réactiver"}
      </Button>
      <Button type="button" size="icon-sm" variant="ghost" aria-label="Supprimer la famille" onClick={onDelete}>
        <Trash2 />
      </Button>
    </li>
  );
}
