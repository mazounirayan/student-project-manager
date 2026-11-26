'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ApiError, apiGet } from '@/lib/api'
import { formatShortDateTime, plural } from '@/lib/format'
import { projectPath } from '@/lib/routes'
import { formatDeadline, isDeadlinePassed, progressOf, type GroupReport, type ReportConfig } from '@/lib/reports'

/** Où en est le rapport d’un groupe, avec le lien pour le rédiger. N’affiche rien si le projet ne demande pas de rapport. */
export function GroupReportStatus({ projectId, groupId }: { projectId: number; groupId: number }) {
  const [state, setState] = useState<{ config: ReportConfig; report: GroupReport | null } | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiGet<ReportConfig>(`/reports/projects/${projectId}/report-config`),
      apiGet<GroupReport>(`/reports/groups/${groupId}/projects/${projectId}`).catch((error) => {
        if (error instanceof ApiError && error.status === 404) return null
        throw error
      }),
    ])
      .then(([config, report]) => {
        if (!cancelled) setState({ config, report })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [projectId, groupId])

  if (!state?.config.isEnabled || state.config.sections.length === 0) return null
  const { config, report } = state
  const submitted = report?.status === 'submitted'
  const closed = !submitted && isDeadlinePassed(config.deadline)
  const progress = progressOf(config, report)

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border bg-muted/40 p-3">
      <div className="min-w-0 space-y-0.5 text-sm">
        <p className="font-medium">
          {submitted ? `Rapport rendu le ${formatShortDateTime(report?.submittedAt)}` : closed ? 'Rapport non rendu, date limite dépassée' : `Rapport : ${progress.written} sur ${plural(progress.total, 'section')} rédigées`}
        </p>
        {!submitted && <p className="text-muted-foreground">{config.deadline ? `Date limite : ${formatDeadline(config.deadline)}` : 'Pas de date limite'}</p>}
      </div>
      <Button asChild variant="outline" size="sm">
        <Link href={`${projectPath('/my-projects', projectId, '/group')}#rapport`}>{submitted || closed ? 'Lire le rapport' : 'Rédiger le rapport'}</Link>
      </Button>
    </div>
  )
}
