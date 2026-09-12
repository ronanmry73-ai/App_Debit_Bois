import { Plus, Trash2, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Catalog, PanelFamily } from "@/lib/catalog";
import { familyById } from "@/lib/catalog";
import {
  applyDelta,
  emptyOffcutItem,
  emptyStockItem,
  exampleStock,
  isPlaceholderDate,
  recordMove,
  stockStatus,
  stockSurfaceM2,
  stockValuePriced,
  unpricedStockCount,
  type StockDeduction,
  type StockItem,
  type StockKind,
  type StockMove,
} from "@/lib/stock";
import { formatEuro, cn } from "@/lib/utils";

type Props = {
  items: StockItem[];
  moves: StockMove[];
  onItems: (items: StockItem[]) => void;
  onMoves: (moves: StockMove[]) => void;
  catalog: Catalog;
  deduction?: StockDeduction | null;
  onCatalog?: () => void;
};

const KIND_LABEL: Record<StockKind, string> = {
  "panel-A": "Panneau 2500 × 400 mm",
  "panel-B": "Panneau 2500 × 600 mm",
  hardware: "Quincaillerie",
  other: "Panneau / autre",
  offcut: "Chute",
};

const KIND_SHORT: Record<StockKind, string> = {
  "panel-A": "Panneau",
  "panel-B": "Panneau",
  hardware: "Quincaillerie",
  other: "Autre",
  offcut: "Chute",
};

