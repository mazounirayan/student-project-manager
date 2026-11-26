"use client"

import Link from "next/link"
import { useMemo, useRef, useState, type ReactNode } from "react"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core"
import { FolderInput, GripVertical, Plus, Search, Shuffle, Trash2, UserMinus } from "lucide-react"
import { toast } from "sonner"
import { QuietEmpty } from "@/components/dashboard/parts"
import { EmptyState } from "@/components/shared/EmptyState"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { errorMessage } from "@/lib/api"
import { confirmAction } from "@/lib/dialogs"
import { formatDateTime, plural } from "@/lib/format"
import { moveStudent, planAutoDistribution } from "@/lib/groups"
import { fullName, initials, matchesQuery } from "@/lib/people"
import { formationClosed, groupFill, groupSizeLabel, isFreeFormation, maxGroupSize, type ProjectGroup, type ProjectPerson } from "@/lib/projects"
import { cn } from "@/lib/utils"
import { createGroup, deleteGroup, saveProjectGrouping } from "@/services/groups.service"
import type { Project } from "@/services/project.service"

const UNASSIGNED = "unassigned"
const studentKey = (id: number) => `s-${id}`
const groupKey = (id: number) => `g-${id}`

type SaveState = "idle" | "saving" | "saved" | "error"

interface GroupsBoardProps {
  project: Project
  /** Tous les étudiants de la promotion du projet. */
  students: ProjectPerson[]
  initialGroups: ProjectGroup[]
  /** Appelé après chaque enregistrement réussi, pour tenir à jour les compteurs de la page. */
  onGroupsChange?: (groups: ProjectGroup[]) => void
}

