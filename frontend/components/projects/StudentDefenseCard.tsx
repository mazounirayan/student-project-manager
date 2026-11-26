import Link from "next/link"
import { CalendarClock, Clock } from "lucide-react"
import { QuietEmpty } from "@/components/dashboard/parts"
import { DueBadge } from "@/components/shared/DueBadge"
import { SectionCard } from "@/components/shared/SectionCard"
import { Badge } from "@/components/ui/badge"
import { countdownLabel, durationOf, formatDuration, positionLabel, slotRange, studentSlot, type DefenseSlot, type DefenseStatus } from "@/lib/defenses"
import { formatFullDateTime } from "@/lib/format"

/** Où en est la soutenance : un délai tant qu’elle n’a pas commencé, sinon « en cours » ou « passée ». */
export function DefenseWhenBadge({ startTime, status }: { startTime: string; status: DefenseStatus }) {
  if (status === "live") return <Badge>En cours</Badge>
  if (status === "done") return <Badge variant="secondary">Passée</Badge>
  const soon = countdownLabel(startTime)
  if (soon) {
    return (
      <Badge>
        <Clock aria-hidden="true" />
        {soon}
      </Badge>
    )
  }
  return <DueBadge date={startTime} />
}

interface StudentDefenseCardProps {
  defenses: DefenseSlot[]
  groupId: number | null | undefined
}

/** Le créneau de soutenance du groupe de l’étudiant : quand, où, combien de temps, dans quel ordre, et quoi préparer. */
export function StudentDefenseCard({ defenses, groupId }: StudentDefenseCardProps) {
  const found = studentSlot(defenses, groupId)

  return (
    <SectionCard title="Votre soutenance">
      {!found ? (
        <QuietEmpty>
          {defenses.length > 0
            ? "Votre groupe n’a pas encore de créneau de soutenance. Contactez votre enseignant."
            : "Aucune soutenance n’est planifiée pour l’instant. La date, l’heure et le lieu apparaîtront ici dès qu’ils seront fixés."}
        </QuietEmpty>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="font-medium">{formatFullDateTime(found.slot.startTime)}</p>
            <DefenseWhenBadge startTime={found.slot.startTime} status={found.status} />
          </div>

          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Heure de passage</dt>
              <dd className="font-medium tabular-nums">
                {slotRange(found.slot)} <span className="font-normal text-muted-foreground">({formatDuration(durationOf(found.slot))})</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Lieu</dt>
              <dd className="font-medium">{found.slot.location || "À préciser par votre enseignant"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Ordre de passage</dt>
              <dd className="font-medium">{positionLabel(found.position, found.total)}</dd>
            </div>
          </dl>

          {found.slot.instructions && (
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground">À préparer</p>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{found.slot.instructions}</p>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  )
}

interface DefenseBannerProps extends StudentDefenseCardProps {
  /** Page où lire le détail et les consignes. */
  href: string
}

/** Rappel d’une ligne du créneau, pour les pages où la soutenance n’est pas le sujet (espace du groupe). */
export function StudentDefenseBanner({ defenses, groupId, href }: DefenseBannerProps) {
  const found = studentSlot(defenses, groupId)
  if (!found) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border bg-muted/40 p-3">
      <div className="flex min-w-0 items-start gap-3">
        <CalendarClock aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-medium">
            Votre soutenance : {formatFullDateTime(found.slot.startTime)}
          </p>
          <p className="text-xs text-muted-foreground">
            {found.slot.location ? `${found.slot.location} · ` : ""}
            {positionLabel(found.position, found.total)}
            {found.slot.instructions ? " · consignes de préparation à lire" : ""}
          </p>
        </div>
      </div>
      <span className="flex flex-wrap items-center gap-3">
        <DefenseWhenBadge startTime={found.slot.startTime} status={found.status} />
        <Link href={href} className="rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          Voir le détail
        </Link>
      </span>
    </div>
  )
}
