'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { apiPost, errorMessage } from '@/lib/api'
import { formatNumber, gridTypeLabel, plural } from '@/lib/format'
import { loadProjectGrids, percentOf, type Grid, type GridType } from '@/lib/grading'
import { criterionBody, criterionError, CriterionFields, emptyCriterion, type CriterionDraft } from './CriterionFields'

interface CreateGradingGridDialogProps {
  projectId: number
  /** Livrables du projet, pour rattacher une grille de type Livrable à celui qu’elle évalue. */
  deliverables?: Array<{ id: number; name: string }>
  /** Valeurs proposées à l’ouverture (depuis un écran de notation qui n’a pas encore de grille). */
  preset?: { type?: GridType; deliverableId?: number; name?: string }
  label?: string
  variant?: 'default' | 'outline'
  onGridCreated?: () => void
}

const TYPES: GridType[] = ['deliverable', 'report', 'defense']

const toNumber = (text: string) => Number(text.trim().replace(',', '.'))

/** Création d’une grille : ce qu’elle évalue, son poids dans la note finale et ses critères, en une seule fois. */
export function CreateGradingGridDialog({ projectId, deliverables = [], preset, label = 'Nouvelle grille', variant = 'default', onGridCreated }: CreateGradingGridDialogProps) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<GridType>('deliverable')
  const [deliverableId, setDeliverableId] = useState('')
  const [weight, setWeight] = useState('')
  const [description, setDescription] = useState('')
  const [criteria, setCriteria] = useState<CriterionDraft[]>([emptyCriterion()])
  const [existing, setExisting] = useState<Grid[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // À chaque ouverture : on repart des valeurs proposées et on regarde ce que pèsent déjà les autres grilles.
  useEffect(() => {
    if (!open) return
    const initialType = preset?.type ?? 'deliverable'
    setName(preset?.name ?? '')
    setType(initialType)
    setDeliverableId(preset?.deliverableId ? String(preset.deliverableId) : deliverables.length === 1 ? String(deliverables[0].id) : '')
    setDescription('')
    setCriteria([emptyCriterion()])
    setError(null)
    setExisting(null)
    setWeight('')
    loadProjectGrids(projectId)
      .then((grids) => {
        setExisting(grids)
        const used = grids.reduce((sum, grid) => sum + grid.weight, 0)
        setWeight(String(Math.max(0, Math.round((1 - used) * 100))))
      })
      .catch(() => setExisting([]))
    // Les valeurs proposées ne comptent qu’à l’ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const used = (existing ?? []).reduce((sum, grid) => sum + grid.weight, 0)
  const filled = criteria.filter((criterion) => criterion.name.trim() || criterion.description.trim())
  const totalCoefficient = filled.reduce((sum, criterion) => sum + (toNumber(criterion.weight) > 0 ? toNumber(criterion.weight) : 0), 0)
  const needsDeliverable = type === 'deliverable' && deliverables.length > 0

  const updateCriterion = (index: number, value: CriterionDraft) => setCriteria((current) => current.map((item, i) => (i === index ? value : item)))

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const weightPercent = toNumber(weight)
    if (!name.trim()) return setError('Donnez un nom à la grille.')
    if (needsDeliverable && !deliverableId) return setError('Choisissez le livrable que cette grille évalue.')
    if (!Number.isFinite(weightPercent) || weightPercent < 0 || weightPercent > 100) return setError('Le poids doit être un pourcentage entre 0 et 100.')
    for (const criterion of filled) {
      const problem = criterionError(criterion)
      if (problem) return setError(`« ${criterion.name.trim() || 'Critère sans nom'} » : ${problem}`)
    }

    setError(null)
    setSaving(true)
    try {
      const grid = await apiPost<Grid>('/grading/grids', {
        projectId,
        name: name.trim(),
        type,
        weight: weightPercent / 100,
        description: description.trim() || null,
        deliverableId: type === 'deliverable' && deliverableId ? Number(deliverableId) : undefined,
      })
      const failed: string[] = []
      for (const criterion of filled) {
        try {
          await apiPost(`/grading/grids/${grid.id}/criteria`, criterionBody(criterion))
        } catch {
          failed.push(criterion.name.trim())
        }
      }
      setOpen(false)
      onGridCreated?.()
      if (failed.length > 0) {
        toast.warning(`Grille « ${grid.name} » créée, mais ${plural(failed.length, 'critère')} n’${failed.length > 1 ? 'ont' : 'a'} pas été ajouté${failed.length > 1 ? 's' : ''}.`, {
          description: `À ajouter depuis l’onglet Notation : ${failed.join(', ')}.`,
        })
      } else {
        toast.success(`Grille « ${grid.name} » créée.`, {
          description: filled.length > 0 ? `${plural(filled.length, 'critère')} ajouté${filled.length > 1 ? 's' : ''}.` : 'Ajoutez ses critères pour pouvoir noter.',
        })
      }
    } catch (err) {
      setError(errorMessage(err, 'La grille n’a pas pu être créée.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant}>
          <Plus aria-hidden="true" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouvelle grille de notation</DialogTitle>
          <DialogDescription>
            Une grille liste ce que vous évaluez. Chaque critère a un barème (sa note maximale) et un coefficient ; la note de la grille est sur 20.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="grid-name">Nom de la grille</Label>
              <Input id="grid-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex. : Évaluation du rapport" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="grid-type">Ce qu’elle évalue</Label>
              <Select value={type} onValueChange={(value) => setType(value as GridType)}>
                <SelectTrigger id="grid-type" className="w-full">
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
            {needsDeliverable && (
              <div className="grid gap-1.5">
                <Label htmlFor="grid-deliverable">Livrable évalué</Label>
                <Select value={deliverableId} onValueChange={setDeliverableId}>
                  <SelectTrigger id="grid-deliverable" className="w-full">
                    <SelectValue placeholder="Choisir un livrable" />
                  </SelectTrigger>
                  <SelectContent>
                    {deliverables.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid content-start gap-1.5 sm:col-span-2 sm:max-w-[calc(50%-0.5rem)]">
              <Label htmlFor="grid-weight">Poids dans la note finale (%)</Label>
              <Input id="grid-weight" inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              {existing === null
                ? 'Calcul de la part restante…'
                : existing.length === 0
                  ? 'C’est la première grille du projet : 100 % est la valeur habituelle.'
                  : `${existing.length === 1 ? 'L’autre grille du projet pèse' : `Les ${existing.length} autres grilles du projet pèsent`} déjà ${percentOf(used)}. Le total des grilles doit faire 100 % : vous ajusterez les poids dans l’onglet Notation.`}
            </p>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="grid-description">Description (facultatif)</Label>
              <Textarea id="grid-description" rows={2} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ce que cette évaluation regarde, en une ou deux phrases." />
            </div>
          </div>

          <fieldset className="grid gap-3">
            <legend className="text-sm font-medium">Critères</legend>
            <p className="-mt-1 text-xs text-muted-foreground">Vous pourrez en ajouter, en modifier ou en retirer plus tard depuis l’onglet Notation.</p>
            {criteria.map((criterion, index) => {
              const coefficient = toNumber(criterion.weight)
              const share = totalCoefficient > 0 && coefficient > 0 && criterion.name.trim() ? percentOf(coefficient / totalCoefficient) + ' de la note' : undefined
              return (
                <div key={index} className="grid gap-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground">Critère {index + 1}</p>
                    {criteria.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={`Retirer le critère ${index + 1}`} onClick={() => setCriteria((current) => current.filter((_, i) => i !== index))}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                  <CriterionFields idPrefix={`new-criterion-${index}`} value={criterion} onChange={(value) => updateCriterion(index, value)} withDescription={false} compact shareHint={share} />
                </div>
              )
            })}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setCriteria((current) => [...current, emptyCriterion()])}>
                <Plus aria-hidden="true" />
                Ajouter un critère
              </Button>
              <p className="text-xs tabular-nums text-muted-foreground">
                {filled.length === 0 ? 'Sans critère, la grille ne permettra pas encore de noter.' : `${plural(filled.length, 'critère')}, coefficients cumulés : ${formatNumber(totalCoefficient, 1)}`}
              </p>
            </div>
          </fieldset>

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
              Créer la grille
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
