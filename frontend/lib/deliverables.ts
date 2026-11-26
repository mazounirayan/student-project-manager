/** Lectures communes aux écrans des livrables (enseignante et étudiants) : règles, retard, conformité, ressemblance. */
import { formatDecimal, formatNumber } from "@/lib/format"
import { projectPath } from "@/lib/routes"

export type DeliverableKind = "archive" | "git_link"
export type RuleType = "max_size" | "file_presence" | "folder_structure" | "file_content"

export interface Rule {
  id: number
  type: RuleType
  /** Paramètres de la règle, en JSON. */
  configuration: string
  errorMessage?: string | null
}

export interface RuleResult {
  type: RuleType | string
  configuration?: string
  passed: boolean
  message: string
}

export interface SimilarTo {
  submissionId: number
  groupId: number | null
  groupName: string | null
  /** Entre 0 et 1. */
  score: number
  details?: string
}

export interface Submission {
  id: number
  groupId: number
  group?: { id: number; name: string } | null
  fileName?: string | null
  fileSize?: number | null
  gitUrl?: string | null
  submittedAt: string
  isLate: boolean
  penalty?: number
  validationResults?: RuleResult[]
  /** Réservés à l’enseignante : l’API ne les envoie pas aux étudiants. */
  similarityScore?: number | null
  similarTo?: SimilarTo[]
}

export interface Deliverable {
  id: number
  name: string
  description: string
  type: DeliverableKind
  deadline: string
  allowLateSubmission: boolean
  penaltyPerHour: number
  validationRules?: Rule[]
  submissions?: Submission[]
}

export interface GroupRef {
  id: number
  name: string
  members?: Array<{ firstName: string; lastName: string }>
}

// ----- Règles de conformité, dites en clair -----

export const RULE_LABELS: Record<RuleType, string> = {
  file_presence: "Fichiers requis",
  max_size: "Taille maximale",
  folder_structure: "Dossiers attendus",
  file_content: "Contenu d’un fichier",
}

function parseConfiguration(configuration: string | undefined): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(configuration ?? "")
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const toList = (value: unknown): string[] =>
  (Array.isArray(value) ? value : typeof value === "string" ? [value] : []).filter(
    (item): item is string => typeof item === "string" && item.trim() !== "",
  )

/** « 20 Mo », « 1,5 Go » */
export function formatMegabytes(megabytes: number) {
  return megabytes >= 1024 ? `${formatDecimal(megabytes / 1024)} Go` : `${formatDecimal(megabytes)} Mo`
}

const enumerate = (items: string[]) => items.join(", ")

/** Retire les échappements ajoutés quand l’enseignante saisit un texte simple (« \\. » devient « . »). */
const unescapeRegex = (pattern: string) => pattern.replace(/\\(.)/g, "$1")

/** Échappe un texte pour l’utiliser tel quel dans une expression régulière. */
export const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** Ce que la règle exige, en une phrase : « Doit contenir le fichier README.md ». */
export function describeRule(rule: { type: string; configuration?: string }): string {
  const config = parseConfiguration(rule.configuration)
  if (!config) return RULE_LABELS[rule.type as RuleType] ?? rule.type

  switch (rule.type) {
    case "max_size": {
      const size = Number(config.maxSizeMB)
      return Number.isFinite(size) && size > 0 ? `Archive de ${formatMegabytes(size)} au maximum` : RULE_LABELS.max_size
    }
    case "file_presence": {
      const files = [...toList(config.requiredFiles), ...toList(config.fileName)]
      return files.length > 0 ? `Doit contenir ${files.length > 1 ? "les fichiers" : "le fichier"} ${enumerate(files)}` : RULE_LABELS.file_presence
    }
    case "folder_structure": {
      const folders = toList(config.expectedStructure)
      return folders.length > 0 ? `Doit contenir ${folders.length > 1 ? "les dossiers" : "le dossier"} ${enumerate(folders)}` : RULE_LABELS.folder_structure
    }
    case "file_content": {
      const file = typeof config.fileName === "string" ? config.fileName : ""
      const pattern = typeof config.contentRegex === "string" ? config.contentRegex : ""
      return file && pattern ? `${file} doit contenir « ${unescapeRegex(pattern)} »` : RULE_LABELS.file_content
    }
    default:
      return RULE_LABELS[rule.type as RuleType] ?? rule.type
  }
}

/** Liste saisie à la main : un élément par ligne ou séparés par des virgules, sans doublon. */
export function splitList(text: string): string[] {
  return [...new Set(text.split(/[\n,]/).map((item) => item.trim()).filter(Boolean))]
}

// ----- Retard et pénalité -----

export const isPastDeadline = (deadline: string, at: number = Date.now()) => new Date(deadline).getTime() < at

/** Heures de retard, toute heure entamée comptant comme une heure (comme le calcul de l’API). */
export const hoursLate = (deadline: string, at: string | number) =>
  Math.max(0, Math.ceil((new Date(at).getTime() - new Date(deadline).getTime()) / 3_600_000))

