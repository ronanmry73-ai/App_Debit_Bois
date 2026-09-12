import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { FreeRect, OccupiedRect, PackedPanel, Placement } from "@/lib/packing";
import { stockableLeftovers } from "@/lib/packing";
import { formatPct, cn } from "@/lib/utils";

const FILLS = [
  "#c4b49a",
  "#9aa392",
  "#8a9aa8",
  "#b79a8c",
  "#7e8f86",
  "#a89880",
  "#8d8074",
  "#6f7f8c",
];

function colorFor(defId: string): string {
  let h = 0;
  for (let i = 0; i < defId.length; i++) h = (h * 31 + defId.charCodeAt(i)) | 0;
  return FILLS[Math.abs(h) % FILLS.length]!;
}

function labelFor(p: Placement): string {
  const dims = `${Math.round(p.rotated ? p.h : p.w)}×${Math.round(p.rotated ? p.w : p.h)}`;
  const rot = p.rotated ? " ↻" : "";
  const code = p.code ? `${p.code} · ` : "";
  return `${code}${p.name} ${dims}${rot}`;
}

function leftoverKey(panelIndex: number, r: FreeRect): string {
  return `${panelIndex}:${Math.round(r.w)}x${Math.round(r.h)}@${Math.round(r.x)},${Math.round(r.y)}`;
}

export type PlanActions = {
  onStockOffcut?: (panel: PackedPanel, rect: FreeRect) => void;
  stockedKeys?: Set<string>;
  onSwap?: (
    panelId: string,
    a: string,
    b: string,
  ) => { ok: true } | { ok: false; reason: string };
  onUndoSwap?: () => void;
  canUndoSwap?: boolean;
  onLockLeftover?: (panelId: string, rect: OccupiedRect) => void;
  onUnlockLeftover?: (panelId: string, rect: OccupiedRect) => void;
  onRecalcPanel?: (panelId: string) => void;
  interactive?: boolean;
};

