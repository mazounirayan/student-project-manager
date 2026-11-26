"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"
import { ArrowDown, ArrowUp, PenLine } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DEFENSE_STATUS_LABELS, hasStarted, slotRange, sortSlots, statusesOf, type DefenseSlot, type DefenseStatus } from "@/lib/defenses"
import { GRADE_STATE_LABELS, type GradeState } from "@/lib/grading"
import { fullName } from "@/lib/people"
import { cn } from "@/lib/utils"

interface DefenseOrderTableProps {
  defenses: DefenseSlot[]
  /** Membres de chaque groupe, pour reconnaître qui passe. */
  members: Map<number, { firstName: string; lastName: string }[]>
  /** État de la note de soutenance de chaque groupe ; absent tant qu’il n’est pas chargé. */
  noteStates: Map<number, GradeState> | null
  /** Heure de référence pour savoir qui est passé (se met à jour toutes les minutes). */
  now: number
  /** Une modification est en cours d’enregistrement. */
  busy: boolean
  onMove: (slotId: number, direction: -1 | 1) => void
  gradeHref: (groupId: number) => string
  onGrade: (groupId: number) => void
}

const STATUS_BADGE: Record<DefenseStatus, "default" | "secondary" | "outline"> = {
  done: "secondary",
  live: "default",
  next: "outline",
  upcoming: "outline",
}

/** Ordre de passage : l’état de chaque groupe, son horaire, la note à saisir et deux boutons pour changer l’ordre. */
export default function DefenseOrderTable({ defenses, members, noteStates, now, busy, onMove, gradeHref, onGrade }: DefenseOrderTableProps) {
  const sorted = sortSlots(defenses)
  const statuses = statusesOf(sorted, now)
  // Les soutenances commencées restent en tête et ne se déplacent plus.
  const locked = sorted.filter((slot) => hasStarted(slot, now)).length

  // Après un déplacement, le focus reste sur le bouton utilisé (la ligne change de place dans la liste).
  const focusAfter = useRef<string | null>(null)
  useEffect(() => {
    if (busy || !focusAfter.current) return
    const [id, direction] = focusAfter.current.split(":")
    const wanted = document.querySelector<HTMLButtonElement>(`[data-move="${id}:${direction}"]`)
    const fallback = document.querySelector<HTMLButtonElement>(`[data-move="${id}:${direction === "up" ? "down" : "up"}"]`)
    ;(wanted && !wanted.disabled ? wanted : fallback)?.focus()
    focusAfter.current = null
  }, [busy, defenses])

  const move = (slot: DefenseSlot, direction: -1 | 1) => {
    focusAfter.current = `${slot.id}:${direction === -1 ? "up" : "down"}`
    onMove(slot.id, direction)
  }

  return (
    <ol className="divide-y rounded-lg border" aria-label="Ordre de passage">
      {sorted.map((slot, index) => {
        const status = statuses.get(slot.id) ?? "upcoming"
        const groupId = slot.group?.id
        const people = (groupId !== undefined && members.get(groupId)) || []
        const note = groupId !== undefined ? noteStates?.get(groupId) : undefined
        const movable = index >= locked
        const gradable = status === "done" || status === "live"
        const name = slot.group?.name ?? "Groupe supprimé"

        return (
          <li
            key={slot.id}
            aria-current={status === "next" || status === "live" ? "step" : undefined}
            className={cn("flex flex-wrap items-center gap-x-4 gap-y-3 p-3 sm:px-4", (status === "live" || status === "next") && "bg-primary/5")}
          >
            <span className="w-6 shrink-0 text-center text-sm font-semibold tabular-nums text-muted-foreground" aria-label={`Passage ${index + 1}`}>
              {index + 1}
            </span>

            <div className="min-w-0 flex-[1_1_14rem]">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium">{name}</span>
                <Badge variant={STATUS_BADGE[status]} className={status === "next" ? "border-primary text-primary" : undefined}>
                  {DEFENSE_STATUS_LABELS[status]}
                </Badge>
              </p>
              <p className="text-sm tabular-nums text-muted-foreground">{slotRange(slot)}</p>
              {people.length > 0 && <p className="text-xs text-muted-foreground">{people.map(fullName).join(", ")}</p>}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {gradable && groupId !== undefined && (
                <>
                  {note && <span className="text-xs text-muted-foreground">Note : {GRADE_STATE_LABELS[note].toLowerCase()}</span>}
                  <Button asChild size="sm" variant={note === "validated" || note === "published" ? "outline" : "default"}>
                    <Link
                      href={gradeHref(groupId)}
                      onClick={(event) => {
                        // Déjà sur l’onglet : on descend directement à la grille, sans recharger la page.
                        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
                        event.preventDefault()
                        onGrade(groupId)
                      }}
                    >
                      <PenLine aria-hidden="true" className="h-4 w-4" />
                      {note === "validated" || note === "published" ? "Voir la note" : "Noter"}
                      <span className="sr-only"> {name}</span>
                    </Link>
                  </Button>
                </>
              )}
              {movable && (
                <div className="flex items-center gap-1" role="group" aria-label={`Changer l’ordre de ${name}`}>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    data-move={`${slot.id}:up`}
                    disabled={index <= locked}
                    aria-disabled={busy || undefined}
                    title="Passer plus tôt"
                    onClick={() => !busy && move(slot, -1)}
                  >
                    <ArrowUp aria-hidden="true" className="h-4 w-4" />
                    <span className="sr-only">Monter {name} d’une place</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    data-move={`${slot.id}:down`}
                    disabled={index === sorted.length - 1}
                    aria-disabled={busy || undefined}
                    title="Passer plus tard"
                    onClick={() => !busy && move(slot, 1)}
                  >
                    <ArrowDown aria-hidden="true" className="h-4 w-4" />
                    <span className="sr-only">Descendre {name} d’une place</span>
                  </Button>
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
