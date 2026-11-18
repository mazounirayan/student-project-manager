/**
 * Formatage des dates en français, lisible et sans dépendance externe.
 */

export function formatDate(
  value?: string | number | Date | null,
  locale = "fr-FR",
  opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "2-digit" },
) {
  if (value === undefined || value === null || value === "") return "Date inconnue";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "Date inconnue" : date.toLocaleDateString(locale, opts);
}

/** « 18 novembre 2026 » */
export function formatDateLong(value?: string | number | Date | null) {
  return formatDate(value, "fr-FR", { year: "numeric", month: "long", day: "numeric" });
}

/** « 18 novembre 2026 à 14 h 30 » */
export function formatDateTime(value?: string | number | Date | null) {
  if (value === undefined || value === null || value === "") return "Date inconnue";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  const jour = date.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
  const heure = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", " h ");
  return `${jour} à ${heure}`;
}

/** « dans 3 jours » / « il y a 2 jours » / « aujourd'hui » — pour les échéances. */
export function formatRelativeDay(value?: string | number | Date | null): string {
  if (value === undefined || value === null || value === "") return "échéance inconnue";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "échéance inconnue";

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(date) - startOfDay(new Date())) / 86_400_000);

  if (days === 0) return "aujourd'hui";
  if (days === 1) return "demain";
  if (days === -1) return "hier";
  if (days > 1) return `dans ${days} jours`;
  return `il y a ${Math.abs(days)} jours`;
}

/** Nombre de jours entiers avant/après une échéance (négatif = dépassée). */
export function daysUntil(value?: string | number | Date | null): number | null {
  if (value === undefined || value === null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(date) - startOfDay(new Date())) / 86_400_000);
}
