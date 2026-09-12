import { Check, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { PanelSpec, StrategyId, StrategyResult } from "@/lib/packing";
import { findPanel, type StockItem } from "@/lib/stock";
import { supplierCostFromCounts, type SupplierCost } from "@/lib/supplier";
import { formatArea, formatEuro, formatPct, cn } from "@/lib/utils";

type Props = {
  strategies: StrategyResult[];
  selected: StrategyId;
  bestId: StrategyId;
  onSelect: (id: StrategyId) => void;
  stock?: StockItem[];
  specs?: PanelSpec[];
};

function countTotal(counts: Record<string, number>): number {
  return Object.values(counts).reduce((s, n) => s + n, 0);
}

function specLabel(id: string, specs: PanelSpec[]): string {
  return specs.find((s) => s.id === id)?.label ?? id;
}

function costOf(s: StrategyResult, specs: PanelSpec[]): SupplierCost {
  return supplierCostFromCounts(s.counts, specs);
}

export function ResultsPanel({
  strategies,
  selected,
  bestId,
  onSelect,
  stock = [],
  specs = [],
}: Props) {
  const current = strategies.find((s) => s.id === selected) ?? strategies[0];
  if (!current) return null;

  return (
    <section aria-labelledby="resultats-title" className="flex flex-col gap-4">
      <div>
        <h2 id="resultats-title" className="font-display text-xl font-medium tracking-tight">
          Comparaison des stratégies
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Objectif : minimiser la surface de panneaux achetée. L’achat affiché
          est le coût fournisseur de cette stratégie.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {strategies.map((s) => {
          const isBest = s.id === bestId;
          const isSel = s.id === selected;
          const cost = costOf(s, specs);
          const total = countTotal(s.counts);
          const offcutN = (s.offcutsUsed ?? []).reduce((n, o) => n + o.qty, 0);
          const mix = [
            ...Object.entries(s.counts)
              .filter(([, n]) => n > 0)
              .map(([id, n]) => `${n} × ${specLabel(id, specs)}`),
            ...((s.offcutsUsed ?? []).map(
              (o) => `${o.qty} chute ${Math.round(o.length)}×${Math.round(o.width)}`,
            )),
          ].join(" · ");
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              className={cn(
                "rounded-xl bg-card p-4 text-left shadow-[var(--shadow-border)] transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSel && "ring-2 ring-primary",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-base font-medium">{s.label}</p>
                {isBest && (
                  <Badge variant="good">
                    <Check className="mr-1 size-3" />
                    Recommandé
                  </Badge>
                )}
              </div>
              <p className="mt-3 font-display text-3xl font-medium tabular-nums tracking-tight">
                {total}
                <span className="ml-1.5 text-base font-normal text-muted-foreground">
                  feuille{total > 1 ? "s" : ""}
                </span>
                {offcutN > 0 && (
                  <span className="ml-2 text-base font-normal text-muted-foreground">
                    · {offcutN} chute{offcutN > 1 ? "s" : ""}
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm tabular-nums text-muted-foreground">{mix}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Surface achetée</dt>
                  <dd className="tabular-nums font-medium">{formatArea(s.purchasedArea)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Chute plan</dt>
                  <dd className="tabular-nums font-medium">{formatPct(s.wastePercent)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Achat panneaux</dt>
                  <dd className="tabular-nums font-medium">
                    {total === 0
                      ? "—"
                      : cost.totalCost != null
                        ? formatEuro(cost.totalCost)
                        : "— prix incomplet"}
                  </dd>
                </div>
              </dl>
              {s.unplaced.length > 0 && (
                <p className="mt-3 flex items-start gap-1.5 text-xs text-destructive">
                  <TriangleAlert className="mt-px size-3.5 shrink-0" />
                  {s.unplaced.length} pièce{s.unplaced.length > 1 ? "s" : ""} non placée
                  {s.unplaced.length > 1 ? "s" : ""}
                </p>
              )}
            </button>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-5">
          <h3 className="font-display text-base font-medium">À acheter — {current.label}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {Object.entries(current.counts)
              .filter(([, n]) => n > 0)
              .map(([id, n]) => {
                const spec = specs.find((s) => s.id === id);
                const hand =
                  id === "A" || id === "B"
                    ? (findPanel(stock, id)?.qty ?? 0)
                    : (stock.find((it) => it.id === id)?.qty ?? 0);
                const gap = Math.max(0, n - hand);
                return (
                  <BuyStat
                    key={id}
                    label={`Panneaux ${spec?.label ?? id}`}
                    value={n}
                    onHand={hand}
                    gap={gap}
                  />
                );
              })}
            {(current.offcutsUsed ?? []).map((o) => {
              const hand = stock.find((it) => it.id === o.stockItemId)?.qty ?? 0;
              return (
                <BuyStat
                  key={o.stockItemId}
                  label={`Chute ${Math.round(o.length)} × ${Math.round(o.width)} mm`}
                  value={o.qty}
                  onHand={hand}
                  gap={Math.max(0, o.qty - hand)}
                />
              );
            })}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Total panneaux</dt>
              <dd className="text-lg font-medium tabular-nums">
                {countTotal(current.counts)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Surface utile</dt>
              <dd className="text-lg font-medium tabular-nums">{formatArea(current.usedArea)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Surface achetée</dt>
              <dd className="text-lg font-medium tabular-nums">
                {formatArea(current.purchasedArea)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Chute du plan</dt>
              <dd className="text-lg font-medium tabular-nums">
                {formatPct(current.wastePercent)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </section>
  );
}

function BuyStat({
  label,
  value,
  onHand,
  gap,
}: {
  label: string;
  value: number;
  onHand?: number;
  gap?: number;
}) {
  return (
    <div className="rounded-lg bg-muted/70 px-4 py-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-4xl font-medium tabular-nums tracking-tight">
        {value}
      </p>
      {onHand != null && (
        <p className="text-xs text-muted-foreground">
          stock {onHand}
          {gap && gap > 0 ? ` · à commander ${gap}` : " · couvert"}
        </p>
      )}
    </div>
  );
}