export default function GroupsBoard({ project, students, initialGroups, onGroupsChange }: GroupsBoardProps) {
  const maxSize = maxGroupSize(project)
  const [groups, setGroups] = useState(initialGroups)
  const savedGroups = useRef(initialGroups)
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [busy, setBusy] = useState(false)
  const [announcement, setAnnouncement] = useState("")
  const [query, setQuery] = useState("")
  const [dragged, setDragged] = useState<ProjectPerson | null>(null)

  const people = useMemo(() => new Map(students.map((student) => [student.id, student])), [students])
  const unassigned = useMemo(() => {
    const placed = new Set(groups.flatMap((group) => group.members.map((member) => member.id)))
    return students.filter((student) => !placed.has(student.id))
  }, [groups, students])
  const shownUnassigned = useMemo(() => unassigned.filter((student) => matchesQuery(student, query)), [unassigned, query])
  const groupOf = (studentId: number) => groups.find((group) => group.members.some((member) => member.id === studentId))

  /** Enregistre la répartition ; en cas d’échec, revient à la dernière répartition enregistrée. */
  const persist = async (next: ProjectGroup[], message: string): Promise<boolean> => {
    setGroups(next)
    setBusy(true)
    setSaveState("saving")
    try {
      await saveProjectGrouping(project.id, {
        groups: next.map((group) => ({ id: group.id, memberIds: group.members.map((member) => member.id) })),
        unassignedIds: [],
      })
      savedGroups.current = next
      setSaveState("saved")
      setAnnouncement(message)
      onGroupsChange?.(next)
      return true
    } catch (err) {
      setGroups(savedGroups.current)
      setSaveState("error")
      toast.error("La répartition n’a pas été enregistrée.", { description: errorMessage(err, "Réessayez dans un instant.") })
      return false
    } finally {
      setBusy(false)
    }
  }

  const place = (student: ProjectPerson, targetGroupId: number | null) => {
    if (busy) return
    const target = groups.find((group) => group.id === targetGroupId)
    if (targetGroupId !== null && !target) return
    if (target && target.members.some((member) => member.id === student.id)) return
    if (target && target.members.length >= maxSize) {
      toast.error(`${target.name} est complet.`, { description: `La taille maximale est de ${plural(maxSize, "étudiant")} par groupe.` })
      return
    }
    void persist(
      moveStudent(groups, student, targetGroupId),
      target ? `${fullName(student)} est dans ${target.name}.` : `${fullName(student)} n’a plus de groupe.`,
    )
  }

  const addGroup = async () => {
    if (busy) return
    setBusy(true)
    try {
      const created = await createGroup(project.id)
      const next = [...groups, { ...created, members: [] }]
      setGroups(next)
      savedGroups.current = [...savedGroups.current, { ...created, members: [] }]
      onGroupsChange?.(savedGroups.current)
      setAnnouncement(`${created.name} ajouté.`)
    } catch (err) {
      toast.error("Le groupe n’a pas été créé.", { description: errorMessage(err, "Réessayez dans un instant.") })
    } finally {
      setBusy(false)
    }
  }

  const removeGroup = async (group: ProjectGroup) => {
    if (busy) return
    const confirmed = await confirmAction({
      title: `Supprimer le groupe « ${group.name} » ?`,
      description: "Le groupe est vide. Vous pourrez en créer un nouveau à tout moment.",
      confirmText: "Supprimer le groupe",
      destructive: true,
    })
    if (!confirmed) return
    setBusy(true)
    try {
      await deleteGroup(group.id)
      savedGroups.current = savedGroups.current.filter((item) => item.id !== group.id)
      setGroups((current) => current.filter((item) => item.id !== group.id))
      onGroupsChange?.(savedGroups.current)
      setAnnouncement(`${group.name} supprimé.`)
    } catch (err) {
      toast.error("Le groupe n’a pas été supprimé.", { description: errorMessage(err, "Réessayez dans un instant.") })
    } finally {
      setBusy(false)
    }
  }

  const autoDistribute = async () => {
    if (busy || unassigned.length === 0) return
    const plan = planAutoDistribution(unassigned, groups, maxSize)
    const confirmed = await confirmAction({
      title: `Répartir ${plural(unassigned.length, "étudiant")} au hasard ?`,
      description:
        "Ils sont placés à parts égales dans les groupes qui ont de la place." +
        (plan.newGroups > 0
          ? ` Les places restantes ne suffisent pas : ${plural(plan.newGroups, "nouveau groupe sera créé", "nouveaux groupes seront créés")}.`
          : "") +
        " Les groupes déjà constitués ne changent pas, et vous pourrez ensuite déplacer chaque étudiant.",
      confirmText: "Répartir",
    })
    if (!confirmed) return

    setBusy(true)
    let all = groups
    try {
      for (let i = 0; i < plan.newGroups; i++) {
        const created = await createGroup(project.id)
        all = [...all, { ...created, members: [] }]
        savedGroups.current = [...savedGroups.current, { ...created, members: [] }]
      }
    } catch (err) {
      setGroups(savedGroups.current)
      toast.error("Les nouveaux groupes n’ont pas été créés.", { description: errorMessage(err, "Réessayez dans un instant.") })
      setBusy(false)
      return
    }

    const next = all.map((group, slot) => ({
      ...group,
      members: [...group.members, ...plan.placements.filter((placement) => placement.slot === slot).map((placement) => placement.student)],
    }))
    const summary = `${plural(plan.placements.length, "étudiant réparti", "étudiants répartis")}.`
    if (await persist(next, summary)) toast.success(summary)
  }

  // --- Glisser-déposer : souris, doigt (poignée sans défilement) et clavier (flèches entre les zones) ---
  const orderedZones = [UNASSIGNED, ...groups.map((group) => groupKey(group.id))]
  const zonesRef = useRef(orderedZones)
  zonesRef.current = orderedZones

  const keyboardGetter: KeyboardCoordinateGetter = (event, { context: { droppableRects, collisionRect } }) => {
    const direction = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.code as "ArrowDown"]
    if (!direction || !collisionRect) return undefined
    event.preventDefault()
    const zones = zonesRef.current
    const centerY = collisionRect.top + collisionRect.height / 2
    const centerX = collisionRect.left + collisionRect.width / 2
    let current = 0
    let best = Infinity
    zones.forEach((id, index) => {
      const rect = droppableRects.get(id)
      if (!rect) return
      const distance = Math.hypot(rect.left + rect.width / 2 - centerX, rect.top + rect.height / 2 - centerY)
      if (distance < best) {
        best = distance
        current = index
      }
    })
    const target = droppableRects.get(zones[Math.min(zones.length - 1, Math.max(0, current + direction))])
    return target ? { x: target.left + 8, y: target.top + 8 } : undefined
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardGetter }),
  )
  const collisionDetection: CollisionDetection = (args) => (args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args))

  const studentOf = (id: unknown) => {
    const key = String(id)
    return key.startsWith("s-") ? people.get(Number(key.slice(2))) : undefined
  }
  const zoneName = (id: unknown) => {
    const key = String(id)
    if (key === UNASSIGNED) return "la liste des étudiants sans groupe"
    return groups.find((group) => groupKey(group.id) === key)?.name ?? "un groupe"
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `${fullName(studentOf(active.id) ?? { firstName: "", lastName: "" })} est saisi. Flèches pour changer de zone, Espace pour déposer.`,
    onDragOver: ({ active, over }) => (over ? `${fullName(studentOf(active.id) ?? { firstName: "", lastName: "" })} est au-dessus de ${zoneName(over.id)}.` : undefined),
    onDragEnd: ({ active, over }) => (over ? `${fullName(studentOf(active.id) ?? { firstName: "", lastName: "" })} est déposé dans ${zoneName(over.id)}.` : "Dépôt annulé."),
    onDragCancel: () => "Déplacement annulé.",
  }

  const handleDragStart = (event: DragStartEvent) => setDragged(studentOf(event.active.id) ?? null)

  const handleDragEnd = (event: DragEndEvent) => {
    setDragged(null)
    const student = studentOf(event.active.id)
    const over = event.over ? String(event.over.id) : null
    if (!student || !over) return
    if (over === UNASSIGNED) {
      if (groupOf(student.id)) place(student, null)
    } else if (over.startsWith("g-")) {
      place(student, Number(over.slice(2)))
    }
  }

  // --- Rendu ---
  if (students.length === 0) {
    return (
      <EmptyState
        title="Aucun étudiant dans cette promotion"
        description="Ajoutez les étudiants à la promotion pour pouvoir les répartir en groupes."
        action={
          <Button asChild>
            <Link href="/promotions">Aller aux promotions</Link>
          </Button>
        }
      />
    )
  }

  const free = isFreeFormation(project)
  const closed = formationClosed(project)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragged(null)}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Pour déplacer cet étudiant, appuyez sur Espace, changez de zone avec les flèches, puis déposez-le avec Espace ou annulez avec Échap. Le bouton « Déplacer vers » propose la même action sous forme de menu.",
        },
      }}
    >
      <div className="space-y-4" aria-busy={busy}>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 flex-[1_1_26rem] space-y-1">
            <p className="text-sm font-medium tabular-nums">
              {plural(students.length, "étudiant")} · {plural(groups.length, "groupe")} ·{" "}
              <span className={cn(unassigned.length > 0 && "text-primary")}>{unassigned.length === 0 ? "tous placés" : `${unassigned.length} sans groupe`}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {groupSizeLabel(project)}.{" "}
              {free
                ? closed
                  ? "Formation libre, terminée : les étudiants ne peuvent plus changer de groupe."
                  : `Formation libre : les étudiants peuvent aussi rejoindre ou quitter un groupe${project.groupFormationDeadline ? ` jusqu’au ${formatDateTime(project.groupFormationDeadline)}` : ""}.`
                : "Seul vous placez les étudiants."}
              {project.status === "draft" && " Le projet est en brouillon : les étudiants ne voient pas encore les groupes."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span role="status" aria-live="polite" className="text-right text-sm text-muted-foreground empty:hidden">
              {saveState === "saving" ? "Enregistrement…" : saveState === "saved" ? "Modifications enregistrées" : saveState === "error" ? "Non enregistré" : ""}
            </span>
            <Button variant="outline" onClick={addGroup} disabled={busy}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              Ajouter un groupe
            </Button>
            <Button onClick={autoDistribute} disabled={busy || unassigned.length === 0}>
              <Shuffle aria-hidden="true" className="h-4 w-4" />
              {unassigned.length > 0 ? `Répartir les ${unassigned.length} restants` : "Répartir les restants"}
            </Button>
          </div>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">
          <Zone id={UNASSIGNED} className="lg:sticky lg:top-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">Sans groupe</h3>
              <Badge variant={unassigned.length > 0 ? "default" : "secondary"} className="tabular-nums">
                {unassigned.length}
              </Badge>
            </div>
            {unassigned.length > 0 && (
              <div className="relative mt-3">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="search" aria-label="Rechercher un étudiant sans groupe" placeholder="Rechercher" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
            )}
            <div className="mt-3">
              {unassigned.length === 0 ? (
                <QuietEmpty done>Tous les étudiants ont un groupe.</QuietEmpty>
              ) : shownUnassigned.length === 0 ? (
                <QuietEmpty>Aucun étudiant sans groupe ne correspond à « {query} ».</QuietEmpty>
              ) : (
                <ul className="max-h-80 space-y-1.5 overflow-y-auto pr-1 lg:max-h-[calc(100vh-18rem)]">
                  {shownUnassigned.map((student) => (
                    <StudentItem key={student.id} student={student} groups={groups} maxSize={maxSize} currentGroupId={null} disabled={busy} onMove={place} />
                  ))}
                </ul>
              )}
            </div>
          </Zone>

          {groups.length === 0 ? (
            <EmptyState
              title="Aucun groupe pour l’instant"
              description="Ajoutez un groupe vide, ou répartissez les étudiants automatiquement : les groupes nécessaires sont alors créés pour vous."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {groups.map((group) => (
                <GroupCard key={group.id} group={group} project={project} groups={groups} maxSize={maxSize} busy={busy} onMove={place} onDelete={() => removeGroup(group)} />
              ))}
            </div>
          )}
        </div>

        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </div>

      <DragOverlay>{dragged ? <StudentCard student={dragged} floating /> : null}</DragOverlay>
    </DndContext>
  )
}

