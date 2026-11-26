"use client"

import { useState } from "react"
import { GraduationCap, Plus } from "lucide-react"
import { toast } from "sonner"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { MainLayout } from "@/components/layout/main-layout"
import { PageContainer, PageHeader } from "@/components/layout/page"
import { AddStudentsDialog } from "@/components/promotions/add-students-dialog"
import { PromotionCard } from "@/components/promotions/promotion-card"
import { PromotionDialog } from "@/components/promotions/promotion-dialog"
import { StudentsDialog } from "@/components/promotions/students-dialog"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorState } from "@/components/shared/ErrorState"
import { CardsSkeleton } from "@/components/shared/Skeletons"
import { Button } from "@/components/ui/button"
import { errorMessage } from "@/lib/api"
import { confirmAction } from "@/lib/dialogs"
import { plural } from "@/lib/format"
import { fullName } from "@/lib/people"
import { sortPromotions, usePromotions } from "@/hooks/usePromotions"
import { promotionService, type Promotion, type PromotionForm, type PromotionStudent } from "@/services/PromotionService"

type Dialog = { kind: "create" } | { kind: "edit" | "students" | "add"; id: number }

export default function PromotionsPage() {
  return (
    <ProtectedRoute roles={["teacher"]}>
      <PromotionsPageContent />
    </ProtectedRoute>
  )
}

