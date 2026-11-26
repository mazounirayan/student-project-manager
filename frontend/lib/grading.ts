/**
 * Notation : types, états d’une note, calculs du total et appels partagés par les écrans
 * (page Évaluations, onglets du projet, « Mes notes »).
 *
 * Une note passe par trois états : brouillon (visible de l’enseignante seule), validée (figée, pas encore
 * visible des étudiants) puis publiée (visible des étudiants du groupe).
 */
import { apiGet, apiPost, apiPut } from "@/lib/api"
import { confirmAction } from "@/lib/dialogs"
import { formatNumber, plural } from "@/lib/format"
import { projectPath } from "@/lib/routes"

export type GridType = "deliverable" | "report" | "defense"
export type SessionStatus = "draft" | "submitted" | "validated"

export const MAX_GRADE = 20

export interface Criterion {
  id: number
  gridId?: number
  name: string
  description?: string | null
  /** Note maximale du critère (le barème). */
  maxScore: number
  /** Coefficient : poids relatif du critère dans la note de la grille. */
  weight: number
  type?: string
  /** Un commentaire est attendu pour ce critère : il est exigé avant de valider. */
  hasComments?: boolean
}

export interface Grid {
  id: number
  projectId?: number
  name: string
  description?: string | null
  type: GridType
  /** Part de la grille dans la note finale du projet (0 à 1). */
  weight: number
  deliverableId?: number | null
  criteria: Criterion[]
}

export interface Entry {
  id: number
  criterionId: number
  score: number
  comment?: string | null
}

export interface Session {
  id: number
  gridId: number
  groupId: number
  entries: Entry[]
  globalComment?: string | null
  totalScore: number
  status: SessionStatus
  gradedAt?: string
  validatedAt?: string | null
  publishedAt?: string | null
}

// ----- États d’une note -----

export type GradeState = "none" | "draft" | "validated" | "published"

export function gradeState(session: Pick<Session, "status" | "publishedAt"> | null | undefined): GradeState {
  if (!session) return "none"
  if (session.status !== "validated") return "draft"
  return session.publishedAt ? "published" : "validated"
}

export const GRADE_STATE_LABELS: Record<GradeState, string> = {
  none: "À noter",
  draft: "Brouillon",
  validated: "Validée",
  published: "Publiée",
}

/** Ce que l’état veut dire, pour qui peut le voir. */
export const GRADE_STATE_HINTS: Record<GradeState, string> = {
  none: "Aucune note saisie.",
  draft: "Visible de vous seule, modifiable.",
  validated: "Figée, pas encore visible des étudiants.",
  published: "Visible des étudiants du groupe.",
}

export interface GradeCounts {
  none: number
  draft: number
  validated: number
  published: number
}

export const emptyCounts = (): GradeCounts => ({ none: 0, draft: 0, validated: 0, published: 0 })

// ----- Suivi d’un projet (page Évaluations) -----

export interface SummaryGrid {
  id: number
  name: string
  type: GridType
  weight: number
  deliverableId: number | null
}

export interface SummaryGrade {
  id: number
  gridId: number
  gridName: string
  totalScore: number
  status: SessionStatus
  isValidated: boolean
  isPublished: boolean
}

export interface SummaryGroup {
  id: number
  name: string
  grades: SummaryGrade[]
  /** Moyenne pondérée des notes validées ou publiées ; null tant qu’aucune n’est validée. */
  finalGrade: number | null
}

export interface ProjectSummary {
  project: { id: number; name: string }
  gradingGrids: SummaryGrid[]
  groups: SummaryGroup[]
}

export function summaryState(grade: SummaryGrade | undefined): GradeState {
  if (!grade) return "none"
  if (!grade.isValidated) return "draft"
  return grade.isPublished ? "published" : "validated"
}

/** Combien de notes (une par groupe et par grille) sont à saisir, validées, publiées. */
export function progressOf(summary: ProjectSummary): GradeCounts & { total: number } {
  const counts = emptyCounts()
  for (const group of summary.groups) {
    for (const grid of summary.gradingGrids) counts[summaryState(group.grades.find((grade) => grade.gridId === grid.id))] += 1
  }
  return { ...counts, total: summary.groups.length * summary.gradingGrids.length }
}

