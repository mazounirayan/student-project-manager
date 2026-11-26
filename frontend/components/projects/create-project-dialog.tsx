"use client"

import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { errorMessage } from "@/lib/api"
import type { CreateProjectPayload } from "@/services/project.service"
import type { Promotion } from "@/services/PromotionService"
import { emptyProjectForm, payloadFromForm, projectFormProblem, ProjectFormFields } from "./project-form"

interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  promotions: Promotion[]
  /** Crée le projet ; une erreur levée s’affiche dans le formulaire, qui reste ouvert. */
  onCreate: (payload: CreateProjectPayload) => Promise<void>
}

export function CreateProjectDialog({ open, onOpenChange, promotions, onCreate }: CreateProjectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <CreateProjectForm promotions={promotions} onCreate={onCreate} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function CreateProjectForm({ promotions, onCreate, onCancel }: Pick<CreateProjectDialogProps, "promotions" | "onCreate"> & { onCancel: () => void }) {
  const [values, setValues] = useState(() => ({ ...emptyProjectForm(), promotionId: promotions.length === 1 ? String(promotions[0].id) : "" }))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const problem = projectFormProblem(values)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (problem) return
    setPending(true)
    setError(null)
    try {
      await onCreate(payloadFromForm(values))
    } catch (err) {
      setError(errorMessage(err, "Le projet n’a pas été créé. Réessayez."))
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>Nouveau projet</DialogTitle>
        <DialogDescription>Une fois créé, vous constituerez les groupes et ajouterez les livrables depuis la page du projet.</DialogDescription>
      </DialogHeader>

      <ProjectFormFields idPrefix="create-project" values={values} onChange={setValues} promotions={promotions} />

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
          {pending ? "Création…" : "Créer le projet"}
        </Button>
      </DialogFooter>
    </form>
  )
}
