import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emptyRow } from "@/lib/presets";
import type { PieceRow } from "@/lib/types";
import { pieceFitsAnyPanel } from "@/lib/packing";
import { cn } from "@/lib/utils";

type Props = {
  rows: PieceRow[];
  onChange: (rows: PieceRow[]) => void;
  kerf: number;
  allowRotation: boolean;
};

function parseNum(s: string): number {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function PieceList({ rows, onChange, kerf, allowRotation }: Props) {
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
            Dimensions en millimètres. {totalQty} pièce{totalQty > 1 ? "s" : ""} ·{" "}
            {(totalArea / 1_000_000).toLocaleString("fr-FR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            m² à débiter
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange([...rows, emptyRow()])}
        >
          <Plus />
          Ajouter une pièce
        </Button>
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/60 text-left text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">Nom</th>
              <th className="w-32 px-3 py-2.5 font-medium">Longueur</th>
              <th className="w-32 px-3 py-2.5 font-medium">Largeur</th>
              <th className="w-24 px-3 py-2.5 font-medium">Qté</th>
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
            </div>
            <FitHint row={row} kerf={kerf} allowRotation={allowRotation} />
          </li>
        ))}
      </ul>
    </section>
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
  onChange,
  onRemove,
}: {
  row: PieceRow;
  kerf: number;
  allowRotation: boolean;
  onChange: (patch: Partial<PieceRow>) => void;
  onRemove: () => void;
}) {
  const l = parseNum(row.length);
  const w = parseNum(row.width);
  const invalid =
    (l > 0 && w > 0 && !pieceFitsAnyPanel(l, w, allowRotation, kerf));

  return (
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
  );
}

function FitHint({
  row,
  kerf,
  allowRotation,
}: {
  row: PieceRow;
  kerf: number;
  allowRotation: boolean;
}) {
  const l = parseNum(row.length);
  const w = parseNum(row.width);
  if (l <= 0 || w <= 0) return null;
  if (pieceFitsAnyPanel(l, w, allowRotation, kerf)) return null;
  return (
    <p className="mt-2 text-xs text-destructive">
      Cette pièce ne rentre dans aucun panneau (max 2500 × 600 mm).
    </p>
  );
}
