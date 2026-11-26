"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarClock, Download, Pencil, Presentation, Shuffle } from "lucide-react"
import { toast } from "sonner"
import { EmptyState } from "@/components/shared/EmptyState"
import { SectionCard } from "@/components/shared/SectionCard"
import { StatTile } from "@/components/shared/StatTile"
import { QuietEmpty } from "@/components/dashboard/parts"
import { Button } from "@/components/ui/button"
import { apiGet, apiPost, apiPut, downloadFile, errorMessage } from "@/lib/api"
import { confirmAction } from "@/lib/dialogs"
import {
  durationOf,
  formatDuration,
  groupsToSchedule,
  hasStarted,
  moveSlot,
  planDefaults,
  reorderPayload,
  shuffleUpcoming,
  slotRange,
  sortSlots,
  statusesOf,
  type DefenseSlot,
} from "@/lib/defenses"
import { formatDateFull, formatDayMonth, formatTime, plural } from "@/lib/format"
import { defenseGradingHref, summaryState, type GradeState, type ProjectSummary } from "@/lib/grading"
import DefenseOrderTable from "./DefenseOrderTable"
import { ScheduleDefenseDialog, type SchedulePayload } from "./schedule-defense-dialog"

interface DefensesTabProps {
  projectId: number
  /** Le projet est visible des étudiants : ils voient donc le planning. */
  visible: boolean
  groups: { id: number; name: string; members: { firstName: string; lastName: string }[] }[]
  defenses: DefenseSlot[]
  onChange: (defenses: DefenseSlot[]) => void
  /** Descend à la grille de notation du groupe. */
  onGrade: (groupId: number) => void
  /** Ouvre l’onglet Groupes. */
  onOpenGroups: () => void
  /** Change à chaque enregistrement d’une note : l’état des notes se recharge. */
  notesKey: number
}

/** Heure courante, rafraîchie chaque minute : « en cours » et « suivant » restent justes sans recharger la page. */
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])
  return now
}

const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString()

const rank = (position: number) => (position === 1 ? "1re" : `${position}e`)

