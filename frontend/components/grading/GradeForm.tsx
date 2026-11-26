'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Loader2, Lock, Save, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/api'
import { confirmAction } from '@/lib/dialogs'
import { formatNumber, formatShortDateTime, plural } from '@/lib/format'
import {
  criterionShares,
  draftFrom,
  draftIssue,
  draftScores,
  GRADE_STATE_HINTS,
  gradeState,
  percentOf,
  publishGrades,
  sameDraft,
  saveSession,
  totalOf,
  validationIssues,
  type Draft,
  type Grid,
  type Session,
} from '@/lib/grading'
import { GradeStateBadge } from './GradeStateBadge'

interface GradeFormProps {
  projectId: number
  grid: Grid
  group: { id: number; name: string; members?: string }
  session: Session | null
  onSaved: (session: Session) => void
  onDirtyChange?: (dirty: boolean) => void
  /** Passage au groupe suivant, proposé après une validation. */
  onNext?: () => void
}

type Busy = 'draft' | 'validate' | 'reopen' | 'publish' | null

/**
 * Note d’un groupe pour une grille : une ligne par critère, total calculé au fil de la saisie,
 * brouillon enregistrable, puis validation (note figée) et publication (visible des étudiants).
 */
export function GradeForm({ projectId, grid, group, session, onSaved, onDirtyChange, onNext }: GradeFormProps) {
  const baseline = useMemo(() => draftFrom(grid, session), [grid, session])
  const [draft, setDraft] = useState<Draft>(baseline)
  const [busy, setBusy] = useState<Busy>(null)
  const [showIssues, setShowIssues] = useState(false)

  // Nouveau groupe ou note enregistrée : on repart de ce que l’API a gardé.
  useEffect(() => {
    setDraft(baseline)
    setShowIssues(false)
  }, [baseline, group.id])

  const state = gradeState(session)
  const locked = state === 'validated' || state === 'published'
  const dirty = !locked && !sameDraft(draft, baseline)

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  const shares = useMemo(() => criterionShares(grid.criteria), [grid.criteria])
  const scores = draftScores(grid, draft)
  const total = totalOf(grid.criteria, scores)
  const scored = Object.values(scores).filter((score) => score !== null && !Number.isNaN(score)).length
  const issues = validationIssues(grid, draft)

  const setScore = (id: number, value: string) => setDraft((current) => ({ ...current, scores: { ...current.scores, [id]: value } }))
  const setComment = (id: number, value: string) => setDraft((current) => ({ ...current, comments: { ...current.comments, [id]: value } }))

  async function run(kind: Exclude<Busy, null>, action: () => Promise<void>) {
    setBusy(kind)
    try {
      await action()
    } catch (error) {
      toast.error('La note n’a pas été enregistrée.', { description: errorMessage(error, 'Réessayez dans un instant.') })
    } finally {
      setBusy(null)
    }
  }

  const saveDraft = () =>
    run('draft', async () => {
      const issue = draftIssue(grid, draft)
      if (issue) {
        toast.error(issue)
        return
      }
      onSaved(await saveSession(grid, group.id, session, draft, 'draft'))
      toast.success('Brouillon enregistré.')
    })

  const validate = () => {
    setShowIssues(true)
    if (issues.length > 0) return
    void run('validate', async () => {
      onSaved(await saveSession(grid, group.id, session, draft, 'validated'))
      toast.success(`Note de ${group.name} validée.`, {
        description: 'Elle n’est pas encore visible des étudiants.',
        action: onNext ? { label: 'Groupe suivant', onClick: onNext } : undefined,
      })
    })
  }

  const reopen = async () => {
    if (state === 'published') {
      const confirmed = await confirmAction({
        title: 'Rouvrir cette note ?',
        description: `Elle est publiée. Les étudiants de ${group.name} ne la verront plus tant que vous ne l’aurez pas validée et publiée de nouveau.`,
        confirmText: 'Rouvrir la note',
      })
      if (!confirmed) return
    }
    void run('reopen', async () => {
      onSaved(await saveSession(grid, group.id, session, baseline, 'draft'))
      toast.success('Note rouverte : elle repasse en brouillon.')
    })
  }

  const publish = () =>
    run('publish', async () => {
      const published = await publishGrades(projectId, 1, { gridId: grid.id, groupId: group.id, label: `la note de ${group.name}` })
      if (published === null || !session) return
      onSaved({ ...session, publishedAt: new Date().toISOString() })
      toast.success(`Note publiée : ${group.name} peut la consulter.`)
    })

  const working = busy !== null

  return (
    <section aria-label={`Note de ${group.name}`} className="rounded-xl border bg-card text-card-foreground shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b p-4 sm:p-5">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold leading-snug">{group.name}</h3>
            <GradeStateBadge state={state} />
          </div>
          {group.members && <p className="text-sm text-muted-foreground">{group.members}</p>}
          <p className="text-sm text-muted-foreground">
            {grid.name} · {GRADE_STATE_HINTS[state]}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums">
            {total === null ? '–' : formatNumber(total, 2)}
            <span className="text-base font-normal text-muted-foreground"> / 20</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {scored} sur {plural(grid.criteria.length, 'critère')} noté{scored > 1 ? 's' : ''}
          </p>
        </div>
      </header>

      <ol className="divide-y px-4 sm:px-5">
        {grid.criteria.map((criterion, index) => {
          const fieldId = `grade-${grid.id}-${group.id}-${criterion.id}`
          const score = scores[criterion.id]
          const invalid = score !== null && (Number.isNaN(score) || score > criterion.maxScore)
          const missingComment = showIssues && criterion.hasComments && !(draft.comments[criterion.id] ?? '').trim()
          return (
            <li key={criterion.id} className="grid gap-x-6 gap-y-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0 space-y-1">
                <Label htmlFor={`${fieldId}-score`} className="text-sm font-medium leading-snug">
                  {index + 1}. {criterion.name}
                </Label>
                {criterion.description && <p className="text-xs text-muted-foreground">{criterion.description}</p>}
                <p className="text-xs text-muted-foreground">
                  Compte pour {percentOf(shares.get(criterion.id) ?? 0)} de la note
                </p>
              </div>
              <div className="sm:text-right">
                {locked ? (
                  <p className="text-base font-semibold tabular-nums">
                    {score === null ? '–' : formatNumber(score, Number.isInteger(score) ? 0 : 1)}
                    <span className="font-normal text-muted-foreground"> / {formatNumber(criterion.maxScore, 0)}</span>
                  </p>
                ) : (
                  <div className="flex items-center gap-2 sm:justify-end">
                    <Input
                      id={`${fieldId}-score`}
                      inputMode="decimal"
                      autoComplete="off"
                      className="w-20 border-muted-foreground/40 text-right tabular-nums"
                      value={draft.scores[criterion.id] ?? ''}
                      onChange={(event) => setScore(criterion.id, event.target.value)}
                      aria-invalid={invalid || undefined}
                      aria-describedby={invalid ? `${fieldId}-error` : undefined}
                    />
                    <span className="text-sm text-muted-foreground">/ {formatNumber(criterion.maxScore, 0)}</span>
                  </div>
                )}
                {invalid && (
                  <p id={`${fieldId}-error`} className="mt-1 text-xs text-destructive">
                    Entre 0 et {formatNumber(criterion.maxScore, 0)}.
                  </p>
                )}
              </div>
              <div className="space-y-1 sm:col-span-2">
                {locked ? (
                  <p className="whitespace-pre-line text-sm text-muted-foreground">{draft.comments[criterion.id]?.trim() || 'Pas de commentaire.'}</p>
                ) : (
                  <>
                    <Label htmlFor={`${fieldId}-comment`} className="text-xs font-normal text-muted-foreground">
                      Commentaire{criterion.hasComments ? ' (attendu pour valider)' : ' (facultatif)'}
                    </Label>
                    <Textarea
                      id={`${fieldId}-comment`}
                      rows={2}
                      className="min-h-0 border-muted-foreground/40"
                      value={draft.comments[criterion.id] ?? ''}
                      onChange={(event) => setComment(criterion.id, event.target.value)}
                      aria-invalid={missingComment || undefined}
                    />
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      <div className="space-y-1 border-t px-4 py-4 sm:px-5">
        <Label htmlFor={`grade-${grid.id}-${group.id}-global`} className="text-sm font-medium">
          Appréciation générale
        </Label>
        {locked ? (
          <p className="whitespace-pre-line text-sm text-muted-foreground">{draft.globalComment.trim() || 'Pas d’appréciation.'}</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">Visible des étudiants du groupe une fois la note publiée.</p>
            <Textarea
              id={`grade-${grid.id}-${group.id}-global`}
              rows={3}
              className="border-muted-foreground/40"
              value={draft.globalComment}
              onChange={(event) => setDraft((current) => ({ ...current, globalComment: event.target.value }))}
            />
          </>
        )}
      </div>

      <footer className="space-y-3 sm:sticky sm:bottom-0 rounded-b-xl border-t bg-card px-4 py-3 sm:px-5">
        {showIssues && issues.length > 0 && !locked && (
          <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
            <p className="font-medium">Cette note ne peut pas encore être validée :</p>
            <ul className="mt-1 list-disc pl-5 text-muted-foreground">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-muted-foreground">Vous pouvez enregistrer un brouillon et la compléter plus tard.</p>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground" aria-live="polite">
            {locked ? (
              <>
                <Lock aria-hidden="true" className="h-3.5 w-3.5" />
                {state === 'published' ? `Publiée le ${formatShortDateTime(session?.publishedAt)}` : `Validée le ${formatShortDateTime(session?.validatedAt)}`}
              </>
            ) : dirty ? (
              'Modifications non enregistrées'
            ) : session ? (
              `Brouillon enregistré le ${formatShortDateTime(session.gradedAt)}`
            ) : (
              'Pas encore enregistrée'
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {locked ? (
              <>
                <Button variant="outline" onClick={reopen} disabled={working}>
                  {busy === 'reopen' && <Loader2 aria-hidden="true" className="animate-spin" />}
                  Rouvrir pour modifier
                </Button>
                {state === 'validated' && (
                  <Button onClick={publish} disabled={working}>
                    {busy === 'publish' ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}
                    Publier aux étudiants
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button variant="outline" onClick={saveDraft} disabled={working || !dirty}>
                  {busy === 'draft' ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
                  Enregistrer le brouillon
                </Button>
                <Button onClick={validate} disabled={working}>
                  {busy === 'validate' && <Loader2 aria-hidden="true" className="animate-spin" />}
                  Valider la note
                </Button>
              </>
            )}
            {onNext && (
              <Button variant="ghost" onClick={onNext} disabled={working}>
                Groupe suivant
                <ArrowRight aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </footer>
    </section>
  )
}
