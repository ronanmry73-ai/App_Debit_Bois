import { useEffect, useState } from "react";

export const TERRAIN_MQ = "(max-width: 767px)";

export function isTerrainFlag(value: unknown): boolean {
  return value === "1" || value === 1 || value === true || value === "true";
}

export function terrainFromSearch(search: { terrain?: unknown } | undefined): boolean {
  return isTerrainFlag(search?.terrain);
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

export function useTerrainMode(forced: boolean): boolean {
  const narrow = useNarrowScreen();
  return forced || narrow;
}
