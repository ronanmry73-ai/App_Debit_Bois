import { Button } from "@/components/ui/button";
import { moveRefLabel, type PendingMove } from "@/lib/movements";
import type { StockItem } from "@/lib/stock";

type Props = {
  items: PendingMove[];
  stock: StockItem[];
  onApply: () => void;
};

function formatAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PendingMovesBanner({ items, stock, onApply }: Props) {
  const n = items.length;
  if (n === 0) return null;
  const preview = items.slice(0, 8);
  return (
    <div className="no-print rounded-xl border border-border bg-card px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-medium">
          {n} mouvement{n > 1 ? "s" : ""} Terrain en attente — Appliquer
        </p>
        <Button type="button" onClick={onApply}>
          {n} mouvement{n > 1 ? "s" : ""} — Appliquer
        </Button>
      </div>
      <ul className="mt-2 space-y-1 text-muted-foreground">
        {preview.map((m) => (
          <li key={m.id}>
            {formatAt(m.at)} · {moveRefLabel(stock, m)} · {m.delta > 0 ? "+" : "−"}
            {Math.abs(m.delta)} · {m.reason || "—"}
          </li>
        ))}
      </ul>
      {n > preview.length ? (
        <p className="mt-1 text-xs text-muted-foreground">
          +{n - preview.length} autre{n - preview.length > 1 ? "s" : ""}
        </p>
      ) : null}
    </div>
  );
}