/** Zone où l’on peut déposer un étudiant : surlignée pendant un survol. */
function Zone({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <section ref={setNodeRef} className={cn("rounded-xl border bg-card p-4 text-card-foreground shadow-sm transition-colors", isOver && "border-primary bg-primary/5 ring-2 ring-primary/30", className)}>
      {children}
    </section>
  )
}

interface MoveHandlers {
  groups: ProjectGroup[]
  maxSize: number
  disabled: boolean
  onMove: (student: ProjectPerson, targetGroupId: number | null) => void
}

function GroupCard({ group, project, groups, maxSize, busy, onMove, onDelete }: Omit<MoveHandlers, "disabled"> & { group: ProjectGroup; project: Project; busy: boolean; onDelete: () => void }) {
  const fill = groupFill(group, project)
  return (
    <Zone id={groupKey(group.id)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{group.name}</h3>
        <div className="flex items-center gap-1.5">
          {fill === "full" && <Badge variant="secondary">Complet</Badge>}
          {fill === "incomplete" && <Badge variant="outline">Incomplet · min. {project.minGroupSize}</Badge>}
          <span className="text-sm tabular-nums text-muted-foreground" aria-label={`${group.members.length} étudiants sur ${maxSize} au maximum`}>
            {group.members.length}/{maxSize}
          </span>
          {fill === "empty" && (
            <Button variant="ghost" size="icon" className="-mr-2 h-8 w-8" aria-label={`Supprimer ${group.name}`} disabled={busy} onClick={onDelete}>
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="mt-3">
        {group.members.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">Glissez un étudiant ici, ou utilisez « Déplacer vers ».</p>
        ) : (
          <ul className="space-y-1.5">
            {group.members.map((member) => (
              <StudentItem key={member.id} student={member} groups={groups} maxSize={maxSize} currentGroupId={group.id} disabled={busy} onMove={onMove} />
            ))}
          </ul>
        )}
      </div>
    </Zone>
  )
}

function StudentItem({ student, currentGroupId, ...handlers }: MoveHandlers & { student: ProjectPerson; currentGroupId: number | null }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: studentKey(student.id), disabled: handlers.disabled })
  return (
    <li ref={setNodeRef} className={cn(isDragging && "opacity-40")}>
      <StudentCard
        student={student}
        handle={
          <button
            type="button"
            ref={setActivatorNodeRef}
            aria-label={`Glisser ${fullName(student)}`}
            className="flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical aria-hidden="true" className="h-4 w-4" />
          </button>
        }
        menu={<MoveMenu student={student} currentGroupId={currentGroupId} {...handlers} />}
      />
    </li>
  )
}

