"use client"

import { useState } from "react"
import { Loader2, MoreHorizontal, Pencil, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { QuietEmpty } from "@/components/dashboard/parts"
import { SubmissionDetailsDialog } from "@/components/deliverables/DeliverableGroupDetails"
import { DeliverableStats } from "@/components/deliverables/DeliverableStats"
import { SubmissionList } from "@/components/deliverables/SubmissionList"
import { DeliverableConstraintDialog, type NewRule } from "@/components/projects/deliverable-constraint-dialog"
import { DueBadge } from "@/components/shared/DueBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { apiDelete, apiPost, errorMessage } from "@/lib/api"
import { confirmAction } from "@/lib/dialogs"
import { describeRule, latePolicy, type Deliverable, type GroupRef, type GroupRow } from "@/lib/deliverables"
import { formatDateFull, formatTime, plural } from "@/lib/format"

interface DeliverablesListProps {
  groups: GroupRef[]
  deliverables: Deliverable[]
  onEdit: (deliverable: Deliverable) => void
  /** Recharge le projet après une modification. */
  onChanged: () => Promise<void> | void
  /** Passe à la notation du livrable, plus bas dans la page. */
  onGrade: (deliverableId: number) => void
}

/** Livrables du projet : consigne et échéance, règles de conformité, rendus par groupe avec leur détail et leur notation. */
export function DeliverablesList({ groups, deliverables, onEdit, onChanged, onGrade }: DeliverablesListProps) {
  const [details, setDetails] = useState<{ deliverable: Deliverable; row: GroupRow } | null>(null)
  const [analysing, setAnalysing] = useState<number | null>(null)

  const addRule = async (deliverable: Deliverable, rule: NewRule) => {
    try {
      await apiPost(`/deliverables/${deliverable.id}/rules`, rule)
      toast.success("Règle ajoutée.", { description: "Elle s’applique aux prochains rendus. Ceux déjà déposés ne sont pas revérifiés." })
      await onChanged()
    } catch (err) {
      toast.error("La règle n’a pas été ajoutée.", { description: errorMessage(err, "Réessayez dans un instant.") })
      throw err
    }
  }

  const removeRule = async (deliverable: Deliverable, ruleId: number, label: string) => {
    const confirmed = await confirmAction({
      title: "Retirer cette règle ?",
      description: `« ${label} » ne sera plus vérifiée. Les rendus déjà déposés gardent leur résultat de vérification.`,
      confirmText: "Retirer la règle",
    })
    if (!confirmed) return
    try {
      await apiDelete(`/deliverables/${deliverable.id}/rules/${ruleId}`)
      toast.success("Règle retirée.")
      await onChanged()
    } catch (err) {
      toast.error("La règle n’a pas été retirée.", { description: errorMessage(err, "Réessayez dans un instant.") })
    }
  }

  const analyse = async (deliverable: Deliverable) => {
    setAnalysing(deliverable.id)
    try {
      const result = await apiPost<{ message?: string }>(`/deliverables/${deliverable.id}/analyze-similarity`)
      toast.success(result?.message ?? "Analyse terminée.")
      await onChanged()
    } catch (err) {
      toast.error("L’analyse n’a pas pu se faire.", { description: errorMessage(err, "Réessayez dans un instant.") })
    } finally {
      setAnalysing(null)
    }
  }

  const remove = async (deliverable: Deliverable) => {
    const count = deliverable.submissions?.length ?? 0
    const confirmed = await confirmAction({
      title: `Supprimer « ${deliverable.name} » ?`,
      description: `${count > 0 ? `${plural(count, "rendu")} déposé${count > 1 ? "s" : ""} par les groupes ser${count > 1 ? "ont" : "a"} supprimé${count > 1 ? "s" : ""} avec lui. ` : ""}Cette action est irréversible.`,
      confirmText: "Supprimer le livrable",
      destructive: true,
    })
    if (!confirmed) return
    try {
      await apiDelete(`/deliverables/${deliverable.id}`)
      toast.success("Livrable supprimé.")
      await onChanged()
    } catch (err) {
      toast.error("Le livrable n’a pas été supprimé.", { description: errorMessage(err, "Réessayez dans un instant.") })
    }
  }

  if (deliverables.length === 0) return null

  return (
    <div className="space-y-6">
      {deliverables.map((deliverable) => {
        const rules = deliverable.validationRules ?? []
        const received = deliverable.submissions?.length ?? 0
        const isArchive = deliverable.type === "archive"

        return (
          <article key={deliverable.id} className="space-y-5 rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
            <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold leading-snug">{deliverable.name}</h3>
                  <Badge variant="outline">{isArchive ? "Archive" : "Lien Git"}</Badge>
                  <DueBadge date={deliverable.deadline} />
                </div>
                <p className="text-sm text-muted-foreground">
                  Échéance : {formatDateFull(deliverable.deadline)} à {formatTime(deliverable.deadline)}
                </p>
                <p className="text-sm text-muted-foreground">{latePolicy(deliverable)}</p>
                {deliverable.description && <p className="max-w-3xl whitespace-pre-line pt-1 text-sm">{deliverable.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => onEdit(deliverable)}>
                  <Pencil aria-hidden="true" />
                  Modifier
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="size-8" aria-label={`Autres actions sur ${deliverable.name}`}>
                      <MoreHorizontal aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem variant="destructive" onSelect={() => remove(deliverable)}>
                      <Trash2 aria-hidden="true" />
                      Supprimer le livrable
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>

            <section className="space-y-3 border-t pt-4" aria-label={`Règles de conformité de ${deliverable.name}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold">Règles de conformité</h4>
                {isArchive && <DeliverableConstraintDialog onAdd={(rule) => addRule(deliverable, rule)} />}
              </div>
              {!isArchive ? (
                <QuietEmpty>Le contenu d’un dépôt Git n’est pas inspecté : aucune règle ne s’applique à ce livrable.</QuietEmpty>
              ) : rules.length === 0 ? (
                <QuietEmpty>
                  Aucune règle : tous les rendus sont acceptés tels quels. Ajoutez par exemple un fichier requis ou une taille maximale ; les étudiants les voient avant de rendre.
                </QuietEmpty>
              ) : (
                <ul className="divide-y rounded-md border">
                  {rules.map((rule) => {
                    const label = describeRule(rule)
                    return (
                      <li key={rule.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <span className="min-w-0">{label}</span>
                        <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => removeRule(deliverable, rule.id, label)}>
                          <X aria-hidden="true" />
                          <span className="sr-only">Retirer la règle : {label}</span>
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section className="space-y-3 border-t pt-4" aria-label={`Rendus de ${deliverable.name}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <DeliverableStats deliverable={deliverable} groups={groups} />
                <Button variant="outline" size="sm" disabled={received < 2 || analysing !== null} onClick={() => analyse(deliverable)}>
                  {analysing === deliverable.id && <Loader2 aria-hidden="true" className="animate-spin" />}
                  Analyser la ressemblance
                </Button>
              </div>
              {received < 2 && (
                <p className="text-xs text-muted-foreground">L’analyse de ressemblance compare les rendus entre eux : il en faut au moins deux.</p>
              )}
              <SubmissionList
                deliverable={deliverable}
                groups={groups}
                onOpen={(row) => setDetails({ deliverable, row })}
                onGrade={() => onGrade(deliverable.id)}
              />
            </section>
          </article>
        )
      })}

      {details && (
        <SubmissionDetailsDialog
          open
          onOpenChange={(open) => !open && setDetails(null)}
          deliverable={details.deliverable}
          group={details.row.group}
          submission={details.row.submission}
          onGrade={() => {
            const id = details.deliverable.id
            setDetails(null)
            onGrade(id)
          }}
        />
      )}
    </div>
  )
}
