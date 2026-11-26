'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, Loader2, Save } from 'lucide-react'
import { SectionCard } from '@/components/shared/SectionCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiPut, errorMessage } from '@/lib/api'
import { confirmAction } from '@/lib/dialogs'
import { formatNumber, gridTypeLabel } from '@/lib/format'
import type { Grid } from '@/lib/grading'

interface ProjectGradingOverviewProps {
  projectId: number
  grids: Grid[]
  onSaved: () => void | Promise<void>
}

const toPercent = (weight: number) => String(Math.round(weight * 1000) / 10).replace('.', ',')
const toNumber = (text: string) => {
  const value = Number(text.trim().replace(',', '.'))
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0
}

/** Part de chaque grille dans la note finale du projet : saisie en pourcentage, total toujours visible. */
export function ProjectGradingOverview({ projectId, grids, onSaved }: ProjectGradingOverviewProps) {
  const saved = useMemo(() => Object.fromEntries(grids.map((grid) => [grid.id, toPercent(grid.weight)])), [grids])
  const [values, setValues] = useState<Record<number, string>>(saved)
  const [saving, setSaving] = useState(false)

  useEffect(() => setValues(saved), [saved])

  const total = grids.reduce((sum, grid) => sum + toNumber(values[grid.id] ?? '0'), 0)
  const balanced = Math.abs(total - 100) < 0.05
  const dirty = grids.some((grid) => (values[grid.id] ?? '') !== saved[grid.id])

  // Parts égales à 0,1 % près ; la dernière grille absorbe l’arrondi pour que le total fasse exactement 100 %.
  const distribute = () => {
    const share = Math.round(1000 / grids.length) / 10
    setValues(Object.fromEntries(grids.map((grid, index) => [grid.id, String(index === grids.length - 1 ? Math.round((100 - share * (grids.length - 1)) * 10) / 10 : share).replace('.', ',')])))
  }
  const normalize = () => {
    if (total === 0) return
    setValues(Object.fromEntries(grids.map((grid) => [grid.id, String(Math.round((toNumber(values[grid.id] ?? '0') / total) * 1000) / 10).replace('.', ',')])))
  }

  async function save() {
    if (!balanced) {
      const confirmed = await confirmAction({
        title: 'Ramener le total à 100 % ?',
        description: `Le total fait ${formatNumber(total, 1)} % au lieu de 100 %. Les poids seront ramenés proportionnellement à 100 % avant l’enregistrement.`,
        confirmText: 'Ajuster et enregistrer',
      })
      if (!confirmed) return
    }
    setSaving(true)
    try {
      await apiPut(`/grading/projects/${projectId}/weights`, {
        weights: grids.map((grid) => ({ id: grid.id, weight: balanced || total === 0 ? toNumber(values[grid.id] ?? '0') / 100 : toNumber(values[grid.id] ?? '0') / total })),
      })
      toast.success('Pondération enregistrée.')
      await onSaved()
    } catch (error) {
      toast.error('La pondération n’a pas été enregistrée.', { description: errorMessage(error, 'Réessayez dans un instant.') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard title="Pondération des grilles" description="Part de chaque grille dans la note finale du projet. Le total doit faire 100 %.">
      <div className="space-y-4">
        <ul className="divide-y rounded-lg border">
          {grids.map((grid) => (
            <li key={grid.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2.5">
              <div className="min-w-0 flex-[1_1_12rem]">
                <Label htmlFor={`weight-${grid.id}`} className="font-medium">
                  {grid.name}
                </Label>
                <p className="text-xs text-muted-foreground">{gridTypeLabel(grid.type)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id={`weight-${grid.id}`}
                  inputMode="decimal"
                  className="w-20 text-right tabular-nums"
                  value={values[grid.id] ?? ''}
                  onChange={(event) => setValues((current) => ({ ...current, [grid.id]: event.target.value }))}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <p className={balanced ? 'flex items-center gap-1.5 text-sm font-medium' : 'flex items-center gap-1.5 text-sm font-medium text-destructive'}>
            {balanced ? <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-primary" /> : <AlertTriangle aria-hidden="true" className="h-4 w-4" />}
            Total : {formatNumber(total, 1)} %
            {!balanced && <span className="font-normal"> ({total < 100 ? `il manque ${formatNumber(100 - total, 1)} %` : `${formatNumber(total - 100, 1)} % en trop`})</span>}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={distribute} disabled={grids.length < 2}>
              Répartir équitablement
            </Button>
            <Button variant="outline" size="sm" onClick={normalize} disabled={balanced || total === 0}>
              Ramener à 100 %
            </Button>
            <Button size="sm" onClick={save} disabled={saving || !dirty}>
              {saving ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
              Enregistrer
            </Button>
          </div>
        </div>
      </div>
    </SectionCard>
  )
}
