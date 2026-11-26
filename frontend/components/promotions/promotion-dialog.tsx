"use client"

import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { errorMessage } from "@/lib/api"
import type { Promotion, PromotionForm } from "@/services/PromotionService"

interface PromotionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Promotion à modifier ; absente pour une création. */
  promotion?: Promotion
  /** Enregistre la promotion ; une erreur levée s’affiche dans le formulaire, qui reste ouvert. */
  onSubmit: (data: PromotionForm) => Promise<void>
}

export function PromotionDialog({ open, onOpenChange, promotion, onSubmit }: PromotionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <PromotionForm promotion={promotion} onSubmit={onSubmit} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function PromotionForm({ promotion, onSubmit, onCancel }: Pick<PromotionDialogProps, "promotion" | "onSubmit"> & { onCancel: () => void }) {
  const editing = Boolean(promotion)
  const [name, setName] = useState(promotion?.name ?? "")
  const [year, setYear] = useState(String(promotion?.year ?? new Date().getFullYear()))
  const [description, setDescription] = useState(promotion?.description ?? "")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      await onSubmit({ name: name.trim(), description: description.trim(), year: Number(year) })
    } catch (err) {
      setError(errorMessage(err, "L’enregistrement a échoué. Réessayez."))
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{editing ? "Modifier la promotion" : "Nouvelle promotion"}</DialogTitle>
        <DialogDescription>
          {editing ? "Le nom et l’année apparaissent dans la liste des projets." : "Vous pourrez ensuite y ajouter vos étudiants, depuis un fichier ou à la main."}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor="promotion-name">Nom</Label>
        <Input id="promotion-name" placeholder="Master 1 Informatique" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="promotion-year">Année</Label>
        <Input id="promotion-year" type="number" inputMode="numeric" min={2000} max={2100} value={year} onChange={(e) => setYear(e.target.value)} required className="sm:w-32" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="promotion-description">
          Description <span className="font-normal text-muted-foreground">(facultatif)</span>
        </Label>
        <Textarea id="promotion-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending ? "Enregistrement…" : editing ? "Enregistrer" : "Créer la promotion"}
        </Button>
      </DialogFooter>
    </form>
  )
}
