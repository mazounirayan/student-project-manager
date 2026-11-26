'use client'

import { BACKEND_URL, assertOk, errorMessage } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { toast } from "sonner"
import { confirmAction } from "@/lib/dialogs"
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Send, 
  FileText,
  Eye,
  Edit3
} from 'lucide-react'
import { StudentReportEditor } from './StudentReportEditor'
import { ReportContent } from './ReportContent'

interface StudentReportViewProps {
  projectId: number
  groupId: number
}

export function StudentReportView({ projectId, groupId }: StudentReportViewProps) {
  const [reportConfig, setReportConfig] = useState<any>(null)
  const [reportContent, setReportContent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')

  useEffect(() => {
    fetchReportData()
  }, [projectId, groupId])

  const fetchReportData = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) throw new Error('Non authentifié')

      const configResponse = await fetch(
        `${BACKEND_URL}/api/reports/projects/${projectId}/report-config`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      await assertOk(configResponse)

      const config = await configResponse.json()
      setReportConfig(config)

      const contentResponse = await fetch(
        `${BACKEND_URL}/api/reports/groups/${groupId}/projects/${projectId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (contentResponse.ok) {
        const content = await contentResponse.json()
        setReportContent(content)
      }
    } catch (error) {
      toast.error('Erreur', { description: errorMessage(error, 'Impossible de charger le rapport') })
    } finally {
      setLoading(false)
    }
  }

  const submitReport = async () => {
    // Vérifier que toutes les sections obligatoires sont remplies
    const missingSections = reportConfig.sections?.filter((section: any) => {
      if (!section.required) return false
      const content = reportContent?.sections?.find(
        (s: any) => s.sectionConfigId === section.id
      )
      return !content?.content || content.content.trim() === ''
    })

    if (missingSections && missingSections.length > 0) {
      toast.warning('Sections obligatoires à compléter', {
        description: missingSections.map((s: any) => s.title).join(', '),
      })
      return
    }

    const confirmed = await confirmAction({ title: 'Envoyer le rapport ?', description: 'Il ne pourra plus être modifié.', confirmText: 'Envoyer' })

    if (!confirmed) return

    setSubmitting(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${BACKEND_URL}/api/reports/groups/${groupId}/projects/${projectId}/submit`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        }
      )

      await assertOk(response)

      toast.success('Rapport envoyé', { description: 'Il ne peut plus être modifié.' })

      fetchReportData()
    } catch (error) {
      toast.error('Erreur', { description: errorMessage(error, 'Impossible de soumettre le rapport') })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!reportConfig?.isEnabled) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Aucun rapport n’est demandé pour ce projet.
        </AlertDescription>
      </Alert>
    )
  }

  const completedSections = reportContent?.sections?.filter(
    (s: any) => s.content && s.content.trim() !== ''
  ).length || 0
  const totalSections = reportConfig.sections?.length || 0
  const requiredSections = reportConfig.sections?.filter((s: any) => s.required).length || 0
  const completedRequired = reportContent?.sections?.filter(
    (s: any) => {
      const config = reportConfig.sections?.find((c: any) => c.id === s.sectionConfigId)
      return config?.required && s.content && s.content.trim() !== ''
    }
  ).length || 0
  
  const progress = totalSections > 0 ? (completedSections / totalSections) * 100 : 0
  const isSubmitted = reportContent?.status === 'submitted'
  const canSubmit = !isSubmitted && completedRequired === requiredSections

  return (
    <div className="space-y-6">
      <Card className={isSubmitted ? 'border-green-300 bg-green-50/50' : ''}>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex flex-wrap items-center gap-2">
                <FileText className="h-5 w-5" />
                Rapport du projet
              </CardTitle>
              <CardDescription>
                Format: {reportConfig.format === 'markdown' ? 'Markdown' : 'HTML'}
              </CardDescription>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {reportConfig.deadline && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Date limite: {formatDateTime(reportConfig.deadline)}
                </Badge>
              )}
              
              {isSubmitted ? (
                <Badge className="bg-green-600">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Envoyé
                </Badge>
              ) : (
                <Badge variant="secondary">Brouillon</Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {reportConfig.instructions && (
            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Instructions :</strong> {reportConfig.instructions}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between text-sm">
              <span className="text-muted-foreground">Progression globale</span>
              <span className="font-medium">
                {completedSections} / {totalSections} sections complétées
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            
            {requiredSections > 0 && (
              <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground">
                <span>Sections obligatoires : {completedRequired} / {requiredSections}</span>
                {completedRequired === requiredSections ? (
                  <span className="text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Toutes les sections obligatoires sont complètes
                  </span>
                ) : (
                  <span className="text-orange-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {requiredSections - completedRequired} section(s) obligatoire(s) restante(s)
                  </span>
                )}
              </div>
            )}
          </div>

          {!isSubmitted && canSubmit && (
            <Button 
              onClick={submitReport} 
              disabled={submitting}
              className="w-full"
              size="lg"
            >
              <Send className="mr-2 h-4 w-4" />
              {submitting ? 'Envoi…' : 'Envoyer le rapport'}
            </Button>
          )}

          {!isSubmitted && !canSubmit && totalSections > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Complétez toutes les sections obligatoires avant de soumettre le rapport.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'edit' | 'preview')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="edit" disabled={isSubmitted}>
            <Edit3 className="mr-2 h-4 w-4" />
            Édition
          </TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="mr-2 h-4 w-4" />
            Aperçu
          </TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="space-y-6">
          {isSubmitted ? (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Votre rapport a été soumis le {formatDateTime(reportContent.submittedAt)}. 
                Vous ne pouvez plus le modifier.
              </AlertDescription>
            </Alert>
          ) : (
            reportConfig.sections
              ?.sort((a: any, b: any) => a.order - b.order)
              .map((section: any) => {
                const existingContent = reportContent?.sections?.find(
                  (s: any) => s.sectionConfigId === section.id
                )

                return (
                  <StudentReportEditor
                        key={section.id}
                        groupId={groupId}
                        sectionId={section.id}
                        sectionTitle={section.title}
                        sectionDescription={section.description}
                        wordLimit={section.wordLimit}
                        required={section.required}
                        initialContent={existingContent?.content || ''}
                        onSave={fetchReportData}
                  />
                )
              })
          )}
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          {reportConfig.sections
            ?.sort((a: any, b: any) => a.order - b.order)
            .map((section: any) => {
              const content = reportContent?.sections?.find(
                (s: any) => s.sectionConfigId === section.id
              )
              const isEmpty = !content?.content || content.content.trim() === ''

              return (
                <Card key={section.id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between">
                      <CardTitle className="text-lg">{section.title}</CardTitle>
                      {section.required && (
                        <Badge variant={isEmpty ? 'destructive' : 'default'}>
                          {isEmpty ? 'À compléter' : 'Complété'}
                        </Badge>
                      )}
                    </div>
                    {section.description && (
                      <CardDescription>{section.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    {isEmpty ? (
                      <div className="p-6 bg-muted/30 rounded-lg border border-dashed text-center text-muted-foreground">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Cette section n’a pas encore été rédigée</p>
                      </div>
                    ) : (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReportContent>{content.content}</ReportContent>
                      </div>
                    )}
                    {content?.updatedAt && !isEmpty && (
                      <p className="text-xs text-muted-foreground mt-4">
                        Dernière modification : {formatDateTime(content.updatedAt)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
        </TabsContent>
      </Tabs>

      {isSubmitted && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>Rapport envoyé.</strong><br />
            Envoyé le {formatDateTime(reportContent.submittedAt)}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}