'use client'

import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, ListChecks, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { CreateGradingGridDialog } from '@/components/grading/CreateGradingGridDialog'
import { criterionBody, criterionError, CriterionFields, draftOfCriterion, emptyCriterion, type CriterionDraft } from '@/components/grading/CriterionFields'
import { EditGradingGridDialog } from '@/components/grading/EditGradingGridDialog'
import { ProjectGradingOverview } from '@/components/grading/project-grading-overview'
import { EmptyState } from '@/components/shared/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { apiDelete, apiPost, apiPut, errorMessage } from '@/lib/api'
import { confirmAction } from '@/lib/dialogs'
import { formatDecimal, gridTypeLabel, plural } from '@/lib/format'
import { criterionShares, percentOf, type Criterion, type Grid } from '@/lib/grading'

interface DeliverableRef {
  id: number
  name: string
}

interface ProjectGradingSectionProps {
  project: { id: number; gradingGrids?: unknown[]; deliverables?: unknown[] }
  onRefresh: () => void | Promise<void>
}

/** Contenu de l’onglet Notation : pondération des grilles, puis chaque grille avec ses critères. */
export function ProjectGradingSection({ project, onRefresh }: ProjectGradingSectionProps) {
  const grids = (project.gradingGrids ?? []) as Grid[]
  const deliverables = ((project.deliverables ?? []) as DeliverableRef[]).map(({ id, name }) => ({ id, name }))
  const [criterionDialog, setCriterionDialog] = useState<{ grid: Grid; criterion: Criterion | null } | null>(null)

  async function deleteGrid(grid: Grid) {
    const confirmed = await confirmAction({
      title: `Supprimer la grille « ${grid.name} » ?`,
      description: `${plural(grid.criteria.length, 'critère')} et toutes les notes saisies avec cette grille, publiées ou non, seront supprimés. Cette action est irréversible.`,
      confirmText: 'Supprimer la grille',
      destructive: true,
    })
    if (!confirmed) return
    try {
      await apiDelete(`/grading/grids/${grid.id}`)
      toast.success(`Grille « ${grid.name} » supprimée.`)
      await onRefresh()
    } catch (error) {
      toast.error('La grille n’a pas été supprimée.', { description: errorMessage(error, 'Réessayez dans un instant.') })
    }
  }

  async function deleteCriterion(grid: Grid, criterion: Criterion) {
    const confirmed = await confirmAction({
      title: `Supprimer le critère « ${criterion.name} » ?`,
      description: 'Sa note est retirée de toutes les notes déjà saisies pour cette grille, et leur total est recalculé. Cette action est irréversible.',
      confirmText: 'Supprimer le critère',
      destructive: true,
    })
    if (!confirmed) return
    try {
      await apiDelete(`/grading/criteria/${criterion.id}`)
      toast.success(`Critère « ${criterion.name} » supprimé.`)
      await onRefresh()
    } catch (error) {
      toast.error('Le critère n’a pas été supprimé.', { description: errorMessage(error, 'Réessayez dans un instant.') })
    }
  }

  if (grids.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="Aucune grille de notation pour ce projet"
        description="Une grille liste les critères d’une évaluation, chacun avec son barème et son coefficient. Créez-en une par livrable, une pour le rapport et une pour la soutenance : vous noterez ensuite chaque groupe depuis les onglets Livrables, Rapports et Soutenances."
        action={<CreateGradingGridDialog projectId={project.id} deliverables={deliverables} label="Créer la première grille" />}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Les grilles décrivent ce que vous évaluez. Les notes se saisissent dans les onglets Livrables, Rapports et Soutenances ; leur avancement et leur publication
          se suivent dans Évaluations.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href={`/grading?project=${project.id}`}>
              Suivre les notes
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          <CreateGradingGridDialog projectId={project.id} deliverables={deliverables} />
        </div>
      </div>

      <ProjectGradingOverview projectId={project.id} grids={grids} onSaved={onRefresh} />

      <div className="space-y-4">
        {grids.map((grid) => (
          <GridCard
            key={grid.id}
            grid={grid}
            deliverables={deliverables}
            onChanged={onRefresh}
            onAddCriterion={() => setCriterionDialog({ grid, criterion: null })}
            onEditCriterion={(criterion) => setCriterionDialog({ grid, criterion })}
            onDeleteCriterion={(criterion) => deleteCriterion(grid, criterion)}
            onDelete={() => deleteGrid(grid)}
          />
        ))}
      </div>

      {criterionDialog && (
        <CriterionDialog
          key={`${criterionDialog.grid.id}-${criterionDialog.criterion?.id ?? 'new'}`}
          grid={criterionDialog.grid}
          criterion={criterionDialog.criterion}
          onClose={() => setCriterionDialog(null)}
          onSaved={onRefresh}
        />
      )}
    </div>
  )
}

interface GridCardProps {
  grid: Grid
  deliverables: DeliverableRef[]
  onChanged: () => void | Promise<void>
  onAddCriterion: () => void
  onEditCriterion: (criterion: Criterion) => void
  onDeleteCriterion: (criterion: Criterion) => void
  onDelete: () => void
}

