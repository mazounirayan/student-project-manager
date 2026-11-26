"use client"

import { useState } from "react"
import { Calendar, ChevronDown, ChevronUp, Clock, Download, Edit, Eye, FileText, Sparkles, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { DeliverableConstraintDialog } from "@/components/projects/deliverable-constraint-dialog"
import { DeliverableStats } from "@/components/deliverables/DeliverableStats"
import { SubmissionStatus } from "@/components/deliverables/SubmissionStatus"
import { DeliverableGroupDetails } from "@/components/deliverables/DeliverableGroupDetails"
import { apiDelete, apiPost, downloadFile, errorMessage } from "@/lib/api"
import { confirmAction } from "@/lib/dialogs"
import { formatPercent, formatDecimal } from "@/lib/format"

const RULE_LABELS: Record<string, string> = {
  max_size: "Taille maximale",
  file_format: "Format de fichier",
  file_presence: "Fichier requis",
  folder_structure: "Structure de dossiers",
  file_content: "Contenu de fichier",
}

function describeRule(rule: { type: string; configuration?: string }) {
  let detail = rule.configuration ?? ""
  try {
    const config = JSON.parse(detail)
    if (typeof config === "object" && config !== null) {
      detail = "maxSizeMB" in config ? `${config.maxSizeMB} Mo` : Object.values(config).join(", ")
    }
  } catch {
    // configuration en texte libre : affichée telle quelle
  }
  const label = RULE_LABELS[rule.type] ?? rule.type
  return detail ? `${label} (${detail})` : label
}

interface DeliverablesListProps {
  project: any
  getDeliverableStatus: (deliverable: any) => JSX.Element
  formatDeadline: (deadline: string) => string
  handleConstraintAdded: (constraint: any) => void
  handleEditDeliverable: (deliverable: any) => void
  onChanged: () => void
}

function SimilarityBar({ ratio }: { ratio: number }) {
  const percent = Math.min(Math.max(ratio * 100, 0), 100)
  const color = percent >= 70 ? "bg-red-500" : percent >= 40 ? "bg-yellow-500" : "bg-green-500"
  return (
    <div className="h-2 w-full rounded bg-muted" role="presentation">
      <div className={`${color} h-2 rounded`} style={{ width: `${percent}%` }} />
    </div>
  )
}

export function DeliverablesList({
  project,
  getDeliverableStatus,
  formatDeadline,
  handleConstraintAdded,
  handleEditDeliverable,
  onChanged,
}: DeliverablesListProps) {
  const [openDrops, setOpenDrops] = useState<Set<number>>(new Set())
  const [selected, setSelected] = useState<{ submission: any; deliverableId: number } | null>(null)

  const toggleDrop = (deliverableId: number) =>
    setOpenDrops((prev) => {
      const next = new Set(prev)
      if (!next.delete(deliverableId)) next.add(deliverableId)
      return next
    })

  const handleDownload = async (submission: any) => {
    try {
      await downloadFile(`/deliverables/submissions/${submission.id}/download`, `rendu-${submission.group?.name ?? submission.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Téléchargement impossible.")
    }
  }

  const analyseSimilarity = async (deliverableId: number) => {
    try {
      await apiPost(`/deliverables/${deliverableId}/analyze-similarity`)
      toast.success("Analyse de similarité terminée.")
      onChanged()
    } catch (err) {
      toast.error(errorMessage(err, "L’analyse de similarité a échoué."))
    }
  }

  const handleDeleteDeliverable = async (deliverableId: number) => {
    const confirmed = await confirmAction({
      title: "Supprimer ce livrable ?",
      description: "Les rendus associés seront supprimés. Cette action est irréversible.",
      confirmText: "Supprimer",
      destructive: true,
    })
    if (!confirmed) return
    try {
      await apiDelete(`/deliverables/${deliverableId}`)
      toast.success("Livrable supprimé.")
      onChanged()
    } catch (err) {
      toast.error(errorMessage(err, "La suppression a échoué."))
    }
  }

    return (
        <div className="space-y-4">
            {project?.deliverables?.map((deliverable: any) => {
                const isOpen = openDrops.has(deliverable.id)
                const submissions = deliverable.submissions || []

                return (
                    <div key={deliverable.id} className="rounded-lg border bg-card p-4 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between mb-4">
                            <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <FileText className="h-5 w-5 text-primary" />
                                    <h3 className="font-semibold text-lg">{deliverable.name}</h3>
                                    {getDeliverableStatus(deliverable)}
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">{deliverable.description}</p>
                                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                        <Calendar className="h-4 w-4" />
                                        {formatDeadline(deliverable.deadline)}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Clock className="h-4 w-4" />
                                        Rendu : {deliverable.type === "archive" ? "archive" : "lien Git"}
                                    </div>
                                    {deliverable.allowLateSubmission && (
                                        <div className="flex items-center gap-1 text-orange-600">
                                            <Clock className="h-4 w-4" />
                                            Retard autorisé (−{formatDecimal(deliverable.penaltyPerHour)} pt/h)
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => analyseSimilarity(deliverable.id)}
                                    disabled={submissions.length === 0}
                                >
                                    <Sparkles className="h-4 w-4 mr-1" />
                                    Analyser la similarité
                                </Button>

                                <DeliverableConstraintDialog
                                    deliverableId={deliverable.id}
                                    onConstraintAdded={(constraint) => handleConstraintAdded(constraint)}
                                />
                                
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => handleEditDeliverable(deliverable)}
                                >
                                    <Edit className="h-4 w-4" />
                                </Button>
                                
                                <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleDeleteDeliverable(deliverable.id)}
                                >
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                            </div>
                        </div>

                        <DeliverableStats 
                            deliverable={deliverable} 
                            totalGroups={project.groups?.length || 0} 
                        />

                        <div className="flex flex-wrap items-center justify-between pt-3 border-t">
                            <span className="text-sm font-medium">Règles de validation</span>
                            <span className="text-sm text-muted-foreground">
                                {deliverable.validationRules?.length > 0
                                    ? deliverable.validationRules.map((rule: any) => describeRule(rule)).join(", ")
                                    : "Aucune règle définie"}
                            </span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between pt-4 border-t">
                            <div className="flex flex-wrap items-center gap-4 text-sm">
                                <span className="font-medium">
                                    Rendus : {submissions.length}/{project.groups?.length || 0}
                                </span>
                            </div>
                            
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleDrop(deliverable.id)}
                                disabled={submissions.length === 0}
                            >
                                {isOpen ? (
                                    <>
                                        <ChevronUp className="mr-1 h-4 w-4" /> Fermer
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown className="mr-1 h-4 w-4" /> 
                                        {submissions.length > 0 ? `Voir les ${submissions.length} rendus` : 'Voir les rendus'}
                                    </>
                                )}
                            </Button>
                        </div>

                        {isOpen && submissions.length > 0 && (
                            <div className="mt-4 overflow-x-auto rounded-lg border">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50">
                                        <tr className="border-b text-left">
                                            <th className="py-3 px-4 font-medium">Groupe</th>
                                            <th className="py-3 px-4 font-medium">Délai</th>
                                            <th className="py-3 px-4 font-medium">Similarité</th>
                                            <th className="py-3 px-4 font-medium">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {submissions.map((submission: any) => (
                                            <tr key={submission.id} className="border-b hover:bg-muted/25 transition-colors">
                                                <td className="py-3 px-4 font-medium">
                                                    {submission.group?.name || 'Groupe inconnu'}
                                                </td>
                                                
                                                <td className="py-3 px-4">
                                                    <SubmissionStatus 
                                                        submission={submission} 
                                                        deliverable={deliverable} 
                                                    />
                                                </td>


                                                <td className="py-3 px-4">
                                                    <div className="space-y-1">
                                                        <SimilarityBar ratio={submission.similarityScore || 0} />
                                                        <span className="text-xs text-muted-foreground">
                                                            {formatPercent((submission.similarityScore || 0), 1)}
                                                        </span>
                                                    </div>
                                                </td>

                                               <td className="py-3 px-4">
                                                    <div className="flex flex-wrap gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleDownload(submission)}
                                                        >
                                                            <Download className="h-4 w-4 mr-1" /> 
                                                            Télécharger
                                                        </Button>
                                                        
                                                                                                               <Button
                                                            size="sm"
                                                            variant="default"
                                                            onClick={() => setSelected({ submission, deliverableId: deliverable.id })}
                                                        >
                                                            <Eye className="h-4 w-4 mr-1" />
                                                            Détails
                                                        </Button>
                                                    </div>
                                                </td>
                                                                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {isOpen && submissions.length === 0 && (
                            <div className="mt-4 text-center py-8 text-muted-foreground">
                                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                <p>Aucun rendu pour ce livrable</p>
                            </div>
                        )}
                    </div>
                )
            })}

            {(!project?.deliverables || project.deliverables.length === 0) && (
                <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">Aucun livrable créé</p>
                    <p className="text-sm">Créez un livrable pour que les groupes puissent déposer leur travail.</p>
                </div>
            )}
      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogTitle className="sr-only">Détail du rendu</DialogTitle>
          <DialogDescription className="sr-only">Résultats de validation et similarité du rendu.</DialogDescription>
          {selected && (
            <DeliverableGroupDetails
              deliverableId={selected.deliverableId}
              groupId={selected.submission.group.id}
              groupName={selected.submission.group.name}
              onClose={() => setSelected(null)}
            />
          )}
        </DialogContent>
      </Dialog>
        </div>


    )
}