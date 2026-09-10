import { PANEL_SPECS, type PackedPanel, type Placement } from "@/lib/packing";
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
  return `${p.name} ${dims}${rot}`;
}

export function CuttingPlan({
  panel,
  kerf,
}: {
  panel: PackedPanel;
  kerf: number;
}) {
  const pad = 56;
  const viewW = panel.length + pad * 2;
  const viewH = panel.width + pad * 2;
  const spec = PANEL_SPECS[panel.format];
  const hatchId = `hatch-${panel.id}`;

  return (
    <article className="print-break rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-base font-medium">
          Panneau {panel.index} · {spec.label}
        </h3>
        <p className="text-sm tabular-nums text-muted-foreground">
          {panel.placements.length} pièce{panel.placements.length > 1 ? "s" : ""} · chute{" "}
          <span className="font-medium text-foreground">
            {formatPct(panel.wastePercent)}
          </span>
          <span className="mx-1.5 text-border">·</span>
          {panel.method === "guillotine" ? "guillotine" : "rect. max."}
        </p>
      </header>

      <div className="overflow-x-auto rounded-md bg-muted/50">
        <div className="w-full min-w-2xl">
          <svg
            viewBox={`0 0 ${viewW} ${viewH}`}
            role="img"
            aria-label={`Plan de découpe du panneau ${panel.index} ${spec.label}`}
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
            {panel.placements.map((p) => (
              <PieceRect
                key={p.instanceId}
                placement={p}
                fill={colorFor(p.defId)}
                kerf={kerf}
              />
            ))}
          </g>
        </svg>
        </div>
      </div>

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
    </article>
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
}: {
  placement: Placement;
  fill: string;
  kerf: number;
}) {
  const tooSmall = p.w < 180 || p.h < 70;
  const fontSize = Math.max(14, Math.min(28, Math.min(p.w, p.h) * 0.18));
  const gap = kerf > 0 ? Math.min(kerf, 2) : 0;

  return (
    <g>
      <title>{labelFor(p)}</title>
      <rect
        x={p.x + gap / 2}
        y={p.y + gap / 2}
        width={Math.max(0, p.w - gap)}
        height={Math.max(0, p.h - gap)}
        fill={fill}
        stroke="#1a1814"
        strokeWidth={1.5}
        rx={3}
      />
      {!tooSmall && (
        <>
          <text
            x={p.x + p.w / 2}
            y={p.y + p.h / 2 - fontSize * 0.15}
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
            y={p.y + p.h / 2 + fontSize * 0.95}
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
          {Math.round(p.w)}×{Math.round(p.h)}
        </text>
      )}
    </g>
  );
}

export function CuttingPlanList({
  panels,
  kerf,
}: {
  panels: PackedPanel[];
  kerf: number;
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
        <CuttingPlan key={panel.id} panel={panel} kerf={kerf} />
      ))}
    </div>
  );
}
