/** Formatage à la française (dates, heures, nombres, tailles) partagé par toute l’interface. */

type DateInput = string | number | Date | null | undefined

const UNKNOWN_DATE = "Date inconnue"

function toDate(value: DateInput): Date | null {
  if (value === undefined || value === null || value === "") return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** « 18 nov. 2026 » */
export function formatDate(value: DateInput, fallback = UNKNOWN_DATE) {
  const date = toDate(value)
  return date ? date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : fallback
}

/** « 18 nov. » */
export function formatDayMonth(value: DateInput, fallback = UNKNOWN_DATE) {
  const date = toDate(value)
  return date ? date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : fallback
}

/** « jeudi 26 novembre 2026 » */
export function formatDateFull(value: DateInput, fallback = UNKNOWN_DATE) {
  const date = toDate(value)
  return date ? date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : fallback
}

/** « 14 h 30 » */
export function formatTime(value: DateInput, fallback = "–") {
  const date = toDate(value)
  if (!date) return fallback
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", " h ")
}

/** « 18 nov. à 23 h 00 » : dates des listes et des phrases. */
export function formatShortDateTime(value: DateInput, fallback = UNKNOWN_DATE) {
  const date = toDate(value)
  return date ? `${formatDayMonth(date)} à ${formatTime(date)}` : fallback
}

/** « jeudi 19 novembre 2026 à 23 h 00 » : échéances mises en avant. */
export function formatFullDateTime(value: DateInput, fallback = UNKNOWN_DATE) {
  const date = toDate(value)
  return date ? `${formatDateFull(date)} à ${formatTime(date)}` : fallback
}

/** Nombre de jours entiers avant une échéance (négatif si elle est dépassée), null si la date est inconnue. */
export function daysUntil(value: DateInput): number | null {
  const date = toDate(value)
  return date ? Math.round((startOfDay(date) - startOfDay(new Date())) / 86_400_000) : null
}

/** « dans 3 jours », « demain », « il y a 2 jours »… */
export function formatRelativeDay(value: DateInput): string {
  const days = daysUntil(value)
  if (days === null) return "échéance inconnue"
  if (days === 0) return "aujourd’hui"
  if (days === 1) return "demain"
  if (days === -1) return "hier"
  return days > 1 ? `dans ${days} jours` : `il y a ${Math.abs(days)} jours`
}

/** Nombre avec virgule décimale : 12,5 */
export function formatNumber(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "–"
  return value.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** « 1 groupe », « 0 groupe », « 3 groupes » (le zéro est au singulier en français). */
export function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count < 2 ? singular : pluralForm}`
}

/** « 1,5 Mo » */
export function formatFileSize(bytes: number) {
  const units = ["o", "Ko", "Mo", "Go"]
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${formatNumber(value, unit === 0 ? 0 : 1)} ${units[unit]}`
}

/** Valeur d’un champ `datetime-local` (heure locale) à partir d’une date ISO. */
export function toDatetimeLocal(value: DateInput) {
  const date = toDate(value)
  if (!date) return ""
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

/** 0.5 → « 0,5 », 2 → « 2 » (coefficients, pénalités). */
export function formatDecimal(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "–"
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })
}

const gridTypeLabels: Record<string, string> = { deliverable: "Livrable", report: "Rapport", defense: "Soutenance" }

export function gridTypeLabel(type: string) {
  return gridTypeLabels[type.toLowerCase()] ?? type
}
