"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { Deliverable, DeliverableKind } from "@/lib/deliverables"
import { formatDecimal, toDatetimeLocal } from "@/lib/format"

export interface DeliverableFormValues {
  name: string
  description: string
  type: DeliverableKind
  deadline: string
  allowLateSubmission: boolean
  penaltyPerHour: number
}

interface DeliverableDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Livrable à modifier ; absent pour une création. */
  deliverable?: Deliverable | null
  onSubmit: (values: DeliverableFormValues) => Promise<void>
}

const TYPE_HINTS: Record<DeliverableKind, string> = {
  archive: "Le groupe dépose un fichier, de préférence un .zip. Les règles de conformité peuvent en vérifier le contenu.",
  git_link: "Le groupe indique l’adresse de son dépôt. Le contenu d’un dépôt n’est pas inspecté : les règles de conformité ne s’y appliquent pas.",
}

/** Date limite proposée à la création : dans deux semaines, à 23 h 59. */
function defaultDeadline() {
  const date = new Date(Date.now() + 14 * 86_400_000)
  date.setHours(23, 59, 0, 0)
  return toDatetimeLocal(date)
}

interface FormState {
  name: string
  description: string
  type: DeliverableKind
  deadline: string
  allowLateSubmission: boolean
  penalty: string
}

const parsePenalty = (value: string) => {
  const number = Number(value.replace(",", "."))
  return Number.isFinite(number) && number >= 0 ? number : null
}

export function DeliverableDialog({ open, onOpenChange, deliverable, onSubmit }: DeliverableDialogProps) {
  const [values, setValues] = useState<FormState | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const editing = Boolean(deliverable)

  useEffect(() => {
    if (!open) return
    setValues(
      deliverable
        ? {
            name: deliverable.name,
            description: deliverable.description,
            type: deliverable.type,
            deadline: toDatetimeLocal(deliverable.deadline),
            allowLateSubmission: deliverable.allowLateSubmission,
            penalty: String(deliverable.penaltyPerHour ?? 0).replace(".", ","),
          }
        : { name: "", description: "", type: "archive", deadline: defaultDeadline(), allowLateSubmission: true, penalty: "1" },
    )
  }, [open, deliverable])

  if (!values) return null

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => setValues((prev) => (prev ? { ...prev, [field]: value } : prev))
  const penalty = parsePenalty(values.penalty)
  const invalidPenalty = values.allowLateSubmission && penalty === null

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (invalidPenalty) return
    setSubmitting(true)
    try {
      await onSubmit({
        name: values.name.trim(),
        description: values.description.trim(),
        type: values.type,
        deadline: new Date(values.deadline).toISOString(),
        allowLateSubmission: values.allowLateSubmission,
        penaltyPerHour: values.allowLateSubmission ? (penalty ?? 0) : 0,
      })
      onOpenChange(false)
    } catch {
      // l’appelant affiche l’erreur ; la boîte reste ouverte pour corriger
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier le livrable" : "Nouveau livrable"}</DialogTitle>
          <DialogDescription>
            Ce que chaque groupe doit rendre, et pour quand.
            {!editing && " Vous pourrez ensuite ajouter des règles de conformité (fichiers requis, taille maximale…)."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deliverable-name">Nom</Label>
            <Input id="deliverable-name" value={values.name} onChange={(e) => update("name", e.target.value)} placeholder="Cahier des charges" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deliverable-description">Consigne pour les étudiants</Label>
            <Textarea
              id="deliverable-description"
              value={values.description}
              onChange={(e) => update("description", e.target.value)}
              rows={3}
              placeholder="Ce que le rendu doit contenir."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deliverable-type">Forme du rendu</Label>
            <Select value={values.type} onValueChange={(value) => update("type", value as DeliverableKind)}>
              <SelectTrigger id="deliverable-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="archive">Une archive (.zip)</SelectItem>
                <SelectItem value="git_link">Un lien vers un dépôt Git</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{TYPE_HINTS[values.type]}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deliverable-deadline">Date limite</Label>
            <Input id="deliverable-deadline" type="datetime-local" value={values.deadline} onChange={(e) => update("deadline", e.target.value)} required />
            {!editing && values.deadline && new Date(values.deadline).getTime() < Date.now() && (
              <p className="text-xs text-destructive">Cette date est déjà passée : les rendus seraient tous en retard.</p>
            )}
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="deliverable-late">Accepter les rendus en retard</Label>
                <p className="text-xs text-muted-foreground">
                  {values.allowLateSubmission
                    ? "Les groupes peuvent rendre après la date limite, avec une pénalité."
                    : "Après la date limite, le dépôt est fermé."}
                </p>
              </div>
              <Switch id="deliverable-late" checked={values.allowLateSubmission} onCheckedChange={(checked) => update("allowLateSubmission", checked)} />
            </div>

            {values.allowLateSubmission && (
              <div className="space-y-2">
                <Label htmlFor="deliverable-penalty">Points retirés par heure de retard</Label>
                <Input
                  id="deliverable-penalty"
                  inputMode="decimal"
                  value={values.penalty}
                  onChange={(e) => update("penalty", e.target.value)}
                  aria-invalid={invalidPenalty}
                  className="max-w-32"
                />
                <p className={invalidPenalty ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                  {invalidPenalty
                    ? "Indiquez un nombre positif ou nul, par exemple 0,5."
                    : `Toute heure entamée compte. Exemple : un rendu 5 h 10 en retard perd ${formatDecimal(6 * (penalty ?? 0))} ${6 * (penalty ?? 0) >= 2 ? "points" : "point"}.`}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={submitting || invalidPenalty}>
              {submitting ? "Enregistrement…" : editing ? "Enregistrer" : "Créer le livrable"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
