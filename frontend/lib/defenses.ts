/** Planning des soutenances : créneaux, états (passée, en cours, suivante), ordre de passage et lecture côté étudiant. */
import { formatTime } from "@/lib/format"

export interface DefenseSlot {
  id: number
  group?: { id: number; name: string } | null
  startTime: string
  endTime: string
  orderIndex: number
  location?: string | null
  /** Ce que les étudiants doivent préparer. */
  instructions?: string | null
}

/** Passée, en cours, suivante (la première à venir) ou à venir. */
export type DefenseStatus = "done" | "live" | "next" | "upcoming"

export const DEFENSE_STATUS_LABELS: Record<DefenseStatus, string> = {
  done: "Passée",
  live: "En cours",
  next: "Suivante",
  upcoming: "À venir",
}

export const DEFAULT_DEFENSE_DURATION = 30
export const DEFAULT_DEFENSE_PAUSE = 5

const MINUTE = 60_000
const time = (value: string) => new Date(value).getTime()

/** Dans l’ordre de passage (l’heure de passage suit toujours l’ordre). */
export const sortSlots = <T extends Pick<DefenseSlot, "startTime" | "orderIndex">>(list: T[]): T[] =>
  [...list].sort((a, b) => time(a.startTime) - time(b.startTime) || a.orderIndex - b.orderIndex)

/** Une soutenance commencée ne se déplace plus. */
export const hasStarted = (slot: Pick<DefenseSlot, "startTime">, now = Date.now()) => time(slot.startTime) <= now

/** État de chaque soutenance, par identifiant. */
export function statusesOf(list: DefenseSlot[], now = Date.now()): Map<number, DefenseStatus> {
  const result = new Map<number, DefenseStatus>()
  let nextFound = false
  for (const slot of sortSlots(list)) {
    if (time(slot.endTime) <= now) result.set(slot.id, "done")
    else if (time(slot.startTime) <= now) result.set(slot.id, "live")
    else if (!nextFound) {
      nextFound = true
      result.set(slot.id, "next")
    } else result.set(slot.id, "upcoming")
  }
  return result
}

export const durationOf = (slot: Pick<DefenseSlot, "startTime" | "endTime">) => Math.round((time(slot.endTime) - time(slot.startTime)) / MINUTE)

/** « 30 min », « 1 h », « 1 h 30 ». */
export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const rest = minutes % 60
  return rest === 0 ? `${minutes / 60} h` : `${Math.floor(minutes / 60)} h ${String(rest).padStart(2, "0")}`
}

/** « 9 h 00 – 9 h 30 » */
export const slotRange = (slot: Pick<DefenseSlot, "startTime" | "endTime">) => `${formatTime(slot.startTime)} – ${formatTime(slot.endTime)}`

/** « 1er sur 3 », « 2e sur 3 ». */
export function positionLabel(position: number, total: number) {
  if (total <= 1) return "Seul groupe à passer"
  return `${position === 1 ? "1er" : `${position}e`} sur ${total}`
}

// ----- Calcul des créneaux (même règle que l’API) -----

export interface PlanSettings {
  /** Date de début, « 2026-11-26 ». */
  date: string
  /** Heure de début, « 09:00 ». */
  time: string
  duration: number
  pause: number
  location: string
  instructions: string
}

export const startOf = (settings: Pick<PlanSettings, "date" | "time">) => new Date(`${settings.date}T${settings.time}`)

/** Les créneaux de `count` groupes : même durée, une pause entre deux groupes. */
export function computeSlots(start: Date, duration: number, pause: number, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const begin = new Date(start.getTime() + index * (duration + pause) * MINUTE)
    return { start: begin, end: new Date(begin.getTime() + duration * MINUTE) }
  })
}

