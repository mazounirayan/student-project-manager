'use client'

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Trash2, UserX, CheckSquare, Square } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/components/ui/use-toast"

interface Student {
  id: number
  firstName: string
  lastName: string
  email: string
}

interface ManageStudentsDialogProps {
  promotionId: number
  promotionName: string
  students: Student[]
  onDeleteStudent: (promotionId: number, studentId: number) => Promise<void>
  trigger: React.ReactNode
}

export function ManageStudentsDialog({
  promotionId,
  promotionName,
  students,
  onDeleteStudent,
  trigger
}: ManageStudentsDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [deleting, setDeleting] = useState(false)

  const allSelected = selectedIds.length === students.length && students.length > 0


  const toggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds([])
    else setSelectedIds(students.map(s => s.id))
  }


  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`Supprimer ${selectedIds.length} étudiant(s) ?`)) return

    setDeleting(true)
    try {
      for (const id of selectedIds) {
        await onDeleteStudent(promotionId, id)
      }
      toast({
        title: "Suppression réussie",
        description: `${selectedIds.length} étudiant(s) supprimé(s).`
      })
      setSelectedIds([])
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer un ou plusieurs étudiants.",
        variant: "destructive"
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gérer les étudiants</DialogTitle>
          <DialogDescription>
            Promotion : {promotionName} – {students.length} étudiant(s)
          </DialogDescription>
        </DialogHeader>

        {students.length === 0 ? (
          <Alert>
            <UserX className="h-4 w-4" />
            <AlertDescription>
              Aucun étudiant dans cette promotion.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="flex justify-between items-center mb-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSelectAll}
              >
                {allSelected ? (
                  <>
                    <Square className="h-4 w-4 mr-1" />
                    Tout désélectionner
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-4 w-4 mr-1" />
                    Tout sélectionner
                  </>
                )}
              </Button>

              <Button
                variant="destructive"
                size="sm"
                disabled={selectedIds.length === 0 || deleting}
                onClick={handleBulkDelete}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {deleting ? "Suppression..." : `Supprimer (${selectedIds.length})`}
              </Button>
            </div>

            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {students.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Checkbox
                        checked={selectedIds.includes(student.id)}
                        onCheckedChange={() => toggleSelect(student.id)}
                      />
                      <div>
                        <p className="font-medium">
                          {student.firstName} {student.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {student.email}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
