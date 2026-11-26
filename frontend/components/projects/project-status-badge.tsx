import { Badge } from "@/components/ui/badge"
import type { ProjectStatus } from "@/services/project.service"

export function ProjectStatusBadge({ status }: { status?: ProjectStatus }) {
  return status === "visible" ? <Badge>Visible</Badge> : <Badge variant="secondary">Brouillon</Badge>
}