// ----- Côté étudiant (page « Mes notes ») -----

/** Une note publiée au groupe de l’étudiant, avec le détail par critère. */
export interface PublishedGrade {
  id: number
  projectId: number
  projectName: string
  groupName: string
  gridId?: number
  type: GridType
  title: string
  grade: number
  maxGrade: number
  feedback: string | null
  /** Date de publication. */
  gradedAt: string
  criteria: Array<{ name: string; score: number; maxScore: number; comments: string | null; weight: number }>
}

/** Avancement d’un projet vu par l’étudiant : chaque évaluation est publiée ou pas encore, sans rien dire des brouillons. */
export interface StudentProjectGrades {
  projectId: number
  projectName: string
  groupName: string
  /** Moyenne pondérée des seules notes publiées ; null tant qu’aucune ne l’est. */
  finalGrade: number | null
  /** Toutes les évaluations du projet sont publiées : la note finale est définitive. */
  complete: boolean
  evaluations: Array<{ gridId: number; title: string; type: GridType; share: number; published: boolean; grade: number | null }>
}

// ----- Calculs -----

/** « 14,5 » ou « 14.5 » devient 14.5 ; un champ vide donne null (critère pas encore noté), un texte invalide NaN. */
export function parseScore(text: string): number | null {
  const trimmed = text.trim().replace(",", ".")
  if (trimmed === "") return null
  return /^\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : Number.NaN
}

const round2 = (value: number) => Math.round(value * 100) / 100

/** Note sur 20 : moyenne des critères déjà notés, pondérée par leur coefficient (même calcul que l’API). */
export function totalOf(criteria: Criterion[], scores: Record<number, number | null>): number | null {
  let weighted = 0
  let totalWeight = 0
  for (const criterion of criteria) {
    const score = scores[criterion.id]
    if (score === null || score === undefined || Number.isNaN(score) || criterion.maxScore <= 0) continue
    weighted += (Math.min(score, criterion.maxScore) / criterion.maxScore) * MAX_GRADE * criterion.weight
    totalWeight += criterion.weight
  }
  return totalWeight > 0 ? round2(weighted / totalWeight) : null
}

/** Part de chaque critère dans la note de la grille (somme égale à 1). */
export function criterionShares(criteria: Criterion[]): Map<number, number> {
  const total = criteria.reduce((sum, criterion) => sum + criterion.weight, 0)
  return new Map(criteria.map((criterion) => [criterion.id, total > 0 ? criterion.weight / total : 1 / criteria.length]))
}

export const percentOf = (ratio: number) => `${formatNumber(ratio * 100, 0)} %`

// ----- Brouillon de saisie -----

/** Saisie en cours pour un groupe : les notes restent du texte tant qu’elles ne sont pas enregistrées. */
export interface Draft {
  scores: Record<number, string>
  comments: Record<number, string>
  globalComment: string
}

const scoreText = (score: number) => String(score).replace(".", ",")

export function draftFrom(grid: Grid, session: Session | null | undefined): Draft {
  const entry = (criterionId: number) => session?.entries.find((item) => item.criterionId === criterionId)
  return {
    scores: Object.fromEntries(grid.criteria.map((c) => [c.id, entry(c.id) ? scoreText(entry(c.id)!.score) : ""])),
    comments: Object.fromEntries(grid.criteria.map((c) => [c.id, entry(c.id)?.comment ?? ""])),
    globalComment: session?.globalComment ?? "",
  }
}

export const sameDraft = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b)

export const draftScores = (grid: Grid, draft: Draft): Record<number, number | null> =>
  Object.fromEntries(grid.criteria.map((c) => [c.id, parseScore(draft.scores[c.id] ?? "")]))