function StudentCard({ student, handle, menu, floating = false }: { student: ProjectPerson; handle?: ReactNode; menu?: ReactNode; floating?: boolean }) {
  return (
    <div className={cn("flex items-center gap-1.5 rounded-md border bg-background py-1 pl-1 pr-1.5", floating && "shadow-lg")}>
      {handle ?? <GripVertical aria-hidden="true" className="h-4 w-6 shrink-0 text-muted-foreground" />}
      <Avatar className="h-7 w-7">
        <AvatarFallback className="text-[11px]">{initials(student)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium">{fullName(student)}</p>
        <p className="truncate text-xs text-muted-foreground">{student.email}</p>
      </div>
      {menu}
    </div>
  )
}

/** Alternative au glisser-déposer : un menu pour envoyer l’étudiant dans un groupe (clavier, lecteur d’écran, téléphone). */
function MoveMenu({ student, currentGroupId, groups, maxSize, disabled, onMove }: MoveHandlers & { student: ProjectPerson; currentGroupId: number | null }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={disabled} aria-label={`Déplacer ${fullName(student)} vers un groupe`}>
          <FolderInput aria-hidden="true" className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel>Déplacer vers…</DropdownMenuLabel>
        {groups.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">Aucun groupe : ajoutez-en un d’abord.</p>}
        {groups.map((group) => {
          const current = group.id === currentGroupId
          const full = !current && group.members.length >= maxSize
          return (
            <DropdownMenuItem key={group.id} disabled={current || full} onSelect={() => onMove(student, group.id)}>
              <span className="flex-1">{group.name}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{current ? "actuel" : full ? "complet" : `${group.members.length}/${maxSize}`}</span>
            </DropdownMenuItem>
          )
        })}
        {currentGroupId !== null && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onMove(student, null)}>
              <UserMinus aria-hidden="true" className="h-4 w-4" />
              Retirer du groupe
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