export function CuttingPlan({
  panel,
  kerf,
  actions,
}: {
  panel: PackedPanel;
  kerf: number;
  actions?: PlanActions;
}) {
  const pad = 56;
  const viewW = panel.length + pad * 2;
  const viewH = panel.width + pad * 2;
  const specLabel = panel.label || `${panel.length} × ${panel.width} mm`;
  const hatchId = `hatch-${panel.id}`;
  const leftover = stockableLeftovers(panel, kerf);
  const locked = panel.lockedRects ?? [];
  const guillotine = panel.method === "guillotine";
  const source =
    panel.source === "offcut" ? "chute stock" : "feuille";

  return (
    <article className="print-page print-break rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-base font-medium">
          Panneau {panel.index} · {specLabel}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {source}
          </span>
        </h3>
        <p className="text-sm tabular-nums text-muted-foreground">
          {panel.placements.length} pièce{panel.placements.length > 1 ? "s" : ""} · chute{" "}
          <span className="font-medium text-foreground">
            {formatPct(panel.wastePercent)}
          </span>
          <span className="mx-1.5 text-border">·</span>
          {guillotine ? "guillotine · ordre de coupe" : "rect. max. · ordre libre — pas guillotine"}
        </p>
      </header>

      <div className="overflow-x-auto rounded-md bg-muted/50">
        <div className="w-full min-w-2xl">
          <svg
            viewBox={`0 0 ${viewW} ${viewH}`}
            role="img"
            aria-label={`Plan de découpe du panneau ${panel.index} ${specLabel}`}
            className="block h-auto w-full"
          >
          <defs>
            <pattern
              id={hatchId}
              width="28"
              height="28"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="28"
                stroke="#cfc6b8"
                strokeWidth="8"
              />
            </pattern>
          </defs>

          <text
            x={pad + panel.length / 2}
            y={20}
            textAnchor="middle"
            fill="#6b6560"
            fontSize="22"
            fontFamily="Source Sans 3, sans-serif"
          >
            {panel.length} mm
          </text>
          <text
            x={18}
            y={pad + panel.width / 2}
            textAnchor="middle"
            fill="#6b6560"
            fontSize="22"
            fontFamily="Source Sans 3, sans-serif"
            transform={`rotate(-90 18 ${pad + panel.width / 2})`}
          >
            {panel.width} mm
          </text>

          <g transform={`translate(${pad} ${pad})`}>
            <rect
              x={0}
              y={0}
              width={panel.length}
              height={panel.width}
              fill={`url(#${hatchId})`}
              stroke="#1a1814"
              strokeWidth={2}
            />
            {leftover.map((r) => (
              <g key={`lo-${r.x}-${r.y}-${r.w}-${r.h}`}>
                {r.w >= 120 && r.h >= 40 && (
                  <text
                    x={r.x + r.w / 2}
                    y={r.y + r.h / 2 + 6}
                    textAnchor="middle"
                    fill="#6b6560"
                    fontSize={Math.max(14, Math.min(22, Math.min(r.w, r.h) * 0.12))}
                    fontFamily="Source Sans 3, sans-serif"
                  >
                    chute {Math.round(r.w)} × {Math.round(r.h)}
                  </text>
                )}
              </g>
            ))}
            {locked.map((r) => (
              <rect
                key={`lk-${r.x}-${r.y}`}
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
                fill="none"
                stroke="#8a5a3a"
                strokeWidth={3}
                strokeDasharray="12 8"
              />
            ))}
            {panel.placements.map((p, i) => (
              <PieceRect
                key={p.instanceId}
                placement={p}
                fill={colorFor(p.defId)}
                kerf={kerf}
                index={i}
                guillotine={guillotine}
                selected={false}
                selectable={false}
              />
            ))}
          </g>
        </svg>
        </div>
      </div>

      {actions?.interactive && (
        <InteractivePlan
          panel={panel}
          leftover={leftover}
          locked={locked}
          actions={actions}
        />
      )}

      <ul className="mt-3 flex flex-wrap gap-2">
        {uniqueDefs(panel.placements).map((p) => (
          <li
            key={p.defId}
            className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-1 text-xs text-foreground"
          >
            <span
              className="size-2.5 rounded-sm"
              style={{ backgroundColor: colorFor(p.defId) }}
              aria-hidden
            />
            {p.name}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
          <span className="size-2.5 rounded-sm bg-waste ring-1 ring-border" aria-hidden />
          Chute
        </li>
      </ul>

      <PanelLabels panel={panel} />
    </article>
  );
}

function InteractivePlan({
  panel,
  leftover,
  locked,
  actions,
}: {
  panel: PackedPanel;
  leftover: FreeRect[];
  locked: OccupiedRect[];
  actions: PlanActions;
}) {
  const [pick, setPick] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function clickPiece(id: string) {
    if (!actions.onSwap) return;
    if (!pick || pick === id) {
      setPick(pick === id ? null : id);
      setMsg(pick === id ? null : "Choisissez la deuxième pièce à échanger.");
      return;
    }
    const res = actions.onSwap(panel.id, pick, id);
    if (!res.ok) {
      setMsg(res.reason);
    } else {
      setMsg("Pièces échangées.");
    }
    setPick(null);
  }

  return (
    <div className="no-print mt-3 space-y-3">
      {actions.onSwap && (
        <div>
          <p className="text-xs text-muted-foreground">
            Cliquez deux pièces du même panneau pour les échanger si les
            rectangles le permettent.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {panel.placements.map((p) => (
              <button
                key={p.instanceId}
                type="button"
                onClick={() => clickPiece(p.instanceId)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs",
                  pick === p.instanceId
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
                )}
              >
                {p.code ?? p.name} · {Math.round(p.w)}×{Math.round(p.h)}
              </button>
            ))}
            {actions.canUndoSwap && actions.onUndoSwap && (
              <Button type="button" variant="ghost" size="sm" onClick={actions.onUndoSwap}>
                Annuler l’échange
              </Button>
            )}
          </div>
          {msg && <p className="mt-1 text-xs text-ink-soft">{msg}</p>}
        </div>
      )}

      {(leftover.length > 0 || locked.length > 0) && (
        <div>
          <p className="text-xs font-medium">Chutes du plan</p>
          <ul className="mt-1.5 space-y-1.5">
            {leftover.map((r) => {
              const key = leftoverKey(panel.index, r);
              const already = actions.stockedKeys?.has(key) || actions.stockedKeys?.has(
                `${panel.index}:${Math.round(r.w)}x${Math.round(r.h)}`,
              );
              return (
                <li
                  key={key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/70 px-3 py-2 text-sm"
                >
                  <span className="tabular-nums">
                    {Math.round(r.w)} × {Math.round(r.h)} mm
                  </span>
                  <span className="flex flex-wrap gap-2">
                    {actions.onStockOffcut && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={already}
                        onClick={() => actions.onStockOffcut?.(panel, r)}
                      >
                        {already ? "Déjà en stock" : "Mettre en stock"}
                      </Button>
                    )}
                    {actions.onLockLeftover && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          actions.onLockLeftover?.(panel.id, {
                            x: r.x,
                            y: r.y,
                            w: r.w,
                            h: r.h,
                          })
                        }
                      >
                        Ne plus y placer de pièce
                      </Button>
                    )}
                  </span>
                </li>
              );
            })}
            {locked.map((r, i) => (
              <li
                key={`locked-${i}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm"
              >
                <span className="tabular-nums text-muted-foreground">
                  Verrouillée {Math.round(r.w)} × {Math.round(r.h)} mm
                </span>
                <span className="flex gap-2">
                  {actions.onStockOffcut && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        actions.onStockOffcut?.(panel, {
                          x: r.x,
                          y: r.y,
                          w: r.w,
                          h: r.h,
                        })
                      }
                    >
                      Mettre en stock
                    </Button>
                  )}
                  {actions.onUnlockLeftover && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => actions.onUnlockLeftover?.(panel.id, r)}
                    >
                      Libérer
                    </Button>
                  )}
                  {actions.onRecalcPanel && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => actions.onRecalcPanel?.(panel.id)}
                    >
                      Recalculer ce panneau
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PanelLabels({ panel }: { panel: PackedPanel }) {
  if (panel.placements.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Étiquettes
      </p>
      <table className="quote-table mt-1 w-full text-xs">
        <thead>
          <tr>
            <th>n°</th>
            <th>Nom</th>
            <th>L × l</th>
            <th>Ordre</th>
          </tr>
        </thead>
        <tbody>
          {panel.placements.map((p, i) => (
            <tr key={p.instanceId}>
              <td className="tabular-nums">{p.code ?? `${panel.index}.${i + 1}`}</td>
              <td>{p.name}</td>
              <td className="tabular-nums">
                {Math.round(p.w)} × {Math.round(p.h)} mm
                {p.rotated ? " ↻" : ""}
              </td>
              <td>
                {panel.method === "guillotine"
                  ? p.cutIndex ?? i + 1
                  : "libre"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function uniqueDefs(placements: Placement[]): { defId: string; name: string }[] {
  const map = new Map<string, string>();
  for (const p of placements) {
    if (!map.has(p.defId)) map.set(p.defId, p.name);
  }
  return [...map.entries()].map(([defId, name]) => ({ defId, name }));
}

function PieceRect({
  placement: p,
  fill,
  kerf,
  index,
  guillotine,
  selected,
  selectable,
  onSelect,
}: {
  placement: Placement;
  fill: string;
  kerf: number;
  index: number;
  guillotine: boolean;
  selected: boolean;
  selectable: boolean;
  onSelect?: () => void;
}) {
  const tooSmall = p.w < 180 || p.h < 70;
  const fontSize = Math.max(14, Math.min(28, Math.min(p.w, p.h) * 0.18));
  const gap = kerf > 0 ? Math.min(kerf, 2) : 0;
  const code = p.code ?? String(index + 1);

  return (
    <g
      onClick={selectable ? onSelect : undefined}
      style={{ cursor: selectable ? "pointer" : undefined }}
    >
      <title>{labelFor(p)}</title>
      <rect
        x={p.x + gap / 2}
        y={p.y + gap / 2}
        width={Math.max(0, p.w - gap)}
        height={Math.max(0, p.h - gap)}
        fill={fill}
        stroke={selected ? "#1a1814" : "#1a1814"}
        strokeWidth={selected ? 3 : 1.5}
        rx={3}
      />
      {guillotine && p.w >= 36 && p.h >= 36 && (
        <text
          x={p.x + 10}
          y={p.y + 22}
          fill="#1a1814"
          fontSize={16}
          fontFamily="Source Sans 3, sans-serif"
          fontWeight={700}
        >
          {p.cutIndex ?? index + 1}
        </text>
      )}
      {!tooSmall && (
        <>
          <text
            x={p.x + p.w / 2}
            y={p.y + p.h / 2 - fontSize * 0.55}
            textAnchor="middle"
            fill="#1a1814"
            fontSize={fontSize * 0.72}
            fontFamily="Source Sans 3, sans-serif"
          >
            {code}
          </text>
          <text
            x={p.x + p.w / 2}
            y={p.y + p.h / 2 + fontSize * 0.2}
            textAnchor="middle"
            fill="#1a1814"
            fontSize={fontSize}
            fontFamily="Source Sans 3, sans-serif"
            fontWeight={600}
          >
            {p.name}
          </text>
          <text
            x={p.x + p.w / 2}
            y={p.y + p.h / 2 + fontSize * 1.15}
            textAnchor="middle"
            fill="#3f3a35"
            fontSize={fontSize * 0.78}
            fontFamily="Source Sans 3, sans-serif"
          >
            {Math.round(p.w)} × {Math.round(p.h)}
            {p.rotated ? " ↻" : ""}
          </text>
        </>
      )}
      {tooSmall && p.w >= 80 && (
        <text
          x={p.x + p.w / 2}
          y={p.y + p.h / 2 + 5}
          textAnchor="middle"
          fill="#1a1814"
          fontSize={Math.min(18, p.h * 0.4)}
          fontFamily="Source Sans 3, sans-serif"
        >
          {code} {Math.round(p.w)}×{Math.round(p.h)}
        </text>
      )}
    </g>
  );
}

export function CuttingPlanList({
  panels,
  kerf,
  actions,
}: {
  panels: PackedPanel[];
  kerf: number;
  actions?: PlanActions;
}) {
  if (panels.length === 0) {
    return (
      <p className="rounded-xl bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-border)]">
        Aucun panneau à afficher pour cette stratégie.
      </p>
    );
  }
  return (
    <div className={cn("flex flex-col gap-4")}>
      {panels.map((panel) => (
        <CuttingPlan key={panel.id} panel={panel} kerf={kerf} actions={actions} />
      ))}
    </div>
  );
}

export { leftoverKey };
