'use client'

import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Loader2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { apiPut, errorMessage } from '@/lib/api'
import { gridTypeLabel } from '@/lib/format'
import type { Grid, GridType } from '@/lib/grading'

interface EditGradingGridDialogProps {
  grid: Grid
  deliverables?: Array<{ id: number; name: string }>
  onGridUpdated?: () => void
}

const TYPES: GridType[] = ['deliverable', 'report', 'defense']
const NO_DELIVERABLE = 'none'

const toNumber = (text: string) => Number(text.trim().replace(',', '.'))

/** Modification du nom, du type, du livrable évalué, du poids et de la description d’une grille. */
export function EditGradingGridDialog({ grid, deliverables = [], onGridUpdated }: EditGradingGridDialogProps) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState(grid.name)
  const [type, setType] = useState<GridType>(grid.type)
  const [deliverableId, setDeliverableId] = useState(grid.deliverableId ? String(grid.deliverableId) : NO_DELIVERABLE)
  const [weight, setWeight] = useState(String(Math.round(grid.weight * 1000) / 10).replace('.', ','))
  const [description, setDescription] = useState(grid.description ?? '')

  const reset = (next: boolean) => {
    if (next) {
      setName(grid.name)
      setType(grid.type)
      setDeliverableId(grid.deliverableId ? String(grid.deliverableId) : NO_DELIVERABLE)
      setWeight(String(Math.round(grid.weight * 1000) / 10).replace('.', ','))
      setDescription(grid.description ?? '')
      setError(null)
    }
    setOpen(next)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const percent = toNumber(weight)
    if (!name.trim()) return setError('Donnez un nom à la grille.')
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) return setError('Le poids doit être un pourcentage entre 0 et 100.')
    setError(null)
    setSaving(true)
    try {
      await apiPut(`/grading/grids/${grid.id}`, {
        name: name.trim(),
        type,
        weight: percent / 100,
        description: description.trim() || null,
        deliverableId: type === 'deliverable' && deliverableId !== NO_DELIVERABLE ? Number(deliverableId) : null,
      })
      setOpen(false)
      toast.success(`Grille « ${name.trim()} » mise à jour.`)
      onGridUpdated?.()
    } catch (err) {
      setError(errorMessage(err, 'La grille n’a pas pu être modifiée.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil aria-hidden="true" />
          Modifier
          <span className="sr-only"> la grille {grid.name}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier la grille</DialogTitle>
          <DialogDescription>Les critères se modifient directement dans la carte de la grille.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor={`edit-grid-name-${grid.id}`}>Nom de la grille</Label>
            <Input id={`edit-grid-name-${grid.id}`} value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`edit-grid-type-${grid.id}`}>Ce qu’elle évalue</Label>
              <Select value={type} onValueChange={(value) => setType(value as GridType)}>
                <SelectTrigger id={`edit-grid-type-${grid.id}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {gridTypeLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`edit-grid-weight-${grid.id}`}>Poids dans la note finale (%)</Label>
              <Input id={`edit-grid-weight-${grid.id}`} inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} />
            </div>
          </div>
          {type === 'deliverable' && deliverables.length > 0 && (
            <div className="grid gap-1.5">
              <Label htmlFor={`edit-grid-deliverable-${grid.id}`}>Livrable évalué</Label>
              <Select value={deliverableId} onValueChange={setDeliverableId}>
                <SelectTrigger id={`edit-grid-deliverable-${grid.id}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DELIVERABLE}>Aucun livrable précis</SelectItem>
                  {deliverables.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {deliverableId === NO_DELIVERABLE && <p className="text-xs text-muted-foreground">Sans livrable, la grille n’apparaît dans aucun livrable au moment de noter.</p>}
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor={`edit-grid-description-${grid.id}`}>Description (facultatif)</Label>
            <Textarea id={`edit-grid-description-${grid.id}`} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 aria-hidden="true" className="animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
