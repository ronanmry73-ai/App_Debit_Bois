import { useEffect, useState } from "react";

export const TERRAIN_MQ = "(max-width: 767px)";

/**
 * Préférence de vue portée par l'URL :
 *   ?terrain=1 → terrain forcé (téléphone, tablette)
 *   ?terrain=0 → atelier forcé (grand écran étroit, retour à l'ERP)
 *   absent     → automatique selon la largeur de l'écran
 */
export type TerrainPreference = "auto" | "on" | "off";

const VALUES_ON = new Set<unknown>(["1", 1, true, "true"]);
const VALUES_OFF = new Set<unknown>(["0", 0, false, "false"]);

export function terrainPreferenceFromSearch(
  search: { terrain?: unknown } | undefined,
): TerrainPreference {
  const value = search?.terrain;
  if (VALUES_ON.has(value)) return "on";
  if (VALUES_OFF.has(value)) return "off";
  return "auto";
}

/** Conservé pour la validation de route : la valeur est-elle exploitable ? */
export function isTerrainFlag(value: unknown): boolean {
  return VALUES_ON.has(value) || VALUES_OFF.has(value);
}

export function terrainFromSearch(search: { terrain?: unknown } | undefined): boolean {
  return terrainPreferenceFromSearch(search) === "on";
}

export function useNarrowScreen(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(TERRAIN_MQ);
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return narrow;
}

export function useTerrainMode(preference: TerrainPreference = "auto"): boolean {
  const narrow = useNarrowScreen();
  if (preference === "on") return true;
  if (preference === "off") return false;
  return narrow;
}