function formatMoveDate(iso?: string): string {
  if (isPlaceholderDate(iso)) return "—";
  const d = new Date(iso!);
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stockNumStr(n: number): string {
  if (!Number.isFinite(n)) return "";
  return String(n).replace(".", ",");
}

function parseStockNum(raw: string): number {
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function StockPanel({
  items,
  moves,
  onItems,
  onMoves,
  catalog,
  deduction,
  onCatalog,
}: Props) {
  const [filter, setFilter] = useState<"all" | StockKind>("all");
  const [familyFilter, setFamilyFilter] = useState<"all" | string>("all");
  const [q, setQ] = useState("");
  const [draftQty, setDraftQty] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const value = stockValuePriced(items);
  const unpriced = unpricedStockCount(items);
  const alerts = items.filter((it) => stockStatus(it) !== "ok");

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((it) => {
      if (filter !== "all" && it.kind !== filter) return false;
      if (familyFilter !== "all" && it.familyId !== familyFilter) return false;
      if (!needle) return true;
      const fam = it.familyId ? familyById(catalog, it.familyId)?.name ?? "" : "";
      return `${it.name} ${it.sku} ${fam} ${it.notes ?? ""} ${it.length ?? ""}x${it.width ?? ""} ${it.sourceProjectName ?? ""}`
        .toLowerCase()
        .includes(needle);
    });
  }, [items, filter, familyFilter, q, catalog]);

  function qtyInput(id: string, fallback: number): string {
    return draftQty[id] ?? String(fallback === 0 ? 1 : 1);
  }

  function receive(item: StockItem, type: "in" | "out") {
    const n = Number(String(qtyInput(item.id, 1)).replace(",", "."));
    const qty = Number.isFinite(n) && n > 0 ? n : 0;
    if (qty <= 0) return;
    const delta = type === "in" ? qty : -qty;
    onItems(applyDelta(items, item.id, delta));
    onMoves(
      recordMove(
        moves,
        item.id,
        type,
        qty,
        type === "in" ? "Entrée stock" : "Sortie manuelle",
      ),
    );
    setMessage(type === "in" ? `+${qty} ${item.name}` : `−${qty} ${item.name}`);
  }

  return (
    <section id="stocks" aria-labelledby="stocks-title" className="no-print w-full">
      <Card className="overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2
                id="stocks-title"
                className="font-display text-xl font-medium tracking-tight"
              >
                Stocks atelier
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Stock global, indépendant des projets. Valeur{" "}
                {formatEuro(value)}
                {unpriced > 0
                  ? ` · ${unpriced} article${unpriced > 1 ? "s" : ""} sans prix`
                  : ""}
                {alerts.length > 0
                  ? ` · ${alerts.length} alerte${alerts.length > 1 ? "s" : ""}`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {onCatalog && (
                <Button type="button" variant="outline" onClick={onCatalog}>
                  Catalogue
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => onItems([...items, emptyStockItem()])}
              >
                <Plus />
                Article
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  onItems([
                    ...items,
                    emptyOffcutItem({
                      familyId: catalog.families[0]?.id,
                      length: 1200,
                      width: 400,
                    }),
                  ])
                }
              >
                <Plus />
                Chute
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  onItems(exampleStock());
                  setMessage("Exemple de stock rechargé.");
                }}
              >
                Exemple stock
              </Button>
            </div>
          </div>

          {deduction && (
            <div className="mt-4 rounded-lg border border-border bg-muted/60 px-3 py-3 text-sm">
              <p className="font-medium">Ce projet a déjà déduit le stock</p>
              <p className="mt-1 text-muted-foreground">
                {formatMoveDate(deduction.date)}
                {deduction.projectName ? ` · ${deduction.projectName}` : ""}
                {deduction.partial ? " · partielle" : ""}
                {" · "}
                {deduction.lines.map((l) => `${l.name} −${l.qty}`).join(", ")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Une seule déduction par projet. Annulez-la depuis l’atelier pour
                en enregistrer une nouvelle.
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Input
              className="max-w-xs"
              placeholder="Rechercher une référence…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Rechercher dans le stock"
            />
            <select
              className="flex h-11 rounded-md border border-input bg-card px-3 text-sm"
              value={familyFilter}
              onChange={(e) => setFamilyFilter(e.target.value)}
              aria-label="Filtrer le stock par famille"
            >
              <option value="all">Toutes les familles</option>
              {catalog.families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            {(
              [
                ["all", "Tout"],
                ["panel-A", "Panneaux 2500 × 400"],
                ["panel-B", "Panneaux 2500 × 600"],
                ["offcut", "Chutes"],
                ["hardware", "Quincaillerie"],
                ["other", "Autre"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={cn(
                  "rounded-full px-3 py-1 text-sm",
                  filter === k
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </CardContent>

        <div className="hidden border-t border-border md:block">
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/60 text-left text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Article</th>
                <th className="w-28 px-2 py-2.5 font-medium">Famille</th>
                <th className="w-36 px-2 py-2.5 font-medium">Dimensions</th>
                <th className="w-28 px-2 py-2.5 font-medium">Type</th>
                <th className="w-20 px-2 py-2.5 font-medium">Qté</th>
                <th className="w-24 px-2 py-2.5 font-medium">Surface</th>
                <th className="w-20 px-2 py-2.5 font-medium">Mini</th>
                <th className="w-24 px-2 py-2.5 font-medium">Prix unit. €</th>
                <th className="w-32 px-2 py-2.5 font-medium">État</th>
                <th className="w-40 px-2 py-2.5 font-medium">Mouvement</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <StockRow
                  key={item.id}
                  item={item}
                  families={catalog.families}
                  familyName={
                    item.familyId
                      ? familyById(catalog, item.familyId)?.name ?? ""
                      : ""
                  }
                  draft={qtyInput(item.id, 1)}
                  onDraft={(v) =>
                    setDraftQty((d) => ({ ...d, [item.id]: v }))
                  }
                  onPatch={(patch) =>
                    onItems(
                      items.map((it) =>
                        it.id === item.id
                          ? { ...it, ...patch, updatedAt: new Date().toISOString() }
                          : it,
                      ),
                    )
                  }
                  onIn={() => receive(item, "in")}
                  onOut={() => receive(item, "out")}
                  onRemove={() => {
                    if (item.kind === "panel-A" || item.kind === "panel-B") return;
                    onItems(items.filter((it) => it.id !== item.id));
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>

        <ul className="flex flex-col gap-3 p-4 md:hidden">
          {visible.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-border bg-card p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <Input
                  value={item.name}
                  aria-label="Nom"
                  onChange={(e) =>
                    onItems(
                      items.map((it) =>
                        it.id === item.id ? { ...it, name: e.target.value } : it,
                      ),
                    )
                  }
                />
                <StatusBadge item={item} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.length && item.width
                  ? `${item.length} × ${item.width} mm`
                  : KIND_LABEL[item.kind]}
                {item.familyId
                  ? ` · ${familyById(catalog, item.familyId)?.name ?? ""}`
                  : ""}
                {item.kind === "offcut" ? " · chute" : ""}
                {!(item.unitCost > 0) ? " · sans prix" : ""}
              </p>
              {item.sourceProjectName && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Issue du projet {item.sourceProjectName}
                </p>
              )}
              {item.kind === "offcut" && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Num
                    label="Longueur mm"
                    value={item.length ?? 0}
                    onChange={(length) =>
                      onItems(
                        items.map((it) =>
                          it.id === item.id ? { ...it, length } : it,
                        ),
                      )
                    }
                  />
                  <Num
                    label="Largeur mm"
                    value={item.width ?? 0}
                    onChange={(width) =>
                      onItems(
                        items.map((it) =>
                          it.id === item.id ? { ...it, width } : it,
                        ),
                      )
                    }
                  />
                </div>
              )}
              <div className="mt-2 grid grid-cols-3 gap-2">
                <Num
                  label="Qté"
                  value={item.qty}
                  onChange={(qty) =>
                    onItems(items.map((it) => (it.id === item.id ? { ...it, qty } : it)))
                  }
                />
                <Num
                  label="Mini"
                  value={item.minQty}
                  onChange={(minQty) =>
                    onItems(
                      items.map((it) => (it.id === item.id ? { ...it, minQty } : it)),
                    )
                  }
                />
                <Num
                  label="Coût €"
                  value={item.unitCost}
                  onChange={(unitCost) =>
                    onItems(
                      items.map((it) => (it.id === item.id ? { ...it, unitCost } : it)),
                    )
                  }
                />
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  className="w-20 tabular-nums"
                  inputMode="decimal"
                  value={qtyInput(item.id, 1)}
                  onChange={(e) =>
                    setDraftQty((d) => ({
                      ...d,
                      [item.id]: e.target.value.replace(/[^\d.,]/g, ""),
                    }))
                  }
                  aria-label="Quantité mouvement"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => receive(item, "in")}>
                  <ArrowDownToLine />
                  Entrée
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => receive(item, "out")}>
                  <ArrowUpFromLine />
                  Sortie
                </Button>
              </div>
            </li>
          ))}
        </ul>

        {(message || moves.length > 0) && (
          <div className="border-t border-border px-4 py-4 sm:px-5">
            {message && (
              <p className="text-sm text-ink-soft">{message}</p>
            )}

            {moves.length > 0 && (
              <div className={message ? "mt-6" : ""}>
                <h3 className="font-display text-base font-medium">
                  Derniers mouvements
                </h3>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {moves.slice(0, 12).map((m) => {
                    const it = items.find((i) => i.id === m.itemId);
                    const sign = m.type === "in" ? "+" : m.type === "out" ? "−" : "±";
                    const when = formatMoveDate(m.date);
                    return (
                      <li key={m.id} className="tabular-nums">
                        {sign}
                        {m.qty} {it?.name ?? "article"}
                        {m.projectName ? ` · ${m.projectName}` : ""}
                        {m.quoteNumber ? ` · ${m.quoteNumber}` : ""}
                        {m.note ? ` · ${m.note}` : ""}
                        {when !== "—" ? ` · ${when}` : ""}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>
    </section>
  );
}

function StockRow({
  item,
  familyName,
  families,
  draft,
  onDraft,
  onPatch,
  onIn,
  onOut,
  onRemove,
}: {
  item: StockItem;
  familyName: string;
  families: PanelFamily[];
  draft: string;
  onDraft: (v: string) => void;
  onPatch: (patch: Partial<StockItem>) => void;
  onIn: () => void;
  onOut: () => void;
  onRemove: () => void;
}) {
  const locked = item.kind === "panel-A" || item.kind === "panel-B";
  const dimEdit = item.kind === "offcut" || item.kind === "other";
  const surface = stockSurfaceM2(item);
  const when = formatMoveDate(item.updatedAt);
  return (
    <tr className="border-b border-border last:border-0 align-top">
      <td className="px-2 py-2">
        <Input
          value={item.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          aria-label="Nom"
          className="h-9 min-w-0 px-2"
        />
        <div className="mt-1 flex items-center gap-1">
          <Input
            className="h-8 min-w-0 px-2 text-xs"
            value={item.sku}
            placeholder="Réf."
            onChange={(e) => onPatch({ sku: e.target.value })}
            aria-label="Référence"
          />
          {!locked && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onRemove}
              aria-label="Supprimer"
              className="shrink-0"
            >
              <Trash2 />
            </Button>
          )}
        </div>
        <Input
          className="mt-1 h-8 min-w-0 px-2 text-xs"
          value={item.notes ?? ""}
          onChange={(e) => onPatch({ notes: e.target.value })}
          aria-label="Notes"
          placeholder="Note"
        />
        {item.sourceProjectName && (
          <p className="mt-1 text-xs text-muted-foreground">
            Issue du projet {item.sourceProjectName}
            {item.sourcePanelIndex ? ` · P${item.sourcePanelIndex}` : ""}
          </p>
        )}
        {item.kind === "offcut" && (
          <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Switch
              checked={item.usable !== false}
              onCheckedChange={(v) => onPatch({ usable: v })}
              aria-label="Chute utilisable"
            />
            Vivante
          </label>
        )}
        {when !== "—" && (
          <p className="mt-1 text-xs text-muted-foreground">{when}</p>
        )}
      </td>
      <td className="px-2 py-2 break-words text-muted-foreground">
        {locked ? (
          familyName || "—"
        ) : (
          <select
            value={item.familyId ?? ""}
            onChange={(e) => onPatch({ familyId: e.target.value || undefined })}
            className="flex h-9 w-full min-w-0 rounded-md border border-input bg-card px-2 text-sm"
            aria-label="Famille"
          >
            <option value="">—</option>
            {families.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}
      </td>
      <td className="px-2 py-2 tabular-nums text-muted-foreground">
        {dimEdit ? (
          <div className="flex items-center gap-1">
            <StockNum
              value={item.length ? stockNumStr(item.length) : ""}
              onChange={(v) => onPatch({ length: parseStockNum(v) })}
              ariaLabel="Longueur mm"
            />
            <span>×</span>
            <StockNum
              value={item.width ? stockNumStr(item.width) : ""}
              onChange={(v) => onPatch({ width: parseStockNum(v) })}
              ariaLabel="Largeur mm"
            />
          </div>
        ) : item.length && item.width ? (
          <span className="whitespace-nowrap">
            {item.length} × {item.width} mm
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-2 py-2">
        {locked ? (
          <span className="text-muted-foreground">{KIND_SHORT[item.kind]}</span>
        ) : (
          <select
            value={item.kind}
            onChange={(e) => {
              const kind = e.target.value as StockKind;
              onPatch({
                kind,
                usable: kind === "offcut" ? item.usable !== false : item.usable,
                unit: "pièce",
              });
            }}
            className="flex h-9 w-full min-w-0 rounded-md border border-input bg-card px-2 text-sm"
            aria-label="Type"
          >
            <option value="hardware">Quincaillerie</option>
            <option value="other">Panneau</option>
            <option value="offcut">Chute</option>
          </select>
        )}
      </td>
      <td className="px-2 py-2">
        <StockNum
          value={stockNumStr(item.qty)}
          onChange={(v) => onPatch({ qty: parseStockNum(v) })}
          ariaLabel="Quantité en stock"
        />
      </td>
      <td className="whitespace-nowrap px-2 py-2 tabular-nums text-muted-foreground">
        {surface > 0
          ? `${surface.toLocaleString("fr-FR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} m²`
          : "—"}
      </td>
      <td className="px-2 py-2">
        <StockNum
          value={stockNumStr(item.minQty)}
          onChange={(v) => onPatch({ minQty: parseStockNum(v) })}
          ariaLabel="Seuil mini"
        />
      </td>
      <td className="px-2 py-2">
        <StockNum
          value={item.unitCost > 0 ? stockNumStr(item.unitCost) : ""}
          onChange={(v) => onPatch({ unitCost: parseStockNum(v) })}
          ariaLabel="Prix unitaire"
          placeholder="—"
        />
      </td>
      <td className="px-2 py-2">
        <StatusBadge item={item} />
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-1">
          <StockNum
            value={draft}
            onChange={(v) => onDraft(v.replace(/[^\d.,]/g, ""))}
            ariaLabel="Quantité mouvement"
            compact
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            onClick={onIn}
            aria-label="Entrée"
          >
            <ArrowDownToLine />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            onClick={onOut}
            aria-label="Sortie"
          >
            <ArrowUpFromLine />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function StockNum({
  value,
  onChange,
  ariaLabel,
  placeholder,
  compact,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
  placeholder?: string;
  compact?: boolean;
}) {
  return (
    <Input
      className={cn(
        "h-9 min-w-0 px-2 text-right tabular-nums",
        compact ? "w-14 shrink-0" : "w-full",
      )}
      inputMode="decimal"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
      aria-label={ariaLabel}
    />
  );
}

function StatusBadge({ item }: { item: StockItem }) {
  const s = stockStatus(item);
  if (item.kind === "offcut" && item.usable === false) {
    return (
      <Badge variant="outline" className="whitespace-nowrap">
        Inactive
      </Badge>
    );
  }
  if (s === "empty") {
    return (
      <Badge variant="warn" className="whitespace-nowrap">
        Rupture
      </Badge>
    );
  }
  if (s === "low") {
    return (
      <Badge variant="warn" className="whitespace-nowrap">
        Sous seuil
      </Badge>
    );
  }
  if (!(item.unitCost > 0) && item.kind !== "offcut") {
    return (
      <Badge variant="outline" className="whitespace-nowrap">
        Sans prix
      </Badge>
    );
  }
  if (item.kind === "offcut") {
    return (
      <Badge variant="good" className="whitespace-nowrap">
        Vivante
      </Badge>
    );
  }
  return (
    <Badge variant="good" className="whitespace-nowrap">
      OK
    </Badge>
  );
}

function Num({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        className="mt-1 tabular-nums"
        inputMode="decimal"
        value={stockNumStr(value)}
        onChange={(e) => {
          onChange(parseStockNum(e.target.value.replace(/[^\d.,]/g, "")));
        }}
      />
    </div>
  );
}
