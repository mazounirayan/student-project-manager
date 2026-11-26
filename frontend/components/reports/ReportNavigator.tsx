'use client'

import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { STATE_LABELS, type GroupOverview } from '@/lib/reports'

interface ReportNavigatorProps {
  /** Groupes dont le rapport peut être lu, dans l’ordre de la liste. */
  rows: GroupOverview[]
  currentGroupId: number
  onSelect: (groupId: number) => void
  onBack: () => void
}

/** Retour à la liste, choix d’un groupe et passage au rapport précédent ou suivant. */
export function ReportNavigator({ rows, currentGroupId, onSelect, onBack }: ReportNavigatorProps) {
  const index = rows.findIndex((row) => row.group.id === currentGroupId)
  const previous = rows[index - 1]
  const next = rows[index + 1]

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
        <ArrowLeft aria-hidden="true" />
        Tous les groupes
      </Button>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => previous && onSelect(previous.group.id)} disabled={!previous} aria-label={previous ? `Rapport précédent : ${previous.group.name}` : 'Rapport précédent'}>
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Select value={String(currentGroupId)} onValueChange={(value) => onSelect(Number(value))}>
          <SelectTrigger aria-label="Choisir un groupe" className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {rows.map((row) => (
              <SelectItem key={row.group.id} value={String(row.group.id)}>
                {row.group.name} · {STATE_LABELS[row.state].toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => next && onSelect(next.group.id)} disabled={!next} aria-label={next ? `Rapport suivant : ${next.group.name}` : 'Rapport suivant'}>
          <ChevronRight aria-hidden="true" />
        </Button>
        <span className="text-sm tabular-nums text-muted-foreground" aria-hidden="true">
          {index + 1} / {rows.length}
        </span>
      </div>
    </div>
  )
}
