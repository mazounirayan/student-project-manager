import { Badge } from "@/components/ui/badge"
import type { ProjectStatus } from "@/services/project.service"

/** « Visible » : les étudiants voient le projet. « Brouillon » : seul son enseignant le voit. */
export function ProjectStatusBadge({ status }: { status?: ProjectStatus }) {
  return status === "visible" ? <Badge variant="secondary">Visible</Badge> : <Badge variant="outline">Brouillon</Badge>
}
