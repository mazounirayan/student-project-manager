"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toDatetimeLocal } from "@/lib/format"

export interface DeliverableFormValues {
  name: string
  description: string
  type: "archive" | "git_link"
  deadline: string
  allowLateSubmission: boolean
  penaltyPerHour: number
}

interface DeliverableDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Livrable à modifier ; absent pour une création. */
  deliverable?: Partial<DeliverableFormValues> | null
  onSubmit: (values: DeliverableFormValues) => Promise<void>
}

const EMPTY: DeliverableFormValues = {
  name: "",
  description: "",
  type: "archive",
  deadline: "",
  allowLateSubmission: true,
  penaltyPerHour: 1,
}

export function DeliverableDialog({ open, onOpenChange, deliverable, onSubmit }: DeliverableDialogProps) {
  const [values, setValues] = useState<DeliverableFormValues>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const editing = Boolean(deliverable)

  useEffect(() => {
    if (!open) return
    setValues(
      deliverable
        ? {
            name: deliverable.name ?? "",
            description: deliverable.description ?? "",
            type: deliverable.type ?? "archive",
            deadline: toDatetimeLocal(deliverable.deadline),
            allowLateSubmission: deliverable.allowLateSubmission ?? true,
            penaltyPerHour: deliverable.penaltyPerHour ?? 0,
          }
        : EMPTY,
    )
  }, [open, deliverable])

  const update = <K extends keyof DeliverableFormValues>(field: K, value: DeliverableFormValues[K]) =>
    setValues((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    try {
      await onSubmit({ ...values, deadline: new Date(values.deadline).toISOString() })
      onOpenChange(false)
    } catch {
      // l’appelant affiche l’erreur ; la boîte reste ouverte pour corriger
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier le livrable" : "Nouveau livrable"}</DialogTitle>
          <DialogDescription>Nom, type de rendu, échéance et règles de retard.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deliverable-name">Nom</Label>
            <Input
              id="deliverable-name"
              value={values.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Livrable 1 – Analyse"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deliverable-description">Description</Label>
            <Textarea
              id="deliverable-description"
              value={values.description}
              onChange={(e) => update("description", e.target.value)}
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deliverable-type">Type de rendu</Label>
            <Select value={values.type} onValueChange={(value) => update("type", value as DeliverableFormValues["type"])}>
              <SelectTrigger id="deliverable-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="archive">Archive (.zip, .rar…)</SelectItem>
                <SelectItem value="git_link">Lien vers un dépôt Git</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deliverable-deadline">Date limite</Label>
            <Input
              id="deliverable-deadline"
              type="datetime-local"
              value={values.deadline}
              onChange={(e) => update("deadline", e.target.value)}
              required
            />
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4 border-t pt-4">
            <div className="space-y-0.5">
              <Label htmlFor="deliverable-late">Rendus tardifs autorisés</Label>
              <p className="text-xs text-muted-foreground">Les étudiants peuvent rendre après la date limite.</p>
            </div>
            <Switch
              id="deliverable-late"
              checked={values.allowLateSubmission}
              onCheckedChange={(checked) => update("allowLateSubmission", checked)}
            />
          </div>

          {values.allowLateSubmission && (
            <div className="space-y-2">
              <Label htmlFor="deliverable-penalty">Pénalité par heure de retard (points)</Label>
              <Input
                id="deliverable-penalty"
                type="number"
                min="0"
                step="0.1"
                value={values.penaltyPerHour}
                onChange={(e) => update("penaltyPerHour", Number(e.target.value) || 0)}
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Enregistrement…" : editing ? "Enregistrer" : "Créer le livrable"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
