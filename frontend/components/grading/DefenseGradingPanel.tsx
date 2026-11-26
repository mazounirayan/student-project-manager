// components/defense/DefenseGradingPanel.tsx
'use client'

import { BACKEND_URL, assertOk, errorMessage } from "@/lib/api"
import { formatDate, formatDateTime, formatNumber, formatDecimal } from "@/lib/format"
import { toast } from "sonner"
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Save, Send, AlertCircle, CheckCircle2, Loader2, Presentation } from 'lucide-react'
import type { GradingGrid, GradeEntry, GradingSession } from '@/types/grading'

interface DefenseGradingPanelProps {
  projectId: number
  groups: Array<{ id: number; name: string; defenseDate?: string }>
}

export function DefenseGradingPanel({ projectId, groups }: DefenseGradingPanelProps) {
  const [gradingGrid, setGradingGrid] = useState<GradingGrid | null>(null)
  const [sessions, setSessions] = useState<Map<number, GradingSession>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null)

  useEffect(() => {
    if (groups.length > 0 && !activeGroupId) {
      setActiveGroupId(groups[0].id)
    }
  }, [groups, activeGroupId])

  useEffect(() => {
    let cancelled = false

    const fetchGradingData = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          setLoading(false)
          return
        }

        const gridResponse = await fetch(
          `${BACKEND_URL}/api/grading/projects/${projectId}/grids?type=defense`,
          { headers: { Authorization: `Bearer ${token}` } }
        )

        if (!gridResponse.ok) {
          if (!cancelled) {
            setLoading(false)
          }
          return
        }

        const grids = await gridResponse.json()
        const defenseGrid = Array.isArray(grids) 
          ? grids.find((g: any) => g.type === 'defense') 
          : null
        
        if (!defenseGrid) {
          if (!cancelled) {
            setGradingGrid(null)
            setLoading(false)
          }
          return
        }

        if (!cancelled) {
          setGradingGrid(defenseGrid)
        }

        // Récupérer les sessions pour tous les groupes
        const sessionsMap = new Map<number, GradingSession>()
        
        for (const group of groups) {
          const sessionResponse = await fetch(
            `${BACKEND_URL}/api/grading/sessions?gridId=${defenseGrid.id}&groupId=${group.id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          )

          if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json()
            const existingSession = Array.isArray(sessionData) 
              ? sessionData[0] 
              : sessionData
            
            if (existingSession) {
              sessionsMap.set(group.id, existingSession)
            } else {
              sessionsMap.set(group.id, createNewSession(defenseGrid, group.id))
            }
          } else {
            sessionsMap.set(group.id, createNewSession(defenseGrid, group.id))
          }
        }

        if (!cancelled) {
          setSessions(sessionsMap)
        }
      } catch (error) {
        if (!cancelled) {
          toast.error('Erreur de chargement', { description: errorMessage(error, 'Impossible de charger les données de notation') })
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    const createNewSession = (grid: GradingGrid, groupId: number): GradingSession => {
      return {
        id: -Math.floor(Math.random() * 1000000),
        gridId: grid.id,
        groupId,
        entries: (grid.criteria || []).map((criterion) => ({
          id: -Math.floor(Math.random() * 1000000),
          criterionId: criterion.id,
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
    }

    fetchGradingData()

    return () => {
      cancelled = true
    }
  }, [projectId, groups])

  const updateEntry = (groupId: number, criterionId: number, updates: Partial<GradeEntry>) => {
    if (!gradingGrid) return

    const session = sessions.get(groupId)
    if (!session) return

    const updatedEntries = (session.entries || []).map(entry =>
      entry.criterionId === criterionId ? { ...entry, ...updates } : entry
    )

    const criteria = gradingGrid.criteria || []
    let totalWeighted = 0
    let totalWeight = 0

    criteria.forEach(criterion => {
      const entry = updatedEntries.find(e => e.criterionId === criterion.id)
      if (entry) {
        const normalizedScore = (entry.score / criterion.maxScore) * 20
        totalWeighted += normalizedScore * criterion.weight
        totalWeight += criterion.weight
      }
    })

    const totalScore = totalWeight > 0 
      ? Math.round((totalWeighted / totalWeight) * 100) / 100 
      : 0

    const updatedSession = {
      ...session,
      entries: updatedEntries,
      totalScore
    }

    setSessions(prev => {
      const newMap = new Map(prev)
      newMap.set(groupId, updatedSession)
      return newMap
    })
  }

  const updateGlobalComment = (groupId: number, comment: string) => {
    const session = sessions.get(groupId)
    if (!session) return

    const updatedSession = { ...session, globalComment: comment }
    setSessions(prev => {
      const newMap = new Map(prev)
      newMap.set(groupId, updatedSession)
      return newMap
    })
  }

  const saveSession = async (groupId: number, submit: boolean = false) => {
    const session = sessions.get(groupId)
    if (!session || !gradingGrid) return

    if (submit) {
      const criteria = gradingGrid.criteria || []
      for (const criterion of criteria) {
        if (criterion.requireComments) {
          const entry = session.entries?.find(e => e.criterionId === criterion.id)
          if (!entry?.comment || entry.comment.trim() === '') {
            toast.warning('Commentaire obligatoire', { description: `Le critère "${criterion.name}" nécessite un commentaire` })
            return
          }
        }
      }
    }

    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) throw new Error('Utilisateur non authentifié')

      const payload = {
        id: session.id > 0 ? session.id : undefined,
        gridId: session.gridId,
        groupId: groupId,
        entries: session.entries?.map(entry => ({
          id: entry.id > 0 ? entry.id : undefined,
          criterionId: entry.criterionId,
          score: entry.score,
          comment: entry.comment || ''
        })) || [],
        globalComment: session.globalComment || '',
        totalScore: session.totalScore,
        status: submit ? 'validated' : 'draft'
      }

      const method = session.id < 0 ? 'POST' : 'PUT'
      const url = session.id < 0 
        ? `${BACKEND_URL}/api/grading/sessions`
        : `${BACKEND_URL}/api/grading/sessions/${session.id}`

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      await assertOk(response)

      const savedSession = await response.json()
      setSessions(prev => {
        const newMap = new Map(prev)
        newMap.set(groupId, savedSession)
        return newMap
      })

      toast.success(submit ? 'Note validée' : 'Brouillon sauvegardé')
    } catch (error: any) {
      toast.error('Erreur de sauvegarde', { description: error.message || 'Une erreur est survenue' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!gradingGrid) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Aucune grille de notation de type "Soutenance" n’est configurée pour ce projet.
          Créez-en une dans l’onglet "Notation" pour commencer l’évaluation.
        </AlertDescription>
      </Alert>
    )
  }

  if (groups.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Aucun groupe n’a été créé pour ce projet.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <Presentation className="h-5 w-5" />
          <div>
            <CardTitle>Évaluation des soutenances</CardTitle>
            <CardDescription>{gradingGrid.name}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs
          value={activeGroupId?.toString()}
          onValueChange={val => setActiveGroupId(Number(val))}
          className="space-y-4"
        >
          <TabsList className="grid w-full" style={{ 
            gridTemplateColumns: `repeat(${groups.length}, minmax(120px, 1fr))` 
          }}>
            {groups.map(group => {
              const session = sessions.get(group.id)
              const isValidated = session?.status === 'validated'
              
              return (
                <TabsTrigger 
                  key={group.id} 
                  value={group.id.toString()}
                  className="flex flex-wrap items-center gap-2"
                >
                  {group.name}
                  {isValidated && (
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>

          {groups.map(group => {
            const session = sessions.get(group.id)
            if (!session) return null

            const isValidated = session.status === 'validated'

            return (
              <TabsContent 
                key={group.id} 
                value={group.id.toString()}
                className={isValidated ? 'border border-green-300 rounded-lg p-4 bg-green-50/30' : ''}
              >
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between pb-4 border-b">
                    <div>
                      <h3 className="text-lg font-semibold">{group.name}</h3>
                      {group.defenseDate && (
                        <p className="text-sm text-muted-foreground">
                          Soutenance le {formatDateTime(group.defenseDate)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant="outline" className="text-lg px-4 py-1">
                        {formatNumber(session.totalScore, 2)}/20
                      </Badge>
                      {isValidated && (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Validé
                        </Badge>
                      )}
                    </div>
                  </div>

                  {(gradingGrid.criteria || []).map(criterion => {
                    const entry = session.entries.find(e => e.criterionId === criterion.id)
                    if (!entry) return null

                    return (
                      <div key={criterion.id} className="space-y-4 pb-4 border-b last:border-b-0">
                        <div className="flex flex-wrap items-start justify-between">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <h4 className="font-medium">{criterion.name}</h4>
                              <Badge variant="secondary" className="text-xs">
                                Coef. {formatDecimal(criterion.weight)}
                              </Badge>
                              {criterion.type === 'individual' && (
                                <Badge variant="outline" className="text-xs">
                                  Individuel
                                </Badge>
                              )}
                            </div>
                            {criterion.description && (
                              <p className="text-sm text-muted-foreground">{criterion.description}</p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-base px-3 ml-4">
                            {entry.score}/{criterion.maxScore}
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between text-sm">
                            <Label>Points attribués</Label>
                            <span className="text-muted-foreground">
                              Équiv. {formatNumber((entry.score / criterion.maxScore) * 20, 2)}/20
                            </span>
                          </div>
                          <Slider
                            value={[entry.score]}
                            onValueChange={([value]) => updateEntry(group.id, criterion.id, { score: value })}
                            max={criterion.maxScore}
                            step={0.5}
                            disabled={isValidated}
                          />
                          <div className="flex flex-wrap justify-between text-xs text-muted-foreground">
                            <span>0</span>
                            <span>{criterion.maxScore}</span>
                          </div>
                        </div>

                        {criterion.allowComments && (
                          <div className="space-y-2">
                            <Label htmlFor={`comment-${criterion.id}-${group.id}`}>
                              Commentaire
                              {criterion.requireComments && <span className="text-red-600 ml-1">*</span>}
                            </Label>
                            <Textarea
                              id={`comment-${criterion.id}-${group.id}`}
                              value={entry.comment || ''}
                              onChange={(e) => updateEntry(group.id, criterion.id, { comment: e.target.value })}
                              placeholder={criterion.requireComments ? "Commentaire obligatoire..." : "Commentaire optionnel..."}
                              rows={2}
                              disabled={isValidated}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}

                  <div className="space-y-2 pt-4 border-t">
                    <Label>Appréciation générale de la soutenance (optionnel)</Label>
                    <Textarea
                      value={session.globalComment || ''}
                      onChange={(e) => updateGlobalComment(group.id, e.target.value)}
                      placeholder="Qualité de la présentation, réponses aux questions, posture..."
                      rows={3}
                      disabled={isValidated}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      {session.status === 'draft' && 'Brouillon non sauvegardé'}
                      {session.status === 'validated' && session.validatedAt && 
                        `Validé le ${formatDate(session.validatedAt)}`}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!isValidated && (
                        <>
                          <Button 
                            variant="outline" 
                            onClick={() => saveSession(group.id, false)} 
                            disabled={saving}
                          >
                            {saving ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="mr-2 h-4 w-4" />
                            )}
                            Sauvegarder
                          </Button>
                          <Button 
                            onClick={() => saveSession(group.id, true)} 
                            disabled={saving}
                          >
                            <Send className="mr-2 h-4 w-4" />
                            Valider la note
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            )
          })}
        </Tabs>
      </CardContent>
    </Card>
  )
}