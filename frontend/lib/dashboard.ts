/**
 * Données et calculs de la page d’accueil.
 * Tout est déduit des routes existantes (projets, notes, configuration du rapport) :
 * aucun endpoint dédié n’est nécessaire, en API réelle comme en démo.
 */
import { apiGet } from "@/lib/api"
import { daysUntil } from "@/lib/format"
import { projectPath } from "@/lib/routes"
import { fetchMyProjects, getProjectById } from "@/services/project.service"

type GridType = "deliverable" | "report" | "defense"
export type SessionStatus = "draft" | "submitted" | "validated"

interface Group {
  id: number
  name: string
  members?: Array<{ id: number }>
}
interface Submission {
  groupId: number
}
interface Deliverable {
  id: number
  name: string
  deadline: string
  submissions?: Submission[]
}
interface Report {
  groupId: number
  status: string
}
interface Defense {
  id: number
  groupId: number
  group?: { id: number; name: string } | null
  startTime: string
  endTime: string
  location?: string | null
}
interface Grid {
  id: number
  name: string
  type: GridType
}
interface Session {
  gridId: number
  groupId: number
  status: SessionStatus
}
interface ReportConfig {
  isEnabled: boolean
  deadline: string | null
}

/** Projet avec les relations utiles à l’accueil (voir GET /projects/:id). */
export interface ProjectOverview {
  id: number
  name: string
  status: "draft" | "visible"
  groupFormationRule?: "manual" | "random" | "free"
  groupFormationDeadline?: string | null
  groups: Group[]
  deliverables: Deliverable[]
  reports: Report[]
  defenses: Defense[]
  gradingGrids: Grid[]
  reportDeadline: string | null
}

export interface StudentGradeRow {
  id: number
  projectName: string
  type: GridType
  title: string
  grade: number
  maxGrade: number
  gradedAt: string
}

async function loadProject(id: number): Promise<ProjectOverview | null> {
  try {
    const [detail, reportConfig] = await Promise.all([
      getProjectById(id),
      apiGet<ReportConfig>(`/reports/projects/${id}/report-config`).catch(() => null),
    ])
    const project = detail as unknown as Partial<ProjectOverview> & { id: number; name: string }
    return {
      ...project,
      status: project.status ?? "visible",
      groups: project.groups ?? [],
      deliverables: project.deliverables ?? [],
      reports: project.reports ?? [],
      defenses: project.defenses ?? [],
      gradingGrids: project.gradingGrids ?? [],
      reportDeadline: reportConfig?.isEnabled ? reportConfig.deadline : null,
    }
  } catch {
    // Un projet illisible ne doit pas empêcher d’afficher les autres.
    return null
  }
}

async function loadProjects(): Promise<ProjectOverview[]> {
  const list = await fetchMyProjects()
  const details = await Promise.all((Array.isArray(list) ? list : []).map((project) => loadProject(project.id)))
  return details.filter((project): project is ProjectOverview => project !== null)
}

// ---------------------------------------------------------------------------
// Enseignant
// ---------------------------------------------------------------------------

export interface GradingTask {
  key: string
  projectName: string
  gridName: string
  type: GridType
  /** Groupes dont le travail est prêt mais pas encore noté. */
  toGrade: number
  /** Notes saisies, pas encore publiées aux étudiants. */
  toPublish: number
}

export interface Deadline {
  key: string
  kind: "deliverable" | "report"
  title: string
  projectId: number
  projectName: string
  date: string
  received: number
  expected: number
}

export interface DefensePlan {
  projectId: number
  projectName: string
  firstStart: string
  location: string | null
  upcoming: number
  total: number
}

export interface TeacherOverview {
  projects: ProjectOverview[]
  gradingTasks: GradingTask[]
  deadlines: Deadline[]
  defensePlans: DefensePlan[]
  toGradeTotal: number
  toPublishTotal: number
  deadlinesThisWeek: number
  upcomingDefenses: number
}

/** Groupes dont le travail attend une note, selon le type de grille. */
function readyGroupIds(project: ProjectOverview, type: GridType, now: number): Set<number> {
  switch (type) {
    case "deliverable":
      return new Set(project.deliverables.flatMap((d) => (d.submissions ?? []).map((s) => s.groupId)))
    case "report":
      return new Set(project.reports.filter((r) => r.status === "submitted").map((r) => r.groupId))
    case "defense":
      return new Set(project.defenses.filter((d) => new Date(d.endTime).getTime() <= now).map((d) => d.groupId))
  }
}

