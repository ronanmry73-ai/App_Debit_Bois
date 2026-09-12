/**
 * Saisie tableur du débit : collage TSV/CSV, fil, groupes, migration des pièces.
 */

import { emptyRow } from "./presets.ts";
import type { GrainMode, PieceRow } from "./types.ts";
import { newId } from "./utils.ts";

export const GRAIN_LABEL: Record<GrainMode, string> = {
  default: "Job",
  locked: "Imposé",
  free: "Libre",
};

export function pieceCanRotate(
  grain: GrainMode | undefined,
  jobAllow: boolean,
): boolean {
  if (grain === "locked") return false;
  if (grain === "free") return true;
  return jobAllow;
}

export function migratePieceRow(raw: Partial<PieceRow> | null | undefined): PieceRow {
  const r = raw ?? {};
  const grain: GrainMode =
    r.grain === "locked" || r.grain === "free" ? r.grain : "default";
  return {
    id: typeof r.id === "string" && r.id ? r.id : newId(),
    name: String(r.name ?? ""),
    length: String(r.length ?? ""),
    width: String(r.width ?? ""),
    qty: String(r.qty ?? "1"),
    familyId: typeof r.familyId === "string" ? r.familyId : "",
    grain,
    group: typeof r.group === "string" ? r.group : "",
  };
}

export function migratePieceRows(rows: unknown): PieceRow[] {
  if (!Array.isArray(rows) || rows.length === 0) return [emptyRow()];
  return rows.map((r) => migratePieceRow(r as Partial<PieceRow>));
}

export function rowHasContent(row: PieceRow): boolean {
  const qty = String(row.qty ?? "").trim();
  return (
    String(row.name ?? "").trim() !== "" ||
    String(row.length ?? "").trim() !== "" ||
    String(row.width ?? "").trim() !== "" ||
    (qty !== "" && qty !== "1") ||
    String(row.familyId ?? "").trim() !== "" ||
    String(row.group ?? "").trim() !== "" ||
    (row.grain != null && row.grain !== "default")
  );
}

export function parseNumLoose(s: string): number {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export type GroupBucket = {
  key: string;
  label: string;
  rows: PieceRow[];
  qty: number;
  areaMm2: number;
};

export function groupPieceRows(rows: PieceRow[]): GroupBucket[] {
  const order: string[] = [];
  const map = new Map<string, PieceRow[]>();
  for (const r of rows) {
    const key = String(r.group ?? "").trim();
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(r);
  }
  return order.map((key) => {
    const list = map.get(key)!;
    let qty = 0;
    let areaMm2 = 0;
    for (const r of list) {
      const q = Math.max(0, Math.floor(parseNumLoose(r.qty)));
      const l = parseNumLoose(r.length);
      const w = parseNumLoose(r.width);
      qty += q;
      areaMm2 += l * w * q;
    }
    return {
      key,
      label: key || "Sans groupe",
      rows: list,
      qty,
      areaMm2,
    };
  });
}

export function uniqueGroups(rows: PieceRow[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    const g = String(r.group ?? "").trim();
    if (!g || seen.has(g)) continue;
    seen.add(g);
    out.push(g);
  }
  return out;
}

export type ParsedPasteRow = {
  name: string;
  length: string;
  width: string;
  qty: string;
  family: string;
  group: string;
  grain: GrainMode;
};

export type PasteColumn =
  | "name"
  | "length"
  | "width"
  | "qty"
  | "family"
  | "group"
  | "grain";

const HEADER_ALIASES: Record<string, PasteColumn> = {
  nom: "name",
  name: "name",
  pièce: "name",
  piece: "name",
  libellé: "name",
  libelle: "name",
  longueur: "length",
  long: "length",
  l: "length",
  "longueur (mm)": "length",
  "long. (mm)": "length",
  largeur: "width",
  larg: "width",
  "largeur (mm)": "width",
  qté: "qty",
  qte: "qty",
  qty: "qty",
  quantité: "qty",
  quantite: "qty",
  famille: "family",
  family: "family",
  groupe: "group",
  ensemble: "group",
  sousensemble: "group",
  "sous-ensemble": "group",
  group: "group",
  fil: "grain",
  grain: "grain",
  rotation: "grain",
};

const DEFAULT_ORDER: PasteColumn[] = [
  "name",
  "length",
  "width",
  "qty",
  "family",
  "group",
  "grain",
];

export function parseGrainCell(raw: string): GrainMode {
  const s = raw.trim().toLowerCase();
  if (!s) return "default";
  if (
    ["oui", "imposé", "impose", "1", "locked", "true", "fil", "yes"].includes(s)
  ) {
    return "locked";
  }
  if (["libre", "free", "rotation"].includes(s)) return "free";
  return "default";
}

function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
  if (first.includes("\t")) return "\t";
  const semi = (first.match(/;/g) ?? []).length;
  const comma = (first.match(/,/g) ?? []).length;
  if (semi >= 1 && semi >= comma) return ";";
  if (comma >= 1) return ",";
  return "\t";
}

