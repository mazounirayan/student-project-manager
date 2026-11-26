'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, ExternalLink, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { ConformityBadge, SimilarityBadge, SubmissionStatus } from '@/components/deliverables/SubmissionStatus'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { CardsSkeleton } from '@/components/shared/Skeletons'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { downloadFile, errorMessage } from '@/lib/api'
import type { Deliverable, GroupRef, Submission } from '@/lib/deliverables'
import { formatFileSize, formatShortDateTime } from '@/lib/format'
import { loadProjectGrids, type Grid } from '@/lib/grading'
import { memberNames } from '@/lib/people'
import { CreateGradingGridDialog } from './CreateGradingGridDialog'
import { GridGradingWorkspace, type GradableGroup } from './GridGradingWorkspace'

interface DeliverableGradingPanelProps {
  projectId: number
  deliverable: Deliverable
  groups: GroupRef[]
  initialGroupId?: number
  onChanged?: () => void
}

/** Notation d’un livrable : les grilles rattachées à ce livrable, le rendu de chaque groupe sous les yeux. */
export function DeliverableGradingPanel({ projectId, deliverable, groups, initialGroupId, onChanged }: DeliverableGradingPanelProps) {
  const [grids, setGrids] = useState<Grid[] | null>(null)
  const [loose, setLoose] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [gridId, setGridId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const all = await loadProjectGrids(projectId, 'deliverable')
      const mine = all.filter((grid) => grid.deliverableId === deliverable.id)
      setGrids(mine)
      setLoose(all.filter((grid) => !grid.deliverableId).length)
      setGridId((current) => (mine.some((grid) => grid.id === current) ? current : (mine[0]?.id ?? null)))
    } catch (err) {
      setError(errorMessage(err, 'Impossible de charger les grilles de ce livrable.'))
    }
  }, [projectId, deliverable.id])

  useEffect(() => {
    setGrids(null)
    void load()
  }, [load])

  const submissions = deliverable.submissions ?? []
  const rows = useMemo<GradableGroup[]>(
    () =>
      groups.map((group) => {
        const submission = submissions.find((item) => item.groupId === group.id)
        return {
          id: group.id,
          name: group.name,
          members: memberNames(group.members),
          note: submission ? `Rendu le ${formatShortDateTime(submission.submittedAt)}${submission.isLate ? ', en retard' : ''}` : 'Pas de rendu',
        }
      }),
    [groups, submissions],
  )

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!grids) return <CardsSkeleton count={1} />

  if (grids.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Aucune grille pour ce livrable"
        description={
          loose > 0
            ? 'Une grille de type Livrable existe mais n’est rattachée à aucun livrable : ouvrez-la dans l’onglet Notation pour choisir celui qu’elle évalue. Vous pouvez aussi en créer une pour ce livrable.'
            : 'Une grille décrit ce que vous évaluez : des critères, chacun avec son barème et son coefficient. Créez-en une pour ce livrable, puis notez les groupes ici.'
        }
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <CreateGradingGridDialog
              projectId={projectId}
              preset={{ type: 'deliverable', deliverableId: deliverable.id, name: `Évaluation : ${deliverable.name}` }}
              deliverables={[{ id: deliverable.id, name: deliverable.name }]}
              onGridCreated={load}
            />
            {loose > 0 && (
              <Button asChild variant="outline">
                <a href="#grading">Ouvrir l’onglet Notation</a>
              </Button>
            )}
          </div>
        }
      />
    )
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
        renderContext={(group) => (
          <SubmissionContext deliverable={deliverable} group={group} submission={submissions.find((item) => item.groupId === group.id) ?? null} />
        )}
      />
    </div>
  )
}

/** Le rendu du groupe noté : dépôt, retard, conformité, ressemblance. */
function SubmissionContext({ deliverable, group, submission }: { deliverable: Deliverable; group: GradableGroup; submission: Submission | null }) {
  const download = async () => {
    if (!submission) return
    try {
      await downloadFile(`/deliverables/submissions/${submission.id}/download`, submission.fileName ?? `rendu-${group.name}`)
    } catch (err) {
      toast.error('Le fichier n’a pas été téléchargé.', { description: errorMessage(err, 'Réessayez dans un instant.') })
    }
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4 text-sm text-card-foreground shadow-sm">
      <p className="font-medium">
        Rendu de {group.name} pour « {deliverable.name} »
      </p>
      {!submission ? (
        <div className="flex flex-wrap items-center gap-2">
          <SubmissionStatus deliverable={deliverable} submission={null} />
          <span className="text-muted-foreground">Il n’y a rien à lire : vous pouvez tout de même saisir une note.</span>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <SubmissionStatus deliverable={deliverable} submission={submission} />
            <ConformityBadge deliverable={deliverable} submission={submission} />
            <SimilarityBadge submission={submission} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-muted-foreground">
              Déposé le {formatShortDateTime(submission.submittedAt)}
            </span>
            {submission.fileName && (
              <>
                <span className="break-all font-medium">
                  {submission.fileName}
                  {submission.fileSize ? ` (${formatFileSize(submission.fileSize)})` : ''}
                </span>
                <Button variant="outline" size="sm" onClick={download}>
                  <Download aria-hidden="true" />
                  Télécharger
                </Button>
              </>
            )}
            {submission.gitUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={submission.gitUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink aria-hidden="true" />
                  Ouvrir le dépôt Git
                </a>
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
