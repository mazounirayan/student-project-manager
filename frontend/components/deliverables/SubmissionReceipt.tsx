import { CheckCircle2 } from "lucide-react"
import { RuleResults } from "@/components/deliverables/RuleResults"
import { conformityOf, formatPoints, hoursLate, isPastDeadline, type Deliverable, type Submission } from "@/lib/deliverables"
import { formatDateFull, formatFileSize, formatTime } from "@/lib/format"

/** Accusé de réception d’un rendu : quand il est arrivé, s’il est en retard (et la pénalité), ce qui a été déposé, et le résultat des règles. */
export function SubmissionReceipt({ deliverable, submission }: { deliverable: Deliverable; submission: Submission }) {
  const conformity = conformityOf(deliverable, submission)
  const penalty = submission.penalty ?? 0

  return (
    <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-primary" />
          Rendu enregistré le {formatDateFull(submission.submittedAt)} à {formatTime(submission.submittedAt)}
        </p>
        {submission.isLate ? (
          <p className="text-sm text-destructive">
            En retard de {hoursLate(deliverable.deadline, submission.submittedAt)} h
            {penalty > 0 ? ` : ${formatPoints(penalty)} seront retirés de la note.` : ", sans pénalité."}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Dans les délais.</p>
        )}
        {submission.fileName && (
          <p className="break-all text-sm text-muted-foreground">
            Fichier : {submission.fileName}
            {submission.fileSize ? ` (${formatFileSize(submission.fileSize)})` : ""}
          </p>
        )}
        {submission.gitUrl && (
          <p className="break-all text-sm text-muted-foreground">
            Lien :{" "}
            <a href={submission.gitUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {submission.gitUrl}
            </a>
          </p>
        )}
      </div>

      {conformity.state === "ok" && <RuleResults results={submission.validationResults ?? []} />}
      {conformity.state === "failed" && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">
            Ce rendu ne respecte pas toutes les règles.
            {!isPastDeadline(deliverable.deadline) && " Corrigez-le puis remplacez-le avant l’échéance."}
          </p>
          <RuleResults results={submission.validationResults ?? []} />
        </div>
      )}
    </div>
  )
}
