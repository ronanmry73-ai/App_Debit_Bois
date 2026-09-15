import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Catalog } from "@/lib/catalog";
import { familyById } from "@/lib/catalog";
import {
  makePendingMove,
  moveRefLabel,
  pendingDeltaFor,
  stockRefKey,
  type PendingMove,
} from "@/lib/movements";
import { stockStatus, type StockItem } from "@/lib/stock";
import { cn } from "@/lib/utils";

type Props = {
  items: StockItem[];
  catalog: Catalog;
  pending: PendingMove[];
  onPending: (next: PendingMove[]) => void;
  driveLinked?: boolean;
};

export function TerrainStock({
  items,
  catalog,
  pending,
  onPending,
  driveLinked = false,
}: Props) {
  const [qtyDraft, setQtyDraft] = useState("1");
  const [reason, setReason] = useState("");
  const [picked, setPicked] = useState<string | null>(items[0]?.id ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<PendingMove | null>(null);

  const visible = useMemo(
    () => items.filter((it) => it.kind !== "offcut" || (it.qty ?? 0) > 0 || pendingDeltaFor(pending, stockRefKey(it)) !== 0),
    [items, pending],
  );

  const selected = visible.find((it) => it.id === picked) ?? visible[0] ?? null;

  function push(deltaSign: 1 | -1) {
    if (!selected) return;
    const n = Number(String(qtyDraft).replace(",", "."));
    const qty = Number.isFinite(n) && n > 0 ? n : 0;
    if (qty <= 0) return;
    const motif = reason.trim();
    if (!motif) {
      setMessage("Indiquez un motif (réception, pose, casse…).");
      return;
    }
    const move = makePendingMove(selected, deltaSign * qty, motif);
    onPending([...pending, move]);
    setMessage(
      `${deltaSign > 0 ? "+" : "−"}${qty} ${selected.name} · ${motif} (en attente d’application PC)`,
    );
    setReason("");
  }

  return (
    <section aria-labelledby="terrain-stock-title" className="flex flex-col gap-4">
      <Card>
        <CardContent className="p-4">
          <h2 id="terrain-stock-title" className="font-display text-xl font-medium tracking-tight">
            Stock chantier
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {driveLinked
              ? "Entrée et sortie partent dans le carnet Drive. Le stock affiché vient du PC ; il ne bouge ici qu’après application à l’atelier."
              : "Entrée et sortie restent dans le carnet. Enregistre le carnet et dépose-le dans le dossier Drive ; le PC appliquera les quantités. Ici le stock importé ne bouge pas."}
          </p>

          {message && <p className="mt-3 text-sm">{message}</p>}
        </CardContent>
      </Card>

      <ul className="flex flex-col gap-2">
        {visible.map((item) => {
          const key = stockRefKey(item);
          const pendingQty = pendingDeltaFor(pending, key);
          const shown = item.qty + pendingQty;
          const status = stockStatus({ ...item, qty: shown });
          const active = selected?.id === item.id;
          const fam = item.familyId ? familyById(catalog, item.familyId)?.name : "";
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setPicked(item.id)}
                className={cn(
                  "flex min-h-11 w-full items-start justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-left shadow-[var(--shadow-border)]",
                  active ? "border-primary" : "border-border",
                )}
              >
                <span>
                  <span className="block font-medium">{item.name}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {item.length && item.width ? `${item.length} × ${item.width} mm` : item.unit}
                    {fam ? ` · ${fam}` : ""}
                  </span>
                </span>
                <span className="text-right tabular-nums">
                  <span className="block text-lg font-medium">{shown}</span>
                  {pendingQty !== 0 && (
                    <span className="block text-xs text-accent-foreground">
                      {item.qty} {pendingQty > 0 ? `+${pendingQty}` : pendingQty}
                    </span>
                  )}
                  {status === "empty" && (
                    <span className="block text-xs text-destructive">rupture</span>
                  )}
                  {status === "low" && (
                    <span className="block text-xs text-warn">sous mini</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {selected && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <p className="text-sm font-medium">{selected.name}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="terrain-qty">Quantité</Label>
                <Input
                  id="terrain-qty"
                  className="mt-1.5 min-h-11 tabular-nums"
                  inputMode="decimal"
                  value={qtyDraft}
                  onChange={(e) => setQtyDraft(e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="terrain-reason">Motif</Label>
                <Input
                  id="terrain-reason"
                  className="mt-1.5 min-h-11"
                  placeholder="Réception fournisseur, pose cuisine…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" className="min-h-11" onClick={() => push(1)}>
                <ArrowDownToLine />
                Entrée
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => push(-1)}
              >
                <ArrowUpFromLine />
                Sortie
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirmRemove !== null}
        title="Retirer ce mouvement ?"
        message={
          confirmRemove
            ? (confirmRemove.delta > 0 ? "+" : "") +
              confirmRemove.delta +
              " · " +
              (confirmRemove.reason || "sans motif") +
              " — ce mouvement sera retiré du carnet et ne partira pas vers le PC."
            : ""
        }
        actions={[
          { label: "Annuler", variant: "outline", onClick: () => setConfirmRemove(null) },
          {
            label: "Retirer",
            variant: "destructive",
            onClick: () => {
              if (confirmRemove) {
                onPending(pending.filter((x) => x.id !== confirmRemove.id));
              }
              setConfirmRemove(null);
            },
          },
        ]}
      />

      {pending.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-display text-base font-medium">Carnet du jour</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {pending.map((m) => (
                <li key={m.id} className="flex justify-between gap-2">
                  <span>
                    {m.delta > 0 ? "+" : ""}
                    {m.delta} · {moveRefLabel(items, m)}
                    {m.reason ? ` · ${m.reason}` : ""}
                  </span>
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-xs text-destructive underline-offset-2 hover:underline"
                    onClick={() => setConfirmRemove(m)}
                  >
                    Retirer
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
