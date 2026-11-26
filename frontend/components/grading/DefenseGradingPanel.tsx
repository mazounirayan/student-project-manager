'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Presentation } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { CardsSkeleton } from '@/components/shared/Skeletons'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { errorMessage } from '@/lib/api'
import { formatFullDateTime, formatTime } from '@/lib/format'
import { memberNames } from '@/lib/people'
import { loadProjectGrids, type Grid } from '@/lib/grading'
import { CreateGradingGridDialog } from './CreateGradingGridDialog'
import { GridGradingWorkspace, type GradableGroup } from './GridGradingWorkspace'

interface DefenseSlot {
  group?: { id: number; name: string } | null
  startTime: string
  orderIndex: number
  location?: string | null
}

interface DefenseGradingPanelProps {
  projectId: number
  groups: Array<{ id: number; name: string; members?: Array<{ firstName: string; lastName: string }> }>
  defenses: DefenseSlot[]
  initialGroupId?: number
  onChanged?: () => void
}

/** Notation des soutenances : les groupes dans l’ordre de passage, leur créneau et leurs membres sous les yeux. */
export function DefenseGradingPanel({ projectId, groups, defenses, initialGroupId, onChanged }: DefenseGradingPanelProps) {
  const [grids, setGrids] = useState<Grid[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [gridId, setGridId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const list = await loadProjectGrids(projectId, 'defense')
      setGrids(list)
      setGridId((current) => (list.some((grid) => grid.id === current) ? current : (list[0]?.id ?? null)))
    } catch (err) {
      setError(errorMessage(err, 'Impossible de charger la grille de notation des soutenances.'))
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  const slotOf = useCallback((groupId: number) => defenses.find((defense) => defense.group?.id === groupId), [defenses])

  // Dans l’ordre de passage ; les groupes sans créneau viennent après.
  const rows = useMemo<GradableGroup[]>(
    () =>
      [...groups]
        .sort((a, b) => (slotOf(a.id)?.orderIndex ?? Infinity) - (slotOf(b.id)?.orderIndex ?? Infinity))
        .map((group) => {
          const slot = slotOf(group.id)
          return { id: group.id, name: group.name, members: memberNames(group.members), note: slot ? `Passage ${slot.orderIndex}, ${formatTime(slot.startTime)}` : 'Pas de créneau' }
        }),
    [groups, slotOf],
  )

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!grids) return <CardsSkeleton count={1} />

  if (grids.length === 0) {
    return (
      <EmptyState
        icon={Presentation}
        title="Aucune grille pour noter les soutenances"
        description="Créez la grille « Soutenance » du projet : clarté de la présentation, réponses aux questions, répartition de la parole… Vous noterez ensuite chaque groupe ici, dans l’ordre de passage."
        action={<CreateGradingGridDialog projectId={projectId} preset={{ type: 'defense', name: 'Évaluation de la soutenance' }} label="Créer une grille" onGridCreated={load} />}
      />
    )
  }
  if (groups.length === 0) {
    return <EmptyState icon={Presentation} title="Aucun groupe à noter" description="Constituez les groupes dans l’onglet Groupes : ils pourront ensuite être notés ici." />
  }

  const grid = grids.find((item) => item.id === gridId) ?? grids[0]

  return (
    <div className="space-y-4">
      {grids.length > 1 && (
        <Tabs value={String(grid.id)} onValueChange={(value) => setGridId(Number(value))}>
          <TabsList aria-label="Grille de notation">
            {grids.map((item) => (
              <TabsTrigger key={item.id} value={String(item.id)}>
                {item.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      <GridGradingWorkspace
        key={grid.id}
        projectId={projectId}
        grid={grid}
        groups={rows}
        initialGroupId={initialGroupId}
        onChanged={onChanged}
        renderContext={(row) => {
          const slot = slotOf(row.id)
          return (
            <div className="space-y-1 rounded-xl border bg-card p-4 text-sm text-card-foreground shadow-sm">
              <p className="font-medium">
                {slot ? `Soutenance de ${row.name} : ${formatFullDateTime(slot.startTime)}${slot.location ? `, ${slot.location}` : ''}` : `${row.name} n’a pas de créneau de soutenance`}
              </p>
            </div>
          )
        }}
      />
    </div>
  )
}
