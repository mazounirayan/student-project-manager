'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, BarChart3, CheckCircle2, Save } from 'lucide-react'
import { apiFetch, errorMessage } from '@/lib/api'
import { confirmAction } from '@/lib/dialogs'
import { formatNumber, formatPercent, gridTypeLabel } from '@/lib/format'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

interface GridWeight {
  id: number
  name: string
  type: string
  weight: number
}

interface GroupSummary {
  id: number
  name: string
  grades: Array<{ gridId: number; gridName: string; totalScore: number; isValidated: boolean }>
  finalGrade: number
}

interface ProjectSummary {
  gradingGrids: GridWeight[]
  groups: GroupSummary[]
}

const isComplete = (total: number) => Math.abs(total - 1) < 0.01

export function ProjectGradingOverview({ projectId }: { projectId: number }) {
  const [grids, setGrids] = useState<GridWeight[]>([])
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const summary = await apiFetch<ProjectSummary>(`/grading/projects/${projectId}/summary`)
      setGrids(summary.gradingGrids.map((grid) => ({ ...grid, weight: grid.weight || 1 / summary.gradingGrids.length })))
      setGroups(summary.groups)
    } catch (error) {
      toast.error(errorMessage(error, 'La synthèse des notes n’a pas pu être chargée.'))
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  const setWeight = (gridId: number, percent: number) =>
    setGrids((previous) => previous.map((grid) => (grid.id === gridId ? { ...grid, weight: Math.max(0, Math.min(100, percent)) / 100 } : grid)))

  const totalWeight = grids.reduce((sum, grid) => sum + grid.weight, 0)

  const normalize = () => {
    if (totalWeight === 0) return
    setGrids((previous) => previous.map((grid) => ({ ...grid, weight: grid.weight / totalWeight })))
  }

  const distributeEqually = () => setGrids((previous) => previous.map((grid) => ({ ...grid, weight: 1 / previous.length })))

  async function save() {
    if (!isComplete(totalWeight)) {
      const confirmed = await confirmAction({
        title: 'Ajuster les poids ?',
        description: `Le total fait ${formatPercent(totalWeight)} au lieu de 100 %. Les poids seront ramenés proportionnellement à 100 % avant l’enregistrement.`,
        confirmText: 'Ajuster',
      })
      if (!confirmed) return
    }
    const weights = isComplete(totalWeight) ? grids : grids.map((grid) => ({ ...grid, weight: grid.weight / totalWeight }))
    setSaving(true)
    try {
      await apiFetch(`/grading/projects/${projectId}/weights`, { method: 'PUT', body: JSON.stringify({ weights }) })
      toast.success('Pondérations enregistrées.')
      await load()
    } catch (error) {
      toast.error(errorMessage(error, 'Les pondérations n’ont pas pu être enregistrées.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-center text-muted-foreground">Chargement…</div>

  // Seuls les groupes qui ont au moins une note entrent dans les statistiques.
  const graded = groups.filter((group) => group.grades.length > 0).map((group) => group.finalGrade)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Pondération des grilles</CardTitle>
              <CardDescription>Part de chaque grille dans la note finale. Le total doit faire 100 %.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={distributeEqually} disabled={grids.length === 0}>
                Répartir équitablement
              </Button>
              <Button variant="outline" size="sm" onClick={normalize} disabled={grids.length === 0}>
                Ramener à 100 %
              </Button>
              <Button size="sm" onClick={save} disabled={saving || grids.length === 0}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between">
              <span className="text-sm font-medium">Total</span>
              <Badge variant={isComplete(totalWeight) ? 'default' : 'destructive'} className="px-3 text-base">
                {isComplete(totalWeight) ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <AlertTriangle className="mr-1 h-3 w-3" />}
                {formatPercent(totalWeight)}
              </Badge>
            </div>
            <Progress value={Math.min(100, totalWeight * 100)} className="h-2" />
          </div>

          <div className="space-y-3">
            {grids.map((grid) => (
              <div key={grid.id} className="flex flex-wrap items-center gap-4 rounded-lg border p-3">
                <div className="flex-1">
                  <Label htmlFor={`weight-${grid.id}`} className="font-medium">
                    {grid.name}
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">{gridTypeLabel(grid.type)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id={`weight-${grid.id}`}
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={Math.round(grid.weight * 100)}
                    onChange={(event) => setWeight(grid.id, Number(event.target.value) || 0)}
                    className="w-20 text-center"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
            ))}
            {grids.length === 0 && <p className="py-8 text-center text-muted-foreground">Aucune grille de notation pour ce projet.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            <div>
              <CardTitle>Notes finales des groupes</CardTitle>
              <CardDescription>Moyenne pondérée des notes déjà saisies, avec les poids enregistrés.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {groups.map((group) => {
              const notGraded = group.grades.length === 0
              const complete = !notGraded && group.grades.length === grids.length && group.grades.every((grade) => grade.isValidated)
              return (
                <div key={group.id} className="rounded-lg border p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-medium">{group.name}</h4>
                      {complete ? (
                        <Badge className="bg-green-600 text-xs">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Notes validées
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          {notGraded ? 'Pas encore noté' : 'Provisoire'}
                        </Badge>
                      )}
                    </div>
                    {!notGraded && (
                      <Badge className={`px-4 py-1 text-lg ${group.finalGrade >= 10 ? 'bg-green-600' : 'bg-red-600'}`}>
                        {formatNumber(group.finalGrade, 2)} / 20
                      </Badge>
                    )}
                  </div>
                  {!notGraded && (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                      {group.grades.map((grade) => (
                        <div key={grade.gridId} className="flex items-center justify-between gap-2 rounded bg-muted/50 p-2 text-sm">
                          <span className="truncate text-muted-foreground">{grade.gridName}</span>
                          <span className="flex items-center gap-1 font-medium">
                            {formatNumber(grade.totalScore, 2)}
                            {grade.isValidated ? (
                              <CheckCircle2 className="h-3 w-3 text-green-600" aria-label="validée" />
                            ) : (
                              <span className="text-xs font-normal text-muted-foreground">(brouillon)</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {groups.length === 0 && <p className="py-8 text-center text-muted-foreground">Aucun groupe dans ce projet.</p>}
          </div>

          {graded.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
              {[
                ['Moyenne', formatNumber(graded.reduce((sum, grade) => sum + grade, 0) / graded.length, 2)],
                ['Maximum', formatNumber(Math.max(...graded), 2)],
                ['Minimum', formatNumber(Math.min(...graded), 2)],
                ['Au-dessus de 10', `${graded.filter((grade) => grade >= 10).length} / ${graded.length}`],
              ].map(([label, value]) => (
                <div key={label} className="text-center">
                  <div className="text-2xl font-bold">{value}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
