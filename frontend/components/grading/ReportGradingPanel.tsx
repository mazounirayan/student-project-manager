'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { CardsSkeleton } from '@/components/shared/Skeletons'
import { Button } from '@/components/ui/button'
import { apiGet, errorMessage } from '@/lib/api'
import { loadProjectGrids, type Grid, type Session } from '@/lib/grading'
import { CreateGradingGridDialog } from './CreateGradingGridDialog'
import { GradeForm } from './GradeForm'

interface ReportGradingPanelProps {
  projectId: number
  groupId: number
  groupName: string
  /** Passe au rapport suivant, proposé après une validation. */
  onNext?: () => void
  onDirtyChange?: (dirty: boolean) => void
  /** Appelé après chaque enregistrement, pour que le suivi des rapports affiche la note à jour. */
  onChanged?: () => void
}

/** Notation du rapport d’un groupe avec la grille « Rapport » du projet. */
export function ReportGradingPanel({ projectId, groupId, groupName, onNext, onDirtyChange, onChanged }: ReportGradingPanelProps) {
  const [grid, setGrid] = useState<Grid | null | undefined>(undefined)
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [reportGrid] = await loadProjectGrids(projectId, 'report')
      setGrid(reportGrid ?? null)
      if (reportGrid) {
        const [existing] = await apiGet<Session[]>(`/grading/sessions?gridId=${reportGrid.id}&groupId=${groupId}`)
        setSession(existing ?? null)
      }
    } catch (err) {
      setError(errorMessage(err, 'Impossible de charger la grille de notation du rapport.'))
    }
  }, [projectId, groupId])

  useEffect(() => {
    setSession(null)
    void load()
  }, [load])

  if (error) return <ErrorState message={error} onRetry={load} />
  if (grid === undefined) return <CardsSkeleton count={1} />

  if (grid === null) {
    return (
      <EmptyState
        icon={FileText}
        title="Aucune grille pour noter le rapport"
        description="Créez la grille « Rapport » du projet : ses critères (structure, analyse, qualité de l’écrit…) avec un barème et un coefficient. Vous noterez ensuite chaque rapport ici, à côté de sa lecture."
        action={<CreateGradingGridDialog projectId={projectId} preset={{ type: 'report', name: 'Évaluation du rapport' }} label="Créer une grille" onGridCreated={load} />}
      />
    )
  }

  if (grid.criteria.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="La grille du rapport n’a pas de critère"
        description="Ajoutez les critères à noter dans l’onglet Notation, puis revenez ici."
        action={
          <Button asChild variant="outline">
            <a href="#grading">Ouvrir l’onglet Notation</a>
          </Button>
        }
      />
    )
  }

  return (
    <GradeForm
      projectId={projectId}
      grid={grid}
      group={{ id: groupId, name: groupName }}
      session={session}
      onSaved={(saved) => {
        setSession(saved)
        onChanged?.()
      }}
      onDirtyChange={onDirtyChange}
      onNext={onNext}
    />
  )
}