function splitDelimited(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQ = !inQ;
      }
    } else if (c === delim && !inQ) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

function normalizeHeader(cell: string): string {
  return cell
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function headerColumns(cells: string[]): PasteColumn[] | null {
  const mapped = cells.map((c) => HEADER_ALIASES[normalizeHeader(c)]);
  const hits = mapped.filter(Boolean).length;
  if (hits < 2) return null;
  return mapped.map((m, i) => m ?? DEFAULT_ORDER[i] ?? "name");
}

export function looksLikeTablePaste(text: string): boolean {
  const t = text.replace(/^\uFEFF/, "");
  if (!t.trim()) return false;
  if (t.includes("\t")) return true;
  if (/\r?\n/.test(t.trim())) return true;
  const first = t.split(/\r?\n/)[0] ?? "";
  if ((first.match(/;/g) ?? []).length >= 3) return true;
  if ((first.match(/,/g) ?? []).length >= 3) return true;
  return false;
}

export function parsePiecePaste(text: string): ParsedPasteRow[] {
  const raw = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = raw.split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  const delim = detectDelimiter(raw);
  const rows = lines.map((l) => splitDelimited(l, delim));
  let cols: PasteColumn[] = DEFAULT_ORDER.slice(0, Math.max(rows[0]!.length, 4));
  const maybeHeader = headerColumns(rows[0]!);
  let start = 0;
  if (maybeHeader) {
    cols = maybeHeader;
    start = 1;
  }
  const out: ParsedPasteRow[] = [];
  for (const cells of rows.slice(start)) {
    if (cells.every((c) => c.trim() === "")) continue;
    const get = (key: PasteColumn) => {
      const i = cols.indexOf(key);
      return i >= 0 ? (cells[i] ?? "") : "";
    };
    const qtyRaw = get("qty").trim();
    out.push({
      name: get("name"),
      length: get("length").replace(/[^\d.,]/g, ""),
      width: get("width").replace(/[^\d.,]/g, ""),
      qty: qtyRaw ? qtyRaw.replace(/[^\d]/g, "") : "1",
      family: get("family"),
      group: get("group"),
      grain: parseGrainCell(get("grain")),
    });
  }
  return out;
}

export function applyPiecePaste(input: {
  rows: PieceRow[];
  startIndex: number;
  parsed: ParsedPasteRow[];
  familyIdByName: (name: string) => string;
}): PieceRow[] {
  const { parsed, familyIdByName } = input;
  if (parsed.length === 0) return input.rows;
  const start = Math.max(0, Math.min(input.startIndex, input.rows.length));
  const next = input.rows.map(migratePieceRow);
  while (next.length < start + parsed.length) next.push(emptyRow());
  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i]!;
    const prev = next[start + i]!;
    next[start + i] = {
      ...prev,
      id: prev.id || newId(),
      name: p.name,
      length: p.length,
      width: p.width,
      qty: p.qty || "1",
      familyId: p.family ? familyIdByName(p.family) : "",
      group: p.group,
      grain: p.grain,
    };
  }
  return next;
}