export function buildTeacherOverview(projects: ProjectOverview[], sessions: Session[], now = Date.now()): TeacherOverview {
  const gradingTasks: GradingTask[] = []
  for (const project of projects) {
    for (const grid of project.gradingGrids) {
      const mine = sessions.filter((s) => s.gridId === grid.id)
      const done = new Set(mine.filter((s) => s.status !== "draft").map((s) => s.groupId))
      const toGrade = [...readyGroupIds(project, grid.type, now)].filter((id) => !done.has(id)).length
      const toPublish = mine.filter((s) => s.status === "submitted").length
      if (toGrade + toPublish > 0) {
        gradingTasks.push({
          key: `${project.id}-${grid.id}`,
          projectName: project.name,
          gridName: grid.name,
          type: grid.type,
          toGrade,
          toPublish,
        })
      }
    }
  }

  const deadlines: Deadline[] = []
  for (const project of projects) {
    const expected = project.groups.length
    for (const deliverable of project.deliverables) {
      const received = new Set((deliverable.submissions ?? []).map((s) => s.groupId)).size
      deadlines.push({
        key: `d-${deliverable.id}`,
        kind: "deliverable",
        title: deliverable.name,
        projectId: project.id,
        projectName: project.name,
        date: deliverable.deadline,
        received,
        expected,
      })
    }
    if (project.reportDeadline) {
      deadlines.push({
        key: `r-${project.id}`,
        kind: "report",
        title: "Rapport",
        projectId: project.id,
        projectName: project.name,
        date: project.reportDeadline,
        received: project.reports.filter((r) => r.status === "submitted").length,
        expected,
      })
    }
  }
  const upcomingDeadlines = deadlines
    .filter((d) => (daysUntil(d.date) ?? -1) >= 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const defensePlans: DefensePlan[] = []
  for (const project of projects) {
    const upcoming = project.defenses
      .filter((d) => new Date(d.endTime).getTime() > now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    if (upcoming.length > 0) {
      defensePlans.push({
        projectId: project.id,
        projectName: project.name,
        firstStart: upcoming[0].startTime,
        location: upcoming[0].location ?? null,
        upcoming: upcoming.length,
        total: project.defenses.length,
      })
    }
  }
  defensePlans.sort((a, b) => new Date(a.firstStart).getTime() - new Date(b.firstStart).getTime())

  return {
    projects,
    gradingTasks,
    deadlines: upcomingDeadlines,
    defensePlans,
    toGradeTotal: gradingTasks.reduce((sum, t) => sum + t.toGrade, 0),
    toPublishTotal: gradingTasks.reduce((sum, t) => sum + t.toPublish, 0),
    deadlinesThisWeek: upcomingDeadlines.filter((d) => (daysUntil(d.date) ?? 99) <= 7).length,
    upcomingDefenses: defensePlans.reduce((sum, p) => sum + p.upcoming, 0),
  }
}

export async function loadTeacherOverview(): Promise<TeacherOverview> {
  const [projects, sessions] = await Promise.all([
    loadProjects(),
    apiGet<Session[]>("/grading/sessions").catch(() => [] as Session[]),
  ])
  return buildTeacherOverview(projects, Array.isArray(sessions) ? sessions : [])
}

// ---------------------------------------------------------------------------
// Étudiant
// ---------------------------------------------------------------------------

export interface StudentTask {
  key: string
  kind: "deliverable" | "report" | "group"
  title: string
  projectName: string
  /** Échéance, ou null si aucune n’est fixée. */
  dueAt: string | null
  href: string
}

export interface StudentDefense {
  projectName: string
  groupName: string
  startTime: string
  location: string | null
  href: string
}

export interface StudentOverview {
  tasks: StudentTask[]
  defense: StudentDefense | null
  grades: StudentGradeRow[]
  projectCount: number
}

export function buildStudentOverview(
  projects: ProjectOverview[],
  grades: StudentGradeRow[],
  studentId: number,
  now = Date.now(),
): StudentOverview {
  const tasks: StudentTask[] = []
  let defense: StudentDefense | null = null

  for (const project of projects) {
    const group = project.groups.find((g) => g.members?.some((m) => m.id === studentId))
    const groupHref = projectPath("/my-projects", project.id, "/group")

    if (!group) {
      const open = project.groupFormationDeadline ? new Date(project.groupFormationDeadline).getTime() > now : true
      if (project.groupFormationRule === "free" && open) {
        tasks.push({
          key: `g-${project.id}`,
          kind: "group",
          title: "Rejoindre ou créer un groupe",
          projectName: project.name,
          dueAt: project.groupFormationDeadline ?? null,
          href: `${projectPath("/my-projects", project.id)}#groupes`,
        })
      }
      continue
    }

    for (const deliverable of project.deliverables) {
      if ((deliverable.submissions ?? []).some((s) => s.groupId === group.id)) continue
      tasks.push({
        key: `d-${deliverable.id}`,
        kind: "deliverable",
        title: deliverable.name,
        projectName: project.name,
        dueAt: deliverable.deadline,
        href: groupHref,
      })
    }

    if (project.reportDeadline && !project.reports.some((r) => r.groupId === group.id && r.status === "submitted")) {
      tasks.push({
        key: `r-${project.id}`,
        kind: "report",
        title: "Rapport du groupe",
        projectName: project.name,
        dueAt: project.reportDeadline,
        href: groupHref,
      })
    }

    const next = project.defenses
      .filter((d) => d.groupId === group.id && new Date(d.endTime).getTime() > now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0]
    if (next && (!defense || new Date(next.startTime) < new Date(defense.startTime))) {
      defense = {
        projectName: project.name,
        groupName: group.name,
        startTime: next.startTime,
        location: next.location ?? null,
        href: projectPath("/my-projects", project.id),
      }
    }
  }

  // Échéances dépassées d’abord (à rattraper), puis par date croissante ; sans date en dernier.
  const time = (task: StudentTask) => (task.dueAt ? new Date(task.dueAt).getTime() : Number.MAX_SAFE_INTEGER)
  tasks.sort((a, b) => time(a) - time(b))

  return {
    tasks,
    defense,
    grades: [...grades].sort((a, b) => new Date(b.gradedAt).getTime() - new Date(a.gradedAt).getTime()),
    projectCount: projects.length,
  }
}

export async function loadStudentOverview(studentId: number): Promise<StudentOverview> {
  const [projects, grades] = await Promise.all([
    loadProjects(),
    apiGet<StudentGradeRow[]>("/grading/students/my-grades").catch(() => [] as StudentGradeRow[]),
  ])
  return buildStudentOverview(projects, Array.isArray(grades) ? grades : [], studentId)
}
