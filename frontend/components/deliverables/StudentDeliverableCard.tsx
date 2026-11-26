import Link from "next/link"
import { Users } from "lucide-react"
import { SubmissionReceipt } from "@/components/deliverables/SubmissionReceipt"
import { SubmitDeliverableDialog } from "@/components/deliverables/submit-deliverable-dialog"
import { DueBadge } from "@/components/shared/DueBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { describeRule, latePolicy, studentAction, type Deliverable, type Submission } from "@/lib/deliverables"
import { formatFullDateTime } from "@/lib/format"
import { projectPath } from "@/lib/routes"

interface StudentDeliverableCardProps {
  deliverable: Deliverable
  /** Groupe de l’étudiant dans ce projet ; null s’il n’en a pas encore. */
  groupId: number | null
  projectId: number
  /** Affiché quand la carte est hors du contexte du projet (liste « Mes livrables »). */
  projectName?: string
  onChanged: () => void
}

/** Un livrable vu par l’étudiant : consigne, échéance, règles, puis soit le bouton pour rendre, soit l’accusé de réception. */
export function StudentDeliverableCard({ deliverable, groupId, projectId, projectName, onChanged }: StudentDeliverableCardProps) {
  const submission: Submission | null = groupId ? (deliverable.submissions ?? []).find((item) => item.groupId === groupId) ?? null : null
  const action = studentAction(deliverable, submission)
  const rules = deliverable.validationRules ?? []

  return (
    <article className="space-y-4 rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 space-y-1">
          <h3 className="font-semibold leading-snug">{deliverable.name}</h3>
          {projectName && (
            <p className="text-sm text-muted-foreground">
              <Link href={projectPath("/my-projects", projectId)} className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                {projectName}
              </Link>
            </p>
          )}
        </div>
        {submission ? (
          <Badge variant={submission.isLate ? "destructive" : "secondary"}>{submission.isLate ? "Rendu en retard" : "Rendu"}</Badge>
        ) : action === "closed" ? (
          <Badge variant="destructive">Dépôt fermé</Badge>
        ) : (
          <DueBadge date={deliverable.deadline} />
        )}
      </header>

      {deliverable.description && <p className="whitespace-pre-line text-sm leading-relaxed">{deliverable.description}</p>}

      <dl className="space-y-1 text-sm">
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-muted-foreground">Échéance :</dt>
          <dd className="font-medium">
            {formatFullDateTime(deliverable.deadline)}
          </dd>
        </div>
        {!submission && (
          <>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground">Retard :</dt>
              <dd>{latePolicy(deliverable)}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground">À rendre :</dt>
              <dd>{deliverable.type === "archive" ? "une archive (de préférence un .zip)" : "le lien de votre dépôt Git"}</dd>
            </div>
          </>
        )}
      </dl>

      {!submission && rules.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Ce que doit respecter votre rendu</p>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
            {rules.map((rule) => (
              <li key={rule.id}>{describeRule(rule)}</li>
            ))}
          </ul>
        </div>
      )}

      {submission && <SubmissionReceipt deliverable={deliverable} submission={submission} />}

      <div className="flex flex-wrap items-center gap-2">
        {groupId === null ? (
          <>
            <p className="text-sm text-muted-foreground">Le livrable se rend au nom d’un groupe.</p>
            <Button asChild variant="outline">
              <Link href={projectPath("/my-projects", projectId)}>
                <Users aria-hidden="true" />
                Rejoindre un groupe
              </Link>
            </Button>
          </>
        ) : action === "closed" ? (
          <p className="text-sm text-muted-foreground">L’échéance est passée et les rendus en retard ne sont pas acceptés. Contactez votre enseignant.</p>
        ) : action === "none" ? (
          <p className="text-sm text-muted-foreground">L’échéance est passée : le rendu ne peut plus être remplacé.</p>
        ) : (
          <SubmitDeliverableDialog
            deliverable={deliverable}
            groupId={groupId}
            existing={submission}
            trigger={<Button variant={submission ? "outline" : "default"}>{submission ? "Remplacer mon rendu" : "Rendre le livrable"}</Button>}
            onSubmitted={onChanged}
          />
        )}
      </div>
    </article>
  )
}
