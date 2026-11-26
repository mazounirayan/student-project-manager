/** Lectures communes aux écrans du rapport (enseignante et étudiants) : texte, avancement, état d’un groupe, échéance. */
import { daysUntil, formatDateFull, formatDayMonth, formatTime } from "@/lib/format"

export interface SectionConfig {
  id: number
  title: string
  description: string
  required: boolean
  wordLimit: number | null
  order: number
}

export interface ReportConfig {
  id?: number
  projectId: number
  isEnabled: boolean
  format: "markdown" | "html"
  deadline: string | null
  instructions: string | null
  sections: SectionConfig[]
}

export interface Author {
  id: number
  firstName: string
  lastName: string
}

export interface SectionContent {
  sectionConfigId: number
  content: string
  updatedAt: string
  updatedBy?: Author | null
}

export interface GroupReport {
  id: number
  projectId: number
  groupId: number
  group?: { id: number; name: string } | null
  title: string
  status: "draft" | "submitted"
  submittedAt: string | null
  sections: SectionContent[]
  updatedAt?: string | null
}

export interface ReportGroup {
  id: number
  name: string
  members: Array<{ id: number; firstName: string; lastName: string }>
}

export interface ReportGrade {
  groupId: number
  totalScore: number
  status: "draft" | "submitted" | "validated"
}

// ----- Texte -----

const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "’" }

/** Texte brut d’une section écrite dans l’éditeur (HTML) ou en Markdown. */
export function plainText(content: string | null | undefined): string {
  return (content ?? "")
    .replace(/<\/(p|li|h[1-6]|blockquote|pre|div)>|<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/\s+/g, " ")
    .trim()
}

export function countWords(content: string | null | undefined): number {
  const text = plainText(content)
  return text ? text.split(" ").length : 0
}

export const isWritten = (content: string | null | undefined) => plainText(content) !== ""

export const contentOf = (report: GroupReport | null | undefined, sectionId: number): SectionContent | undefined =>
  report?.sections.find((section) => section.sectionConfigId === sectionId)

export const sortedSections = (config: Pick<ReportConfig, "sections">): SectionConfig[] =>
  [...config.sections].sort((a, b) => a.order - b.order)

// ----- Échéance -----

export const isDeadlinePassed = (deadline: string | null | undefined) =>
  Boolean(deadline) && new Date(deadline as string).getTime() < Date.now()

/** « jeudi 3 décembre 2026 à 23 h 59 » */
export function formatDeadline(deadline: string | null | undefined) {
  return deadline ? `${formatDateFull(deadline)} à ${formatTime(deadline)}` : "Pas de date limite"
}

/** « à 14 h 32 » aujourd’hui, « le 24 nov. à 14 h 32 » un autre jour. */
export function formatSavedAt(value: string | Date) {
  return daysUntil(value) === 0 ? `à ${formatTime(value)}` : `le ${formatDayMonth(value)} à ${formatTime(value)}`
}

/** Phrase qui dit ce que l’échéance change pour le groupe. */
export function deadlineHint(deadline: string | null | undefined, submitted: boolean) {
  if (!deadline) return "Pas de date limite : le rapport reste modifiable jusqu’à ce que vous le rendiez."
  if (submitted) return null
  const days = daysUntil(deadline)
  return days !== null && days < 0
    ? "La date limite est passée : le rapport est en lecture seule."
    : "À cette date, le rapport passe en lecture seule : il ne peut plus être modifié ni rendu."
}

// ----- Avancement d’un rapport -----

export interface Progress {
  total: number
  written: number
  required: number
  requiredWritten: number
  words: number
  /** Titres des sections obligatoires encore vides. */
  missing: string[]
  /** Titres des sections qui dépassent leur limite de mots. */
  overLimit: string[]
}

export function progressOf(config: Pick<ReportConfig, "sections">, report: GroupReport | null | undefined): Progress {
  const sections = config.sections
  const stats = sections.map((section) => {
    const content = contentOf(report, section.id)?.content
    return { section, written: isWritten(content), words: countWords(content) }
  })
  return {
    total: sections.length,
    written: stats.filter((item) => item.written).length,
    required: sections.filter((section) => section.required).length,
    requiredWritten: stats.filter((item) => item.section.required && item.written).length,
    words: stats.reduce((sum, item) => sum + item.words, 0),
    missing: sortedSections({ sections })
      .filter((section) => section.required && !stats.find((item) => item.section.id === section.id)?.written)
      .map((section) => section.title),
    overLimit: stats.filter((item) => item.section.wordLimit && item.words > item.section.wordLimit).map((item) => item.section.title),
  }
}

/** Dernière activité sur un rapport : la plus récente des modifications de section ou du rendu. */
export function lastActivity(report: GroupReport | null | undefined): string | null {
  if (!report) return null
  const dates = [report.submittedAt, ...report.sections.map((section) => section.updatedAt)].filter((date): date is string => Boolean(date))
  return dates.reduce<string | null>((latest, date) => (latest === null || new Date(date) > new Date(latest) ? date : latest), null)
}

// ----- Suivi des groupes (enseignante) -----

export type ReportState = "not-started" | "drafting" | "submitted"

export const STATE_LABELS: Record<ReportState, string> = {
  "not-started": "Pas commencé",
  drafting: "En rédaction",
  submitted: "Rendu",
}

export interface GroupOverview {
  group: ReportGroup
  report: GroupReport | null
  state: ReportState
  /** Pas rendu alors que la date limite est passée. */
  overdue: boolean
  progress: Progress
  lastActivity: string | null
  grade: ReportGrade | null
}

export function buildOverview(
  config: ReportConfig,
  groups: ReportGroup[],
  reports: GroupReport[],
  grades: ReportGrade[],
): GroupOverview[] {
  const passed = isDeadlinePassed(config.deadline)
  return groups.map((group) => {
    const report = reports.find((item) => item.groupId === group.id) ?? null
    const progress = progressOf(config, report)
    const state: ReportState = report?.status === "submitted" ? "submitted" : progress.written > 0 ? "drafting" : "not-started"
    return {
      group,
      report,
      state,
      overdue: passed && state !== "submitted",
      progress,
      lastActivity: lastActivity(report),
      grade: grades.find((item) => item.groupId === group.id) ?? null,
    }
  })
}

export interface OverviewCounts {
  groups: number
  submitted: number
  drafting: number
  notStarted: number
  overdue: number
}

export function countStates(rows: GroupOverview[]): OverviewCounts {
  return {
    groups: rows.length,
    submitted: rows.filter((row) => row.state === "submitted").length,
    drafting: rows.filter((row) => row.state === "drafting").length,
    notStarted: rows.filter((row) => row.state === "not-started").length,
    overdue: rows.filter((row) => row.overdue).length,
  }
}

/** Adresse de la lecture du rapport d’un groupe dans la page du projet (onglet Rapports). */
export const reportHash = (groupId: number) => `#reports/${groupId}`
