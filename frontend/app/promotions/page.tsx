"use client"

import { usePromotions } from "@/hooks/usePromotions"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Calendar, MoreHorizontal } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { CreatePromotionDialog } from "@/components/promotions/create-promotion-dialog"
import { StudentsListDialog } from "@/components/promotions/students-list-dialog"
import { EditPromotionDialog } from "@/components/promotions/edit-promition-dialog"
import { AddStudentsDialog } from "@/components/promotions/add-students-dialog"
import { ManageStudentsDialog } from "@/components/promotions/manage-students-dialog"
import { toast } from "sonner"
import { promotionService } from "@/services/PromotionService"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { ErrorState } from "@/components/shared/ErrorState"
import { EmptyState } from "@/components/shared/EmptyState"
import { CardsSkeleton } from "@/components/shared/Skeletons"
import { useState } from "react"
import type { Promotion } from "@/services/PromotionService"

export default function PromotionsPage() {
  return (
    <ProtectedRoute roles={["teacher"]}>
      <PromotionsPageContent />
    </ProtectedRoute>
  )
}

function PromotionsPageContent() {
  const { promotions, loading, error, fetchPromotions, setPromotions } = usePromotions()
  const [pendingDelete, setPendingDelete] = useState<Promotion | null>(null)

  const handleCreatePromotion = async (data: { name: string; description: string; year: number }) => {
    try {
      const newPromotion = await promotionService.create(data)
      setPromotions((prev) => [...prev, newPromotion])
      toast.success("Promotion créée.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la création de la promotion.")
    }
  }

  const handleEditPromotion = async (id: number, data: { name: string; description: string; year: number }) => {
    try {
      const updated = await promotionService.update(id, data)
      setPromotions((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)))
      toast.success("Promotion mise à jour.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de modifier la promotion.")
    }
  }

  const confirmDeletePromotion = async () => {
    if (!pendingDelete) return
    try {
      await promotionService.delete(pendingDelete.id)
      setPromotions((prev) => prev.filter((p) => p.id !== pendingDelete.id))
      toast.success("Promotion supprimée.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la suppression de la promotion.")
    } finally {
      setPendingDelete(null)
    }
  }

  const handleAddStudents = async (promotionId: number, students: { nom: string; prenom: string; email: string }[]) => {
    try {
      await promotionService.addStudents(promotionId, students)
      toast.success("Étudiants ajoutés.")
      await fetchPromotions()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l’ajout des étudiants.")
    }
  }

  const handleAddStudentsFile = async (promotionId: number, file: File) => {
    try {
      await promotionService.importFile(promotionId, file)
      toast.success("Fichier importé.")
      await fetchPromotions()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l’import du fichier.")
    }
  }

  const confirmDeleteStudent = async (promotionId: number, studentId: number) => {
    if (!window.confirm("Supprimer cet étudiant de la promotion ?")) return
    try {
      await promotionService.deleteStudent(promotionId, studentId)
      toast.success("Étudiant retiré de la promotion.")
      setPromotions((prev) =>
        prev.map((p) =>
          p.id === promotionId
            ? { ...p, students: (p.students ?? []).filter((s) => s.id !== studentId) }
            : p
        )
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la suppression de l’étudiant.")
    }
  }

  return (
    <MainLayout>
      <div className="p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Promotions</h1>
            <p className="text-muted-foreground">Vos promotions et leurs étudiants.</p>
          </div>
          <CreatePromotionDialog onCreatePromotion={handleCreatePromotion} />
        </div>

        {loading ? (
          <CardsSkeleton count={3} />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchPromotions} />
        ) : promotions.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Aucune promotion pour l’instant"
            description="Créez une première promotion pour y ajouter vos étudiants et lancer des projets."
          />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {promotions.map((promotion) => {
              // Adapter les étudiants de l’API vers la forme attendue par les dialogues.
              const dialogStudents = (promotion.students ?? []).map((s) => ({
                id: s.id,
                name: `${s.firstName} ${s.lastName}`.trim(),
                email: s.email,
                firstName: s.firstName,
                lastName: s.lastName,
                promotionId: String(promotion.id),
                groupId: undefined,
                createdAt: new Date(),
              })) as unknown as import("@/types/project").Student[]
              return (
              <Card key={promotion.id} className="transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-wrap justify-between items-center">
                  <div>
                    <CardTitle className="text-lg">{promotion.name}</CardTitle>
                    <CardDescription className="flex items-center">
                      <Calendar aria-hidden="true" className="mr-1 h-3 w-3" />
                      {promotion.year}
                    </CardDescription>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Actions sur la promotion">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <EditPromotionDialog
                        promotion={{
                          id: String(promotion.id),
                          name: promotion.name,
                          description: promotion.description ?? "",
                          year: String(promotion.year),
                        }}
                        onEditPromotion={(data) => handleEditPromotion(promotion.id, data)}
                        trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Modifier</DropdownMenuItem>}
                      />
                      <AddStudentsDialog
                        promotionId={promotion.id}
                        promotionName={promotion.name}
                        onAddStudents={handleAddStudents}
                        onAddStudentsFile={handleAddStudentsFile}
                        trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Ajouter des étudiants</DropdownMenuItem>}
                      />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setPendingDelete(promotion)}
                      >
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>

                <CardContent>
                  <div className="flex flex-wrap items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Users aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {promotion.students?.length ?? 0} étudiant(s)
                      </span>
                    </div>
                    <Badge variant="secondary">Active</Badge>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <StudentsListDialog
                      promotionName={promotion.name}
                      students={dialogStudents}
                      trigger={
                        <Button variant="outline" size="sm" className="flex-1">
                          Voir
                        </Button>
                      }
                    />
                    <ManageStudentsDialog
                      promotionId={promotion.id}
                      promotionName={promotion.name}
                      students={dialogStudents as unknown as { id: number; firstName: string; lastName: string; email: string }[]}
                      onDeleteStudent={confirmDeleteStudent}
                      trigger={<Button size="sm" className="flex-1">Gérer</Button>}
                    />
                  </div>
                </CardContent>
              </Card>
              )
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => { if (!open) setPendingDelete(null) }}
        onConfirm={confirmDeletePromotion}
        title="Supprimer cette promotion ?"
        description={`« ${pendingDelete?.name ?? "" } » sera définitivement supprimée. Une promotion qui contient des projets ne peut pas être supprimée.`}
        confirmText="Supprimer"
        variant="destructive"
      />
    </MainLayout>
  )
}
