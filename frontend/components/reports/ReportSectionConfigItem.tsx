'use client'

import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

/** Section en cours d’édition : la limite de mots reste du texte tant que le formulaire n’est pas enregistré. */
export interface SectionDraft {
  /** Identifiant local, stable pendant l’édition (l’ordre change, pas l’identité). */
  uid: string
  /** Identifiant en base ; absent pour une section ajoutée mais pas encore enregistrée. */
  id?: number
  title: string
  description: string
  required: boolean
  wordLimit: string
}

export interface SectionErrors {
  title?: string
  wordLimit?: string
}

interface ReportSectionConfigItemProps {
  section: SectionDraft
  position: number
  count: number
  errors?: SectionErrors
  onUpdate: (updates: Partial<SectionDraft>) => void
  onRemove: () => void
  onMove: (delta: -1 | 1) => void
}

/** Une section du rapport : titre, consignes pour les étudiants, caractère obligatoire, limite de mots. */
export function ReportSectionConfigItem({ section, position, count, errors, onUpdate, onRemove, onMove }: ReportSectionConfigItemProps) {
  const name = section.title.trim() ? `« ${section.title.trim()} »` : String(position)
  const field = (name: string) => `section-${section.uid}-${name}`

  return (
    <li className="space-y-4 rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-7 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums text-muted-foreground"
        >
          {position}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor={field('title')}>Titre de la section {position}</Label>
          <Input
            id={field('title')}
            value={section.title}
            onChange={(event) => onUpdate({ title: event.target.value })}
            placeholder="Ex. : Introduction et contexte"
            aria-invalid={Boolean(errors?.title)}
            aria-describedby={errors?.title ? field('title-error') : undefined}
            maxLength={255}
          />
          {errors?.title && (
            <p id={field('title-error')} className="text-sm text-destructive">
              {errors.title}
            </p>
          )}
        </div>
        <div className="mt-6 flex shrink-0 items-center">
          <Button type="button" variant="ghost" size="icon" onClick={() => onMove(-1)} disabled={position === 1} aria-label={`Monter la section ${name}`}>
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => onMove(1)} disabled={position === count} aria-label={`Descendre la section ${name}`}>
            <ArrowDown aria-hidden="true" />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={onRemove} className="text-destructive hover:text-destructive" aria-label={`Retirer la section ${name}`}>
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="space-y-2 sm:pl-9">
        <Label htmlFor={field('description')}>Consignes pour les étudiants</Label>
        <Textarea
          id={field('description')}
          value={section.description}
          onChange={(event) => onUpdate({ description: event.target.value })}
          placeholder="Ce que cette section doit contenir. Les étudiants la voient à côté de l’éditeur."
          rows={3}
        />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 sm:pl-9">
        <div className="flex items-center gap-2">
          <Switch id={field('required')} checked={section.required} onCheckedChange={(required) => onUpdate({ required })} className="data-[state=unchecked]:bg-muted-foreground/40" />
          <Label htmlFor={field('required')} className="font-normal">
            Section obligatoire
            <span className="ml-1 text-muted-foreground">(le rapport ne peut pas être rendu sans elle)</span>
          </Label>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={field('wordlimit')}>Limite de mots (facultatif)</Label>
          <Input
            id={field('wordlimit')}
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={section.wordLimit}
            onChange={(event) => onUpdate({ wordLimit: event.target.value })}
            placeholder="Ex. : 400"
            className="w-40"
            aria-invalid={Boolean(errors?.wordLimit)}
            aria-describedby={errors?.wordLimit ? field('wordlimit-error') : undefined}
          />
          {errors?.wordLimit && (
            <p id={field('wordlimit-error')} className="text-sm text-destructive">
              {errors.wordLimit}
            </p>
          )}
        </div>
      </div>
    </li>
  )
}
