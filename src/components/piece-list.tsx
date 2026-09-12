import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { emptyRow } from "@/lib/presets";
import type { GrainMode, PieceRow } from "@/lib/types";
import type { PanelSpec } from "@/lib/packing";
import { pieceFitsAnyPanel } from "@/lib/packing";
import { compatibleRefs, type Catalog, type PanelFamily } from "@/lib/catalog";
import {
  applyPiecePaste,
  GRAIN_LABEL,
  looksLikeTablePaste,
  parsePiecePaste,
  pieceCanRotate,
  rowHasContent,
  uniqueGroups,
} from "@/lib/piece-io";
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

type Col = "name" | "length" | "width" | "qty" | "family" | "grain" | "group";

function parseNum(s: string): number {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function cellSel(index: number, col: Col): string {
  return `[data-debit="${index}:${col}"]`;
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
  const [groupFilter, setGroupFilter] = useState("");
  const [pendingFocus, setPendingFocus] = useState<{
    index: number;
    col: Col;
  } | null>(null);
  const [confirm, setConfirm] = useState<
    | { kind: "none" }
    | { kind: "delete"; id: string }
    | { kind: "paste"; parsed: ReturnType<typeof parsePiecePaste>; start: number }
  >({ kind: "none" });
  const activeIndex = useRef(0);

  useEffect(() => {
    if (!pendingFocus) return;
    const el = document.querySelector(
      cellSel(pendingFocus.index, pendingFocus.col),
    ) as HTMLElement | null;
    el?.focus();
    setPendingFocus(null);
  }, [rows, pendingFocus]);

  function update(id: string, patch: Partial<PieceRow>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function requestRemove(id: string) {
    const row = rows.find((r) => r.id === id);
    if (row && rowHasContent(row)) {
      setConfirm({ kind: "delete", id });
      return;
    }
    remove(id);
  }

  function remove(id: string) {
    if (rows.length <= 1) {
      onChange([emptyRow()]);
      return;
    }
    onChange(rows.filter((r) => r.id !== id));
  }

  function addAfter(index: number, focusCol: Col = "name") {
    const next = rows.slice();
    const fresh = emptyRow();
    if (groupFilter) fresh.group = groupFilter;
    next.splice(index + 1, 0, fresh);
    onChange(next);
    setPendingFocus({ index: index + 1, col: focusCol });
  }

  function familyIdByName(name: string): string {
    const k = name.trim().toLowerCase();
    if (!k) return "";
    return families.find((f) => f.name.trim().toLowerCase() === k)?.id ?? "";
  }

  function commitPaste(
    parsed: ReturnType<typeof parsePiecePaste>,
    start: number,
  ) {
    onChange(
      applyPiecePaste({
        rows,
        startIndex: start,
        parsed,
        familyIdByName,
      }),
    );
    setPendingFocus({ index: start, col: "name" });
  }

  function onPaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text/plain");
    if (!looksLikeTablePaste(text)) return;
    const parsed = parsePiecePaste(text);
    if (parsed.length === 0) return;
    e.preventDefault();
    const start = activeIndex.current;
    const filled = rows.filter(rowHasContent).length;
    const wouldWipe = start === 0 && filled > 1 && parsed.length >= 1;
    if (wouldWipe) {
      setConfirm({ kind: "paste", parsed, start });
      return;
    }
    commitPaste(parsed, start);
  }

  function onGridKey(e: React.KeyboardEvent, index: number, col: Col) {
    if (e.key === "Tab" && !e.shiftKey && col === "group") {
      e.preventDefault();
      if (index >= rows.length - 1) {
        addAfter(index, "name");
      } else {
        setPendingFocus({ index: index + 1, col: "name" });
        const el = document.querySelector(cellSel(index + 1, "name")) as HTMLElement | null;
        el?.focus();
      }
      return;
    }
    if (e.key === "Tab" && e.shiftKey && col === "name" && index > 0) {
      e.preventDefault();
      const el = document.querySelector(cellSel(index - 1, "group")) as HTMLElement | null;
      el?.focus();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (col === "qty" || col === "family" || col === "grain" || col === "group") {
        addAfter(index, "name");
        return;
      }
      if (index >= rows.length - 1) {
        addAfter(index, col);
      } else {
        const el = document.querySelector(cellSel(index + 1, col)) as HTMLElement | null;
        el?.focus();
      }
    }
  }

  const groups = uniqueGroups(rows);
  const visible = groupFilter
    ? rows.filter((r) => (r.group ?? "").trim() === groupFilter)
    : rows;

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
            Dimensions en millimètres. Tab parcourt la ligne, Entrée crée une pièce.{" "}
            {totalQty} pièce{totalQty > 1 ? "s" : ""} ·{" "}
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

      {groups.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <FilterChip
            active={!groupFilter}
            onClick={() => setGroupFilter("")}
            label="Tous"
          />
          {groups.map((g) => (
            <FilterChip
              key={g}
              active={groupFilter === g}
              onClick={() => setGroupFilter(g === groupFilter ? "" : g)}
              label={g}
            />
          ))}
        </div>
      )}

      <datalist id="debit-groups">
        {groups.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>

      <div
        className="hidden overflow-hidden rounded-lg border border-border bg-card md:block"
        onPaste={onPaste}
      >
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/60 text-left text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">Nom</th>
              <th className="w-24 px-2 py-2.5 font-medium">Longueur</th>
              <th className="w-24 px-2 py-2.5 font-medium">Largeur</th>
              <th className="w-16 px-2 py-2.5 font-medium">Qté</th>
              <th className="w-36 px-2 py-2.5 font-medium">Famille</th>
              <th className="w-24 px-2 py-2.5 font-medium" title="Imposé = ne pas tourner (fil / placage).">
                Fil
              </th>
              <th className="w-28 px-2 py-2.5 font-medium">Groupe</th>
              <th className="w-10 px-1 py-2.5">
                <span className="sr-only">Supprimer</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const index = rows.findIndex((r) => r.id === row.id);
              return (
                <PieceTableRow
                  key={row.id}
                  row={row}
                  index={index}
                  kerf={kerf}
                  allowRotation={allowRotation}
                  families={families}
                  catalog={catalog}
                  specs={specs}
                  onChange={(patch) => update(row.id, patch)}
                  onRemove={() => requestRemove(row.id)}
                  onFocusCell={() => {
                    activeIndex.current = index;
                  }}
                  onGridKey={(e, col) => onGridKey(e, index, col)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 hidden text-xs text-muted-foreground md:block">
        Fil : Job suit l’option du chantier · Imposé = ne pas tourner (fil / placage) ·
        Libre = rotation même si le job l’interdit. Coller depuis un tableur
        (Nom, Longueur, Largeur, Qté).
      </p>

      <ul className="flex flex-col gap-3 md:hidden">
        {visible.map((row, i) => (
          <li
            key={row.id}
            className="rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-border)]"
            onPaste={onPaste}
            onFocusCapture={() => {
              activeIndex.current = rows.findIndex((r) => r.id === row.id);
            }}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Pièce {i + 1}
                {row.group?.trim() ? ` · ${row.group}` : ""}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Supprimer la pièce"
                onClick={() => requestRemove(row.id)}
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
              <div>
                <Label htmlFor={`grain-${row.id}`}>Fil</Label>
                <GrainSelect
                  id={`grain-${row.id}`}
                  value={row.grain ?? "default"}
                  onChange={(grain) => update(row.id, { grain })}
                />
              </div>
              <div>
                <Label htmlFor={`group-${row.id}`}>Groupe</Label>
                <Input
                  id={`group-${row.id}`}
                  className="mt-1"
                  list="debit-groups"
                  placeholder="Caisson, portes…"
                  value={row.group ?? ""}
                  onChange={(e) => update(row.id, { group: e.target.value })}
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

      <ConfirmDialog
        open={confirm.kind === "delete"}
        title="Supprimer cette pièce ?"
        message="La ligne n’est pas vide. Confirmez pour la retirer du débit."
        actions={[
          {
            label: "Annuler",
            variant: "ghost",
            onClick: () => setConfirm({ kind: "none" }),
          },
          {
            label: "Supprimer",
            variant: "destructive",
            onClick: () => {
              if (confirm.kind !== "delete") return;
              remove(confirm.id);
              setConfirm({ kind: "none" });
            },
          },
        ]}
      />
      <ConfirmDialog
        open={confirm.kind === "paste"}
        title="Remplacer le débit ?"
        message="Le collage écraserait plusieurs pièces déjà saisies. Continuer depuis la première ligne ?"
        actions={[
          {
            label: "Annuler",
            variant: "ghost",
            onClick: () => setConfirm({ kind: "none" }),
          },
          {
            label: "Remplacer",
            onClick: () => {
              if (confirm.kind !== "paste") return;
              commitPaste(confirm.parsed, confirm.start);
              setConfirm({ kind: "none" });
            },
          },
        ]}
      />
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}

function FamilySelect({
  id,
  value,
  families,
  onChange,
  compact,
  dataDebit,
  onKeyDown,
  onFocus,
}: {
  id?: string;
  value: string;
  families: PanelFamily[];
  onChange: (id: string) => void;
  compact?: boolean;
  dataDebit?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onFocus?: () => void;
}) {
  return (
    <select
      id={id}
      aria-label="Famille prioritaire"
      data-debit={dataDebit}
      className={
        compact
          ? "flex h-9 w-full min-w-0 rounded-md border border-input bg-card px-2 text-sm"
          : "mt-1 flex h-11 w-full rounded-md border border-input bg-card px-2 text-sm"
      }
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
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

function GrainSelect({
  id,
  value,
  onChange,
  compact,
  dataDebit,
  onKeyDown,
  onFocus,
}: {
  id?: string;
  value: GrainMode;
  onChange: (g: GrainMode) => void;
  compact?: boolean;
  dataDebit?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onFocus?: () => void;
}) {
  return (
    <select
      id={id}
      aria-label="Fil"
      title="Imposé = ne pas tourner (fil / placage)."
      data-debit={dataDebit}
      className={
        compact
          ? "flex h-9 w-full min-w-0 rounded-md border border-input bg-card px-2 text-sm"
          : "mt-1 flex h-11 w-full rounded-md border border-input bg-card px-2 text-sm"
      }
      value={value}
      onChange={(e) => onChange(e.target.value as GrainMode)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
    >
      <option value="default">{GRAIN_LABEL.default}</option>
      <option value="locked">{GRAIN_LABEL.locked}</option>
      <option value="free">{GRAIN_LABEL.free}</option>
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
  index,
  kerf,
  allowRotation,
  families,
  catalog,
  specs,
  onChange,
  onRemove,
  onFocusCell,
  onGridKey,
}: {
  row: PieceRow;
  index: number;
  kerf: number;
  allowRotation: boolean;
  families: PanelFamily[];
  catalog: Catalog;
  specs: PanelSpec[];
  onChange: (patch: Partial<PieceRow>) => void;
  onRemove: () => void;
  onFocusCell: () => void;
  onGridKey: (e: React.KeyboardEvent, col: Col) => void;
}) {
  const l = parseNum(row.length);
  const w = parseNum(row.width);
  const familyHint = familyFitMessage(row, l, w, kerf, allowRotation, catalog, families, specs);
  const invalid = Boolean(familyHint);

  return (
    <>
    <tr className="border-b border-border last:border-0">
      <td className="px-2 py-1">
        <Input
          aria-label="Nom de la pièce"
          placeholder="montant, traverse…"
          value={row.name}
          data-debit={`${index}:name`}
          onFocus={onFocusCell}
          onKeyDown={(e) => onGridKey(e, "name")}
          onChange={(e) => onChange({ name: e.target.value })}
          className="h-9"
        />
      </td>
      <td className="px-1 py-1">
        <Input
          aria-label="Longueur en mm"
          inputMode="numeric"
          value={row.length}
          data-debit={`${index}:length`}
          onFocus={onFocusCell}
          onKeyDown={(e) => onGridKey(e, "length")}
          onChange={(e) => onChange({ length: e.target.value.replace(/[^\d.,]/g, "") })}
          className={cn("h-9 tabular-nums", invalid && "border-destructive")}
        />
      </td>
      <td className="px-1 py-1">
        <Input
          aria-label="Largeur en mm"
          inputMode="numeric"
          value={row.width}
          data-debit={`${index}:width`}
          onFocus={onFocusCell}
          onKeyDown={(e) => onGridKey(e, "width")}
          onChange={(e) => onChange({ width: e.target.value.replace(/[^\d.,]/g, "") })}
          className={cn("h-9 tabular-nums", invalid && "border-destructive")}
        />
      </td>
      <td className="px-1 py-1">
        <Input
          aria-label="Quantité"
          inputMode="numeric"
          value={row.qty}
          data-debit={`${index}:qty`}
          onFocus={onFocusCell}
          onKeyDown={(e) => onGridKey(e, "qty")}
          onChange={(e) => onChange({ qty: e.target.value.replace(/[^\d]/g, "") })}
          className="h-9 tabular-nums"
        />
      </td>
      <td className="px-1 py-1">
        <FamilySelect
          value={row.familyId ?? ""}
          families={families}
          compact
          dataDebit={`${index}:family`}
          onFocus={onFocusCell}
          onKeyDown={(e) => onGridKey(e, "family")}
          onChange={(familyId) => onChange({ familyId })}
        />
      </td>
      <td className="px-1 py-1">
        <GrainSelect
          value={row.grain ?? "default"}
          compact
          dataDebit={`${index}:grain`}
          onFocus={onFocusCell}
          onKeyDown={(e) => onGridKey(e, "grain")}
          onChange={(grain) => onChange({ grain })}
        />
      </td>
      <td className="px-1 py-1">
        <Input
          aria-label="Groupe"
          list="debit-groups"
          placeholder="Caisson…"
          value={row.group ?? ""}
          data-debit={`${index}:group`}
          onFocus={onFocusCell}
          onKeyDown={(e) => onGridKey(e, "group")}
          onChange={(e) => onChange({ group: e.target.value })}
          className="h-9"
        />
      </td>
      <td className="px-1 py-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Supprimer la pièce"
          tabIndex={-1}
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      </td>
    </tr>
    {familyHint && (
      <tr className="border-b border-border last:border-0">
        <td colSpan={8} className="px-3 pb-2 text-xs text-destructive">
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
  const rot = pieceCanRotate(row.grain, allowRotation);
  if (row.familyId) {
    const fam = families.find((f) => f.id === row.familyId);
    const ok = compatibleRefs(catalog, l, w, rot, kerf, row.familyId);
    if (ok.length === 0) {
      const piece = row.name.trim() || "sans nom";
      return `Aucun panneau actif compatible n’a été trouvé dans la famille ${fam?.name ?? "sélectionnée"} pour la pièce ${piece}. Veuillez ajouter une référence compatible ou choisir une autre famille.`;
    }
    return null;
  }
  if (pieceFitsAnyPanel(l, w, rot, kerf, specs)) return null;
  return row.grain === "locked"
    ? "Cette pièce (fil imposé) ne rentre dans aucun panneau actif sans la tourner."
    : "Cette pièce ne rentre dans aucun panneau actif.";
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