import { Badge } from "@/components/ui/badge";
import { isProjectFinished, projectStatusLabel, type Project } from "@/lib/projects";
import { cn } from "@/lib/utils";

type Props = {
  project: Pick<Project, "status" | "finishedAt">;
  className?: string;
};

/**
 * État de vie du chantier. À ne pas confondre avec `JobStatusBadge`, qui décrit
 * l'avancement du dossier (calepiné, stock déduit, devis émis) : les deux
 * coexistent, et les confondre ferait passer un chantier terminé pour un
 * chantier dont le devis n'est pas émis.
 */
export function ChantierStatusBadge({ project, className }: Props) {
  const done = isProjectFinished(project);
  return (
    <Badge
      variant={done ? "good" : "outline"}
      className={cn("max-w-full font-normal whitespace-normal", className)}
    >
      {projectStatusLabel(project)}
    </Badge>
  );
}