function GridCard({ grid, deliverables, onChanged, onAddCriterion, onEditCriterion, onDeleteCriterion, onDelete }: GridCardProps) {
  const shares = criterionShares(grid.criteria)
  const deliverable = deliverables.find((item) => item.id === grid.deliverableId)
  const unlinked = grid.type === 'deliverable' && !deliverable && deliverables.length > 0

  return (
    <article className="rounded-xl border bg-card text-card-foreground shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b p-4 sm:p-5">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold leading-snug">{grid.name}</h3>
            <Badge variant="outline">{gridTypeLabel(grid.type)}</Badge>
            <Badge variant="secondary">{percentOf(grid.weight)} de la note finale</Badge>
          </div>
          {deliverable && <p className="text-sm text-muted-foreground">Évalue le livrable « {deliverable.name} »</p>}
          {unlinked && (
            <p className="text-sm text-destructive">Cette grille n’est rattachée à aucun livrable : elle n’apparaît pas au moment de noter. Modifiez-la pour choisir le livrable.</p>
          )}
          {grid.description && <p className="text-sm text-muted-foreground">{grid.description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EditGradingGridDialog grid={grid} deliverables={deliverables} onGridUpdated={onChanged} />
          <Button variant="outline" size="sm" onClick={onDelete}>
            <Trash2 aria-hidden="true" />
            Supprimer
            <span className="sr-only"> la grille {grid.name}</span>
          </Button>
        </div>
      </header>

      {grid.criteria.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground sm:px-5">Cette grille n’a pas encore de critère : elle ne permet pas de noter. Ajoutez-en un ci-dessous.</p>
      ) : (
        <ul className="divide-y px-4 sm:px-5">
          {grid.criteria.map((criterion) => (
            <li key={criterion.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 flex-[1_1_14rem] space-y-0.5">
                <p className="text-sm font-medium">{criterion.name}</p>
                {criterion.description && <p className="text-xs text-muted-foreground">{criterion.description}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <p className="text-xs tabular-nums text-muted-foreground">
                  Sur {formatDecimal(criterion.maxScore)} · coefficient {formatDecimal(criterion.weight)} · {percentOf(shares.get(criterion.id) ?? 0)} de la note
                </p>
                {criterion.hasComments && <Badge variant="outline">Commentaire attendu</Badge>}
                <span className="flex items-center">
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => onEditCriterion(criterion)}>
                    <Pencil aria-hidden="true" />
                    <span className="sr-only">Modifier le critère {criterion.name}</span>
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => onDeleteCriterion(criterion)}>
                    <Trash2 aria-hidden="true" className="text-destructive" />
                    <span className="sr-only">Supprimer le critère {criterion.name}</span>
                  </Button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t px-4 py-3 sm:px-5">
        <Button variant="outline" size="sm" onClick={onAddCriterion}>
          <Plus aria-hidden="true" />
          Ajouter un critère
        </Button>
        {grid.criteria.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Note sur 20 : moyenne des {plural(grid.criteria.length, 'critère')} pondérée par leurs coefficients (total {formatDecimal(grid.criteria.reduce((sum, c) => sum + c.weight, 0))}).
          </p>
        )}
      </footer>
    </article>
  )
}

interface CriterionDialogProps {
  grid: Grid
  criterion: Criterion | null
  onClose: () => void
  onSaved: () => void | Promise<void>
}

/** Ajout ou modification d’un critère d’une grille. */
function CriterionDialog({ grid, criterion, onClose, onSaved }: CriterionDialogProps) {
  const [value, setValue] = useState<CriterionDraft>(criterion ? draftOfCriterion(criterion) : emptyCriterion())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const problem = criterionError(value)
    if (problem) return setError(problem)
    setError(null)
    setSaving(true)
    try {
      if (criterion) await apiPut(`/grading/criteria/${criterion.id}`, criterionBody(value))
      else await apiPost(`/grading/grids/${grid.id}/criteria`, criterionBody(value))
      toast.success(criterion ? 'Critère modifié.' : `Critère ajouté à « ${grid.name} ».`)
      onClose()
      await onSaved()
    } catch (err) {
      setError(errorMessage(err, 'Le critère n’a pas pu être enregistré.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{criterion ? 'Modifier le critère' : `Ajouter un critère à « ${grid.name} »`}</DialogTitle>
          <DialogDescription>
            {criterion ? 'Les notes déjà saisies pour cette grille sont recalculées avec le nouveau barème et le nouveau coefficient.' : 'Le critère apparaîtra dans le formulaire de notation de chaque groupe.'}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
          className="grid gap-4"
        >
          <CriterionFields idPrefix={`criterion-${grid.id}`} value={value} onChange={setValue} />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 aria-hidden="true" className="animate-spin" />}
              {criterion ? 'Enregistrer' : 'Ajouter le critère'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
