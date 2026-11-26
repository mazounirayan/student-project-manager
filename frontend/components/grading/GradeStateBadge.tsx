import { Check, CheckCheck, Pencil } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { GRADE_STATE_LABELS, type GradeState } from "@/lib/grading"
import { cn } from "@/lib/utils"

/** État d’une note : à noter, brouillon, validée (figée, privée) ou publiée (visible des étudiants). */
export function GradeStateBadge({ state, className }: { state: GradeState; className?: string }) {
  const label = GRADE_STATE_LABELS[state]
  switch (state) {
    case "published":
      return (
        <Badge className={className}>
          <CheckCheck aria-hidden="true" />
          {label}
        </Badge>
      )
    case "validated":
      return (
        <Badge variant="outline" className={cn("border-primary text-primary", className)}>
          <Check aria-hidden="true" />
          {label}
        </Badge>
      )
    case "draft":
      return (
        <Badge variant="secondary" className={className}>
          <Pencil aria-hidden="true" />
          {label}
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className={cn("text-muted-foreground", className)}>
          {label}
        </Badge>
      )
  }
}
