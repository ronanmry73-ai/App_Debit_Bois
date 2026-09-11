import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emptyRow } from "@/lib/presets";
import type { PieceRow } from "@/lib/types";
import type { PanelSpec } from "@/lib/packing";
import { pieceFitsAnyPanel } from "@/lib/packing";
import { compatibleRefs, type Catalog, type PanelFamily } from "@/lib/catalog";
import { cn } from "@/lib/utils";

type Props = {
  rows: PieceRow[];
  onChange: (rows: PieceRow[]) => void;
  kerf: number;
  allowRotation: boolean;
  families: PanelFamily[];
  catalog: Catalog;
  specs: PanelSpec[];
  onClear?: () => void;
};

function parseNum(s: string): number {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function PieceList({
  rows,
  onChange,
  kerf,
  allowRotation,
  families,
  catalog,
  specs,
  onClear,
}: Props) {
  function update(id: string, patch: Partial<PieceRow>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function remove(id: string) {
    if (rows.length <= 1) {
      onChange([emptyRow()]);
      return;
    }
    onChange(rows.filter((r) => r.id !== id));
  }

  const totalQty = rows.reduce((s, r) => s + Math.max(0, Math.floor(parseNum(r.qty))), 0);
  const totalArea = rows.reduce((s, r) => {
    const l = parseNum(r.length);
    const w = parseNum(r.width);
    const q = Math.max(0, Math.floor(parseNum(r.qty)));
    return s + l * w * q;
  }, 0);

  return (
    <section aria-labelledby="debit-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="debit-title" className="font-display text-xl font-medium tracking-tight">
            Débit des pièces
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Dimensions en millimètres. Famille prioritaire facultative. {totalQty} pièce
            {totalQty > 1 ? "s" : ""} ·{" "}
            {(totalArea / 1_000_000).toLocaleString("fr-FR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            m² à débiter
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onClear && (
            <Button type="button" variant="ghost" onClick={onClear}>
              Vider la liste
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => onChange([...rows, emptyRow()])}
          >
            <Plus />
            Ajouter une pièce
          </Button>
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/60 text-left text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">Nom</th>
              <th className="w-28 px-3 py-2.5 font-medium">Longueur</th>
              <th className="w-28 px-3 py-2.5 font-medium">Largeur</th>
              <th className="w-20 px-3 py-2.5 font-medium">Qté</th>
              <th className="w-40 px-3 py-2.5 font-medium">Famille prioritaire</th>
              <th className="w-12 px-3 py-2.5">
                <span className="sr-only">Supprimer</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <PieceTableRow
                key={row.id}
                row={row}
                kerf={kerf}
                allowRotation={allowRotation}
                families={families}
                catalog={catalog}
                specs={specs}
                onChange={(patch) => update(row.id, patch)}
                onRemove={() => remove(row.id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row, i) => (
          <li
            key={row.id}
            className="rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-border)]"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Pièce {i + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Supprimer la pièce"
                onClick={() => remove(row.id)}
              >
                <Trash2 />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <Label htmlFor={`name-${row.id}`}>Nom</Label>
                <Input
                  id={`name-${row.id}`}
                  className="mt-1"
                  placeholder="montant, traverse…"
                  value={row.name}
                  onChange={(e) => update(row.id, { name: e.target.value })}
                />
              </div>
              <NumField
                id={`l-${row.id}`}
                label="Longueur (mm)"
                value={row.length}
                onChange={(v) => update(row.id, { length: v })}
              />
              <NumField
                id={`w-${row.id}`}
                label="Largeur (mm)"
                value={row.width}
                onChange={(v) => update(row.id, { width: v })}
              />
              <NumField
                id={`q-${row.id}`}
                label="Quantité"
                value={row.qty}
                onChange={(v) => update(row.id, { qty: v })}
                integer
              />
              <div>
                <Label htmlFor={`fam-${row.id}`}>Famille prioritaire</Label>
                <FamilySelect
                  id={`fam-${row.id}`}
                  value={row.familyId ?? ""}
                  families={families}
                  onChange={(familyId) => update(row.id, { familyId })}
                />
              </div>
            </div>
            <FitHint
              row={row}
              kerf={kerf}
              allowRotation={allowRotation}
              catalog={catalog}
              specs={specs}
              families={families}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function FamilySelect({
  id,
  value,
  families,
  onChange,
}: {
  id?: string;
  value: string;
  families: PanelFamily[];
  onChange: (id: string) => void;
}) {
  return (
    <select
      id={id}
      aria-label="Famille prioritaire"
      className="mt-1 flex h-11 w-full rounded-md border border-input bg-card px-2 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Aucune</option>
      {families.filter((f) => f.active || f.id === value).map((f) => (
        <option key={f.id} value={f.id}>
          {f.name}
          {!f.active ? " (inactive)" : ""}
        </option>
      ))}
    </select>
  );
}

function NumField({
  id,
  label,
  value,
  onChange,
  integer,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  integer?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className="mt-1 tabular-nums"
        inputMode="numeric"
        value={value}
        onChange={(e) =>
          onChange(e.target.value.replace(integer ? /[^\d]/g : /[^\d.,]/g, ""))
        }
      />
    </div>
  );
}

function PieceTableRow({
  row,
  kerf,
  allowRotation,
  families,
  catalog,
  specs,
  onChange,
  onRemove,
}: {
  row: PieceRow;
  kerf: number;
  allowRotation: boolean;
  families: PanelFamily[];
  catalog: Catalog;
  specs: PanelSpec[];
  onChange: (patch: Partial<PieceRow>) => void;
  onRemove: () => void;
}) {
  const l = parseNum(row.length);
  const w = parseNum(row.width);
  const familyHint = familyFitMessage(row, l, w, kerf, allowRotation, catalog, families, specs);
  const invalid = Boolean(familyHint);

  return (
    <>
    <tr className="border-b border-border last:border-0">
      <td className="px-2 py-1.5">
        <Input
          aria-label="Nom de la pièce"
          placeholder="montant, traverse…"
          value={row.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="h-10"
        />
      </td>
      <td className="px-2 py-1.5">
        <Input
          aria-label="Longueur en mm"
          inputMode="numeric"
          value={row.length}
          onChange={(e) => onChange({ length: e.target.value.replace(/[^\d.,]/g, "") })}
          className={cn("h-10 tabular-nums", invalid && "border-destructive")}
        />
      </td>
      <td className="px-2 py-1.5">
        <Input
          aria-label="Largeur en mm"
          inputMode="numeric"
          value={row.width}
          onChange={(e) => onChange({ width: e.target.value.replace(/[^\d.,]/g, "") })}
          className={cn("h-10 tabular-nums", invalid && "border-destructive")}
        />
      </td>
      <td className="px-2 py-1.5">
        <Input
          aria-label="Quantité"
          inputMode="numeric"
          value={row.qty}
          onChange={(e) => onChange({ qty: e.target.value.replace(/[^\d]/g, "") })}
          className="h-10 tabular-nums"
        />
      </td>
      <td className="px-2 py-1.5">
        <FamilySelect
          value={row.familyId ?? ""}
          families={families}
          onChange={(familyId) => onChange({ familyId })}
        />
      </td>
      <td className="px-1 py-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Supprimer la pièce"
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      </td>
    </tr>
    {familyHint && (
      <tr className="border-b border-border last:border-0">
        <td colSpan={6} className="px-3 pb-2 text-xs text-destructive">
          {familyHint}
        </td>
      </tr>
    )}
    </>
  );
}

function familyFitMessage(
  row: PieceRow,
  l: number,
  w: number,
  kerf: number,
  allowRotation: boolean,
  catalog: Catalog,
  families: PanelFamily[],
  specs: PanelSpec[],
): string | null {
  if (l <= 0 || w <= 0) return null;
  if (row.familyId) {
    const fam = families.find((f) => f.id === row.familyId);
    const ok = compatibleRefs(catalog, l, w, allowRotation, kerf, row.familyId);
    if (ok.length === 0) {
      const piece = row.name.trim() || "sans nom";
      return `Aucun panneau actif compatible n’a été trouvé dans la famille ${fam?.name ?? "sélectionnée"} pour la pièce ${piece}. Veuillez ajouter une référence compatible ou choisir une autre famille.`;
    }
    return null;
  }
  if (pieceFitsAnyPanel(l, w, allowRotation, kerf, specs)) return null;
  return "Cette pièce ne rentre dans aucun panneau actif.";
}

function FitHint({
  row,
  kerf,
  allowRotation,
  catalog,
  specs,
  families,
}: {
  row: PieceRow;
  kerf: number;
  allowRotation: boolean;
  catalog: Catalog;
  specs: PanelSpec[];
  families: PanelFamily[];
}) {
  const l = parseNum(row.length);
  const w = parseNum(row.width);
  const msg = familyFitMessage(row, l, w, kerf, allowRotation, catalog, families, specs);
  if (!msg) return null;
  return <p className="mt-2 text-xs text-destructive">{msg}</p>;
}
