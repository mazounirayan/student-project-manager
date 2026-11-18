'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Save, AlertTriangle, CheckCircle2, Download, BarChart3 } from 'lucide-react'

interface GridWeight {
  id: number
  name: string
  type: string
  weight: number
}

interface GroupGrade {
  groupId: number
  name: string
  grades: Array<{
    gridId: number
    gridName: string
    score: number
    status: 'draft' | 'submitted' | 'validated'
  }>
  finalGrade: number
}
const NEST_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'

export function ProjectGradingOverview({ projectId }: { projectId: number }) {
  const [gridWeights, setGridWeights] = useState<GridWeight[]>([])
  const [groupGrades, setGroupGrades] = useState<GroupGrade[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchGradingData()
  }, [projectId])

const fetchGradingData = async () => {
  try {
    const token = localStorage.getItem('token')

    const res = await fetch(`${NEST_BACKEND_URL}/api/grading/projects/${projectId}/summary`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('Erreur de chargement du résumé')

    const summary = await res.json()

    setGridWeights(summary.gradingGrids.map((g: any) => ({
      id: g.id,
      name: g.name,
      type: g.type,
      weight: g.weight || 1 / summary.gradingGrids.length
    })))

    setGroupGrades(
      summary.groups.map((g: any) => ({
        groupId: g.id,
        name: g.name,
        grades: g.grades.map((gr: any) => ({
          gridId: gr.id,
          gridName: gr.gridName,
          score: gr.totalScore,
          status: gr.isValidated ? 'validated' : 'draft'
        })),
        finalGrade: g.finalGrade || 0
      }))
    )

  } catch (error) {
    setGridWeights([])
    setGroupGrades([])
  } finally {
    setLoading(false)
  }
}


  const updateGridWeight = (gridId: number, newWeight: number) => {

    setGridWeights(prev => prev.map(g => 
      g.id === gridId ? { ...g, weight: Math.max(0, Math.min(1, newWeight)) } : g
    ))
  }

  const normalizeWeights = () => {
    const total = gridWeights.reduce((sum, g) => sum + g.weight, 0)
    if (total === 0) return

    setGridWeights(prev => prev.map(g => ({
      ...g,
      weight: g.weight / total
    })))
  }

  const distributeEqually = () => {
    const count = gridWeights.length
    if (count === 0) return
    
    setGridWeights(prev => prev.map(g => ({
      ...g,
      weight: 1 / count
    })))
  }

  const calculateFinalGrade = (group: GroupGrade): number => {
    if (!group?.grades || gridWeights.length === 0) return 0
    
    const totalWeight = gridWeights.reduce((sum, g) => sum + g.weight, 0)
    if (totalWeight === 0) return 0

    let weightedSum = 0
    group.grades.forEach(grade => {
      const grid = gridWeights.find(gw => gw.id === grade.gridId)
      if (grid && grade.score != null) {
        weightedSum += grade.score * grid.weight
      }
    })

    return Math.round((weightedSum / totalWeight) * 100) / 100
  }

  const saveWeights = async () => {
    const totalWeight = gridWeights.reduce((sum, g) => sum + g.weight, 0)

    if (Math.abs(totalWeight - 1) > 0.01) {
      const confirm = window.confirm(
        `La somme des poids est de ${totalWeight.toFixed(2)} au lieu de 1.00.\n\nVoulez-vous normaliser automatiquement ?`
      )
      if (confirm) {
        normalizeWeights()
        return
      }
    }

    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${NEST_BACKEND_URL}/api/grading/projects/${projectId}/weights`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ weights: gridWeights })
      })

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`)
      }

      alert('Pondérations sauvegardées avec succès')
      fetchGradingData() // Rafraîchir les données
    } catch (error) {
      alert('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  // ✅ CORRECTION : Calculs sécurisés
  const totalWeight = gridWeights.reduce((sum, g) => sum + g.weight, 0)
  const isValidTotal = Math.abs(totalWeight - 1) < 0.01


  if (loading) {
    return <div className="p-6 text-center">Chargement...</div>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pondération des grilles d'évaluation</CardTitle>
              <CardDescription>
                Définissez le poids de chaque grille dans la note finale (somme = 1.00)
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={distributeEqually}>
                Répartir équitablement
              </Button>
              <Button variant="outline" size="sm" onClick={normalizeWeights}>
                Normaliser
              </Button>
              <Button onClick={saveWeights} size="sm" disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Total des poids</span>
              <Badge variant={isValidTotal ? "default" : "destructive"} className="text-base px-3">
                {isValidTotal ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <AlertTriangle className="mr-1 h-3 w-3" />}
                {totalWeight.toFixed(3)}
              </Badge>
            </div>
            <Progress value={totalWeight * 100} className="h-2" />
            {!isValidTotal && (
              <p className="text-xs text-muted-foreground mt-2">
                ⚠️ La somme doit être égale à 1.00 pour que les calculs soient corrects
              </p>
            )}
          </div>

          {/* Liste des grilles */}
          <div className="space-y-3">
            {gridWeights.map(grid => (
              <div key={grid.id} className="flex items-center gap-4 p-3 border rounded-lg">
                <div className="flex-1">
                  <Label className="font-medium">{grid.name}</Label>
                  <p className="text-xs text-muted-foreground mt-1 capitalize">
                    Type: {grid.type}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={grid.weight.toFixed(2)}
                    onChange={(e) => updateGridWeight(grid.id, parseFloat(e.target.value) || 0)}
                    className="w-24 text-center"
                  />
                  <div className="w-20 text-right">
                    <Badge variant="outline" className="text-sm">
                      {(grid.weight * 100).toFixed(0)}%
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
            
            {gridWeights.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Aucune grille de notation configurée pour ce projet
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notes finales des groupes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              <div>
                <CardTitle>Notes finales des groupes</CardTitle>
                <CardDescription>Calculées automatiquement selon la pondération</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!isValidTotal && (
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Les notes affichées ne sont pas correctes car la somme des poids ≠ 1.00
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            {groupGrades.map(group => {
              const finalGrade = group.finalGrade ?? calculateFinalGrade(group)
              const allValidated = group.grades.every(g => g.status === 'validated')

              return (
                <div key={group.groupId} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{group.name}</h4>
                      {allValidated && (
                        <Badge variant="default" className="bg-green-600 text-xs">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Toutes les notes validées
                        </Badge>
                      )}
                    </div>
                    <Badge className={`text-lg px-4 py-1 ${finalGrade >= 10 ? 'bg-green-600' : 'bg-red-600'}`}>
                      {finalGrade.toFixed(2)} / 20
                    </Badge>
                  </div>


                  {/* Détail par grille */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {group.grades.map(grade => (
                      <div key={grade.gridId} className="text-sm p-2 bg-muted/50 rounded">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground truncate">{grade.gridName}</span>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs">
                              {grade?.score?.toFixed(2)}
                            </Badge>
                            {grade.status === 'draft' && (
                              <span className="text-xs text-yellow-600">●</span>
                            )}
                            {grade.status === 'submitted' && (
                              <span className="text-xs text-blue-600">●</span>
                            )}
                            {grade.status === 'validated' && (
                              <CheckCircle2 className="h-3 w-3 text-green-600" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            
            {groupGrades.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Aucune note disponible pour les groupes
              </div>
            )}
          </div>

          {/* Statistiques */}
          {groupGrades.length > 0 && (
            <div className="mt-6 pt-4 border-t grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {(groupGrades.reduce((sum, g) => sum + calculateFinalGrade(g), 0) / groupGrades.length).toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">Moyenne</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {Math.max(...groupGrades.map(g => calculateFinalGrade(g))).toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">Maximum</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {Math.min(...groupGrades.map(g => calculateFinalGrade(g))).toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">Minimum</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {groupGrades.filter(g => calculateFinalGrade(g) >= 10).length}
                </div>
                <div className="text-xs text-muted-foreground">Admis (≥10)</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}