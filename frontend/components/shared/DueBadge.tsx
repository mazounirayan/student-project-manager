import { Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { daysUntil } from "@/lib/format"

/** Délai avant une échéance : rouge si dépassée, plein si elle approche (3 jours ou moins), discret sinon. */
export function DueBadge({ date }: { date: string | null | undefined }) {
  const days = daysUntil(date)
  if (days === null) return null

  const label =
    days < 0 ? "Échéance dépassée" : days === 0 ? "Aujourd’hui" : days === 1 ? "Demain" : `Dans ${days} jours`

  return (
    <Badge variant={days < 0 ? "destructive" : days <= 3 ? "default" : "secondary"}>
      <Clock aria-hidden="true" />
      {label}
    </Badge>
  )
}
