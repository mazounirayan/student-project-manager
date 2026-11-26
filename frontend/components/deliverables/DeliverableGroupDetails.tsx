'use client'

import { BACKEND_URL, downloadFile, errorMessage } from "@/lib/api"
import { formatDate, formatPercent } from "@/lib/format"
import { toast } from "sonner"
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Users,
  Download,
  Eye,
  AlertCircle
} from 'lucide-react'

interface DeliverableGroupDetailsProps {
  deliverableId: number
  groupId: number
  groupName: string
  onClose: () => void
}

interface ValidationResult {
  type: string
  passed: boolean
  message?: string
  errorMessage?: string
  details?: any
}

interface SimilarityDetail {
  finalScore: number
  textScore: number
  astScore?: number
  otherSubmissionId: number
  filePath1?: string
  filePath2?: string
  details?: any
}

export function DeliverableGroupDetails({
  deliverableId,
  groupId,
  groupName,
  onClose
}: DeliverableGroupDetailsProps) {
  const [submission, setSubmission] = useState<any>(null)
  const [similarityDetails, setSimilarityDetails] = useState<SimilarityDetail[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void fetchDetails()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliverableId, groupId])

  const fetchDetails = async () => {
    setLoading(true)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}

      const subRes = await fetch(
        `${BACKEND_URL}/api/deliverables/${deliverableId}/submissions/${groupId}`,
        { headers }
      )

      if (!subRes.ok) {
        if (subRes.status === 404) setSubmission(null)
        return
      }

      const subData = await subRes.json()
      setSubmission(subData)

      const submissionId =
        subData.id ??
        subData.submissionId ??
        subData.submission?.id

      if (!submissionId) {
        setSimilarityDetails([])
        return
      }

      const simUrl = `${BACKEND_URL}/api/submissions/${submissionId}/similarity`
      const simRes = await fetch(simUrl, { headers })

      if (simRes.ok) {
        const simJson = await simRes.json()

        if (simJson.submission) {
          setSubmission((prev: any) => ({ ...(prev || {}), ...simJson.submission }))
        }

        const matches = Array.isArray(simJson.topMatches) ? simJson.topMatches : []
        const normalized: SimilarityDetail[] = matches.map((m: any) => {
          const other =
            m.submissionId1 === submissionId ? m.submissionId2 : m.submissionId1
          return {
            finalScore: m.finalScore ?? 0,
            textScore: m.textScore ?? 0,
            astScore: m.astScore ?? undefined,
            otherSubmissionId: other,
            filePath1: m.filePath1,
            filePath2: m.filePath2,
            details: m.details
          }
        })

        setSimilarityDetails(normalized)
      } else {
        setSimilarityDetails([])
      }
    } catch (e) {
      setSimilarityDetails([])
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    if (!submission) return

    try {
      await downloadFile(`/deliverables/submissions/${submission.id}/download`, `${groupName}-livrable-${deliverableId}.zip`)
    } catch (error) {
      toast.error('Erreur', { description: errorMessage(error, 'Impossible de télécharger le fichier') })
    }
  }

  const safeDetails = Array.isArray(similarityDetails) ? similarityDetails : []

  // max file/file
  const maxDetailScore =
    safeDetails.length > 0 ? Math.max(...safeDetails.map(d => d.finalScore ?? 0)) : 0

  const displayedSimilarity =
    typeof submission?.similarityScore === 'number' && submission?.similarityScore !== null
      ? submission.similarityScore
      : maxDetailScore

  // livrables suspects (1 entrée par autre soumission)
  const groupedBySubmission = (() => {
    const m = new Map<number, { otherSubmissionId: number; score: number }>()
    for (const d of safeDetails) {
      const current = m.get(d.otherSubmissionId)
      if (!current || d.finalScore > current.score) {
        m.set(d.otherSubmissionId, {
          otherSubmissionId: d.otherSubmissionId,
          score: d.finalScore
        })
      }
    }
    return Array.from(m.values()).sort((a, b) => b.score - a.score)
  })()

  const suspiciousFiles = [...safeDetails].sort((a, b) => b.finalScore - a.finalScore)

  const validationResults: ValidationResult[] = submission?.validationResults
    ? Array.isArray(submission.validationResults)
      ? submission.validationResults
      : Object.entries(submission.validationResults).map(([key, value]: [string, any]) => ({
          type: key,
          passed: value.passed || value.valid || false,
          message: value.message || value.errorMessage,
          details: value.details
        }))
    : []

  const passedRules = validationResults.filter(r => r.passed).length
  const totalRules = validationResults.length

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
        <p className="mt-4 text-muted-foreground">Chargement des détails...</p>
      </div>
    )
  }

  if (!submission) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex flex-wrap items-center gap-2">
              <Users className="h-6 w-6" />
              {groupName}
            </h2>
            <p className="text-muted-foreground">Détails du rendu</p>
          </div>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Ce groupe n’a encore rien rendu.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex flex-wrap items-center gap-2">
            <Users className="h-6 w-6" />
            {groupName}
          </h2>
          <p className="text-muted-foreground">Détails du rendu</p>
        </div>
        <Button variant="outline" onClick={onClose}>
          Fermer
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Statut du rendu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-wrap items-center gap-3 p-3 border rounded-lg">
              {submission.isLate ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="font-medium text-orange-500">Rendu en retard</p>
                    <p className="text-xs text-muted-foreground">
                      Pénalité : {submission.penalty || 0} points
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-green-500">Dans les temps</p>
                    <p className="text-xs text-muted-foreground">
                      Rendu le {formatDate(submission.submittedAt)}
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 p-3 border rounded-lg">
              {passedRules === totalRules && totalRules > 0 ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-green-500">Conforme</p>
                    <p className="text-xs text-muted-foreground">
                      {totalRules} règle{totalRules > 1 ? 's' : ''} respectée{totalRules > 1 ? 's' : ''}
                    </p>
                  </div>
                </>
              ) : totalRules > 0 ? (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="font-medium text-red-500">Non conforme</p>
                    <p className="text-xs text-muted-foreground">
                      {passedRules}/{totalRules} règles respectées
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-muted-foreground">Aucune règle</p>
                    <p className="text-xs text-muted-foreground">
                      Aucune règle de validation définie
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="col-span-2 flex flex-col gap-2 p-3 border rounded-lg">
              <div className="flex flex-wrap items-center justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <AlertCircle
                    className={`h-5 w-5 ${
                      displayedSimilarity > 0.7
                        ? 'text-red-500'
                        : displayedSimilarity > 0.4
                          ? 'text-yellow-500'
                          : 'text-green-500'
                    }`}
                  />
                  <p className="font-medium">Similarité maximale trouvée</p>
                </div>
                <span className="text-sm font-semibold">
                  {formatPercent(displayedSimilarity, 1)}
                </span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    displayedSimilarity > 0.7
                      ? 'bg-red-500'
                      : displayedSimilarity > 0.4
                        ? 'bg-yellow-400'
                        : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(displayedSimilarity * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Calculé sur l’ensemble du rendu et les fichiers les plus proches.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 p-3 border rounded-lg">
              {submission.filePath && (
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Télécharger
                </Button>
              )}
              {submission.gitUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(submission.gitUrl, '_blank')}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Voir Git
                </Button>
              )}
              {!submission.filePath && !submission.gitUrl && (
                <span className="text-sm text-muted-foreground">Aucun fichier</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="validation" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          {/* <TabsTrigger value="validation">
            Règles de validation ({passedRules}/{totalRules})
          </TabsTrigger> */}
          <TabsTrigger value="similarity">
            Similarité ({safeDetails.length})
          </TabsTrigger>
        </TabsList>

        {/* <TabsContent value="validation" className="space-y-3">
          {validationResults.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Aucune règle de validation n’a été définie pour ce livrable
              </AlertDescription>
            </Alert>
          ) : (
            validationResults.map((result, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    {result.passed ? (
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between mb-1">
                        <p className="font-medium">{result.type}</p>
                        <Badge variant={result.passed ? 'default' : 'destructive'}>
                          {result.passed ? 'Validé' : 'Échoué'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {result.message || result.errorMessage || 'Aucun détail disponible'}
                      </p>
                      {result.details && (
                        <div className="mt-2 p-2 bg-muted rounded text-xs font-mono">
                          {JSON.stringify(result.details, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent> */}

        <TabsContent value="similarity" className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex flex-wrap items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Livrables avec la plus forte ressemblance
            </h3>
            {groupedBySubmission.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Aucun autre livrable fortement similaire détecté.
                </AlertDescription>
              </Alert>
            ) : (
              groupedBySubmission.map(item => {
                const pct = formatPercent(item.score, 1)
                const isHigh = item.score >= 0.7
                const isMedium = item.score >= 0.4
                return (
                  <Card key={item.otherSubmissionId}>
                    <CardContent className="p-4 flex flex-wrap items-center justify-between">
                      <div>
                        <p className="font-medium">
                          Rendu n° {item.otherSubmissionId}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Correspondance la plus proche.
                        </p>
                      </div>
                      <Badge variant={isHigh ? 'destructive' : isMedium ? 'default' : 'secondary'}>
                        {pct}
                      </Badge>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex flex-wrap items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Fichiers les plus suspects
            </h3>
            {suspiciousFiles.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Aucun fichier individuel suspect détecté.
                </AlertDescription>
              </Alert>
            ) : (
              suspiciousFiles.slice(0, 10).map((detail, index) => {
                const pct = formatPercent(detail.finalScore, 1)
                const isHigh = detail.finalScore >= 0.7
                const isMedium = detail.finalScore >= 0.4
                return (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-start gap-3">
                        <AlertTriangle
                          className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                            isHigh ? 'text-red-500' : isMedium ? 'text-yellow-500' : 'text-muted-foreground'
                          }`}
                        />
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center justify-between mb-2">
                            <p className="font-medium">
                              {detail.filePath1 || 'Fichier A'} ↔ {detail.filePath2 || 'Fichier B'}
                            </p>
                            <Badge
                              variant={isHigh ? 'destructive' : isMedium ? 'default' : 'secondary'}
                            >
                              {pct}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Avec le rendu n° {detail.otherSubmissionId}
                          </p>
                          <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                            <div>
                              <span className="text-muted-foreground">Score texte :</span>
                              <span className="ml-2 font-medium">
                                {formatPercent((detail.textScore || 0), 1)}
                              </span>
                            </div>
                            {detail.astScore !== undefined && (
                              <div>
                                <span className="text-muted-foreground">Score AST :</span>
                                <span className="ml-2 font-medium">{formatPercent(detail.astScore, 1)}</span>
                              </div>
                            )}
                          </div>
                          {detail.details && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-primary text-xs">
                                Voir les détails techniques
                              </summary>
                              <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                                {JSON.stringify(detail.details, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
