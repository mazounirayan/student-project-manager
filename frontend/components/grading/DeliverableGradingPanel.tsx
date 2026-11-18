'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertCircle, CheckCircle2, Loader2, Save, Send } from 'lucide-react'
import Swal from 'sweetalert2'

import type { GradingGrid, GradeEntry, GradingSession } from '@/types/grading'

const NEST_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'

/* ===============================
   🔧 Hook : Gestion de la notation
   =============================== */
function useDeliverableGrading(projectId: number, deliverableId: number, groups: any[]) {
  const [gradingGrids, setGradingGrids] = useState<GradingGrid[]>([])
  const [sessions, setSessions] = useState<Map<string, GradingSession>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

  // Dans useDeliverableGrading - CORRIGEZ fetchGradingData
const fetchGradingData = useCallback(async () => {
  if (!token) return

  setLoading(true)
  try {
    const gridsRes = await fetch(
      `${NEST_BACKEND_URL}/api/grading/projects/${projectId}/grids?type=deliverable`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!gridsRes.ok) throw new Error('Erreur récupération des grilles')
    const grids = await gridsRes.json()
    setGradingGrids(Array.isArray(grids) ? grids : [])

    const allSessions: GradingSession[] = []
    
    for (const grid of grids) {
      for (const group of groups) {
        try {
          const sessionRes = await fetch(
            `${NEST_BACKEND_URL}/api/grading/sessions?gridId=${grid.id}&groupId=${group.id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
          
          if (sessionRes.ok) {
            const sessionsData = await sessionRes.json()
            if (Array.isArray(sessionsData) && sessionsData.length > 0) {
              allSessions.push(...sessionsData)
            }
          }
        } catch (err) {
        }
      }
    }

    const sessionsMap = new Map<string, GradingSession>(
      allSessions.map((s: GradingSession) => [`${s.gridId}-${s.groupId}`, s])
    )
    setSessions(sessionsMap)
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Erreur de chargement',
      text: 'Impossible de récupérer les données de notation.',
    })
  } finally {
    setLoading(false)
  }
}, [projectId, deliverableId, token, groups]) 

  useEffect(() => {
    fetchGradingData()
  }, [fetchGradingData])

  const getOrCreateSession = useCallback(
    (gridId: number, groupId: number) => {
      const key = `${gridId}-${groupId}`
      const existing = sessions.get(key)
      if (existing) return existing

      const grid = gradingGrids.find(g => g.id === gridId)
      if (!grid) return null

      const newSession: GradingSession = {
        id: -Math.floor(Math.random() * 1000000),
        gridId,
        groupId,
        entries: grid.criteria.map(c => ({
          id: -Math.floor(Math.random() * 1000000),
          criterionId: c.id,
          groupId,
          score: 0,
          comment: '',
          gradedBy: 0,
          gradedAt: new Date(),
          status: 'draft'
        })),
        globalComment: '',
        totalScore: 0,
        status: 'draft',
        gradedBy: 0,
        gradedAt: new Date()
      }

      setSessions(prev => {
        const newMap = new Map(prev)
        newMap.set(key, newSession)
        return newMap
      })

      return newSession
    },
    [sessions, gradingGrids]
  )

  // 🔧 Mise à jour d'un critère
  const updateEntry = (gridId: number, groupId: number, criterionId: number, updates: Partial<GradeEntry>) => {
    setSessions(prev => {
      const key = `${gridId}-${groupId}`
      const session = getOrCreateSession(gridId, groupId)
      if (!session) return prev

      const updatedEntries = session.entries.map(e =>
        e.criterionId === criterionId ? { ...e, ...updates } : e
      )

      const grid = gradingGrids.find(g => g.id === gridId)
      let totalWeighted = 0
      let totalWeight = 0
      if (grid?.criteria) {
        grid.criteria.forEach(c => {
          const entry = updatedEntries.find(e => e.criterionId === c.id)
          if (entry) {
            const normalized = (entry.score / c.maxScore) * 20
            totalWeighted += normalized * c.weight
            totalWeight += c.weight
          }
        })
      }

      const totalScore = totalWeight > 0 ? +(totalWeighted / totalWeight).toFixed(2) : 0
      const updatedSession = { ...session, entries: updatedEntries, totalScore }

      const newMap = new Map(prev)
      newMap.set(key, updatedSession)
      return newMap
    })
  }

  // 🔧 Mise à jour du commentaire global
  const updateGlobalComment = useCallback((gridId: number, groupId: number, globalComment: string) => {
    setSessions(prev => {
      const key = `${gridId}-${groupId}`
      const session = prev.get(key)
      if (!session) return prev
      
      const updatedSession = { 
        ...session, 
        globalComment 
      }
      
      const newMap = new Map(prev)
      newMap.set(key, updatedSession)
      return newMap
    })
  }, [])

  // 🔧 Sauvegarde (POST / PUT)
  const saveSession = async (gridId: number, groupId: number, submit = false) => {
    const key = `${gridId}-${groupId}`
    const session = sessions.get(key)
    if (!session || !token) return

    setSaving(true)
    try {
      const payload = {
        id: session.id > 0 ? session.id : undefined,
        gridId,
        groupId,
        entries: session.entries.map(e => ({
          id: e.id > 0 ? e.id : undefined,
          criterionId: e.criterionId,
          score: e.score,
          comment: e.comment || ''
        })),
        globalComment: session.globalComment,
        totalScore: session.totalScore,
        status: submit ? 'validated' : 'draft'
      }

      const method = session.id < 0 ? 'POST' : 'PUT'
      const url = session.id < 0
        ? `${NEST_BACKEND_URL}/api/grading/sessions`
        : `${NEST_BACKEND_URL}/api/grading/sessions/${session.id}`

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      })

      if (!res.ok) throw new Error(`Erreur ${res.status}`)
      const saved = await res.json()

      setSessions(prev => {
        const newMap = new Map(prev)
        newMap.set(key, saved)
        return newMap
      })

      Swal.fire({
        icon: 'success',
        title: submit ? 'Note validée' : 'Brouillon sauvegardé',
        timer: 1500,
        showConfirmButton: false
      })
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Erreur', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  return {
    gradingGrids,
    sessions,
    loading,
    saving,
    updateEntry,
    updateGlobalComment, // ✅ Ajoutez cette fonction
    getOrCreateSession,
    saveSession
  }
}

/* ========================================
   🧩 Composant principal : DeliverableGradingPanel
   ======================================== */
export function DeliverableGradingPanel({
  deliverableId,
  projectId,
  groups
}: {
  deliverableId: number
  projectId: number
  groups: Array<{ id: number; name: string }>
}) {
  const { 
    gradingGrids, 
    sessions, 
    loading, 
    saving, 
    updateEntry, 
    updateGlobalComment, // ✅ Récupérez la fonction
    getOrCreateSession, 
    saveSession 
  } = useDeliverableGrading(projectId, deliverableId, groups)

  const [activeGroupId, setActiveGroupId] = useState<number | null>(null)

  useEffect(() => {
    if (groups.length > 0 && !activeGroupId) setActiveGroupId(groups[0].id)
  }, [groups, activeGroupId])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (gradingGrids.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Aucune grille de notation de type "Livrable" n'a été configurée pour ce projet.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Notation des livrables</CardTitle>
          <CardDescription>Évaluez directement les livrables rendus par les groupes</CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs
            defaultValue={groups[0]?.id.toString()}
            value={activeGroupId?.toString()}
            onValueChange={val => setActiveGroupId(Number(val))}
          >
            <TabsList className="overflow-x-auto flex gap-2">
              {groups.map(group => (
                <TabsTrigger key={group.id} value={group.id.toString()}>
                  {group.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {groups.map(group => (
              <TabsContent key={group.id} value={group.id.toString()} className="space-y-4">
                {gradingGrids.map(grid => {
                  const session = getOrCreateSession(grid.id, group.id)
                  if (!session) return null

                  return (
                    <Card key={grid.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle>{grid.name}</CardTitle>
                            <CardDescription>{grid.description}</CardDescription>
                          </div>
                          <Badge>{session.totalScore.toFixed(2)}/20</Badge>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        {grid.criteria.map(criterion => {
                          const entry = session.entries.find(e => e.criterionId === criterion.id)
                          return (
                            <div key={criterion.id} className="border p-3 rounded-lg space-y-2">
                              <div className="flex justify-between items-center">
                                <Label>{criterion.name}</Label>
                                <Badge variant="secondary">{entry?.score ?? 0}/{criterion.maxScore}</Badge>
                              </div>
                              <Slider
                                min={0}
                                max={criterion.maxScore}
                                step={1}
                                value={[entry?.score ?? 0]}
                                onValueChange={([val]) =>
                                  updateEntry(grid.id, group.id, criterion.id, { score: val })
                                }
                              />
                              <Textarea
                                placeholder="Commentaire..."
                                value={entry?.comment ?? ''}
                                onChange={e =>
                                  updateEntry(grid.id, group.id, criterion.id, { comment: e.target.value })
                                }
                              />
                            </div>
                          )
                        })}

                        <div className="pt-4">
                          <Label>Commentaire global</Label>
                          <Textarea
                            value={session.globalComment}
                            onChange={e => updateGlobalComment(grid.id, group.id, e.target.value)} // ✅ Correction
                          />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <Button
                            variant="outline"
                            disabled={saving}
                            onClick={() => saveSession(grid.id, group.id, false)}
                          >
                            <Save className="h-4 w-4 mr-1" /> Sauvegarder
                          </Button>
                          <Button
                            disabled={saving}
                            onClick={() => saveSession(grid.id, group.id, true)}
                          >
                            <Send className="h-4 w-4 mr-1" /> Valider
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}