import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emptyHardwareItem } from "@/lib/presets";
import { hardwareLines, sumHardware } from "@/lib/pricing";
import type { HardwareItem } from "@/lib/types";
import type { StockItem } from "@/lib/stock";
import { findByName } from "@/lib/stock";
import { formatEuro } from "@/lib/utils";

type Props = {
  items: HardwareItem[];
  onChange: (items: HardwareItem[]) => void;
  stock?: StockItem[];
  onEnsureStock?: (name: string, unitCost: number) => void;
};

export function HardwareList({
  items,
  onChange,
  stock = [],
  onEnsureStock,
}: Props) {
  const lines = hardwareLines(items);
  const total = sumHardware(items);
  const catalog = stock.filter(
    (s) => (s.kind === "hardware" || s.kind === "other") && s.name.trim(),
  );

  function update(id: string, patch: Partial<HardwareItem>) {
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function remove(id: string) {
    if (items.length <= 1) {
      onChange([emptyHardwareItem()]);
      return;
    }
    onChange(items.filter((it) => it.id !== id));
  }

  function pickFromStock(stockId: string) {
    const found = stock.find((s) => s.id === stockId);
    if (!found) return;
    const blank = items.find((it) => !it.name.trim());
    const row: HardwareItem = {
      id: blank?.id ?? emptyHardwareItem().id,
      name: found.name,
      qty: blank?.qty || "1",
      unitPrice: blank?.unitPrice || String(found.unitCost),
    };
    if (blank) {
      onChange(items.map((it) => (it.id === blank.id ? row : it)));
    } else {
      onChange([...items, row]);
    }
  }

  function nameChange(item: HardwareItem, name: string) {
    const found = findByName(stock, name);
    const patch: Partial<HardwareItem> = { name };
    if (found && !item.unitPrice.trim()) {
      patch.unitPrice = String(found.unitCost);
    }
    update(item.id, patch);
  }

  return (
    <section aria-labelledby="quincaillerie-title" className="no-print">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3
            id="quincaillerie-title"
            className="font-display text-base font-medium"
          >
            Quincaillerie et fournitures
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Chaque ligne : nom, quantité, prix unitaire. Le stock atelier
            s’affiche à droite.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {catalog.length > 0 && (
            <select
              className="flex h-11 rounded-md border border-input bg-card px-3 text-sm"
              defaultValue=""
              aria-label="Ajouter depuis le stock"
              onChange={(e) => {
                if (e.target.value) pickFromStock(e.target.value);
                e.target.value = "";
              }}
            >
              <option value="">Depuis le stock…</option>
              {catalog.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name} ({it.qty})
                </option>
              ))}
            </select>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => onChange([...items, emptyHardwareItem()])}
          >
            <Plus />
            Ajouter un article
          </Button>
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/60 text-left text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">Article</th>
              <th className="w-24 px-3 py-2.5 font-medium">Qté</th>
              <th className="w-32 px-3 py-2.5 font-medium">Prix unit.</th>
              <th className="w-32 px-3 py-2.5 font-medium">Sous-total</th>
              <th className="w-36 px-3 py-2.5 font-medium">Stock</th>
              <th className="w-12 px-3 py-2.5">
                <span className="sr-only">Supprimer</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id} className="border-b border-border last:border-0">
                <td className="px-2 py-1.5">
                  <Input
                    aria-label="Nom de l’article"
                    placeholder="Charnières, poignées…"
                    value={item.name}
                    onChange={(e) => nameChange(item, e.target.value)}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    aria-label="Quantité"
                    className="tabular-nums"
                    inputMode="decimal"
                    value={item.qty}
                    onChange={(e) =>
                      update(item.id, {
                        qty: e.target.value.replace(/[^\d.,]/g, ""),
                      })
                    }
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    aria-label="Prix unitaire"
                    className="tabular-nums"
                    inputMode="decimal"
                    value={item.unitPrice}
                    onChange={(e) =>
                      update(item.id, {
                        unitPrice: e.target.value.replace(/[^\d.,]/g, ""),
                      })
                    }
                  />
                </td>
                <td className="px-3 py-1.5 tabular-nums font-medium">
                  {formatEuro(lines[i]?.subtotal ?? 0)}
                </td>
                <td className="px-3 py-1.5 text-xs tabular-nums text-muted-foreground">
                  <StockCell
                    stock={stock}
                    name={item.name}
                    needed={lines[i]?.qty ?? 0}
                    unitPrice={lines[i]?.unitPrice ?? 0}
                    onEnsureStock={onEnsureStock}
                  />
                </td>
                <td className="px-1 py-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Supprimer l’article"
                    onClick={() => remove(item.id)}
                  >
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/60">
              <td colSpan={3} className="px-3 py-2.5 text-sm text-muted-foreground">
                Total quincaillerie
              </td>
              <td className="px-3 py-2.5 font-medium tabular-nums" colSpan={2}>
                {formatEuro(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {items.map((item, i) => (
          <li
            key={item.id}
            className="rounded-lg border border-border bg-card p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <Label className="sr-only" htmlFor={`hn-${item.id}`}>
                Article
              </Label>
              <Input
                id={`hn-${item.id}`}
                placeholder="Nom de l’article"
                value={item.name}
                onChange={(e) => nameChange(item, e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Supprimer l’article"
                onClick={() => remove(item.id)}
              >
                <Trash2 />
              </Button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor={`hq-${item.id}`}>Quantité</Label>
                <Input
                  id={`hq-${item.id}`}
                  className="mt-1 tabular-nums"
                  inputMode="decimal"
                  value={item.qty}
                  onChange={(e) =>
                    update(item.id, {
                      qty: e.target.value.replace(/[^\d.,]/g, ""),
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor={`hp-${item.id}`}>Prix unit. (€)</Label>
                <Input
                  id={`hp-${item.id}`}
                  className="mt-1 tabular-nums"
                  inputMode="decimal"
                  value={item.unitPrice}
                  onChange={(e) =>
                    update(item.id, {
                      unitPrice: e.target.value.replace(/[^\d.,]/g, ""),
                    })
                  }
                />
              </div>
            </div>
            <p className="mt-2 text-sm tabular-nums">
              Sous-total {formatEuro(lines[i]?.subtotal ?? 0)}{" "}
              <StockCell
                stock={stock}
                name={item.name}
                needed={lines[i]?.qty ?? 0}
                unitPrice={lines[i]?.unitPrice ?? 0}
                onEnsureStock={onEnsureStock}
              />
            </p>
          </li>
        ))}
        <li className="rounded-lg bg-muted/70 px-3 py-2 text-sm font-medium tabular-nums">
          Total quincaillerie {formatEuro(total)}
        </li>
      </ul>
    </section>
  );
}

function StockCell({
  stock,
  name,
  needed,
  unitPrice,
  onEnsureStock,
}: {
  stock: StockItem[];
  name: string;
  needed: number;
  unitPrice: number;
  onEnsureStock?: (name: string, unitCost: number) => void;
}) {
  const found = findByName(stock, name);
  if (!name.trim()) return null;
  if (!found) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        hors stock
        {onEnsureStock && (
          <button
            type="button"
            className="text-primary underline-offset-2 hover:underline"
            onClick={() => onEnsureStock(name, unitPrice)}
          >
            créer
          </button>
        )}
      </span>
    );
  }
  if (needed > 0 && found.qty < needed) {
    return <span>stock {found.qty} (manque {needed - found.qty})</span>;
  }
  return <span>stock {found.qty}</span>;
}
