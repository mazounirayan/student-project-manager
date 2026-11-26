'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, FileText, Settings2 } from 'lucide-react'
import { ReportGradingPanel } from '@/components/grading/ReportGradingPanel'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { CardsSkeleton } from '@/components/shared/Skeletons'
import { Button } from '@/components/ui/button'
import { apiGet, errorMessage } from '@/lib/api'
import { confirmAction } from '@/lib/dialogs'
import { buildOverview, type GroupReport, type ReportConfig, type ReportGrade, type ReportGroup } from '@/lib/reports'
import { groupsOf } from '@/lib/projects'
import { getProjectById } from '@/services/project.service'
import { ReportNavigator } from './ReportNavigator'
import { ReportViewer } from './ReportViewer'
import { ReportsSummaryTable } from './ReportsSummaryTable'
import { TeacherReportConfig } from './TeacherReportConfig'

interface ReportsData {
  config: ReportConfig
  reports: GroupReport[]
  groups: ReportGroup[]
  grades: ReportGrade[]
}

/** Où on en est dans l’onglet : liste des groupes, lecture d’un rapport (id du groupe) ou consignes. */
type Route = { kind: 'overview' } | { kind: 'config' } | { kind: 'read'; groupId: number }

const hashFor = (route: Route) => (route.kind === 'overview' ? '#reports' : route.kind === 'config' ? '#reports/consignes' : `#reports/${route.groupId}`)

function routeFromHash(): Route {
  const [, detail] = window.location.hash.slice(1).split('/')
  if (detail === 'consignes') return { kind: 'config' }
  return Number(detail) > 0 ? { kind: 'read', groupId: Number(detail) } : { kind: 'overview' }
}

async function loadData(projectId: number): Promise<ReportsData> {
  const [config, reports, project, grades] = await Promise.all([
    apiGet<ReportConfig>(`/reports/projects/${projectId}/report-config`),
    apiGet<GroupReport[]>(`/reports/projects/${projectId}`),
    getProjectById(projectId),
    apiGet<ReportGrade[]>(`/grading/sessions?projectId=${projectId}&type=report`).catch(() => [] as ReportGrade[]),
  ])
  return { config, reports, grades, groups: groupsOf(project) }
}

/** Contenu de l’onglet Rapports d’un projet : suivi des groupes, lecture d’un rapport et notation, consignes du rapport. */
export function TeacherReportsView({ projectId }: { projectId: number }) {
  const [data, setData] = useState<ReportsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [route, setRoute] = useState<Route>({ kind: 'overview' })
  const configDirty = useRef(false)

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setData(null)
      setError(null)
      try {
        setData(await loadData(projectId))
      } catch (err) {
        setError(errorMessage(err, 'Impossible de charger les rapports de ce projet.'))
      }
    },
    [projectId],
  )

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setRoute(routeFromHash())
  }, [])

  const go = useCallback(async (next: Route) => {
    if (configDirty.current) {
      const leave = await confirmAction({
        title: 'Quitter sans enregistrer ?',
        description: 'Les modifications des consignes du rapport seront perdues.',
        confirmText: 'Quitter sans enregistrer',
        destructive: true,
      })
      if (!leave) return
      configDirty.current = false
    }
    setRoute(next)
    window.history.replaceState(null, '', hashFor(next))
    window.scrollTo({ top: 0 })
  }, [])

  const rows = useMemo(() => (data ? buildOverview(data.config, data.groups, data.reports, data.grades) : []), [data])
  const handleDirty = useCallback((dirty: boolean) => {
    configDirty.current = dirty
  }, [])

  if (error) return <ErrorState message={error} onRetry={() => load()} />
  if (!data) return <CardsSkeleton count={2} />

  const { config, reports } = data
  const configured = Boolean(config.id) && (config.isEnabled || reports.length > 0)

  if (route.kind === 'config' || !configured) {
    return (
      <div className="space-y-6">
        {configured ? (
          <Button variant="ghost" size="sm" className="-ml-2" onClick={() => go({ kind: 'overview' })}>
            <ArrowLeft aria-hidden="true" />
            Retour au suivi des groupes
          </Button>
        ) : (
          <EmptyState
            icon={FileText}
            title="Aucun rapport demandé pour ce projet"
            description="Définissez la structure attendue, une section à la fois, puis une date limite. Chaque groupe rédige ensuite son rapport en ligne, et vous le lisez ici."
          />
        )}
        <TeacherReportConfig
          projectId={projectId}
          config={config}
          reports={reports}
          onDirtyChange={handleDirty}
          onSaved={(saved) => {
            setData((current) => (current ? { ...current, config: saved } : current))
            load(true)
          }}
        />
      </div>
    )
  }

  const readable = rows.filter((row) => row.report)
  const current = route.kind === 'read' ? readable.find((row) => row.group.id === route.groupId) : undefined

  if (current) {
    return (
      <div className="space-y-6">
        <ReportNavigator rows={readable} currentGroupId={current.group.id} onSelect={(groupId) => go({ kind: 'read', groupId })} onBack={() => go({ kind: 'overview' })} />
        <ReportViewer key={current.group.id} row={current} config={config}>
          <ReportGradingPanel reportId={current.report!.id} projectId={projectId} groupId={current.group.id} groupName={current.group.name} />
        </ReportViewer>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Rapports des groupes</h2>
          <p className="text-sm text-muted-foreground">
            {config.isEnabled
              ? 'Qui a rendu, qui avance, qui n’a pas commencé. Ouvrez un rapport pour le lire section par section, puis le noter.'
              : 'Le rapport n’est plus demandé aux groupes : les textes déjà rédigés restent lisibles ici.'}
          </p>
        </div>
        <Button variant="outline" onClick={() => go({ kind: 'config' })}>
          <Settings2 aria-hidden="true" />
          Consignes du rapport
        </Button>
      </div>
      <ReportsSummaryTable rows={rows} config={config} onRead={(groupId) => go({ kind: 'read', groupId })} />
    </div>
  )
}
