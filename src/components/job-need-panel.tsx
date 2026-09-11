import { Package, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { Catalog, PanelSpec } from "@/lib/catalog";
import {
  consumeForJob,
  hasShortage,
  planDeduction,
  restoreDeduction,
  toOrder,
  type JobNeed,
  type StockDeduction,
  type StockItem,
  type StockMove,
} from "@/lib/stock";

type Props = {
  need: JobNeed | null;
  items: StockItem[];
  moves: StockMove[];
  catalog: Catalog;
  specs: PanelSpec[];
  quoteNumber: string;
  projectId: string | null;
  projectName: string;
  deduction: StockDeduction | null;
  onStock: (items: StockItem[], moves: StockMove[]) => void;
  onDeduction: (d: StockDeduction | null) => void;
};

function areaLabel(n: number): string {
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
}

export function JobNeedPanel({
  need,
  items,
  moves,
  catalog,
  specs,
  quoteNumber,
  projectId,
  projectName,
  deduction,
  onStock,
  onDeduction,
}: Props) {
  const [phase, setPhase] = useState<"idle" | "confirm" | "undo">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const plan = useMemo(
    () => (need ? planDeduction(items, need, specs, catalog) : []),
    [need, items, specs, catalog],
  );
  if (!need || plan.length === 0) return null;

  const shortage = hasShortage(
    plan.map((p) => ({
      key: p.name,
      itemId: p.itemId,
      name: p.name,
      needed: p.needed,
      onHand: p.onHand,
      gap: p.gap,
    })),
  );
  const order = toOrder(
    plan.map((p) => ({
      key: p.name,
      itemId: p.itemId,
      name: p.name,
      needed: p.needed,
      onHand: p.onHand,
      gap: p.gap,
    })),
  );
  const already = !!deduction;

  function runDeduct(partial: boolean) {
    const out = consumeForJob(items, moves, need!, quoteNumber, partial, {
      projectId: projectId ?? "",
      projectName,
      specs,
      catalog,
    });
    if (!out.ok) {
      setMessage("Stock insuffisant. Confirmez une sortie partielle, ou commandez le manque.");
      setPhase("idle");
      return;
    }
    onStock(out.items, out.moves);
    if (out.deduction) onDeduction(out.deduction);
    setPhase("idle");
    setMessage(
      partial
        ? "Sortie partielle enregistrée. Le projet conserve l’historique."
        : `Stock déduit pour ${projectName || quoteNumber || "le chantier"}.`,
    );
  }

  function runUndo() {
    if (!deduction) return;
    const out = restoreDeduction(items, moves, deduction);
    if (!out.ok) {
      setMessage(out.error ?? "Impossible d’annuler la déduction.");
      setPhase("idle");
      return;
    }
    onStock(out.items, out.moves);
    onDeduction(null);
    setPhase("idle");
    setMessage("Déduction annulée. Les quantités sont revenues en stock.");
  }

  return (
    <section aria-labelledby="chantier-title" className="no-print">
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="chantier-title"
              className="font-display text-xl font-medium tracking-tight"
            >
              Besoin du chantier
            </h2>
            {already ? (
              <Badge variant="good">Stock déjà déduit</Badge>
            ) : shortage ? (
              <Badge variant="warn">Manque</Badge>
            ) : (
              <Badge variant="good">Couvert par le stock</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Déduction sur le stock atelier global. Une seule déduction par projet,
            pour éviter un double retrait.
          </p>

          <ul className="mt-4 space-y-1.5 text-sm">
            {plan.map((l) => (
              <li
                key={`${l.specId ?? l.name}-${l.name}`}
                className="flex flex-wrap items-baseline justify-between gap-2"
              >
                <span>
                  {l.name}
                  {l.familyName ? ` · ${l.familyName}` : ""}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  besoin {l.needed} · stock {l.onHand}
                  {l.areaM2 > 0 ? ` · ${areaLabel(l.areaM2)}` : ""}
                  {l.gap > 0 ? ` · manque ${l.gap}` : ""}
                </span>
              </li>
            ))}
          </ul>
          {order.length > 0 && (
            <p className="mt-2 text-sm text-warn">
              À commander : {order.map((o) => `${o.name} ×${o.qty}`).join(", ")}
            </p>
          )}

          {already && deduction && (
            <p className="mt-3 text-sm text-muted-foreground">
              Déduit le{" "}
              {new Date(deduction.date).toLocaleString("fr-FR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {deduction.partial ? " (partiel)" : ""}
              {deduction.quoteNumber ? ` · ${deduction.quoteNumber}` : ""}
              {" · "}
              {deduction.lines
                .map((l) => `${l.name} −${l.qty}`)
                .join(", ")}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => setPhase("confirm")}
              disabled={already}
            >
              <Package />
              Déduire du stock
            </Button>
            {already && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setPhase("undo")}
              >
                <Undo2 />
                Annuler la déduction
              </Button>
            )}
          </div>
          {already && (
            <p className="mt-2 text-xs text-muted-foreground">
              Une nouvelle déduction n’est possible qu’après avoir annulé celle-ci.
            </p>
          )}
          {message && <p className="mt-3 text-sm text-ink-soft">{message}</p>}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={phase === "confirm"}
        wide
        title="Confirmer la déduction"
        message={
          shortage
            ? "Le stock est insuffisant sur au moins une référence. Aucune quantité différente ne sera déduite en silence."
            : "Les quantités suivantes seront retirées du stock atelier global."
        }
        actions={[
          {
            label: "Annuler",
            variant: "ghost",
            onClick: () => setPhase("idle"),
          },
          ...(shortage
            ? [
                {
                  label: "Sortir le disponible",
                  variant: "outline" as const,
                  onClick: () => runDeduct(true),
                },
              ]
            : []),
          {
            label: shortage ? "Impossible en totalité" : "Confirmer la déduction",
            onClick: () => runDeduct(false),
            disabled: shortage,
          },
        ]}
      >
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/60 text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">Référence</th>
                <th className="px-3 py-2 font-medium">Famille</th>
                <th className="px-3 py-2 font-medium">À retirer</th>
                <th className="px-3 py-2 font-medium">Stock</th>
                <th className="px-3 py-2 font-medium">Après</th>
                <th className="px-3 py-2 font-medium">Surface</th>
              </tr>
            </thead>
            <tbody>
              {plan.map((l) => (
                <tr key={`${l.specId ?? l.name}`} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">{l.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {l.familyName || "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{l.needed}</td>
                  <td className="px-3 py-2 tabular-nums">{l.onHand}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {shortage ? `${l.afterPartial} (partiel)` : l.afterFull}
                    {l.gap > 0 ? ` · manque ${l.gap}` : ""}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {l.areaM2 > 0 ? areaLabel(l.areaM2) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={phase === "undo"}
        title="Annuler la déduction"
        message="Les quantités déduites seront réintégrées au stock atelier. Confirmez seulement si le stock n’a pas été consommé ailleurs entre-temps."
        actions={[
          {
            label: "Conserver la déduction",
            variant: "ghost",
            onClick: () => setPhase("idle"),
          },
          {
            label: "Remettre en stock",
            onClick: runUndo,
          },
        ]}
      />
    </section>
  );
}
