'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, LayoutGrid, FileText, Settings } from 'lucide-react'
import { ReportNavigator } from './ReportNavigator'
import { ReportViewer } from './ReportViewer'
import { ReportsSummaryTable } from './ReportsSummaryTable'
import { ReportGradingPanel } from '../grading/ReportGradingPanel'
import type { Report } from '@/types/reports'
import Swal from 'sweetalert2'
import { TeacherReportConfig } from './TeacherReportConfig'

interface TeacherReportsViewProps {
  projectId: number
}

export function TeacherReportsView({ projectId }: TeacherReportsViewProps) {
  const [reports, setReports] = useState<Report[]>([])
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [grades, setGrades] = useState<Record<number, number>>({})
  const NEST_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'
  useEffect(() => {
    fetchReports()
  }, [projectId])

  const fetchReports = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const response = await fetch(
        `${NEST_BACKEND_URL}/api/reports/projects/${projectId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (!response.ok) throw new Error('Erreur chargement rapports')

      const data = await response.json()
      setReports(data)
      
      if (data.length > 0 && !selectedReportId) {
        setSelectedReportId(data[0].id)
      }

      // Charger les notes (à adapter selon votre API)
      fetchGrades(data.map((r: Report) => r.groupId))
    } catch (error) {
      Swal.fire({
        title: 'Erreur',
        text: 'Impossible de charger les rapports',
        icon: 'error'
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchGrades = async (groupIds: number[]) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      // À adapter selon votre API de notation
      const response = await fetch(
        `${NEST_BACKEND_URL}/api/grading/sessions?projectId=${projectId}&type=report`,
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
    
    Swal.fire({
      title: 'Export en cours...',
      text: 'Génération du PDF',
      icon: 'info',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading()
      }
    })

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${NEST_BACKEND_URL}/api/reports/${selectedReportId}/export`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (!response.ok) throw new Error('Erreur export')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rapport-${selectedReportId}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      Swal.fire({
        title: 'Export réussi',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      })
    } catch (error) {
      Swal.fire({
        title: 'Erreur',
        text: 'Impossible d\'exporter le rapport',
        icon: 'error'
      })
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

  // Afficher la configuration si aucun rapport n'existe
  if (reports.length === 0) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Aucun rapport n'a été créé pour ce projet. Configurez d'abord les rapports.
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
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            Vue d'ensemble
          </TabsTrigger>
          <TabsTrigger value="view" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Lecture détaillée
          </TabsTrigger>
          <TabsTrigger value="report-config" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configuration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <ReportsSummaryTable 
            reports={reports}
            onViewReport={(reportId) => {
              setSelectedReportId(reportId)
              // Switch to view tab
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