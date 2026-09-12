import { Badge } from "@/components/ui/badge";
import {
  deriveJobStatus,
  formatJobStatusLine,
  type JobStatusInput,
} from "@/lib/projects";
import { cn } from "@/lib/utils";

type Props = {
  info: JobStatusInput;
  className?: string;
};

export function JobStatusBadge({ info, className }: Props) {
  const status = deriveJobStatus(info);
  const variant =
    status === "brouillon"
      ? "muted"
      : status === "calepine"
        ? "outline"
        : "good";
  return (
    <Badge
      variant={variant}
      className={cn("max-w-full font-normal whitespace-normal", className)}
    >
      {formatJobStatusLine(info)}
    </Badge>
  );
}
