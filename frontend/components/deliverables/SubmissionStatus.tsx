import { CheckCircle2, Clock, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  conformityOf,
  formatPoints,
  hoursLate,
  isPastDeadline,
  similarityLevel,
  similarityPercent,
  type Deliverable,
  type Submission,
} from "@/lib/deliverables"
import { plural } from "@/lib/format"

interface SubmissionProps {
  deliverable: Deliverable
  submission: Submission | null
}

/** Où en est un groupe : pas rendu, rendu à l’heure, ou en retard (avec le nombre d’heures et la pénalité). */
export function SubmissionStatus({ deliverable, submission }: SubmissionProps) {
  if (!submission) {
    return isPastDeadline(deliverable.deadline) ? (
      <Badge variant="destructive">Pas rendu, échéance dépassée</Badge>
    ) : (
      <Badge variant="outline">Pas encore rendu</Badge>
    )
  }
  if (!submission.isLate) {
    return (
      <Badge variant="secondary">
        <CheckCircle2 aria-hidden="true" />
        Rendu à l’heure
      </Badge>
    )
  }
  const penalty = submission.penalty ?? 0
  return (
    <Badge variant="destructive">
      <Clock aria-hidden="true" />
      En retard de {hoursLate(deliverable.deadline, submission.submittedAt)} h{penalty > 0 ? `, −${formatPoints(penalty)}` : ""}
    </Badge>
  )
}

/** Conformité aux règles du livrable ; rien à afficher quand le livrable n’a pas de règle. */
export function ConformityBadge({ deliverable, submission }: { deliverable: Deliverable; submission: Submission }) {
  const { state, failed } = conformityOf(deliverable, submission)
  if (state === "none") return null
  if (state === "unchecked") return <Badge variant="outline">Conformité non vérifiée</Badge>
  if (state === "ok") {
    return (
      <Badge variant="outline">
        <CheckCircle2 aria-hidden="true" className="text-primary" />
        Conforme
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="border-destructive text-destructive">
      <XCircle aria-hidden="true" />
      {plural(failed.length, "règle")} non respectée{failed.length > 1 ? "s" : ""}
    </Badge>
  )
}

/** Indice de ressemblance avec les autres rendus : un repère pour aller regarder, jamais un verdict. */
export function SimilarityBadge({ submission }: { submission: Submission }) {
  const level = similarityLevel(submission.similarityScore)
  if (level === "unknown") return <span className="text-xs text-muted-foreground">Ressemblance non analysée</span>
  const percent = similarityPercent(submission.similarityScore ?? 0)
  if (level === "high") {
    return (
      <Badge variant="outline" className="border-destructive text-destructive">
        Ressemblance {percent} : à vérifier
      </Badge>
    )
  }
  return <Badge variant="outline">Ressemblance {percent}</Badge>
}
