'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, FileText, Send } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { DueBadge } from '@/components/shared/DueBadge'
import { CardsSkeleton } from '@/components/shared/Skeletons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { ApiError, apiGet, apiPost, errorMessage } from '@/lib/api'
import { confirmAction } from '@/lib/dialogs'
import { formatShortDateTime, plural } from '@/lib/format'
import { fullName } from '@/lib/people'
import {
  contentOf,
  countWords,
  deadlineHint,
  formatDeadline,
  isDeadlinePassed,
  isWritten,
  progressOf,
  sortedSections,
  type GroupReport,
  type ReportConfig,
  type SectionConfig,
  type SectionContent,
} from '@/lib/reports'
import { ReportContent } from './ReportContent'
import { sectionAnchor, StudentReportEditor } from './StudentReportEditor'
import { useUnsavedWarning } from './use-unsaved-warning'

/** Intervalle entre deux vérifications des modifications faites par les coéquipiers. */
const REFRESH_EVERY = 45_000

const scrollToSection = (sectionId: number) => document.getElementById(sectionAnchor(sectionId))?.scrollIntoView({ behavior: 'smooth', block: 'start' })

interface StudentReportViewProps {
  projectId: number
  groupId: number
}

/** Le rapport vu par un groupe : échéance et consignes, rédaction section par section, puis rendu. Lecture seule une fois rendu ou l’échéance passée. */
export function StudentReportView({ projectId, groupId }: StudentReportViewProps) {
  const { user } = useAuth()
  const [config, setConfig] = useState<ReportConfig | null>(null)
  const [report, setReport] = useState<GroupReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [unsaved, setUnsaved] = useState<ReadonlySet<number>>(new Set())
  const flushers = useRef(new Map<number, () => Promise<boolean>>())

  useUnsavedWarning(unsaved.size > 0)

  const fetchReport = useCallback(
    () =>
      apiGet<GroupReport>(`/reports/groups/${groupId}/projects/${projectId}`).catch((err) => {
        if (err instanceof ApiError && err.status === 404) return null
        throw err
      }),
    [groupId, projectId],
  )

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const [nextConfig, nextReport] = await Promise.all([apiGet<ReportConfig>(`/reports/projects/${projectId}/report-config`), fetchReport()])
        setConfig(nextConfig)
        setReport(nextReport)
        setError(null)
      } catch (err) {
        if (!silent) setError(errorMessage(err, 'Impossible de charger le rapport.'))
      } finally {
        setLoading(false)
      }
    },
    [fetchReport, projectId],
  )

  useEffect(() => {
    load()
  }, [load])

  // Les modifications d’un coéquipier arrivent sans recharger la page.
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) load(true)
    }, REFRESH_EVERY)
    return () => clearInterval(interval)
  }, [load])

  const onSaved = useCallback(
    (saved: SectionContent) =>
      setReport((current) => {
        const base: GroupReport = current ?? { id: 0, projectId, groupId, title: '', status: 'draft', submittedAt: null, sections: [] }
        return { ...base, sections: [...base.sections.filter((item) => item.sectionConfigId !== saved.sectionConfigId), saved] }
      }),
    [groupId, projectId],
  )

  const onUnsavedChange = useCallback((sectionId: number, isUnsaved: boolean) => {
    setUnsaved((current) => {
      if (current.has(sectionId) === isUnsaved) return current
      const next = new Set(current)
      if (isUnsaved) next.add(sectionId)
      else next.delete(sectionId)
      return next
    })
  }, [])

  const registerFlush = useCallback((sectionId: number, flush: (() => Promise<boolean>) | null) => {
    if (flush) flushers.current.set(sectionId, flush)
    else flushers.current.delete(sectionId)
  }, [])

  const submit = async () => {
    if (!config) return
    setSubmitting(true)
    try {
      const results = await Promise.all([...flushers.current.values()].map((flush) => flush()))
      if (results.includes(false)) {
        toast.error('Une section n’est pas enregistrée. Réglez-le avant de rendre le rapport.')
        return
      }
      const fresh = await fetchReport()
      const progress = progressOf(config, fresh)
      if (progress.missing.length > 0) {
        setReport(fresh)
        toast.error(`Il reste à rédiger : ${progress.missing.join(', ')}.`)
        return
      }
      setSubmitting(false)
      const confirmed = await confirmAction({
        title: 'Rendre le rapport ?',
        description: `Après le rendu, personne dans le groupe ne peut plus le modifier.${progress.overLimit.length > 0 ? ` Attention, la limite de mots est dépassée dans : ${progress.overLimit.join(', ')}.` : ''}`,
        confirmText: 'Rendre le rapport',
      })
      if (!confirmed) return
      setSubmitting(true)
      await apiPost(`/reports/groups/${groupId}/projects/${projectId}/submit`)
      toast.success('Rapport rendu', { description: 'Il est maintenant en lecture seule.' })
      await load(true)
    } catch (err) {
      toast.error(errorMessage(err, 'Impossible de rendre le rapport.'))
      load(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <CardsSkeleton count={2} />
  if (error || !config) return <ErrorState message={error ?? 'Impossible de charger le rapport.'} onRetry={() => load()} />

  if (!config.isEnabled) {
    return <EmptyState icon={FileText} title="Aucun rapport n’est demandé pour ce projet" description="Si votre enseignant en demande un, il apparaîtra ici avec ses consignes et sa date limite." />
  }
  const sections = sortedSections(config)
  if (sections.length === 0) {
    return <EmptyState icon={FileText} title="Le rapport n’est pas encore défini" description="Votre enseignant doit encore ajouter les sections à rédiger. Elles apparaîtront ici." />
  }

  const submitted = report?.status === 'submitted'
  const closed = !submitted && isDeadlinePassed(config.deadline)
  const readOnly = submitted || closed
  const progress = progressOf(config, report)

  return (
    <div className="space-y-6">
      <section aria-labelledby="rapport-titre" className="space-y-4 rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <h2 id="rapport-titre" className="font-semibold leading-snug">
            Rapport du groupe
          </h2>
          {submitted ? <Badge variant="secondary">Rendu</Badge> : closed ? <Badge variant="destructive">Date limite dépassée</Badge> : config.deadline ? <DueBadge date={config.deadline} /> : <Badge variant="outline">En rédaction</Badge>}
        </header>

        <dl className="space-y-1 text-sm">
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-muted-foreground">Date limite :</dt>
            <dd className="font-medium">{formatDeadline(config.deadline)}</dd>
          </div>
        </dl>
        {deadlineHint(config.deadline, Boolean(submitted)) && <p className="text-sm text-muted-foreground">{deadlineHint(config.deadline, Boolean(submitted))}</p>}

        {config.instructions && (
          <div className="space-y-1 rounded-lg border bg-muted/40 p-4">
            <p className="text-sm font-medium">Consignes de votre enseignant</p>
            <p className="whitespace-pre-line text-sm leading-relaxed">{config.instructions}</p>
          </div>
        )}

        {submitted && (
          <div className="space-y-1 rounded-lg border bg-muted/40 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-primary" />
              Rapport rendu le {formatShortDateTime(report?.submittedAt)}
            </p>
            <p className="text-sm text-muted-foreground">Il est en lecture seule : votre enseignant le lira et le notera.</p>
          </div>
        )}
        {closed && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
            La date limite est passée et le rapport n’a pas été rendu. Vous pouvez relire ce qui a été enregistré, mais plus le modifier. Contactez votre enseignant si vous avez besoin de temps.
          </p>
        )}
        {!readOnly && (
          <p className="text-sm text-muted-foreground">
            Tous les membres du groupe écrivent dans le même rapport. Si un coéquipier enregistre la même section que vous, vous êtes prévenu avant que son texte soit remplacé.
          </p>
        )}

        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <h3 className="text-sm font-medium">Plan du rapport</h3>
            <p className="text-sm tabular-nums text-muted-foreground">
              {progress.written} sur {plural(progress.total, 'section')} rédigées
            </p>
          </div>
          <ol className="divide-y rounded-lg border">
            {sections.map((section, index) => {
              const content = contentOf(report, section.id)?.content
              const written = isWritten(content)
              return (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => scrollToSection(section.id)}
                    className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring"
                  >
                    <span className="min-w-0">
                      <span className="tabular-nums text-muted-foreground">{index + 1}. </span>
                      <span className="font-medium">{section.title}</span>
                      <span className="text-muted-foreground">{section.required ? '' : ' (facultative)'}</span>
                    </span>
                    <span className={written || !section.required ? 'tabular-nums text-muted-foreground' : 'tabular-nums text-destructive'}>
                      {written ? plural(countWords(content), 'mot') : section.required ? 'À rédiger' : 'Vide'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      {sections.map((section, index) =>
        readOnly ? (
          <SectionReading key={section.id} position={index + 1} section={section} content={contentOf(report, section.id)} />
        ) : (
          <StudentReportEditor
            key={section.id}
            projectId={projectId}
            groupId={groupId}
            section={section}
            position={index + 1}
            server={contentOf(report, section.id)}
            currentUserId={user?.id ?? 0}
            onSaved={onSaved}
            onUnsavedChange={onUnsavedChange}
            registerFlush={registerFlush}
            onRefused={() => load(true)}
          />
        ),
      )}

      {!readOnly && (
        <section aria-labelledby="rapport-rendre" className="space-y-3 rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
          <h2 id="rapport-rendre" className="font-semibold">
            Rendre le rapport
          </h2>
          {progress.missing.length > 0 ? (
            <p className="text-sm">
              Il reste à rédiger : <span className="font-medium">{progress.missing.join(', ')}</span>.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Toutes les sections obligatoires sont rédigées. Relisez votre texte, puis rendez le rapport.</p>
          )}
          <p className="text-sm text-muted-foreground">Une fois rendu, le rapport n’est plus modifiable, ni par vous ni par vos coéquipiers.</p>
          <Button onClick={submit} disabled={submitting || progress.missing.length > 0}>
            <Send aria-hidden="true" />
            {submitting ? 'Un instant…' : 'Rendre le rapport'}
          </Button>
        </section>
      )}
    </div>
  )
}

function SectionReading({ position, section, content }: { position: number; section: SectionConfig; content?: SectionContent }) {
  const written = isWritten(content?.content)
  return (
    <article id={sectionAnchor(section.id)} aria-labelledby={`${sectionAnchor(section.id)}-title`} className="scroll-mt-4 space-y-3 rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
      <h3 id={`${sectionAnchor(section.id)}-title`} className="font-semibold leading-snug">
        {position}. {section.title}
      </h3>
      {written ? (
        <>
          <ReportContent className="max-w-[46rem]">{content!.content}</ReportContent>
          <p className="text-xs text-muted-foreground">
            {plural(countWords(content!.content), 'mot')} · dernière modification le {formatShortDateTime(content!.updatedAt)}
            {content!.updatedBy && ` par ${fullName(content!.updatedBy)}`}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Rien n’a été écrit dans cette section.</p>
      )}
    </article>
  )
}
