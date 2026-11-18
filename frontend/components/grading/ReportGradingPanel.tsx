// components/reports/ReportGradingPanel.tsx
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Save, Send, AlertCircle, CheckCircle2, Loader2, FileText } from 'lucide-react'
import Swal from 'sweetalert2'
import type { GradingGrid, GradeEntry, GradingSession } from '@/types/grading'

interface ReportGradingPanelProps {
  reportId: number
  projectId: number
  groupId: number
  groupName: string
}
const NEST_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'

export function ReportGradingPanel({ 
  reportId, 
  projectId, 
  groupId, 
  groupName 
}: ReportGradingPanelProps) {
  const [gradingGrid, setGradingGrid] = useState<GradingGrid | null>(null)
  const [session, setSession] = useState<GradingSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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
          `${NEST_BACKEND_URL}/api/grading/projects/${projectId}/grids?type=report`,
          { headers: { Authorization: `Bearer ${token}` } }
        )

        if (!gridResponse.ok) {
          if (!cancelled) {
            setLoading(false)
          }
          return
        }

        const grids = await gridResponse.json()
        
        
        const reportGrid = Array.isArray(grids) 
          ? grids.find((g: any) => g.type === 'report') 
          : null
        
        if (!reportGrid) {
          if (!cancelled) {
            setGradingGrid(null)
            setLoading(false)
          }
          return
        }

        if (!cancelled) {
          setGradingGrid(reportGrid)
        }

      
        const sessionResponse = await fetch(
          `${NEST_BACKEND_URL}/api/grading/sessions?gridId=${reportGrid.id}&groupId=${groupId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )

        if (!cancelled) {
          if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json()
         
            const existingSession = Array.isArray(sessionData) 
              ? sessionData[0] 
              : sessionData
            
            if (existingSession) {
              setSession(existingSession)
            } else {
       
              createNewSession(reportGrid, groupId)
            }
          } else {
           
            createNewSession(reportGrid, groupId)
          }
        }
      } catch (error) {
        if (!cancelled) {
          Swal.fire({
            title: 'Erreur de chargement',
            text: 'Impossible de charger les données de notation',
            icon: 'error',
            timer: 2000
          })
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

   
    const createNewSession = (grid: GradingGrid, groupId: number) => {
      const newSession: GradingSession = {
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
      setSession(newSession)
    }

    fetchGradingData()

    return () => {
      cancelled = true
    }
  }, [reportId, projectId, groupId])

  const updateEntry = (criterionId: number, updates: Partial<GradeEntry>) => {
    if (!session || !gradingGrid) return

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

    setSession({
      ...session,
      entries: updatedEntries,
      totalScore
    })
  }

  const saveSession = async (submit: boolean = false) => {
    if (!session || !gradingGrid) return

    if (submit) {
      const criteria = gradingGrid.criteria || []
      for (const criterion of criteria) {
        if (criterion.requireComments) {
          const entry = session.entries?.find(e => e.criterionId === criterion.id)
          if (!entry?.comment || entry.comment.trim() === '') {
            Swal.fire({
              title: 'Commentaire obligatoire',
              text: `Le critère "${criterion.name}" nécessite un commentaire`,
              icon: 'warning',
              confirmButtonText: 'Compris'
            })
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
        ? `${NEST_BACKEND_URL}/api/grading/sessions`
        : `${NEST_BACKEND_URL}/api/grading/sessions/${session.id}`

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Erreur ${response.status}`)
      }

      const savedSession = await response.json()
      setSession(savedSession)

      Swal.fire({
        title: submit ? 'Note validée' : 'Brouillon sauvegardé',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      })
    } catch (error: any) {
      Swal.fire({
        title: 'Erreur de sauvegarde',
        text: error.message || 'Une erreur est survenue',
        icon: 'error'
      })
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
          Aucune grille de notation de type "Rapport" n'est configurée pour ce projet.
        </AlertDescription>
      </Alert>
    )
  }

  const isValidated = session?.status === 'validated'

  return (
    <Card className={isValidated ? 'border-green-300 bg-green-50/50' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5" />
            <div>
              <CardTitle>Évaluation du rapport — {groupName}</CardTitle>
              <CardDescription>{gradingGrid.name}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-base px-3">
              {session?.totalScore?.toFixed(2) || '0.00'}/20
            </Badge>
            {isValidated && (
              <Badge variant="default" className="bg-green-600">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Validé
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {(gradingGrid.criteria || []).map(criterion => {
          const entry = Array.isArray(session?.entries)
            ? session.entries.find(e => e.criterionId === criterion.id)
            : undefined

          if (!entry) return null

          return (
            <div key={criterion.id} className="space-y-4 pb-4 border-b last:border-b-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{criterion.name}</h4>
                    <Badge variant="secondary" className="text-xs">
                      Coef. {criterion.weight}
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
                <div className="flex items-center justify-between text-sm">
                  <Label>Points attribués</Label>
                  <span className="text-muted-foreground">
                    Équiv. {((entry.score / criterion.maxScore) * 20).toFixed(2)}/20
                  </span>
                </div>
                <Slider
                  value={[entry.score]}
                  onValueChange={([value]) => updateEntry(criterion.id, { score: value })}
                  max={criterion.maxScore}
                  step={0.5}
                  disabled={isValidated}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0</span>
                  <span>{criterion.maxScore}</span>
                </div>
              </div>

              {criterion.allowComments && (
                <div className="space-y-2">
                  <Label htmlFor={`comment-${criterion.id}`}>
                    Commentaire
                    {criterion.requireComments && <span className="text-red-600 ml-1">*</span>}
                  </Label>
                  <Textarea
                    id={`comment-${criterion.id}`}
                    value={entry.comment || ''}
                    onChange={(e) => updateEntry(criterion.id, { comment: e.target.value })}
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
          <Label>Commentaire global (optionnel)</Label>
          <Textarea
            value={session?.globalComment || ''}
            onChange={(e) => setSession({ ...session!, globalComment: e.target.value })}
            placeholder="Appréciation générale du rapport..."
            rows={3}
            disabled={isValidated}
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {session?.status === 'draft' && 'Brouillon non sauvegardé'}
            {session?.status === 'validated' && session.validatedAt && 
              `Validé le ${new Date(session.validatedAt).toLocaleDateString('fr-FR')}`}
          </div>

          <div className="flex gap-2">
            {!isValidated && (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => saveSession(false)} 
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
                  onClick={() => saveSession(true)} 
                  disabled={saving}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Valider la note
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}