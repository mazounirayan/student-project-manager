'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, Search } from 'lucide-react'
import { GradeStateBadge } from '@/components/grading/GradeStateBadge'
import { StatTile } from '@/components/shared/StatTile'
import { EmptyState } from '@/components/shared/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate, formatDateTime, formatDayMonth, formatNumber, formatRelativeDay, plural } from '@/lib/format'
import { gradeState } from '@/lib/grading'
import { fullName, normalizeText } from '@/lib/people'
import { countStates, STATE_LABELS, type GroupOverview, type ReportConfig, type ReportState } from '@/lib/reports'

type StateFilter = ReportState | 'all'
type SortKey = 'name' | 'progress' | 'activity'

const SORT_LABELS: Record<SortKey, string> = {
  name: 'Nom du groupe',
  progress: 'Avancement',
  activity: 'Dernière activité',
}

const byName = (a: GroupOverview, b: GroupOverview) => a.group.name.localeCompare(b.group.name, 'fr', { numeric: true })
const time = (date: string | null) => (date ? new Date(date).getTime() : 0)

const SORTERS: Record<SortKey, (a: GroupOverview, b: GroupOverview) => number> = {
  name: byName,
  progress: (a, b) => b.progress.written - a.progress.written || b.progress.words - a.progress.words || byName(a, b),
  activity: (a, b) => time(b.lastActivity) - time(a.lastActivity) || byName(a, b),
}

interface ReportsSummaryTableProps {
  rows: GroupOverview[]
  config: ReportConfig
  onRead: (groupId: number) => void
}

/** Suivi des groupes : ce qui est rendu, ce qui avance, ce qui n’a pas démarré, avec un accès direct à la lecture. */
export function ReportsSummaryTable({ rows, config, onRead }: ReportsSummaryTableProps) {
  const [query, setQuery] = useState('')
  const [state, setState] = useState<StateFilter>('all')
  const [sort, setSort] = useState<SortKey>('name')

  const counts = countStates(rows)
  const shown = useMemo(() => {
    const words = normalizeText(query).split(/\s+/).filter(Boolean)
    return rows
      .filter((row) => state === 'all' || row.state === state)
      .filter((row) => {
        const haystack = normalizeText(`${row.group.name} ${row.group.members.map(fullName).join(' ')}`)
        return words.every((word) => haystack.includes(word))
      })
      .sort(SORTERS[sort])
  }, [rows, query, state, sort])

  const filtering = query.trim() !== '' || state !== 'all'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Rendus"
          value={`${counts.submitted} / ${counts.groups}`}
          hint={counts.overdue > 0 ? `${plural(counts.overdue, 'groupe')} sans rendu après l’échéance` : 'groupes ayant rendu'}
          emphasis={counts.overdue > 0}
        />
        <StatTile label="En rédaction" value={counts.drafting} hint={counts.drafting > 0 ? 'texte commencé, pas encore rendu' : undefined} />
        <StatTile label="Pas commencés" value={counts.notStarted} hint={counts.notStarted > 0 ? 'aucune section rédigée' : undefined} />
        <StatTile
          label="Date limite"
          value={config.deadline ? formatDayMonth(config.deadline) : 'Aucune'}
          hint={config.deadline ? formatRelativeDay(config.deadline) : 'les groupes rendent quand ils veulent'}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Aucun groupe dans ce projet"
          description="Les rapports se rédigent au nom d’un groupe. Constituez les groupes dans l’onglet Groupes : ils apparaîtront ici."
        />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" aria-label="Rechercher un groupe ou un étudiant" placeholder="Rechercher un groupe" className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <Select value={state} onValueChange={(value) => setState(value as StateFilter)}>
              <SelectTrigger aria-label="Filtrer par état" className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les états</SelectItem>
                <SelectItem value="submitted">{STATE_LABELS.submitted} ({counts.submitted})</SelectItem>
                <SelectItem value="drafting">{STATE_LABELS.drafting} ({counts.drafting})</SelectItem>
                <SelectItem value="not-started">{STATE_LABELS['not-started']} ({counts.notStarted})</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
              <SelectTrigger aria-label="Trier les groupes" className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    Trier par {SORT_LABELS[key].toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filtering && (
              <p aria-live="polite" className="text-sm text-muted-foreground">
                {plural(shown.length, 'groupe')} sur {rows.length}
              </p>
            )}
          </div>

          {shown.length === 0 ? (
            <EmptyState
              title="Aucun groupe ne correspond"
              description="Essayez un autre nom ou affichez tous les états."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery('')
                    setState('all')
                  }}
                >
                  Effacer la recherche
                </Button>
              }
            />
          ) : (
            <ul className="divide-y rounded-xl border bg-card text-card-foreground shadow-sm">
              {shown.map((row) => (
                <GroupRow key={row.group.id} row={row} onRead={() => onRead(row.group.id)} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function StateBadge({ row }: { row: GroupOverview }) {
  if (row.state === 'submitted') {
    return (
      <Badge variant="secondary">
        <CheckCircle2 aria-hidden="true" />
        Rendu le {formatDate(row.report?.submittedAt)}
      </Badge>
    )
  }
  if (row.overdue) return <Badge variant="destructive">Non rendu, échéance dépassée</Badge>
  return <Badge variant="outline">{STATE_LABELS[row.state]}</Badge>
}

function GroupRow({ row, onRead }: { row: GroupOverview; onRead: () => void }) {
  const { progress, grade } = row
  const members = row.group.members.map(fullName).join(', ')

  return (
    <li className="grid gap-3 p-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_11rem] md:items-center md:gap-6">
      <div className="min-w-0">
        <p className="font-medium">{row.group.name}</p>
        {members && <p className="truncate text-sm text-muted-foreground">{members}</p>}
      </div>

      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <StateBadge row={row} />
          {progress.total > 0 && (
            <span className="text-sm tabular-nums text-muted-foreground">
              {progress.written} sur {plural(progress.total, 'section')}
              {progress.words > 0 && ` · ${plural(progress.words, 'mot')}`}
            </span>
          )}
        </div>
        {progress.total > 0 && <Progress value={(progress.written / progress.total) * 100} className="h-1.5 max-w-xs" aria-label={`Sections rédigées : ${progress.written} sur ${progress.total}`} />}
        {row.lastActivity && <p className="text-xs text-muted-foreground">Dernière activité : {formatDateTime(row.lastActivity)}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-3 md:justify-end">
        {grade && (
          <span className="flex items-center gap-2 text-sm tabular-nums">
            <span className="font-medium">{formatNumber(grade.totalScore, 1)} / 20</span>
            <GradeStateBadge state={gradeState(grade)} />
          </span>
        )}
        {row.report ? (
          <Button variant="outline" size="sm" onClick={onRead} aria-label={`Lire le rapport de ${row.group.name}`}>
            Lire le rapport
          </Button>
        ) : (
          <span className="text-sm text-muted-foreground">Rien à lire</span>
        )}
      </div>
    </li>
  )
}