/** Ce qui empêche de valider cette saisie ; vide si elle est complète. */
export function validationIssues(grid: Grid, draft: Draft): string[] {
  const issues: string[] = []
  const scores = draftScores(grid, draft)
  const missing = grid.criteria.filter((c) => scores[c.id] === null)
  if (missing.length > 0) issues.push(`${plural(missing.length, "critère")} sans note : ${missing.map((c) => c.name).join(", ")}.`)
  for (const c of grid.criteria) {
    const score = scores[c.id]
    if (score !== null && (Number.isNaN(score) || score > c.maxScore)) issues.push(`La note de « ${c.name} » doit être un nombre entre 0 et ${formatNumber(c.maxScore, 0)}.`)
  }
  const uncommented = grid.criteria.filter((c) => c.hasComments && !(draft.comments[c.id] ?? "").trim())
  if (uncommented.length > 0) issues.push(`Un commentaire est attendu pour : ${uncommented.map((c) => c.name).join(", ")}.`)
  return issues
}

/** Une saisie enregistrable comme brouillon : au moins un critère noté, et aucune note invalide. */
export function draftIssue(grid: Grid, draft: Draft): string | null {
  const scores = Object.entries(draftScores(grid, draft))
  const invalid = scores.find(([id, score]) => {
    const criterion = grid.criteria.find((c) => c.id === Number(id))
    return score !== null && (Number.isNaN(score) || (criterion !== undefined && score > criterion.maxScore))
  })
  if (invalid) return `La note de « ${grid.criteria.find((c) => c.id === Number(invalid[0]))?.name} » n’est pas valide.`
  return null
}

// ----- Appels API -----

export const loadProjectGrids = (projectId: number | string, type?: GridType) =>
  apiGet<Grid[]>(`/grading/projects/${projectId}/grids${type ? `?type=${type}` : ""}`)

export const loadGridSessions = (gridId: number) => apiGet<Session[]>(`/grading/sessions?gridId=${gridId}`)

/** Enregistre la note d’un groupe (création ou mise à jour). Seuls les critères notés sont envoyés. */
export function saveSession(grid: Grid, groupId: number, session: Session | null, draft: Draft, status: SessionStatus): Promise<Session> {
  const scores = draftScores(grid, draft)
  const body = {
    gridId: grid.id,
    groupId,
    entries: grid.criteria.flatMap((c) =>
      scores[c.id] === null
        ? []
        : [{ id: session?.entries.find((e) => e.criterionId === c.id)?.id, criterionId: c.id, score: scores[c.id], comment: draft.comments[c.id] ?? "" }],
    ),
    globalComment: draft.globalComment,
    status,
  }
  return session ? apiPut<Session>(`/grading/sessions/${session.id}`, body) : apiPost<Session>("/grading/sessions", body)
}

interface PublicationScope {
  groupId?: number
  gridId?: number
}

/** Demande confirmation en disant aux étudiants concernés ce qu’ils verront, puis publie les notes validées. */
export async function publishGrades(projectId: number, count: number, scope: PublicationScope & { label: string }): Promise<number | null> {
  const confirmed = await confirmAction({
    title: `Publier ${scope.label} ?`,
    description:
      `${plural(count, "note validée", "notes validées")} ${count < 2 ? "va" : "vont"} devenir visible${count < 2 ? "" : "s"} des étudiants concernés. ` +
      "Ils verront la note de chaque évaluation, le détail critère par critère, vos commentaires et leur note finale calculée sur les seules notes publiées. " +
      "Les brouillons ne sont pas publiés. Une note publiée peut être retirée en la rouvrant.",
    confirmText: "Publier",
  })
  if (!confirmed) return null
  const { published } = await apiPost<{ published: number }>("/grading/grades/publish", { projectId, groupId: scope.groupId, gridId: scope.gridId })
  return published
}

// ----- Liens vers l’endroit où l’on note -----

export const defenseGradingHref = (projectId: number | string, groupId: number) => `${projectPath("/projects", projectId)}#defenses/${groupId}`

export const gridSetupHref = (projectId: number | string) => `${projectPath("/projects", projectId)}#grading`
