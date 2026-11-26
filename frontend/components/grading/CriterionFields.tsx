'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Criterion } from '@/lib/grading'

/** Saisie d’un critère : les nombres restent du texte jusqu’à l’enregistrement (virgule ou point acceptés). */
export interface CriterionDraft {
  name: string
  description: string
  maxScore: string
  weight: string
  hasComments: boolean
}

export const emptyCriterion = (): CriterionDraft => ({ name: '', description: '', maxScore: '20', weight: '1', hasComments: false })

export const draftOfCriterion = (criterion: Criterion): CriterionDraft => ({
  name: criterion.name,
  description: criterion.description ?? '',
  maxScore: String(criterion.maxScore).replace('.', ','),
  weight: String(criterion.weight).replace('.', ','),
  hasComments: Boolean(criterion.hasComments),
})

const toNumber = (text: string) => Number(text.trim().replace(',', '.'))

/** Ce qui empêche d’enregistrer ce critère, ou null s’il est valable. */
export function criterionError(draft: CriterionDraft): string | null {
  if (!draft.name.trim()) return 'Donnez un nom au critère.'
  const max = toNumber(draft.maxScore)
  if (!Number.isFinite(max) || max <= 0) return 'Le barème doit être un nombre supérieur à 0.'
  const weight = toNumber(draft.weight)
  if (!Number.isFinite(weight) || weight <= 0) return 'Le coefficient doit être un nombre supérieur à 0.'
  return null
}

export const criterionBody = (draft: CriterionDraft) => ({
  name: draft.name.trim(),
  description: draft.description.trim() || null,
  maxScore: toNumber(draft.maxScore),
  weight: toNumber(draft.weight),
  hasComments: draft.hasComments,
})

interface CriterionFieldsProps {
  idPrefix: string
  value: CriterionDraft
  onChange: (value: CriterionDraft) => void
  withDescription?: boolean
  /** Une ligne par critère, sans les explications : pour saisir plusieurs critères à la suite. */
  compact?: boolean
  /** Part du critère dans la note de la grille, affichée sous le coefficient. */
  shareHint?: string
}

/** Nom, barème, coefficient et « commentaire attendu » d’un critère. */
export function CriterionFields({ idPrefix, value, onChange, withDescription = true, compact = false, shareHint }: CriterionFieldsProps) {
  const set = (patch: Partial<CriterionDraft>) => onChange({ ...value, ...patch })

  if (compact) {
    return (
      <div className="grid gap-2">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem]">
          <div className="grid gap-1.5">
            <Label htmlFor={`${idPrefix}-name`}>Nom du critère</Label>
            <Input id={`${idPrefix}-name`} value={value.name} onChange={(event) => set({ name: event.target.value })} placeholder="Ex. : Qualité du code" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${idPrefix}-max`}>Barème</Label>
            <Input id={`${idPrefix}-max`} inputMode="decimal" value={value.maxScore} onChange={(event) => set({ maxScore: event.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${idPrefix}-weight`}>Coefficient</Label>
            <Input id={`${idPrefix}-weight`} inputMode="decimal" value={value.weight} onChange={(event) => set({ weight: event.target.value })} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id={`${idPrefix}-comments`} checked={value.hasComments} onCheckedChange={(checked) => set({ hasComments: checked === true })} />
          <Label htmlFor={`${idPrefix}-comments`} className="font-normal">
            Commentaire attendu
          </Label>
          {shareHint && <span className="ml-auto text-xs tabular-nums text-muted-foreground">{shareHint}</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-name`}>Nom du critère</Label>
        <Input id={`${idPrefix}-name`} value={value.name} onChange={(event) => set({ name: event.target.value })} placeholder="Ex. : Qualité du code" />
      </div>
      {withDescription && (
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-description`}>Ce qu’on regarde (facultatif)</Label>
          <Textarea
            id={`${idPrefix}-description`}
            rows={2}
            value={value.description}
            onChange={(event) => set({ description: event.target.value })}
            placeholder="Ex. : lisibilité, découpage en fonctions, tests présents"
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-max`}>Barème (note maximale)</Label>
          <Input id={`${idPrefix}-max`} inputMode="decimal" value={value.maxScore} onChange={(event) => set({ maxScore: event.target.value })} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-weight`}>Coefficient</Label>
          <Input id={`${idPrefix}-weight`} inputMode="decimal" value={value.weight} onChange={(event) => set({ weight: event.target.value })} />
        </div>
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">
        Un critère de coefficient 2 compte deux fois plus qu’un critère de coefficient 1. {shareHint}
      </p>
      <div className="flex items-start gap-2">
        <Checkbox id={`${idPrefix}-comments`} checked={value.hasComments} onCheckedChange={(checked) => set({ hasComments: checked === true })} className="mt-0.5" />
        <Label htmlFor={`${idPrefix}-comments`} className="grid gap-0.5 font-normal">
          <span className="font-medium">Commentaire attendu</span>
          <span className="text-xs text-muted-foreground">Il faudra justifier la note de ce critère avant de pouvoir valider.</span>
        </Label>
      </div>
    </div>
  )
}