/** Onglet Soutenances : planning, ordre de passage, qui est passé et qui reste, accès à la notation. */
export function DefensesTab({ projectId, visible, groups, defenses, onChange, onGrade, onOpenGroups, notesKey }: DefensesTabProps) {
  const now = useNow()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [noteStates, setNoteStates] = useState<Map<number, GradeState> | null>(null)

  const sorted = useMemo(() => sortSlots(defenses), [defenses])
  const statuses = useMemo(() => statusesOf(sorted, now), [sorted, now])
  const members = useMemo(() => new Map(groups.map((group) => [group.id, group.members])), [groups])
  const started = sorted.filter((slot) => hasStarted(slot, now))
  const movable = sorted.length - started.length
  const toSchedule = useMemo(() => groupsToSchedule(groups, sorted, now), [groups, sorted, now])
  const unscheduled = groups.filter((group) => group.members.length > 0 && !sorted.some((slot) => slot.group?.id === group.id))

  // L’état de la note de chaque groupe, pour savoir qui reste à noter (sans bloquer l’onglet s’il ne charge pas).
  useEffect(() => {
    let cancelled = false
    apiGet<ProjectSummary>(`/grading/projects/${projectId}/summary`)
      .then((summary) => {
        if (cancelled) return
        const grid = summary.gradingGrids.find((item) => item.type === "defense")
        setNoteStates(grid ? new Map(summary.groups.map((group) => [group.id, summaryState(group.grades.find((grade) => grade.gridId === grid.id))])) : null)
      })
      .catch(() => !cancelled && setNoteStates(null))
    return () => {
      cancelled = true
    }
  }, [projectId, notesKey])

  const announce = visible
    ? "Les étudiants voient leur créneau dès qu’il est enregistré. Aucun e-mail n’est envoyé : prévenez-les en cas de changement."
    : "Le projet est en brouillon : les étudiants ne voient pas ce planning tant que le projet n’est pas visible."

  const saveOrder = async (next: DefenseSlot[], title: string, description?: string) => {
    const previous = defenses
    onChange(next)
    setBusy(true)
    try {
      const data = await apiPut<{ defenses: DefenseSlot[] }>(`/defenses/projects/${projectId}/reorder`, reorderPayload(next))
      onChange(data.defenses)
      toast.success(title, { description })
    } catch (err) {
      onChange(previous)
      toast.error("L’ordre de passage n’a pas changé.", { description: errorMessage(err, "Réessayez dans un instant.") })
    } finally {
      setBusy(false)
    }
  }

  const move = (slotId: number, direction: -1 | 1) => {
    const from = sorted.findIndex((slot) => slot.id === slotId)
    const to = from + direction
    if (from === -1 || to < 0 || to >= sorted.length || to < started.length) return
    const name = sorted[from].group?.name ?? "Ce groupe"
    void saveOrder(moveSlot(sorted, from, to), "Ordre de passage enregistré.", `${name} passe en ${rank(to + 1)} position ; les horaires sont recalculés.`)
  }

  const draw = async () => {
    const confirmed = await confirmAction({
      title: "Tirer l’ordre de passage au sort ?",
      description: `${plural(movable, "groupe")} ${movable > 1 ? "qui n’ont pas encore commencé passeront" : "passera"} dans un ordre aléatoire, et leurs horaires seront recalculés. L’ordre actuel sera perdu.${
        visible ? " Les étudiants verront le nouvel ordre tout de suite ; aucun e-mail n’est envoyé." : ""
      }`,
      confirmText: "Tirer au sort",
    })
    if (!confirmed) return
    let next = shuffleUpcoming(sorted, Date.now())
    for (let attempt = 0; attempt < 10 && next.every((slot, index) => slot.id === sorted[index].id); attempt++) next = shuffleUpcoming(sorted, Date.now())
    await saveOrder(next, "Ordre de passage tiré au sort.", "Les horaires sont recalculés.")
  }

  const schedule = async (payload: SchedulePayload) => {
    if (movable > 0) {
      const confirmed = await confirmAction({
        title: "Enregistrer le nouveau planning ?",
        description: `Les horaires de ${plural(toSchedule.length, "groupe")} vont changer.${started.length > 0 ? " Les groupes déjà passés ou en cours ne changent pas." : ""} ${
          visible ? "Les étudiants voient le nouveau planning tout de suite ; aucun e-mail n’est envoyé." : "Le projet est en brouillon : les étudiants ne le voient pas encore."
        }`,
        confirmText: "Enregistrer le planning",
      })
      if (!confirmed) return false
    }
    const data = await apiPost<{ defenses: DefenseSlot[] }>(`/defenses/projects/${projectId}/schedule`, payload)
    const list = sortSlots(data.defenses)
    onChange(list)
    setDialogOpen(false)
    toast.success(`Planning enregistré : ${plural(list.length, "groupe")}, de ${formatTime(list[0]?.startTime)} à ${formatTime(list[list.length - 1]?.endTime)}.`, {
      description: visible ? "Les étudiants le voient dès maintenant. Aucun e-mail n’est envoyé." : "Les étudiants le verront quand le projet sera visible.",
    })
    return true
  }

  const download = useCallback(async (path: string, fallbackName: string) => {
    try {
      await downloadFile(`/defenses/projects/${projectId}/${path}`, fallbackName)
    } catch (err) {
      toast.error("Le document n’a pas pu être téléchargé.", { description: errorMessage(err, "Réessayez dans un instant.") })
    }
  }, [projectId])

  const dialog = (
    <ScheduleDefenseDialog
      open={dialogOpen}
      onOpenChange={setDialogOpen}
      groups={toSchedule}
      initial={planDefaults(sorted, now)}
      editing={sorted.length > 0}
      keptCount={started.length}
      onSubmit={schedule}
    />
  )

  if (sorted.length === 0) {
    const hasGroups = groups.some((group) => group.members.length > 0)
    return (
      <>
        <EmptyState
          icon={Presentation}
          title="Aucune soutenance planifiée"
          description={
            hasGroups
              ? "Indiquez la date, l’heure de début, la durée par groupe et le lieu : l’heure de passage de chaque groupe est calculée pour vous, et vous pouvez ensuite changer l’ordre."
              : "Les soutenances se planifient groupe par groupe. Constituez d’abord les groupes, puis revenez ici."
          }
          action={
            hasGroups ? (
              <Button onClick={() => setDialogOpen(true)}>
                <CalendarClock aria-hidden="true" className="h-4 w-4" />
                Planifier les soutenances
              </Button>
            ) : (
              <Button onClick={onOpenGroups}>Constituer les groupes</Button>
            )
          }
        />
        {dialog}
      </>
    )
  }

  const done = [...statuses.values()].filter((status) => status === "done").length
  const live = sorted.find((slot) => statuses.get(slot.id) === "live")
  const next = sorted.find((slot) => statuses.get(slot.id) === "next")
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const pause = sorted[1] ? Math.max(0, Math.round((new Date(sorted[1].startTime).getTime() - new Date(first.endTime).getTime()) / 60_000)) : 0
  const instructions = sorted.find((slot) => slot.instructions)?.instructions

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-1">
          <StatTile label="Passés" value={`${done} sur ${sorted.length}`} hint={sorted.length - done > 0 ? `${plural(sorted.length - done, "reste", "restent")} à passer` : "Tous les groupes sont passés"} />
        </div>
        <StatTile label="En cours" value={live?.group?.name ?? "–"} hint={live ? slotRange(live) : "Aucun passage en ce moment"} emphasis={Boolean(live)} />
        <StatTile label="Suivant" value={next?.group?.name ?? "–"} hint={next ? `à ${formatTime(next.startTime)}` : "Aucun autre groupe à venir"} emphasis={!live && Boolean(next)} />
      </div>

      <SectionCard
        title="Ordre de passage"
        description={`${formatDateFull(first.startTime)} · ${first.location || "Lieu à définir"} · ${formatDuration(durationOf(first))} par groupe${
          pause > 0 ? `, ${formatDuration(pause)} de pause` : ""
        } · fin prévue ${sameDay(first.startTime, last.endTime) ? "" : `le ${formatDayMonth(last.endTime)} `}à ${formatTime(last.endTime)}`}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)} disabled={toSchedule.length === 0}>
              <Pencil aria-hidden="true" className="h-4 w-4" />
              Modifier le planning
            </Button>
            <Button variant="outline" size="sm" onClick={() => void draw()} disabled={busy || movable < 2}>
              <Shuffle aria-hidden="true" className="h-4 w-4" />
              Tirer l’ordre au sort
            </Button>
            <span className="ml-auto flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => void download("schedule/pdf", "planning-soutenances.pdf")}>
                <Download aria-hidden="true" className="h-4 w-4" />
                Planning (PDF)
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void download("attendance/pdf", "emargement-soutenances.pdf")}>
                <Download aria-hidden="true" className="h-4 w-4" />
                Fiche d’émargement (PDF)
              </Button>
            </span>
          </div>

          <p className="text-sm text-muted-foreground">
            {announce}
            {movable > 1 ? " Utilisez les flèches pour changer l’ordre : chaque groupe prend l’horaire de sa nouvelle place." : ""}
          </p>

          <DefenseOrderTable
            defenses={sorted}
            members={members}
            noteStates={noteStates}
            now={now}
            busy={busy}
            onMove={move}
            gradeHref={(groupId) => defenseGradingHref(projectId, groupId)}
            onGrade={onGrade}
          />

          {unscheduled.length > 0 && (
            <p role="status" className="rounded-md border bg-muted/40 p-3 text-sm">
              <span className="font-medium">{unscheduled.map((group) => group.name).join(", ")}</span>{" "}
              {unscheduled.length > 1 ? "n’ont" : "n’a"} pas de créneau. « Modifier le planning » {unscheduled.length > 1 ? "les ajoute" : "l’ajoute"} à la fin de l’ordre de passage.
            </p>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Consignes de préparation" description="Ce que les étudiants lisent avec leur créneau.">
        {instructions ? (
          <p className="whitespace-pre-line text-sm leading-relaxed">{instructions}</p>
        ) : (
          <QuietEmpty>Aucune consigne pour l’instant : les étudiants voient leur créneau sans savoir quoi préparer. Ajoutez-les depuis « Modifier le planning ».</QuietEmpty>
        )}
      </SectionCard>

      {dialog}
    </div>
  )
}
