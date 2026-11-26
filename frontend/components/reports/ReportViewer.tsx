'use client'

import { useState, type ReactNode } from 'react'
import { CheckCircle2, Download, Loader2, PenLine } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GradeStateBadge } from '@/components/grading/GradeStateBadge'
import { downloadFile, errorMessage } from '@/lib/api'
import { STATIC_DEMO } from '@/lib/demo/mode'
import { formatDateFull, formatDateTime, formatNumber, formatTime, plural } from '@/lib/format'
import { gradeState } from '@/lib/grading'
import { fullName } from '@/lib/people'
import {
  contentOf,
  countWords,
  formatDeadline,
  isWritten,
  sortedSections,
  STATE_LABELS,
  type GroupOverview,
  type ReportConfig,
  type SectionConfig,
} from '@/lib/reports'
import { ReportContent } from './ReportContent'

const sectionDomId = (id: number) => `rapport-section-${id}`
const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

interface ReportViewerProps {
  row: GroupOverview
  config: ReportConfig
  /** Panneau de notation, affiché sous le rapport. */
  children?: ReactNode
}

/** Lecture d’un rapport, section par section, avec un plan à gauche et le passage à la notation. */
export function ReportViewer({ row, config, children }: ReportViewerProps) {
  const { report, progress, grade } = row
  const sections = sortedSections(config)
  const [exporting, setExporting] = useState(false)

  if (!report) return null

  const exportPdf = async () => {
    setExporting(true)
    try {
      await downloadFile(`/reports/${report.id}/export`, `rapport-${row.group.name}.pdf`)
    } catch (error) {
      toast.error(errorMessage(error, 'Impossible d’exporter le rapport en PDF.'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-4 rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 space-y-1">
            <h2 className="text-xl font-semibold leading-snug">{row.group.name}</h2>
            <p className="text-sm text-muted-foreground">{row.group.members.map(fullName).join(', ') || 'Aucun membre'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => scrollTo('notation-rapport')}>
              <PenLine aria-hidden="true" />
              Noter ce rapport
            </Button>
            {!STATIC_DEMO && (
              <Button variant="outline" onClick={exportPdf} disabled={exporting}>
                {exporting ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Download aria-hidden="true" />}
                Exporter en PDF
              </Button>
            )}
          </div>
        </div>

        <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="État">
            {row.state === 'submitted' ? (
              <Badge variant="secondary">
                <CheckCircle2 aria-hidden="true" />
                {STATE_LABELS.submitted}
              </Badge>
            ) : row.overdue ? (
              <Badge variant="destructive">Non rendu</Badge>
            ) : (
              <Badge variant="outline">{STATE_LABELS[row.state]}</Badge>
            )}
          </Fact>
          <Fact label="Rédigé">
            {progress.written} sur {plural(progress.total, 'section')} · {plural(progress.words, 'mot')}
          </Fact>
          <Fact label="Dernière activité">{row.lastActivity ? formatDateTime(row.lastActivity) : '–'}</Fact>
          <Fact label="Note">
            {grade ? (
              <span className="flex flex-wrap items-center gap-2 tabular-nums">
                {formatNumber(grade.totalScore, 1)} / 20
                <GradeStateBadge state={gradeState(grade)} />
              </span>
            ) : (
              'Pas encore notée'
            )}
          </Fact>
        </dl>

        <p className="rounded-md bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
          {row.state === 'submitted'
            ? `Rendu le ${formatDateFull(report.submittedAt)} à ${formatTime(report.submittedAt)}. Le texte ci-dessous est définitif.`
            : row.overdue
              ? `Non rendu : la date limite (${formatDeadline(config.deadline)}) est passée. Vous lisez la dernière version enregistrée.`
              : 'Le groupe n’a pas encore rendu son rapport : le texte peut encore changer.'}
        </p>
      </header>

      {/* Sur grand écran, la grille de notation reste à droite pendant la lecture ; sinon elle suit le rapport. */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] xl:grid-cols-1">
          <nav aria-label="Sections du rapport" className="self-start lg:sticky lg:top-4 xl:static">
            <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Sections</p>
            <ol className="space-y-0.5 xl:flex xl:flex-wrap xl:gap-x-1 xl:space-y-0">
              {sections.map((section, index) => (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => scrollTo(sectionDomId(section.id))}
                    className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring"
                  >
                    <span className="tabular-nums text-muted-foreground">{index + 1}.</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{section.title}</span>
                      <span className="xl:hidden">
                        <NavStatus section={section} content={contentOf(report, section.id)?.content} />
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <div className="min-w-0 space-y-8">
            {sections.length === 0 && <p className="text-sm text-muted-foreground">Aucune section n’est définie pour ce rapport.</p>}
            {sections.map((section, index) => (
              <SectionReading key={section.id} index={index + 1} section={section} content={contentOf(report, section.id)} />
            ))}
          </div>
        </div>

        <aside id="notation-rapport" aria-label="Notation du rapport" className="scroll-mt-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:self-start xl:overflow-y-auto">
          {children}
        </aside>
      </div>
    </div>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}

function NavStatus({ section, content }: { section: SectionConfig; content?: string }) {
  if (!isWritten(content)) {
    return <span className={section.required ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>{section.required ? 'Vide, obligatoire' : 'Vide'}</span>
  }
  return <span className="text-xs tabular-nums text-muted-foreground">{plural(countWords(content), 'mot')}</span>
}

function SectionReading({ index, section, content }: { index: number; section: SectionConfig; content?: { content: string; updatedAt: string; updatedBy?: { firstName: string; lastName: string } | null } }) {
  const written = isWritten(content?.content)
  const words = countWords(content?.content)
  const over = Boolean(section.wordLimit && words > section.wordLimit)

  return (
    <section id={sectionDomId(section.id)} aria-labelledby={`${sectionDomId(section.id)}-title`} className="scroll-mt-4 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id={`${sectionDomId(section.id)}-title`} className="text-lg font-semibold leading-snug">
          {index}. {section.title}
        </h3>
        {written && (
          <p className={over ? 'text-sm tabular-nums text-destructive' : 'text-sm tabular-nums text-muted-foreground'}>
            {section.wordLimit ? `${words} / ${section.wordLimit} mots${over ? ', limite dépassée' : ''}` : plural(words, 'mot')}
          </p>
        )}
      </div>

      {section.description && (
        <details className="text-sm text-muted-foreground">
          <summary className="w-fit cursor-pointer rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Consignes données aux groupes</summary>
          <p className="mt-1 whitespace-pre-line">{section.description}</p>
        </details>
      )}

      {written ? (
        <>
          <ReportContent className="max-w-[46rem] rounded-xl border bg-card px-5 py-4">{content!.content}</ReportContent>
          <p className="text-xs text-muted-foreground">
            Dernière modification le {formatDateTime(content!.updatedAt)}
            {content!.updatedBy && ` par ${fullName(content!.updatedBy)}`}
          </p>
        </>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          Rien n’a été écrit dans cette section.{section.required && ' Elle est obligatoire.'}
        </p>
      )}
    </section>
  )
}
