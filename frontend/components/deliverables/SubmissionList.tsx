import Link from "next/link"
import { QuietEmpty } from "@/components/dashboard/parts"
import { ConformityBadge, SimilarityBadge, SubmissionStatus } from "@/components/deliverables/SubmissionStatus"
import { Button } from "@/components/ui/button"
import {
  closestMatch,
  needsAttention,
  rowsOf,
  similarityLevel,
  similarityPercent,
  type Deliverable,
  type GroupRef,
  type GroupRow,
} from "@/lib/deliverables"
import { formatShortDateTime } from "@/lib/format"
import { memberNames } from "@/lib/people"

interface SubmissionListProps {
  deliverable: Deliverable
  groups: GroupRef[]
  /** N’affiche que les groupes dont le rendu demande un regard. */
  onlyAttention?: boolean
  onOpen: (row: GroupRow) => void
  /** Ouvre la notation de ce groupe sans quitter la page (onglet du projet) ou, à défaut, via l’adresse de la notation. */
  onGrade?: (groupId: number) => void
  /** Adresse de la notation du livrable ; l’identifiant du groupe y est ajouté. */
  gradeHref?: string
}

/** Un groupe par ligne : rendu ou non, retard, conformité, ressemblance, puis voir le rendu et le noter. */
export function SubmissionList({ deliverable, groups, onlyAttention = false, onOpen, onGrade, gradeHref }: SubmissionListProps) {
  const all = rowsOf(deliverable, groups)
  const rows = onlyAttention ? all.filter((row) => needsAttention(deliverable, row)) : all

  if (groups.length === 0) {
    return <QuietEmpty>Aucun groupe n’est constitué : les rendus apparaîtront ici dès que les groupes existeront.</QuietEmpty>
  }
  if (rows.length === 0) {
    return <QuietEmpty done>Rien à signaler pour l’instant : aucun retard, aucun rendu non conforme, aucune ressemblance élevée.</QuietEmpty>
  }

  return (
    <ul className="divide-y">
      {rows.map((row) => {
        const { group, submission } = row
        const match = submission && similarityLevel(submission.similarityScore) === "high" ? closestMatch(submission) : null
        return (
          <li key={group.id} className="grid items-start gap-x-6 gap-y-3 py-3 first:pt-0 last:pb-0 md:grid-cols-[13rem_minmax(0,1fr)_auto]">
            <div className="min-w-0">
              <p className="font-medium">{group.name}</p>
              {group.members && group.members.length > 0 && <p className="text-xs text-muted-foreground">{memberNames(group.members)}</p>}
            </div>

            <div className="flex min-w-0 flex-col items-start gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <SubmissionStatus deliverable={deliverable} submission={submission} />
                {submission && <ConformityBadge deliverable={deliverable} submission={submission} />}
                {submission && <SimilarityBadge submission={submission} />}
              </div>
              {submission && <p className="text-xs text-muted-foreground">Rendu le {formatShortDateTime(submission.submittedAt)}</p>}
              {match && (
                <p className="text-xs text-muted-foreground">
                  Proche du rendu de {match.groupName ?? "un autre groupe"} ({similarityPercent(match.score)}). À examiner avant toute conclusion.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {submission && (
                <Button variant="outline" size="sm" onClick={() => onOpen(row)}>
                  Voir le rendu
                  <span className="sr-only"> de {group.name}</span>
                </Button>
              )}
              {onGrade ? (
                <Button size="sm" variant={submission ? "default" : "outline"} onClick={() => onGrade(group.id)}>
                  Noter
                  <span className="sr-only"> {group.name}</span>
                </Button>
              ) : (
                gradeHref && (
                  <Button size="sm" variant={submission ? "default" : "outline"} asChild>
                    <Link href={`${gradeHref}/${group.id}`}>
                      Noter
                      <span className="sr-only"> {group.name}</span>
                    </Link>
                  </Button>
                )
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