const pad = (value: number) => String(value).padStart(2, "0")
const dateInput = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const timeInput = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`

/** Réglages de départ du formulaire : ceux du planning en cours (premier groupe à replanifier), sinon des valeurs courantes. */
export function planDefaults(defenses: DefenseSlot[], now = Date.now()): PlanSettings {
  const sorted = sortSlots(defenses)
  const toPlan = sorted.filter((slot) => !hasStarted(slot, now))
  const reference = toPlan[0] ?? sorted[sorted.length - 1]
  const instructions = sorted.find((slot) => slot.instructions)?.instructions ?? ""
  if (!reference) return { date: "", time: "09:00", duration: DEFAULT_DEFENSE_DURATION, pause: DEFAULT_DEFENSE_PAUSE, location: "", instructions }

  const start = toPlan[0] ? new Date(toPlan[0].startTime) : null
  const pause = toPlan[1] ? Math.max(0, Math.round((time(toPlan[1].startTime) - time(reference.endTime)) / MINUTE)) : DEFAULT_DEFENSE_PAUSE
  return {
    date: start ? dateInput(start) : "",
    time: start ? timeInput(start) : "09:00",
    duration: durationOf(reference) || DEFAULT_DEFENSE_DURATION,
    pause,
    location: reference.location ?? "",
    instructions,
  }
}

/**
 * Groupes à qui l’API attribue un créneau en replanifiant : ceux qui ont des membres et dont la soutenance n’a pas commencé,
 * dans l’ordre actuel, puis les groupes sans créneau.
 */
export function groupsToSchedule<G extends { id: number; members?: unknown[] }>(groups: G[], defenses: DefenseSlot[], now = Date.now()): G[] {
  const sorted = sortSlots(defenses)
  const started = new Set(sorted.filter((slot) => hasStarted(slot, now)).map((slot) => slot.group?.id))
  const position = new Map(sorted.filter((slot) => !hasStarted(slot, now)).map((slot, index) => [slot.group?.id, index]))
  return groups
    .filter((group) => (group.members?.length ?? 0) > 0 && !started.has(group.id))
    .sort((a, b) => (position.get(a.id) ?? Infinity) - (position.get(b.id) ?? Infinity) || a.id - b.id)
}

// ----- Ordre de passage -----

/** Déplace la soutenance de la place `from` à la place `to` ; chaque groupe prend l’horaire de sa nouvelle place. */
export function moveSlot(list: DefenseSlot[], from: number, to: number): DefenseSlot[] {
  const sorted = sortSlots(list)
  const next = [...sorted]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next.map((slot, index) => ({ ...slot, startTime: sorted[index].startTime, endTime: sorted[index].endTime, orderIndex: index + 1 }))
}

/** Mélange les soutenances qui n’ont pas commencé ; les autres restent en tête, à leur place. */
export function shuffleUpcoming(list: DefenseSlot[], now = Date.now(), random: () => number = Math.random): DefenseSlot[] {
  const sorted = sortSlots(list)
  const fixed = sorted.filter((slot) => hasStarted(slot, now))
  const movable = sorted.slice(fixed.length)
  for (let index = movable.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1))
    ;[movable[index], movable[swap]] = [movable[swap], movable[index]]
  }
  const order = [...fixed, ...movable]
  return order.map((slot, index) => ({ ...slot, startTime: sorted[index].startTime, endTime: sorted[index].endTime, orderIndex: index + 1 }))
}

/** Corps de la demande de changement d’ordre. */
export const reorderPayload = (list: DefenseSlot[]) => ({
  newOrder: sortSlots(list).flatMap((slot, index) => (slot.group ? [{ groupId: slot.group.id, orderIndex: index + 1 }] : [])),
})

// ----- Côté étudiant -----

/** « Dans 35 min », « Dans 2 h 10 » : seulement dans les trois heures qui précèdent le passage, sinon null (le jour suffit). */
export function countdownLabel(startTime: string, now = Date.now()): string | null {
  const minutes = Math.ceil((time(startTime) - now) / MINUTE)
  if (minutes <= 0 || minutes > 180) return null
  return minutes < 60 ? `Dans ${minutes} min` : `Dans ${formatDuration(minutes)}`
}


export interface StudentSlot {
  slot: DefenseSlot
  status: DefenseStatus
  /** Place du groupe dans l’ordre de passage (à partir de 1) et nombre de groupes. */
  position: number
  total: number
}

/** Créneau du groupe de l’étudiant, avec son état et sa place dans l’ordre de passage. */
export function studentSlot(defenses: DefenseSlot[], groupId: number | null | undefined, now = Date.now()): StudentSlot | null {
  if (!groupId) return null
  const sorted = sortSlots(defenses)
  const index = sorted.findIndex((slot) => slot.group?.id === groupId)
  if (index === -1) return null
  const slot = sorted[index]
  const status = statusesOf(sorted, now).get(slot.id) ?? "upcoming"
  return { slot, status, position: index + 1, total: sorted.length }
}
