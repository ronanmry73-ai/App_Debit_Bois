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
  parsePriceInput,
  refsOfFamily,
  renameFamily,
  setFamilyActive,
  setRefActive,
  updateRef,
  type Catalog,
  type PanelFamily,
  type PanelRef,
} from "@/lib/catalog";
import { formatEuro } from "@/lib/utils";

type Props = {
  catalog: Catalog;
  onChange: (catalog: Catalog, error?: string) => void;
  usedRefIds: string[];
};

type SortKey = "dims" | "name" | "family" | "price-asc" | "price-desc";
type StatusFilter = "all" | "active" | "inactive";
type PriceFilter = "all" | "priced" | "empty";

export function CatalogPanel({ catalog, onChange, usedRefIds }: Props) {
  const [q, setQ] = useState("");
  const [familyFilter, setFamilyFilter] = useState<"all" | string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [sort, setSort] = useState<SortKey>("family");
  const [newFamily, setNewFamily] = useState("");
  const [draft, setDraft] = useState({
    familyId: catalog.families[0]?.id ?? "",
    length: "3000",
    width: "600",
    name: "",
    price: "",
  });

  const families = catalog.families;
  const visibleRefs = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = catalog.refs.filter((r) => {
      if (familyFilter !== "all" && r.familyId !== familyFilter) return false;
      const fam = families.find((f) => f.id === r.familyId);
      const usable = r.active && !!fam?.active;
      if (statusFilter === "active" && !usable) return false;
      if (statusFilter === "inactive" && usable) return false;
      if (priceFilter === "priced" && r.pricePerM2 == null) return false;
      if (priceFilter === "empty" && r.pricePerM2 != null) return false;
      if (!needle) return true;
      const price = r.pricePerM2 != null ? String(r.pricePerM2) : "";
      return `${r.length}x${r.width} ${r.name} ${fam?.name ?? ""} ${price}`
        .toLowerCase()
        .includes(needle);
    });
    rows = rows.slice();
    rows.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "fr");
      if (sort === "family") {
        const fa = families.find((f) => f.id === a.familyId)?.name ?? "";
        const fb = families.find((f) => f.id === b.familyId)?.name ?? "";
        const d = fa.localeCompare(fb, "fr");
        if (d !== 0) return d;
        return a.length * a.width - b.length * b.width;
      }
      if (sort === "price-asc" || sort === "price-desc") {
        const pa = a.pricePerM2;
        const pb = b.pricePerM2;
        if (pa == null && pb == null) return 0;
        if (pa == null) return 1;
        if (pb == null) return -1;
        return sort === "price-asc" ? pa - pb : pb - pa;
      }
      return a.length * a.width - b.length * b.width;
    });
    return rows;
  }, [catalog.refs, families, familyFilter, q, sort, statusFilter, priceFilter]);

  return (
    <section id="catalogue" aria-labelledby="catalogue-title" className="no-print">
      <Card>
        <CardContent className="p-5">
          <h2 id="catalogue-title" className="font-display text-xl font-medium tracking-tight">
            Familles et références de panneaux
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Base globale, réutilisée par tous les projets. Les formats 2500 × 400 et
            2500 × 600 restent disponibles. Le prix fournisseur au m² est facultatif ;
            une référence désactivée conserve son tarif.
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
                <div className="col-span-2">
                  <Label htmlFor="ref-price">Prix fournisseur €/m² (facultatif)</Label>
                  <Input
                    id="ref-price"
                    className="mt-1 tabular-nums"
                    inputMode="decimal"
                    placeholder="18,50"
                    value={draft.price}
                    aria-label="Prix fournisseur au mètre carré"
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        price: e.target.value.replace(/[^\d.,]/g, ""),
                      }))
                    }
                  />
                </div>
                <Button
                  type="button"
                  className="col-span-2"
                  onClick={() => {
                    const price = parsePriceInput(draft.price);
                    if (!price.ok) {
                      onChange(catalog, price.error);
                      return;
                    }
                    const out = createRef(catalog, {
                      familyId: draft.familyId || catalog.families[0]?.id || "",
                      name: draft.name,
                      length: Number(draft.length),
                      width: Number(draft.width),
                      pricePerM2: price.value,
                    });
                    onChange(out.catalog, out.error);
                    if (!out.error) setDraft((d) => ({ ...d, name: "", price: "" }));
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
            <select
              className="flex h-11 rounded-md border border-input bg-card px-3 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              aria-label="Filtrer par statut"
            >
              <option value="all">Actives et inactives</option>
              <option value="active">Actives</option>
              <option value="inactive">Inactives</option>
            </select>
            <select
              className="flex h-11 rounded-md border border-input bg-card px-3 text-sm"
              value={priceFilter}
              onChange={(e) => setPriceFilter(e.target.value as PriceFilter)}
              aria-label="Filtrer par prix"
            >
              <option value="all">Tous les prix</option>
              <option value="priced">Avec prix</option>
              <option value="empty">Sans prix</option>
            </select>
            <select
              className="flex h-11 rounded-md border border-input bg-card px-3 text-sm"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Trier les références"
            >
              <option value="family">Trier par famille</option>
              <option value="dims">Trier par surface</option>
              <option value="name">Trier par nom</option>
              <option value="price-asc">Prix croissant</option>
              <option value="price-desc">Prix décroissant</option>
            </select>
          </div>

          <div className="mt-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-left text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Dimensions</th>
                  <th className="px-3 py-2.5 font-medium">Nom</th>
                  <th className="px-3 py-2.5 font-medium">Famille</th>
                  <th className="px-3 py-2.5 font-medium">Prix €/m²</th>
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
                      <td className="px-2 py-1.5">
                        <PriceCell
                          refItem={r}
                          onCommit={(raw) => {
                            const parsed = parsePriceInput(raw);
                            if (!parsed.ok) {
                              onChange(catalog, parsed.error);
                              return;
                            }
                            const out = updateRef(catalog, r.id, { pricePerM2: parsed.value });
                            onChange(out.catalog, out.error);
                          }}
                        />
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

function PriceCell({
  refItem,
  onCommit,
}: {
  refItem: PanelRef;
  onCommit: (raw: string) => void;
}) {
  const display =
    refItem.pricePerM2 != null
      ? String(refItem.pricePerM2).replace(".", ",")
      : "";
  return (
    <div>
      <Input
        className="w-24 tabular-nums"
        inputMode="decimal"
        aria-label="Prix fournisseur au mètre carré"
        defaultValue={display}
        key={`${refItem.id}-p-${refItem.pricePerM2 ?? "x"}`}
        placeholder="—"
        onBlur={(e) => onCommit(e.target.value)}
      />
      {refItem.pricePerM2 != null && (
        <p className="mt-1 text-xs text-muted-foreground">
          {formatEuro(refItem.pricePerM2)}/m²
        </p>
      )}
    </div>
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
