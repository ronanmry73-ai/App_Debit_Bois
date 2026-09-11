/**
 * Familles et références de panneaux — données locales, jamais figées dans le code.
 *
 * Les deux formats d’origine (2500×400 et 2500×600) sont semés une fois,
 * puis l’utilisateur ajoute / modifie / désactive le reste.
 */

import { newId } from "./utils.ts";

export const DEFAULT_FAMILY_ID = "fam-standard";
export const REF_A_ID = "A";
export const REF_B_ID = "B";

export type PanelFamily = {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PanelRef = {
  id: string;
  familyId: string;
  name: string;
  length: number;
  width: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Catalog = {
  families: PanelFamily[];
  refs: PanelRef[];
};

export type PanelSpec = {
  id: string;
  length: number;
  width: number;
  label: string;
  familyId: string;
  familyName: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

export function normalizeKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function seedCatalog(): Catalog {
  const t = "2024-01-01T00:00:00.000Z";
  return {
    families: [
      {
        id: DEFAULT_FAMILY_ID,
        name: "Standard",
        active: true,
        createdAt: t,
        updatedAt: t,
      },
    ],
    refs: [
      {
        id: REF_A_ID,
        familyId: DEFAULT_FAMILY_ID,
        name: "P-400",
        length: 2500,
        width: 400,
        active: true,
        createdAt: t,
        updatedAt: t,
      },
      {
        id: REF_B_ID,
        familyId: DEFAULT_FAMILY_ID,
        name: "P-600",
        length: 2500,
        width: 600,
        active: true,
        createdAt: t,
        updatedAt: t,
      },
    ],
  };
}

export function familyById(
  catalog: Catalog,
  id: string,
): PanelFamily | undefined {
  return catalog.families.find((f) => f.id === id);
}

export function refById(catalog: Catalog, id: string): PanelRef | undefined {
  return catalog.refs.find((r) => r.id === id);
}

export function refsOfFamily(catalog: Catalog, familyId: string): PanelRef[] {
  return catalog.refs.filter((r) => r.familyId === familyId);
}

export function activeFamilies(catalog: Catalog): PanelFamily[] {
  return catalog.families.filter((f) => f.active);
}

export function isRefUsable(catalog: Catalog, ref: PanelRef): boolean {
  if (!ref.active) return false;
  const fam = familyById(catalog, ref.familyId);
  return !!fam?.active;
}

export function usableRefs(catalog: Catalog): PanelRef[] {
  return catalog.refs.filter((r) => isRefUsable(catalog, r));
}

export function specsFromRefs(
  catalog: Catalog,
  refs: PanelRef[],
): PanelSpec[] {
  return refs.map((r) => {
    const fam = familyById(catalog, r.familyId);
    const label = `${r.length} × ${r.width} mm`;
    return {
      id: r.id,
      length: r.length,
      width: r.width,
      label: r.name ? `${label} · ${r.name}` : label,
      familyId: r.familyId,
      familyName: fam?.name ?? "",
    };
  });
}

/** Références actives, plus celles déjà utilisées par le projet ouvert. */
export function packingSpecs(
  catalog: Catalog,
  includeIds: string[] = [],
): PanelSpec[] {
  const wanted = new Map<string, PanelRef>();
  for (const r of usableRefs(catalog)) wanted.set(r.id, r);
  for (const id of includeIds) {
    const r = refById(catalog, id);
    if (r) wanted.set(r.id, r);
  }
  return specsFromRefs(catalog, [...wanted.values()]);
}

export function findFamilyByName(
  catalog: Catalog,
  name: string,
  exceptId?: string,
): PanelFamily | undefined {
  const k = normalizeKey(name);
  if (!k) return undefined;
  return catalog.families.find(
    (f) => f.id !== exceptId && normalizeKey(f.name) === k,
  );
}

export function findDuplicateRef(
  catalog: Catalog,
  familyId: string,
  length: number,
  width: number,
  exceptId?: string,
): PanelRef | undefined {
  return catalog.refs.find(
    (r) =>
      r.id !== exceptId &&
      r.familyId === familyId &&
      r.length === length &&
      r.width === width,
  );
}

export function createFamily(
  catalog: Catalog,
  name: string,
): { catalog: Catalog; family?: PanelFamily; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) return { catalog, error: "Indiquez un nom de famille." };
  if (findFamilyByName(catalog, trimmed)) {
    return { catalog, error: `La famille « ${trimmed} » existe déjà.` };
  }
  const t = nowIso();
  const family: PanelFamily = {
    id: newId(),
    name: trimmed,
    active: true,
    createdAt: t,
    updatedAt: t,
  };
  return { catalog: { ...catalog, families: [...catalog.families, family] }, family };
}

export function renameFamily(
  catalog: Catalog,
  id: string,
  name: string,
): { catalog: Catalog; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) return { catalog, error: "Indiquez un nom de famille." };
  if (findFamilyByName(catalog, trimmed, id)) {
    return { catalog, error: `La famille « ${trimmed} » existe déjà.` };
  }
  const t = nowIso();
  return {
    catalog: {
      ...catalog,
      families: catalog.families.map((f) =>
        f.id === id ? { ...f, name: trimmed, updatedAt: t } : f,
      ),
    },
  };
}

export function setFamilyActive(
  catalog: Catalog,
  id: string,
  active: boolean,
): Catalog {
  const t = nowIso();
  return {
    ...catalog,
    families: catalog.families.map((f) =>
      f.id === id ? { ...f, active, updatedAt: t } : f,
    ),
  };
}

export function canDeleteFamily(
  catalog: Catalog,
  id: string,
): { ok: true } | { ok: false; reason: string } {
  if (id === DEFAULT_FAMILY_ID) {
    return { ok: false, reason: "La famille Standard ne peut pas être supprimée." };
  }
  const n = refsOfFamily(catalog, id).length;
  if (n > 0) {
    return {
      ok: false,
      reason: `Cette famille contient ${n} référence${n > 1 ? "s" : ""}. Déplacez-les ou désactivez la famille.`,
    };
  }
  return { ok: true };
}

export function deleteFamily(
  catalog: Catalog,
  id: string,
): { catalog: Catalog; error?: string } {
  const gate = canDeleteFamily(catalog, id);
  if (!gate.ok) return { catalog, error: gate.reason };
  return {
    catalog: { ...catalog, families: catalog.families.filter((f) => f.id !== id) },
  };
}

export function createRef(
  catalog: Catalog,
  input: { familyId: string; name?: string; length: number; width: number },
): { catalog: Catalog; ref?: PanelRef; error?: string } {
  const length = Math.round(input.length);
  const width = Math.round(input.width);
  if (!(length > 0 && width > 0)) {
    return { catalog, error: "Indiquez une longueur et une largeur en millimètres." };
  }
  if (!familyById(catalog, input.familyId)) {
    return { catalog, error: "Famille introuvable." };
  }
  if (findDuplicateRef(catalog, input.familyId, length, width)) {
    return {
      catalog,
      error: `Cette famille a déjà une référence ${length} × ${width} mm.`,
    };
  }
  const t = nowIso();
  const ref: PanelRef = {
    id: newId(),
    familyId: input.familyId,
    name: (input.name ?? "").trim(),
    length,
    width,
    active: true,
    createdAt: t,
    updatedAt: t,
  };
  return { catalog: { ...catalog, refs: [...catalog.refs, ref] }, ref };
}

export function updateRef(
  catalog: Catalog,
  id: string,
  patch: { familyId?: string; name?: string; length?: number; width?: number },
): { catalog: Catalog; error?: string } {
  const current = refById(catalog, id);
  if (!current) return { catalog, error: "Référence introuvable." };
  const familyId = patch.familyId ?? current.familyId;
  const length = patch.length != null ? Math.round(patch.length) : current.length;
  const width = patch.width != null ? Math.round(patch.width) : current.width;
  const name = patch.name != null ? patch.name.trim() : current.name;
  if (!(length > 0 && width > 0)) {
    return { catalog, error: "Indiquez une longueur et une largeur en millimètres." };
  }
  if (!familyById(catalog, familyId)) {
    return { catalog, error: "Famille introuvable." };
  }
  if (findDuplicateRef(catalog, familyId, length, width, id)) {
    return {
      catalog,
      error: `Cette famille a déjà une référence ${length} × ${width} mm.`,
    };
  }
  const t = nowIso();
  return {
    catalog: {
      ...catalog,
      refs: catalog.refs.map((r) =>
        r.id === id ? { ...r, familyId, name, length, width, updatedAt: t } : r,
      ),
    },
  };
}

export function setRefActive(
  catalog: Catalog,
  id: string,
  active: boolean,
): Catalog {
  const t = nowIso();
  return {
    ...catalog,
    refs: catalog.refs.map((r) =>
      r.id === id ? { ...r, active, updatedAt: t } : r,
    ),
  };
}

export function canDeleteRef(
  id: string,
  usedIds: Iterable<string>,
): { ok: true } | { ok: false; reason: string } {
  if (id === REF_A_ID || id === REF_B_ID) {
    return {
      ok: false,
      reason: "Les panneaux 2500 × 400 et 2500 × 600 ne peuvent pas être supprimés. Désactivez-les si besoin.",
    };
  }
  const used = new Set(usedIds);
  if (used.has(id)) {
    return {
      ok: false,
      reason: "Cette référence est utilisée dans un projet. Désactivez-la plutôt que de la supprimer.",
    };
  }
  return { ok: true };
}

export function deleteRef(
  catalog: Catalog,
  id: string,
  usedIds: Iterable<string>,
): { catalog: Catalog; error?: string } {
  const gate = canDeleteRef(id, usedIds);
  if (!gate.ok) return { catalog, error: gate.reason };
  return { catalog: { ...catalog, refs: catalog.refs.filter((r) => r.id !== id) } };
}

export function compatibleRefs(
  catalog: Catalog,
  length: number,
  width: number,
  allowRotation: boolean,
  kerf: number,
  familyId?: string | null,
): PanelRef[] {
  const pool = familyId
    ? usableRefs(catalog).filter((r) => r.familyId === familyId)
    : usableRefs(catalog);
  return pool.filter((r) => pieceFitsSpec(length, width, r, allowRotation, kerf));
}

export function pieceFitsSpec(
  w: number,
  h: number,
  spec: { length: number; width: number },
  allowRotation: boolean,
  kerf: number,
): boolean {
  const binW = spec.length + kerf;
  const binH = spec.width + kerf;
  const iw = w + kerf;
  const ih = h + kerf;
  if (iw <= binW && ih <= binH) return true;
  if (allowRotation && ih <= binW && iw <= binH) return true;
  return false;
}

export function migrateCatalog(raw: unknown): Catalog {
  const seed = seedCatalog();
  if (!raw || typeof raw !== "object") return seed;
  const c = raw as Partial<Catalog>;
  const families = Array.isArray(c.families) ? c.families : [];
  const refs = Array.isArray(c.refs) ? c.refs : [];
  const next: Catalog = {
    families: families.filter((f) => f && typeof f.id === "string" && f.name),
    refs: refs.filter(
      (r) =>
        r &&
        typeof r.id === "string" &&
        Number(r.length) > 0 &&
        Number(r.width) > 0,
    ),
  };
  if (!next.families.some((f) => f.id === DEFAULT_FAMILY_ID)) {
    next.families = [...seed.families, ...next.families];
  }
  for (const r of seed.refs) {
    if (!next.refs.some((x) => x.id === r.id)) next.refs = [r, ...next.refs];
  }
  return next;
}

/** Fusionne un catalogue importé sans écraser les familles / refs déjà présentes. */
export function mergeCatalog(
  base: Catalog,
  incoming?: Catalog | null,
): Catalog {
  if (!incoming) return base;
  let families = [...base.families];
  let refs = [...base.refs];
  for (const f of incoming.families ?? []) {
    if (!f?.id || !f.name) continue;
    if (families.some((x) => x.id === f.id)) continue;
    if (findFamilyByName({ families, refs }, f.name)) continue;
    families.push(f);
  }
  for (const r of incoming.refs ?? []) {
    if (!r?.id || !(Number(r.length) > 0) || !(Number(r.width) > 0)) continue;
    if (refs.some((x) => x.id === r.id)) continue;
    const familyId = families.some((f) => f.id === r.familyId)
      ? r.familyId
      : (families[0]?.id ?? DEFAULT_FAMILY_ID);
    const candidate = { ...r, familyId };
    if (findDuplicateRef({ families, refs }, familyId, candidate.length, candidate.width)) {
      continue;
    }
    refs.push(candidate);
  }
  return { families, refs };
}
