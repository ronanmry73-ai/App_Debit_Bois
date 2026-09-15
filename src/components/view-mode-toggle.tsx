import { Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TerrainPreference } from "@/lib/terrain";

type Props = {
  preference: TerrainPreference;
  onPreference: (next: TerrainPreference) => void;
};

/**
 * Bascule manuelle de vue. Sur un écran étroit la détection automatique choisit
 * l'interface terrain ; ce contrôle permet de forcer l'autre vue, et de revenir
 * au mode automatique.
 */
export function ViewModeToggle({ preference, onPreference }: Props) {
  const onTerrain = preference === "on";
  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onPreference(onTerrain ? "off" : "on")}
      >
        {onTerrain ? <Monitor /> : <Smartphone />}
        {onTerrain ? "Vue atelier" : "Vue terrain"}
      </Button>
      {preference !== "auto" && (
        <Button type="button" size="sm" variant="ghost" onClick={() => onPreference("auto")}>
          Auto
        </Button>
      )}
    </div>
  );
}
