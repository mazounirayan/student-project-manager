'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, ListChecks } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { CardsSkeleton } from '@/components/shared/Skeletons'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { errorMessage } from '@/lib/api'
import { confirmAction } from '@/lib/dialogs'
import { formatNumber, plural } from '@/lib/format'
import { emptyCounts, gradeState, GRADE_STATE_LABELS, loadGridSessions, type Grid, type Session } from '@/lib/grading'
import { cn } from '@/lib/utils'
import { GradeForm } from './GradeForm'
import { GradeStateBadge } from './GradeStateBadge'

export interface GradableGroup {
  id: number
  name: string
  /** Membres du groupe, « Alex Moret, Brice Lemaire ». */
  members?: string
  /** Précision affichée sous le nom (« Rendu le 12 nov. », « Pas de rendu »…). */
  note?: string
}

interface GridGradingWorkspaceProps {
  projectId: number
  grid: Grid
  groups: GradableGroup[]
  /** Groupe à ouvrir en premier ; à défaut, le premier qui reste à noter. */
  initialGroupId?: number
  /** Ce qu’il faut avoir sous les yeux en notant : le rendu du groupe, sa soutenance… */
  renderContext?: (group: GradableGroup) => ReactNode
  onChanged?: () => void
}

/**
 * Notation d’une grille pour tous les groupes : la liste des groupes avec l’état de chacun, la note du groupe
 * ouvert, et le passage de l’un à l’autre sans quitter l’écran.
 */
export function GridGradingWorkspace({ projectId, grid, groups, initialGroupId, renderContext, onChanged }: GridGradingWorkspaceProps) {
  const [sessions, setSessions] = useState<Map<number, Session> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<number | null>(null)
  const dirty = useRef(false)

  const load = useCallback(async () => {
    setError(null)
    setSessions(null)
    try {
      const list = await loadGridSessions(grid.id)
      setSessions(new Map(list.map((session) => [session.groupId, session])))
    } catch (err) {
      setError(errorMessage(err, 'Impossible de charger les notes de cette grille.'))
    }
  }, [grid.id])

  useEffect(() => {
    void load()
  }, [load])

  // Premier groupe affiché : celui demandé par le lien, sinon le premier qui reste à noter.
  useEffect(() => {
    if (!sessions) return
    setActiveId((current) => {
      if (initialGroupId && groups.some((group) => group.id === initialGroupId)) return initialGroupId
      if (current && groups.some((group) => group.id === current)) return current
      const todo = groups.find((group) => ['none', 'draft'].includes(gradeState(sessions.get(group.id))))
      return (todo ?? groups[0])?.id ?? null
    })
    // Seul le chargement et la demande de lien ouvrent un groupe ; ensuite c’est à l’utilisateur de choisir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions === null, initialGroupId])

  const counts = useMemo(() => {
    const result = emptyCounts()
    for (const group of groups) result[gradeState(sessions?.get(group.id))] += 1
    return result
  }, [groups, sessions])

  const choose = useCallback(
    async (groupId: number) => {
      if (groupId === activeId) return
      if (dirty.current) {
        const leave = await confirmAction({
          title: 'Changer de groupe sans enregistrer ?',
          description: 'Les modifications de cette note seront perdues. Enregistrez-la en brouillon pour la garder.',
          confirmText: 'Changer sans enregistrer',
          cancelText: 'Rester ici',
          destructive: true,
        })
        if (!leave) return
        dirty.current = false
      }
      setActiveId(groupId)
    },
    [activeId],
  )

  const handleSaved = useCallback(
    (session: Session) => {
      setSessions((current) => new Map(current).set(session.groupId, session))
      onChanged?.()
    },
    [onChanged],
  )

  const handleDirty = useCallback((value: boolean) => {
    dirty.current = value
  }, [])

  if (grid.criteria.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="Cette grille n’a pas encore de critère"
        description="Ajoutez les critères à noter (nom, barème, coefficient) dans l’onglet Notation, puis revenez noter les groupes."
        action={
          <Button asChild variant="outline">
            <a href="#grading">Ouvrir l’onglet Notation</a>
          </Button>
        }
      />
    )
  }
  if (error) return <ErrorState message={error} onRetry={load} />
  if (!sessions) return <CardsSkeleton count={2} />

  const index = groups.findIndex((group) => group.id === activeId)
  const active = groups[index]
  const next = groups[index + 1]
  const previous = groups[index - 1]

  return (
    <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-6">
      <div className="space-y-3 lg:self-start">
        <p className="text-sm text-muted-foreground">
          {counts.none + counts.draft === 0
            ? `Les ${plural(groups.length, 'groupe')} sont notés.`
            : `${counts.none + counts.draft} sur ${plural(groups.length, 'groupe')} à finir de noter.`}
          {counts.validated > 0 && ` ${plural(counts.validated, 'note validée', 'notes validées')} à publier.`}
        </p>

        <div className="flex items-center gap-2 lg:hidden">
          <Button variant="outline" size="icon" aria-label="Groupe précédent" disabled={!previous} onClick={() => previous && choose(previous.id)}>
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Select value={activeId === null ? undefined : String(activeId)} onValueChange={(value) => choose(Number(value))}>
            <SelectTrigger aria-label="Choisir un groupe" className="min-w-0 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {groups.map((group) => (
                <SelectItem key={group.id} value={String(group.id)}>
                  {group.name} · {GRADE_STATE_LABELS[gradeState(sessions.get(group.id))].toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" aria-label="Groupe suivant" disabled={!next} onClick={() => next && choose(next.id)}>
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>

        <nav aria-label="Groupes à noter" className="hidden lg:block">
          <ul className="space-y-1">
            {groups.map((group) => {
              const session = sessions.get(group.id)
              const current = group.id === activeId
              return (
                <li key={group.id}>
                  <button
                    type="button"
                    onClick={() => choose(group.id)}
                    aria-current={current ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring',
                      current ? 'border-primary bg-muted' : 'border-transparent',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{group.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {session ? `${formatNumber(session.totalScore, 2)} / 20` : group.note ?? ' '}
                      </span>
                    </span>
                    <GradeStateBadge state={gradeState(session)} />
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>

      {active && (
        <div className="min-w-0 space-y-4">
          {renderContext?.(active)}
          <GradeForm
            projectId={projectId}
            grid={grid}
            group={active}
            session={sessions.get(active.id) ?? null}
            onSaved={handleSaved}
            onDirtyChange={handleDirty}
            onNext={next ? () => choose(next.id) : undefined}
          />
        </div>
      )}
    </div>
  )
}
