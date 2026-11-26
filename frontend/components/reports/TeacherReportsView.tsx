'use client'

import { BACKEND_URL, assertOk, downloadFile, errorMessage } from "@/lib/api"
import { toast } from "sonner"
import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, LayoutGrid, FileText, Settings } from 'lucide-react'
import { ReportNavigator } from './ReportNavigator'
import { ReportViewer } from './ReportViewer'
import { ReportsSummaryTable } from './ReportsSummaryTable'
import { ReportGradingPanel } from '../grading/ReportGradingPanel'
import type { Report } from '@/types/reports'
import { TeacherReportConfig } from './TeacherReportConfig'

interface TeacherReportsViewProps {
  projectId: number
}

export function TeacherReportsView({ projectId }: TeacherReportsViewProps) {
  const [reports, setReports] = useState<Report[]>([])
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [grades, setGrades] = useState<Record<number, number>>({})
  useEffect(() => {
    fetchReports()
  }, [projectId])

  const fetchReports = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const response = await fetch(
        `${BACKEND_URL}/api/reports/projects/${projectId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      await assertOk(response)

      const data = await response.json()
      setReports(data)
      
      if (data.length > 0 && !selectedReportId) {
        setSelectedReportId(data[0].id)
      }

      // Charger les notes (à adapter selon votre API)
      fetchGrades()
    } catch (error) {
      toast.error('Erreur', { description: errorMessage(error, 'Impossible de charger les rapports') })
    } finally {
      setLoading(false)
    }
  }

  const fetchGrades = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const response = await fetch(
        `${BACKEND_URL}/api/grading/sessions?projectId=${projectId}&type=report`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.ok) {
        const sessions = await response.json()
        const gradesMap: Record<number, number> = {}
        sessions.forEach((session: any) => {
          const report = reports.find(r => r.groupId === session.groupId)
          if (report) {
            gradesMap[report.id] = session.totalScore
          }
        })
        setGrades(gradesMap)
      }
    } catch (error) {
    }
  }

  const handleExport = async () => {
    if (!selectedReportId) return
    
    const loadingToast = toast.loading('Génération du PDF…')

    try {
      await downloadFile(`/reports/${selectedReportId}/export`, `rapport-${selectedReportId}.pdf`)

      toast.success('Export réussi', { id: loadingToast })
    } catch (error) {
      toast.error(errorMessage(error, 'Impossible d’exporter le rapport'), { id: loadingToast })
    }
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Afficher la configuration si aucun rapport n’existe
  if (reports.length === 0) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Aucun rapport n’a été créé pour ce projet. Configurez d’abord les rapports.
          </AlertDescription>
        </Alert>
        <TeacherReportConfig projectId={projectId} />
      </div>
    )
  }

  const selectedReport = reports.find(r => r.id === selectedReportId)

  return (
    <div className="space-y-6">
      <Tabs defaultValue="view" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="flex flex-wrap items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            Vue d’ensemble
          </TabsTrigger>
          <TabsTrigger value="view" className="flex flex-wrap items-center gap-2">
            <FileText className="h-4 w-4" />
            Lecture détaillée
          </TabsTrigger>
          <TabsTrigger value="report-config" className="flex flex-wrap items-center gap-2">
            <Settings className="h-4 w-4" />
            Configuration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <ReportsSummaryTable 
            reports={reports}
            onViewReport={(reportId) => {
              setSelectedReportId(reportId)
              const viewTab = document.querySelector('[data-value="view"]') as HTMLElement
              viewTab?.click()
            }}
            grades={grades}
          />
        </TabsContent>

        <TabsContent value="view" className="space-y-6">
          <ReportNavigator
            reports={reports}
            selectedReportId={selectedReportId}
            onReportChange={setSelectedReportId}
          />

          {selectedReport && (
            <>
              <ReportViewer
                report={selectedReport}
                onExport={handleExport}
                onPrint={handlePrint}
              />

              <ReportGradingPanel
                reportId={selectedReport.id}
                projectId={projectId}
                groupId={selectedReport.groupId}
                groupName={selectedReport.group?.name || `Groupe ${selectedReport.groupId}`}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="report-config" className="space-y-6">
          <TeacherReportConfig projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}