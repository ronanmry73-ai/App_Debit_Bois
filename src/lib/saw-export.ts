/**
 * Export scie : CSV liste de débit (UTF-8, point-virgule, mm)
 * et DXF R12 minimal (rectangles POLYLINE + TEXT), sans dépendance.
 */

import type { Catalog } from "./catalog.ts";
import { familyById } from "./catalog.ts";
import type { PackedPanel, Placement, StrategyResult } from "./packing.ts";
import { GRAIN_LABEL } from "./piece-io.ts";
import type { GrainMode, PieceRow } from "./types.ts";

function csvCell(v: string | number): string {
  const s = String(v);
  if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function grainOf(row: PieceRow | undefined): GrainMode {
  return row?.grain === "locked" || row?.grain === "free" ? row.grain : "default";
}

function rowByDef(rows: PieceRow[], defId: string): PieceRow | undefined {
  return rows.find((r) => r.id === defId);
}

export type CsvContext = {
  rows: PieceRow[];
  catalog: Catalog;
};

export function cuttingCsv(strategy: StrategyResult, ctx: CsvContext): string {
  const header = [
    "groupe",
    "nom",
    "L",
    "l",
    "qté",
    "famille",
    "fil",
    "n°panneau",
    "x",
    "y",
    "tourné",
    "bac",
    "n°",
    "ordre",
  ];
  const lines: string[] = [header.map(csvCell).join(";")];
  for (const panel of strategy.panels) {
    const bac =
      panel.source === "offcut"
        ? panel.stockItemId || panel.label
        : panel.format;
    for (const p of panel.placements) {
      const row = rowByDef(ctx.rows, p.defId);
      const grain = grainOf(row);
      const fam = row?.familyId
        ? familyById(ctx.catalog, row.familyId)?.name ?? ""
        : panel.familyName ?? "";
      lines.push(
        [
          row?.group?.trim() ?? "",
          p.name,
          Math.round(p.rotated ? p.h : p.w),
          Math.round(p.rotated ? p.w : p.h),
          1,
          fam,
          GRAIN_LABEL[grain],
          panel.index,
          Math.round(p.x),
          Math.round(p.y),
          p.rotated ? "oui" : "non",
          bac,
          p.code ?? `${panel.index}.${(p.cutIndex ?? 0)}`,
          panel.method === "guillotine" ? String(p.cutIndex ?? "") : "libre",
        ]
          .map(csvCell)
          .join(";"),
      );
    }
  }
  if (strategy.unplaced.length > 0) {
    lines.push("");
    lines.push("non placées");
    for (const it of strategy.unplaced) {
      const row = rowByDef(ctx.rows, it.defId);
      const grain = grainOf(row);
      const fam = row?.familyId
        ? familyById(ctx.catalog, row.familyId)?.name ?? ""
        : "";
      lines.push(
        [
          row?.group?.trim() ?? "",
          it.name,
          Math.round(it.w),
          Math.round(it.h),
          1,
          fam,
          GRAIN_LABEL[grain],
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ]
          .map(csvCell)
          .join(";"),
      );
    }
  }
  return `\uFEFF${lines.join("\n")}\n`;
}

function dxfLine(code: number, value: string | number): string {
  return `${String(code).padStart(3, " ")}\n${value}\n`;
}

function dxfPolyline(x: number, y: number, w: number, h: number, layer: string): string {
  const pts: [number, number][] = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
    [x, y],
  ];
  let s = "";
  s += dxfLine(0, "POLYLINE");
  s += dxfLine(8, layer);
  s += dxfLine(66, 1);
  s += dxfLine(70, 1);
  s += dxfLine(10, 0);
  s += dxfLine(20, 0);
  s += dxfLine(30, 0);
  for (const [px, py] of pts) {
    s += dxfLine(0, "VERTEX");
    s += dxfLine(8, layer);
    s += dxfLine(10, Math.round(px * 1000) / 1000);
    s += dxfLine(20, Math.round(py * 1000) / 1000);
    s += dxfLine(30, 0);
  }
  s += dxfLine(0, "SEQEND");
  s += dxfLine(8, layer);
  return s;
}

function dxfText(
  x: number,
  y: number,
  height: number,
  text: string,
  layer: string,
): string {
  let s = "";
  s += dxfLine(0, "TEXT");
  s += dxfLine(8, layer);
  s += dxfLine(10, Math.round(x * 1000) / 1000);
  s += dxfLine(20, Math.round(y * 1000) / 1000);
  s += dxfLine(30, 0);
  s += dxfLine(40, height);
  s += dxfLine(1, text.replace(/\n/g, " "));
  return s;
}

export function panelDxf(panel: PackedPanel, originY = 0): string {
  let s = "";
  s += dxfPolyline(0, originY, panel.length, panel.width, "CONTOUR");
  s += dxfText(
    8,
    originY + panel.width + 40,
    28,
    `P${panel.index} ${panel.label}`,
    "TEXT",
  );
  for (const p of panel.placements) {
    s += dxfPolyline(p.x, originY + p.y, p.w, p.h, "PIECES");
    const label = `${p.code ?? p.name} ${Math.round(p.w)}x${Math.round(p.h)}`;
    const th = Math.max(12, Math.min(24, Math.min(p.w, p.h) * 0.12));
    s += dxfText(p.x + 6, originY + p.y + 8, th, label, "TEXT");
  }
  return s;
}

export function strategyDxf(strategy: StrategyResult): string {
  let y = 0;
  let body = "";
  for (const panel of strategy.panels) {
    body += panelDxf(panel, y);
    y += panel.width + 200;
  }
  return dxfDocument(body);
}

export function dxfDocument(entities: string): string {
  let s = "";
  s += dxfLine(0, "SECTION");
  s += dxfLine(2, "HEADER");
  s += dxfLine(9, "$INSUNITS");
  s += dxfLine(70, 4);
  s += dxfLine(0, "ENDSEC");
  s += dxfLine(0, "SECTION");
  s += dxfLine(2, "ENTITIES");
  s += entities;
  s += dxfLine(0, "ENDSEC");
  s += dxfLine(0, "EOF");
  return s;
}

export function pieceLabelRows(
  panel: PackedPanel,
  rows: PieceRow[],
): {
  name: string;
  dims: string;
  qty: number;
  panel: string;
  group: string;
  grainLocked: boolean;
  code: string;
}[] {
  const map = new Map<
    string,
    {
      name: string;
      dims: string;
      qty: number;
      panel: string;
      group: string;
      grainLocked: boolean;
      code: string;
    }
  >();
  for (const p of panel.placements) {
    const row = rowByDef(rows, p.defId);
    const dims = `${Math.round(p.rotated ? p.h : p.w)} × ${Math.round(p.rotated ? p.w : p.h)}`;
    const key = `${p.defId}|${dims}|${p.rotated ? 1 : 0}`;
    const cur = map.get(key);
    if (cur) {
      cur.qty += 1;
    } else {
      map.set(key, {
        name: p.name,
        dims: `${dims} mm`,
        qty: 1,
        panel: String(panel.index),
        group: row?.group?.trim() ?? "",
        grainLocked: grainOf(row) === "locked",
        code: p.code ?? `${panel.index}`,
      });
    }
  }
  return [...map.values()];
}

export function placementCode(panelIndex: number, p: Placement, i: number): string {
  return p.code ?? `${panelIndex}.${i + 1}`;
}
