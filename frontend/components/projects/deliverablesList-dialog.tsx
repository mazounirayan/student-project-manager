"use client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, FileText, BookOpen, Eye, Edit, Sparkles, PlusCircle, Delete, ChevronDown, ChevronUp, Download } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { DeliverableConstraintDialog } from "@/components/projects/deliverable-constraint-dialog"
import { Trash2 } from "lucide-react"
import { Calendar } from "lucide-react"
import { Clock } from "lucide-react"
import Swal from 'sweetalert2'
import { DeliverableStats } from "../deliverables/DeliverableStats"
import { SubmissionStatus } from "../deliverables/SubmissionStatus"
import { ConformityIndicators } from "../deliverables/ConformityIndicators"
import { Dialog, DialogContent } from "@radix-ui/react-dialog"
import { DeliverableGroupDetails } from "../deliverables/DeliverableGroupDetails"

// Utility function for timeout/delay
function timeout(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
const NEST_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'

interface DeliverablesListProps {
    project: any
    getDeliverableStatus: (deliverable: any) => JSX.Element
    formatDeadline: (deadline: string) => string
    handleConstraintAdded: (constraint: any, deliverableId: string) => void
    handleEditDeliverable: (deliverable: any) => void
}

function SimilarityProgressBar({ value }: { value: number }) {
    const percent = Math.min(Math.max(value, 0), 100)
    let barColor = "bg-green-500"
    if (percent >= 70) barColor = "bg-red-500"
    else if (percent >= 40) barColor = "bg-yellow-500"

    return (
        <div className="w-full h-3 bg-gray-200 rounded">
            <div
                className={`${barColor} h-3 rounded`}
                style={{ width: `${percent}%` }}
            />
        </div>
    )
}

export function DeliverablesList({ project, getDeliverableStatus, formatDeadline, handleConstraintAdded, handleEditDeliverable }: DeliverablesListProps) {
    const [openDrops, setOpenDrops] = useState<Set<number>>(new Set())
const [selectedSubmission, setSelectedSubmission] = useState<{
  submission: any;
  deliverableId: number;
} | null>(null)
const handleViewDetails = (submission: any, deliverableId: number) => {
    setSelectedSubmission({
        submission,
        deliverableId
    })
}

    const toggleDrop = (deliverableId: number) => {
        setOpenDrops((prev) => {
            const next = new Set(prev)
            if (next.has(deliverableId)) next.delete(deliverableId)
            else next.add(deliverableId)
            return next
        })
    }

    const handleDownload = async (submission: any) => {
        const token = localStorage.getItem("token");
        const res = await fetch(`${NEST_BACKEND_URL}/api/deliverables/submissions/${submission.id}/download`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token || ""}`,
            },
        });

        if (!res.ok) {
            const text = await res.text().catch(() => null);
            throw new Error(text || "Téléchargement indisponible en mode démo.");
        }

        
        const disposition = res.headers.get("content-disposition");
        let filename = `submission-${submission.group.name}`;
        if (disposition) {
            const match = disposition.match(/filename\*=UTF-8''(.+)$|filename="(.+)"|filename=(.+)/);
            if (match) {
                filename = decodeURIComponent(match[1] || match[2] || match[3]);
            }
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    }

    const analyseSimilarity = async (deliverableId: number) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error("Token JWT non trouvé");
            }
            
            const response = await fetch(
                `${NEST_BACKEND_URL}/api/deliverables/${deliverableId}/analyze-similarity`, 
                { 
                    method: 'POST', 
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    } 
                }
            );
            
            if (response.status !== 200) {
                Swal.fire({
                    title: "Erreur",
                    text: "L'analyse de similarité a échoué",
                    icon: "error",
                    draggable: true
                });
            } else {
                Swal.fire({
                    title: "Analyse terminée",
                    text: "L'analyse de similarité a été effectuée avec succès",
                    icon: "success",
                    draggable: true
                });
            }
            
            await timeout(3000);
        } catch (error) {
            Swal.fire({
                title: "Erreur",
                text: "Une erreur est survenue lors de l'analyse",
                icon: "error",
                draggable: true
            });
        }
    }

    const handleDeleteDeliverable = async (deliverableId: number) => {
        const result = await Swal.fire({
            title: 'Êtes-vous sûr?',
            text: "Cette action est irréversible!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Oui, supprimer!',
            cancelButtonText: 'Annuler'
        });

        if (result.isConfirmed) {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${NEST_BACKEND_URL}/api/deliverables/${deliverableId}`, {
                    method: 'DELETE',
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (response.ok) {
                    Swal.fire({
                        title: 'Supprimé!',
                        text: 'Le livrable a été supprimé.',
                        icon: 'success',
                    });
                    window.location.reload();
                } else {
                    throw new Error('Erreur lors de la suppression');
                }
            } catch (error) {
                Swal.fire({
                    title: 'Erreur!',
                    text: 'La suppression a échoué.',
                    icon: 'error',
                });
            }
        }
    }

    return (
        <div className="space-y-4">
            {project?.deliverables?.map((deliverable: any) => {
                const isOpen = openDrops.has(deliverable.id)
                const submissions = deliverable.submissions || []

                return (
                    <div key={deliverable.id} className="border rounded-lg p-4 bg-white shadow-sm">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <FileText className="h-5 w-5 text-primary" />
                                    <h3 className="font-semibold text-lg">{deliverable.name}</h3>
                                    {getDeliverableStatus(deliverable)}
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">{deliverable.description}</p>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                        <Calendar className="h-4 w-4" />
                                        {formatDeadline(deliverable.deadline)}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Clock className="h-4 w-4" />
                                        Type : {deliverable.type === "archive" ? "Archive (.zip, .pdf)" : "Lien Git"}
                                    </div>
                                    {deliverable.allowLateSubmission && (
                                        <div className="flex items-center gap-1 text-orange-600">
                                            <Clock className="h-4 w-4" />
                                            Retard autorisé (-{deliverable.penaltyPerHour}pt/h)
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => analyseSimilarity(deliverable.id)}
                                    disabled={submissions.length === 0}
                                >
                                    <Sparkles className="h-4 w-4 mr-1" />
                                    Analyse similarité
                                </Button>

                                <DeliverableConstraintDialog
                                    deliverableId={deliverable.id}
                                    onConstraintAdded={(constraint) => handleConstraintAdded(constraint, deliverable.id)}
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

                        {/* Statistics */}
                        <DeliverableStats 
                            deliverable={deliverable} 
                            totalGroups={project.groups?.length || 0} 
                        />

                        {/* Validation rules */}
                        <div className="flex items-center justify-between pt-3 border-t">
                            <span className="text-sm font-medium">Règles de validation:</span>
                            <span className="text-sm text-muted-foreground">
                                {deliverable.validationRules?.length > 0
                                    ? deliverable.validationRules
                                        .map((r: any) => `${r.type}${r.configuration ? `: ${r.configuration}` : ''}`)
                                        .join(', ')
                                    : 'Aucune règle définie'}
                            </span>
                        </div>

                        {/* Submissions section */}
                        <div className="flex items-center justify-between pt-4 border-t">
                            <div className="flex items-center gap-4 text-sm">
                                <span className="font-medium">
                                    Soumissions: {submissions.length}/{project.groups?.length || 0}
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
                                        {submissions.length > 0 ? `Voir les ${submissions.length} soumissions` : 'Voir les soumissions'}
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Submissions table */}
                        {isOpen && submissions.length > 0 && (
                            <div className="mt-4 border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50">
                                        <tr className="border-b text-left">
                                            <th className="py-3 px-4 font-medium">Groupe</th>
                                            <th className="py-3 px-4 font-medium">Statut temporel</th>
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

                                                {/* <td className="py-3 px-4">
                                                    <ConformityIndicators 
                                                        results={submission.validationResults} 
                                                    />
                                                </td> */}

                                                <td className="py-3 px-4">
                                                    <div className="space-y-1">
                                                        <SimilarityProgressBar 
                                                            value={(submission.similarityScore || 0) * 100} 
                                                        />
                                                        <span className="text-xs text-muted-foreground">
                                                            {((submission.similarityScore || 0) * 100).toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </td>

                                               <td className="py-3 px-4">
                                                    <div className="flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleDownload(submission)}
                                                        >
                                                            <Download className="h-4 w-4 mr-1" /> 
                                                            Télécharger
                                                        </Button>
                                                        
                                                        {/* 🆕 Bouton Voir détails */}
                                                       <Button
                                                            size="sm"
                                                            variant="default"
                                                            onClick={() => handleViewDetails(submission, deliverable.id)}
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
                                <p>Aucune soumission pour ce livrable</p>
                            </div>
                        )}
                    </div>
                )
            })}

            {(!project?.deliverables || project.deliverables.length === 0) && (
                <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">Aucun livrable créé</p>
                    <p className="text-sm">Créez votre premier livrable pour commencer</p>
                </div>
            )}
           {selectedSubmission && (
                <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DeliverableGroupDetails
                            deliverableId={selectedSubmission.deliverableId}
                            groupId={selectedSubmission.submission.group.id}
                            groupName={selectedSubmission.submission.group.name}
                            onClose={() => setSelectedSubmission(null)}
                        />
                    </DialogContent>
                </Dialog>
            )}
        </div>


    )
}