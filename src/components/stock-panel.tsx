import { Plus, Trash2, ArrowDownToLine, ArrowUpFromLine, Package } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  applyDelta,
  consumeForJob,
  coverage,
  emptyStockItem,
  exampleStock,
  hasShortage,
  recordMove,
  stockStatus,
  stockValue,
  toOrder,
  type JobNeed,
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
  need: JobNeed | null;
  quoteNumber: string;
};

const KIND_LABEL: Record<StockKind, string> = {
  "panel-A": "Panneau 400",
  "panel-B": "Panneau 600",
  hardware: "Quincaillerie",
  other: "Autre",
};

export function StockPanel({
  items,
  moves,
  onItems,
  onMoves,
  need,
  quoteNumber,
}: Props) {
  const [filter, setFilter] = useState<"all" | StockKind>("all");
  const [draftQty, setDraftQty] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const value = stockValue(items);
  const alerts = items.filter((it) => stockStatus(it) !== "ok");
  const visible =
    filter === "all" ? items : items.filter((it) => it.kind === filter);
  const lines = need ? coverage(items, need).filter((l) => l.needed > 0) : [];
  const shortage = lines.length > 0 && hasShortage(lines);
  const order = toOrder(lines);

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
    setMessage(
      type === "in"
        ? `+${qty} ${item.name}`
        : `−${qty} ${item.name}`,
    );
  }

  function consume(partial: boolean) {
    if (!need) return;
    const out = consumeForJob(items, moves, need, quoteNumber, partial);
    if (!out.ok) {
      setMessage("Stock insuffisant. Sortez le disponible, ou commandez le manque.");
      return;
    }
    onItems(out.items);
    onMoves(out.moves);
    setMessage(
      partial
        ? "Sortie partielle enregistrée."
        : `Sortie chantier ${quoteNumber || ""} enregistrée.`,
    );
  }

  return (
    <section id="stocks" aria-labelledby="stocks-title" className="no-print">
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2
                id="stocks-title"
                className="font-display text-xl font-medium tracking-tight"
              >
                Stocks atelier
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Panneaux et quincaillerie. Valeur {formatEuro(value)}
                {alerts.length > 0
                  ? ` · ${alerts.length} alerte${alerts.length > 1 ? "s" : ""}`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
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

          <div className="mt-4 flex flex-wrap gap-2">
            {(
              [
                ["all", "Tout"],
                ["panel-A", "400 mm"],
                ["panel-B", "600 mm"],
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

          <div className="mt-4 hidden overflow-x-auto rounded-lg border border-border md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-left text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Article</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="w-24 px-3 py-2.5 font-medium">Qté</th>
                  <th className="w-20 px-3 py-2.5 font-medium">Mini</th>
                  <th className="w-28 px-3 py-2.5 font-medium">Coût</th>
                  <th className="px-3 py-2.5 font-medium">État</th>
                  <th className="px-3 py-2.5 font-medium">Mouvement</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <StockRow
                    key={item.id}
                    item={item}
                    draft={qtyInput(item.id, 1)}
                    onDraft={(v) =>
                      setDraftQty((d) => ({ ...d, [item.id]: v }))
                    }
                    onPatch={(patch) =>
                      onItems(items.map((it) => (it.id === item.id ? { ...it, ...patch } : it)))
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

          <ul className="mt-4 flex flex-col gap-3 md:hidden">
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

          {lines.length > 0 && (
            <div className="mt-6 rounded-lg bg-muted/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-base font-medium">
                  Besoin du chantier
                </p>
                {shortage ? (
                  <Badge variant="warn">Manque</Badge>
                ) : (
                  <Badge variant="good">Couvert par le stock</Badge>
                )}
              </div>
              <ul className="mt-3 space-y-1.5 text-sm">
                {lines.map((l) => (
                  <li
                    key={l.key}
                    className="flex flex-wrap items-baseline justify-between gap-2"
                  >
                    <span>{l.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      besoin {l.needed} · stock {l.onHand}
                      {l.gap > 0 ? ` · à commander ${l.gap}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              {order.length > 0 && (
                <p className="mt-2 text-sm text-warn">
                  À commander : {order.map((o) => `${o.name} ×${o.qty}`).join(", ")}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => consume(false)}
                  disabled={shortage}
                >
                  <Package />
                  Déduire du stock
                </Button>
                {shortage && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => consume(true)}
                  >
                    Sortir le disponible
                  </Button>
                )}
              </div>
            </div>
          )}

          {message && (
            <p className="mt-3 text-sm text-ink-soft">{message}</p>
          )}

          {moves.length > 0 && (
            <div className="mt-6">
              <h3 className="font-display text-base font-medium">
                Derniers mouvements
              </h3>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {moves.slice(0, 8).map((m) => {
                  const it = items.find((i) => i.id === m.itemId);
                  const sign = m.type === "in" ? "+" : m.type === "out" ? "−" : "±";
                  return (
                    <li key={m.id} className="tabular-nums">
                      {sign}
                      {m.qty} {it?.name ?? "article"}
                      {m.quoteNumber ? ` · ${m.quoteNumber}` : ""}
                      {m.note ? ` · ${m.note}` : ""}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function StockRow({
  item,
  draft,
  onDraft,
  onPatch,
  onIn,
  onOut,
  onRemove,
}: {
  item: StockItem;
  draft: string;
  onDraft: (v: string) => void;
  onPatch: (patch: Partial<StockItem>) => void;
  onIn: () => void;
  onOut: () => void;
  onRemove: () => void;
}) {
  const locked = item.kind === "panel-A" || item.kind === "panel-B";
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-2 py-1.5">
        <Input
          value={item.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          aria-label="Nom"
        />
        <Input
          className="mt-1"
          value={item.sku}
          placeholder="Réf."
          onChange={(e) => onPatch({ sku: e.target.value })}
          aria-label="Référence"
        />
      </td>
      <td className="px-2 py-1.5">
        {locked ? (
          <span className="text-muted-foreground">{KIND_LABEL[item.kind]}</span>
        ) : (
          <select
            value={item.kind}
            onChange={(e) => onPatch({ kind: e.target.value as StockKind })}
            className="flex h-11 w-full rounded-md border border-input bg-card px-2 text-sm"
            aria-label="Type"
          >
            <option value="hardware">Quincaillerie</option>
            <option value="other">Autre</option>
          </select>
        )}
      </td>
      <td className="px-2 py-1.5">
        <Input
          className="tabular-nums"
          inputMode="decimal"
          value={String(item.qty)}
          onChange={(e) => {
            const n = Number(e.target.value.replace(",", "."));
            onPatch({ qty: Number.isFinite(n) ? n : 0 });
          }}
          aria-label="Quantité en stock"
        />
      </td>
      <td className="px-2 py-1.5">
        <Input
          className="tabular-nums"
          inputMode="decimal"
          value={String(item.minQty)}
          onChange={(e) => {
            const n = Number(e.target.value.replace(",", "."));
            onPatch({ minQty: Number.isFinite(n) ? n : 0 });
          }}
          aria-label="Seuil mini"
        />
      </td>
      <td className="px-2 py-1.5">
        <Input
          className="tabular-nums"
          inputMode="decimal"
          value={String(item.unitCost)}
          onChange={(e) => {
            const n = Number(e.target.value.replace(",", "."));
            onPatch({ unitCost: Number.isFinite(n) ? n : 0 });
          }}
          aria-label="Coût unitaire"
        />
      </td>
      <td className="px-3 py-1.5">
        <StatusBadge item={item} />
      </td>
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-1">
          <Input
            className="w-16 tabular-nums"
            inputMode="decimal"
            value={draft}
            onChange={(e) => onDraft(e.target.value.replace(/[^\d.,]/g, ""))}
            aria-label="Quantité mouvement"
          />
          <Button type="button" variant="ghost" size="icon-sm" onClick={onIn} aria-label="Entrée">
            <ArrowDownToLine />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onOut} aria-label="Sortie">
            <ArrowUpFromLine />
          </Button>
          {!locked && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onRemove}
              aria-label="Supprimer"
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

function StatusBadge({ item }: { item: StockItem }) {
  const s = stockStatus(item);
  if (s === "empty") return <Badge variant="warn">Rupture</Badge>;
  if (s === "low") return <Badge variant="warn">Sous seuil</Badge>;
  return <Badge variant="good">OK</Badge>;
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
        value={String(value)}
        onChange={(e) => {
          const n = Number(e.target.value.replace(",", "."));
          onChange(Number.isFinite(n) ? n : 0);
        }}
      />
    </div>
  );
}
