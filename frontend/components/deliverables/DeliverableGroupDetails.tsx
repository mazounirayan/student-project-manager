"use client"

import Link from "next/link"
import { Download, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { QuietEmpty } from "@/components/dashboard/parts"
import { RuleResults } from "@/components/deliverables/RuleResults"
import { SimilarityBadge, SubmissionStatus } from "@/components/deliverables/SubmissionStatus"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { downloadFile, errorMessage } from "@/lib/api"
import {
  conformityOf,
  formatPoints,
  hoursLate,
  isPastDeadline,
  similarityLevel,
  similarityPercent,
  type Deliverable,
  type GroupRef,
  type Submission,
} from "@/lib/deliverables"
import { formatDateFull, formatDateTime, formatFileSize, formatTime } from "@/lib/format"

interface DeliverableGroupDetailsProps {
  deliverable: Deliverable
  group: GroupRef
  submission: Submission | null
  onClose: () => void
  /** Passe à la notation de ce livrable. */
  onGrade?: () => void
  gradeHref?: string
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

/** Détail du rendu d’un groupe pour l’enseignante : dépôt, retard, conformité aux règles, ressemblance avec les autres rendus. */
export function DeliverableGroupDetails({ deliverable, group, submission, onClose, onGrade, gradeHref }: DeliverableGroupDetailsProps) {
  const download = async () => {
    if (!submission) return
    try {
      await downloadFile(`/deliverables/submissions/${submission.id}/download`, submission.fileName ?? `rendu-${group.name}`)
    } catch (err) {
      toast.error("Le fichier n’a pas été téléchargé.", { description: errorMessage(err, "Réessayez dans un instant.") })
    }
  }

  if (!submission) {
    return (
      <div className="space-y-4">
        <QuietEmpty>
          {group.name} n’a rien rendu. L’échéance {isPastDeadline(deliverable.deadline) ? "était" : "est"} le {formatDateFull(deliverable.deadline)}.
        </QuietEmpty>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </DialogFooter>
      </div>
    )
  }

  const conformity = conformityOf(deliverable, submission)
  const level = similarityLevel(submission.similarityScore)
  const matches = [...(submission.similarTo ?? [])].sort((a, b) => b.score - a.score)
  const penalty = submission.penalty ?? 0

  return (
    <div className="space-y-6">
      <Section title="Rendu">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Déposé le</dt>
            <dd className="font-medium">
              {formatDateFull(submission.submittedAt)} à {formatTime(submission.submittedAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Délai</dt>
            <dd className="space-y-1">
              <SubmissionStatus deliverable={deliverable} submission={submission} />
              {submission.isLate && (
                <p className="text-muted-foreground">
                  {hoursLate(deliverable.deadline, submission.submittedAt)} h après le {formatDateTime(deliverable.deadline)}
                  {penalty > 0 && `, soit ${formatPoints(penalty)} à retirer de la note`}.
                </p>
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Contenu</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-3">
              {submission.fileName && (
                <>
                  <span className="break-all font-medium">
                    {submission.fileName}
                    {submission.fileSize ? ` (${formatFileSize(submission.fileSize)})` : ""}
                  </span>
                  <Button variant="outline" size="sm" onClick={download}>
                    <Download aria-hidden="true" />
                    Télécharger
                  </Button>
                </>
              )}
              {submission.gitUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={submission.gitUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink aria-hidden="true" />
                    Ouvrir le dépôt Git
                  </a>
                </Button>
              )}
            </dd>
          </div>
        </dl>
      </Section>

      <Section title="Conformité aux règles">
        {conformity.state === "none" && <QuietEmpty>Ce livrable n’a pas de règle de conformité.</QuietEmpty>}
        {conformity.state === "unchecked" && (
          <QuietEmpty>Les règles ont été ajoutées après ce rendu : il n’a pas été vérifié. Un nouveau rendu du groupe le sera.</QuietEmpty>
        )}
        {(conformity.state === "ok" || conformity.state === "failed") && (
          <RuleResults results={submission.validationResults ?? []} />
        )}
      </Section>

      <Section title="Ressemblance avec les autres rendus">
        {level === "unknown" ? (
          <QuietEmpty>
            Pas encore analysée. Lancez « Analyser la ressemblance » depuis la liste des rendus : elle compare tous les rendus de ce livrable entre eux.
          </QuietEmpty>
        ) : (
          <>
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <span>Rendu le plus proche :</span>
              <SimilarityBadge submission={submission} />
            </p>
            {matches.length > 0 ? (
              <ul className="space-y-2">
                {matches.map((match) => (
                  <li key={match.submissionId} className="rounded-md border p-3 text-sm">
                    <p className="font-medium">
                      {match.groupName ?? "Un autre groupe"} : {similarityPercent(match.score)}
                    </p>
                    {match.details && <p className="text-muted-foreground">{match.details}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <QuietEmpty>Aucun autre rendu ne ressemble à celui-ci ({similarityPercent(submission.similarityScore ?? 0)} au plus).</QuietEmpty>
            )}
          </>
        )}
        <p className="text-xs leading-relaxed text-muted-foreground">
          Cet indice compare les lignes de code de deux rendus. Il signale des passages en commun, pas une copie : un code fourni par l’énoncé,
          un modèle de projet ou une bibliothèque suffisent à le faire monter. Ouvrez les deux rendus avant de conclure.
        </p>
      </Section>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Fermer
        </Button>
        {onGrade ? (
          <Button onClick={onGrade}>Noter ce livrable</Button>
        ) : (
          gradeHref && (
            <Button asChild>
              <Link href={gradeHref}>Noter ce livrable</Link>
            </Button>
          )
        )}
      </DialogFooter>
    </div>
  )
}

interface SubmissionDetailsDialogProps extends Omit<DeliverableGroupDetailsProps, "onClose"> {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SubmissionDetailsDialog({ open, onOpenChange, ...details }: SubmissionDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{details.group.name}</DialogTitle>
          <DialogDescription>{details.deliverable.name}</DialogDescription>
        </DialogHeader>
        <DeliverableGroupDetails {...details} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