function PromotionsPageContent() {
  const { promotions, loading, error, fetchPromotions, setPromotions } = usePromotions()
  const [dialog, setDialog] = useState<Dialog | null>(null)

  const target = dialog && dialog.kind !== "create" ? promotions.find((p) => p.id === dialog.id) : undefined
  const close = () => setDialog(null)

  /** Remplace une promotion par sa version à jour en gardant ce que l’API ne renvoie pas (projets). */
  const merge = (updated: Promotion) => setPromotions((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)))

  const createPromotion = async (data: PromotionForm) => {
    const created = await promotionService.create(data)
    setPromotions((prev) => sortPromotions([...prev, { students: [], projects: [], ...created }]))
    toast.success(`Promotion « ${created.name} » créée.`)
    // L’étape suivante évidente : y mettre des étudiants.
    setDialog({ kind: "add", id: created.id })
  }

  const editPromotion = async (id: number, data: PromotionForm) => {
    merge(await promotionService.update(id, data))
    setPromotions((prev) => sortPromotions(prev))
    toast.success("Promotion mise à jour.")
    close()
  }

  const deletePromotion = async (promotion: Promotion) => {
    const projects = promotion.projects?.length ?? 0
    if (projects > 0) {
      toast.error(`« ${promotion.name} » contient ${plural(projects, "projet")}.`, {
        description: "Supprimez d’abord ces projets depuis la page Projets : une promotion qui en contient ne peut pas être supprimée.",
      })
      return
    }
    const students = promotion.students?.length ?? 0
    const confirmed = await confirmAction({
      title: `Supprimer la promotion « ${promotion.name} » ?`,
      description:
        students > 0
          ? `La promotion sera supprimée définitivement. Ses ${plural(students, "étudiant")} gardent leur compte (retrouvez-les dans Utilisateurs) mais ne seront plus rattachés à aucune promotion.`
          : "La promotion sera supprimée définitivement.",
      confirmText: "Supprimer la promotion",
      destructive: true,
    })
    if (!confirmed) return
    try {
      await promotionService.delete(promotion.id)
      setPromotions((prev) => prev.filter((p) => p.id !== promotion.id))
      toast.success(`Promotion « ${promotion.name} » supprimée.`)
    } catch (err) {
      toast.error("La promotion n’a pas été supprimée.", { description: errorMessage(err, "Réessayez dans un instant.") })
    }
  }

  const removeStudents = async (promotion: Promotion, students: PromotionStudent[]): Promise<boolean> => {
    const who = students.length === 1 ? fullName(students[0]) || students[0].email : plural(students.length, "étudiant")
    const projects = promotion.projects?.length ?? 0
    const confirmed = await confirmAction({
      title: `Retirer ${who} de la promotion ?`,
      description:
        (projects > 0
          ? `${students.length === 1 ? "Cet étudiant ne verra" : "Ces étudiants ne verront"} plus les projets de « ${promotion.name} » (${plural(projects, "projet")}) et ${students.length === 1 ? "sera retiré" : "seront retirés"} de leurs groupes. ` +
            `Les rendus déjà déposés restent au nom de chaque groupe. `
          : `${students.length === 1 ? "Cet étudiant ne fera" : "Ces étudiants ne feront"} plus partie de « ${promotion.name} ». `) +
        `${students.length === 1 ? "Son compte est conservé" : "Leurs comptes sont conservés"} et vous pourrez les ajouter de nouveau à tout moment.`,
      confirmText: "Retirer",
      destructive: true,
    })
    if (!confirmed) return false

    const results = await Promise.allSettled(students.map((student) => promotionService.deleteStudent(promotion.id, student.id)))
    const removedIds = new Set(students.filter((_, index) => results[index].status === "fulfilled").map((student) => student.id))
    setPromotions((prev) => prev.map((p) => (p.id === promotion.id ? { ...p, students: (p.students ?? []).filter((s) => !removedIds.has(s.id)) } : p)))

    const failed = students.length - removedIds.size
    if (failed === 0) toast.success(removedIds.size === 1 ? `${who} retiré de la promotion.` : `${plural(removedIds.size, "étudiant retiré", "étudiants retirés")} de la promotion.`)
    else toast.error(`${plural(failed, "étudiant n’a pas pu être retiré", "étudiants n’ont pas pu être retirés")}.`, { description: "Réessayez dans un instant." })
    return failed === 0
  }

  return (
    <MainLayout>
      <PageContainer>
        <PageHeader
          title="Promotions"
          description="Vos promotions et leurs étudiants. Préparez les listes ici avant de lancer un projet."
          actions={
            promotions.length > 0 && (
              <Button onClick={() => setDialog({ kind: "create" })}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                Nouvelle promotion
              </Button>
            )
          }
        />

        {loading ? (
          <CardsSkeleton count={2} />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchPromotions} />
        ) : promotions.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="Aucune promotion pour l’instant"
            description="Créez une promotion, puis importez la liste de vos étudiants depuis un fichier CSV ou JSON : un aperçu vous montre le résultat avant l’ajout."
            action={
              <Button onClick={() => setDialog({ kind: "create" })}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                Créer une promotion
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:gap-6">
            {promotions.map((promotion) => (
              <PromotionCard
                key={promotion.id}
                promotion={promotion}
                onShowStudents={() => setDialog({ kind: "students", id: promotion.id })}
                onAddStudents={() => setDialog({ kind: "add", id: promotion.id })}
                onEdit={() => setDialog({ kind: "edit", id: promotion.id })}
                onDelete={() => deletePromotion(promotion)}
              />
            ))}
          </div>
        )}
      </PageContainer>

      <PromotionDialog open={dialog?.kind === "create"} onOpenChange={(open) => !open && close()} onSubmit={createPromotion} />
      {target && (
        <>
          <PromotionDialog
            key={`edit-${target.id}`}
            open={dialog?.kind === "edit"}
            onOpenChange={(open) => !open && close()}
            promotion={target}
            onSubmit={(data) => editPromotion(target.id, data)}
          />
          <StudentsDialog
            open={dialog?.kind === "students"}
            onOpenChange={(open) => !open && close()}
            promotion={target}
            onAdd={() => setDialog({ kind: "add", id: target.id })}
            onRemove={(students) => removeStudents(target, students)}
          />
          <AddStudentsDialog open={dialog?.kind === "add"} onOpenChange={(open) => !open && close()} promotion={target} onAdded={merge} />
        </>
      )}
    </MainLayout>
  )
}