export const formatPoints = (points: number) => `${formatDecimal(points)} ${points >= 2 ? "points" : "point"}`

/** Règle de retard d’un livrable, en clair. */
export function latePolicy(deliverable: Pick<Deliverable, "allowLateSubmission" | "penaltyPerHour">) {
  if (!deliverable.allowLateSubmission) return "Aucun rendu n’est accepté après la date limite."
  return deliverable.penaltyPerHour > 0
    ? `Rendu en retard accepté : ${formatPoints(deliverable.penaltyPerHour)} en moins par heure de retard.`
    : "Rendu en retard accepté, sans pénalité."
}

export type StudentAction = "submit" | "replace" | "closed" | "none"

/** Ce que le groupe peut faire maintenant : rendre, remplacer son rendu avant l’échéance, ou plus rien. */
export function studentAction(deliverable: Deliverable, submission: Submission | null): StudentAction {
  const past = isPastDeadline(deliverable.deadline)
  if (!submission) return past && !deliverable.allowLateSubmission ? "closed" : "submit"
  return past ? "none" : "replace"
}

// ----- Conformité -----

export interface Conformity {
  state: "none" | "unchecked" | "ok" | "failed"
  failed: RuleResult[]
  total: number
}

/** Résultat de la vérification des règles pour un rendu. « unchecked » : des règles existent mais le rendu n’a pas été contrôlé. */
export function conformityOf(deliverable: Deliverable, submission: Submission): Conformity {
  const results = submission.validationResults ?? []
  const failed = results.filter((result) => !result.passed)
  if (results.length === 0) return { state: (deliverable.validationRules ?? []).length > 0 ? "unchecked" : "none", failed, total: 0 }
  return { state: failed.length === 0 ? "ok" : "failed", failed, total: results.length }
}

// ----- Ressemblance : un indice à vérifier, pas une preuve -----

export const SIMILARITY_REVIEW = 0.4
export const SIMILARITY_HIGH = 0.7

export type SimilarityLevel = "unknown" | "low" | "moderate" | "high"

export function similarityLevel(score: number | null | undefined): SimilarityLevel {
  if (score === null || score === undefined) return "unknown"
  if (score >= SIMILARITY_HIGH) return "high"
  return score >= SIMILARITY_REVIEW ? "moderate" : "low"
}

export const similarityPercent = (score: number) => `${formatNumber(score * 100, 0)} %`

/** Le groupe auquel un rendu ressemble le plus, quand l’indice est élevé. */
export const closestMatch = (submission: Submission): SimilarTo | null =>
  [...(submission.similarTo ?? [])].sort((a, b) => b.score - a.score)[0] ?? null

// ----- Suivi par groupe -----

export interface GroupRow {
  group: GroupRef
  submission: Submission | null
}

export function rowsOf(deliverable: Deliverable, groups: GroupRef[]): GroupRow[] {
  const submissions = deliverable.submissions ?? []
  return groups.map((group) => ({ group, submission: submissions.find((s) => s.groupId === group.id) ?? null }))
}

/** Ce qui mérite un regard : pas rendu après l’échéance, en retard, non conforme, ressemblance élevée. */
export function needsAttention(deliverable: Deliverable, row: GroupRow): boolean {
  if (!row.submission) return isPastDeadline(deliverable.deadline)
  return (
    row.submission.isLate ||
    conformityOf(deliverable, row.submission).state === "failed" ||
    similarityLevel(row.submission.similarityScore) === "high"
  )
}

export interface DeliverableSummary {
  groups: number
  received: number
  onTime: number
  late: number
  /** Groupes sans rendu alors que l’échéance est passée. */
  missing: number
  nonCompliant: number
  flagged: number
  analysed: number
  complete: boolean
}

export function summarize(deliverable: Deliverable, groups: GroupRef[]): DeliverableSummary {
  const rows = rowsOf(deliverable, groups)
  const submissions = rows.flatMap((row) => (row.submission ? [row.submission] : []))
  const past = isPastDeadline(deliverable.deadline)
  return {
    groups: groups.length,
    received: submissions.length,
    onTime: submissions.filter((s) => !s.isLate).length,
    late: submissions.filter((s) => s.isLate).length,
    missing: past ? groups.length - submissions.length : 0,
    nonCompliant: submissions.filter((s) => conformityOf(deliverable, s).state === "failed").length,
    flagged: submissions.filter((s) => similarityLevel(s.similarityScore) === "high").length,
    analysed: submissions.filter((s) => s.similarityScore !== null && s.similarityScore !== undefined).length,
    complete: groups.length > 0 && submissions.length === groups.length,
  }
}

/** Adresse de la notation d’un livrable (et, si on la donne, d’un groupe) dans la page du projet : onglet Livrables, section Notation. */
export const gradingHref = (projectId: number | string, deliverableId: number, groupId?: number) =>
  `${projectPath("/projects", projectId)}#deliverables/${deliverableId}${groupId ? `/${groupId}` : ""}`
