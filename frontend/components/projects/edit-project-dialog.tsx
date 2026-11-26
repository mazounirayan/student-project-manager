"use client"

import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { errorMessage } from "@/lib/api"
import { groupsOf } from "@/lib/projects"
import type { Project, UpdateProjectPayload } from "@/services/project.service"
import type { Promotion } from "@/services/PromotionService"
import { formFromProject, payloadFromForm, projectFormProblem, ProjectFormFields } from "./project-form"

interface EditProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project
  promotions: Promotion[]
  /** Enregistre les modifications ; une erreur levée s’affiche dans le formulaire, qui reste ouvert. */
  onSave: (payload: UpdateProjectPayload) => Promise<void>
}

export function EditProjectDialog({ open, onOpenChange, project, promotions, onSave }: EditProjectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        {/* Remonté à chaque ouverture : le formulaire repart toujours des valeurs enregistrées. */}
        {open && <EditProjectForm project={project} promotions={promotions} onSave={onSave} onCancel={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function EditProjectForm({ project, promotions, onSave, onCancel }: Pick<EditProjectDialogProps, "project" | "promotions" | "onSave"> & { onCancel: () => void }) {
  const [values, setValues] = useState(() => formFromProject(project))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const problem = projectFormProblem(values)
  const hasGroups = groupsOf(project).length > 0

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (problem) return
    setPending(true)
    setError(null)
    try {
      await onSave(payloadFromForm(values))
    } catch (err) {
      setError(errorMessage(err, "Les modifications n’ont pas été enregistrées. Réessayez."))
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>Modifier le projet</DialogTitle>
        <DialogDescription>Les étudiants voient aussitôt les changements de description, de tailles et de dates.</DialogDescription>
      </DialogHeader>

      <ProjectFormFields idPrefix="edit-project" values={values} onChange={setValues} promotions={promotions} promotionLocked={hasGroups} />

      {(error || problem) && (
        <p role={error ? "alert" : undefined} className={error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {error ?? problem}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending || problem !== null}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </DialogFooter>
    </form>
  )
}
