/** Règles et lectures communes aux pages de projet (enseignante et étudiant) : groupes, dates, étapes restantes. */
import { confirmAction } from "@/lib/dialogs"
import type { DefenseSlot } from "@/lib/defenses"
import { plural } from "@/lib/format"
import type { Project } from "@/services/project.service"

export interface ProjectPerson {
  id: number
  firstName: string
  lastName: string
  email: string
}

export interface ProjectGroup {
  id: number
  name: string
  members: ProjectPerson[]
}

export interface ProjectDeliverable {
  id: number
  name: string
  deadline: string
  submissions?: { groupId?: number | null; isLate?: boolean }[]
}

export type ProjectDefense = DefenseSlot

/** Taille maximale d’un groupe quand le projet n’en fixe pas. */
export const DEFAULT_MAX_GROUP_SIZE = 4

export const groupsOf = (project: Project): ProjectGroup[] =>
  ((project.groups ?? []) as ProjectGroup[]).map((group) => ({ ...group, members: group.members ?? [] }))

export const studentsOf = (project: Project): ProjectPerson[] => (project.promotion?.students ?? []) as ProjectPerson[]

export const deliverablesOf = (project: Project): ProjectDeliverable[] => (project.deliverables ?? []) as ProjectDeliverable[]

export const defensesOf = (project: Project): ProjectDefense[] => (project.defenses ?? []) as ProjectDefense[]

export const maxGroupSize = (project: Pick<Project, "maxGroupSize">) => project.maxGroupSize || DEFAULT_MAX_GROUP_SIZE

export function ungroupedStudents(project: Project): ProjectPerson[] {
  const placed = new Set(groupsOf(project).flatMap((group) => group.members.map((member) => member.id)))
  return studentsOf(project).filter((student) => !placed.has(student.id))
}

/** « Libre » : les étudiants choisissent. « Manuelle » et « aléatoire » : l’enseignant constitue les groupes. */
export const isFreeFormation = (project: Pick<Project, "groupFormationRule">) => project.groupFormationRule === "free"

export function formationLabel(project: Pick<Project, "groupFormationRule">) {
  return isFreeFormation(project) ? "Libre : les étudiants choisissent leur groupe" : "Les groupes sont constitués par l’enseignant"
}

/** Les groupes sont figés une fois la date limite passée. */
export function formationClosed(project: Pick<Project, "groupFormationDeadline">) {
  return Boolean(project.groupFormationDeadline) && new Date(project.groupFormationDeadline as string).getTime() < Date.now()
}

export function groupSizeLabel(project: Pick<Project, "minGroupSize" | "maxGroupSize">) {
  const min = project.minGroupSize || 1
  const max = maxGroupSize(project)
  return min >= max ? `${plural(max, "étudiant")} par groupe` : `De ${min} à ${plural(max, "étudiant")} par groupe`
}

export type GroupFill = "empty" | "incomplete" | "ok" | "full"

export function groupFill(group: Pick<ProjectGroup, "members">, project: Pick<Project, "minGroupSize" | "maxGroupSize">): GroupFill {
  const count = group.members.length
  if (count === 0) return "empty"
  if (count >= maxGroupSize(project)) return "full"
  return count < (project.minGroupSize || 1) ? "incomplete" : "ok"
}

export type ChecklistAction = "groups" | "deliverables" | "publish"

export interface ChecklistStep {
  key: ChecklistAction
  done: boolean
  title: string
  detail: string
  actionLabel: string
}

/** Ce qu’il reste à faire pour lancer un projet : constituer les groupes, ajouter un livrable, le rendre visible. */
export function projectChecklist(project: Project): ChecklistStep[] {
  const students = studentsOf(project)
  const groups = groupsOf(project)
  const waiting = ungroupedStudents(project).length
  const deliverables = deliverablesOf(project)
  const visible = project.status === "visible"

  let groupsDetail: string
  if (students.length === 0) groupsDetail = "La promotion n’a pas encore d’étudiants : ajoutez-les depuis la page Promotions."
  else if (waiting > 0) groupsDetail = `${plural(waiting, "étudiant")} sur ${students.length} ${waiting > 1 ? "n’ont" : "n’a"} pas de groupe.`
  else groupsDetail = `Les ${students.length} étudiants sont répartis en ${plural(groups.length, "groupe")}.`
  if (waiting > 0 && isFreeFormation(project)) {
    groupsDetail += visible ? " Ils peuvent aussi rejoindre un groupe eux-mêmes." : " Ils pourront rejoindre un groupe eux-mêmes une fois le projet visible."
  }

  return [
    {
      key: "groups",
      done: students.length > 0 && waiting === 0 && groups.length > 0,
      title: "Constituer les groupes",
      detail: groupsDetail,
      actionLabel: "Constituer les groupes",
    },
    {
      key: "deliverables",
      done: deliverables.length > 0,
      title: "Ajouter un livrable",
      detail: deliverables.length > 0 ? `${plural(deliverables.length, "livrable")} défini${deliverables.length > 1 ? "s" : ""}.` : "Aucun livrable à rendre pour l’instant.",
      actionLabel: "Ajouter un livrable",
    },
    {
      key: "publish",
      done: visible,
      title: "Rendre le projet visible",
      detail: visible ? "Les étudiants de la promotion voient le projet." : "Le projet est en brouillon : les étudiants ne le voient pas encore.",
      actionLabel: "Rendre visible",
    },
  ]
}

/** Première étape restante, en une phrase courte pour les listes, avec l’onglet de la page projet où la mener. */
export function nextStep(project: Project): { label: string; tab: "groups" | "deliverables" | "overview" } | null {
  const step = projectChecklist(project).find((item) => !item.done)
  if (!step) return null
  if (step.key === "publish") return { label: "Rendre le projet visible aux étudiants", tab: "overview" }
  if (step.key === "deliverables") return { label: "Ajouter un livrable", tab: "deliverables" }
  const waiting = ungroupedStudents(project).length
  if (waiting > 0) return { label: `${plural(waiting, "étudiant")} sans groupe`, tab: "groups" }
  return { label: studentsOf(project).length === 0 ? "La promotion n’a pas d’étudiants" : "Constituer les groupes", tab: "groups" }
}

/** Demande confirmation avant de rendre un projet visible ou de le repasser en brouillon. */
export function confirmVisibility(project: Project, makeVisible: boolean): Promise<boolean> {
  const students = studentsOf(project).length
  return makeVisible
    ? confirmAction({
        title: `Rendre « ${project.name} » visible ?`,
        description: `${students > 0 ? `Les ${plural(students, "étudiant")} de la promotion verront` : "Les étudiants de la promotion verront"} le projet et recevront un e-mail. ${
          isFreeFormation(project) ? "Ils pourront aussi rejoindre ou créer un groupe." : "Ils verront les groupes que vous aurez constitués."
        }`,
        confirmText: "Rendre visible",
      })
    : confirmAction({
        title: `Repasser « ${project.name} » en brouillon ?`,
        description: "Les étudiants ne verront plus le projet. Les groupes et les rendus déjà déposés sont conservés.",
        confirmText: "Repasser en brouillon",
      })
}

/** Demande confirmation avant la suppression définitive d’un projet. */
export function confirmDeleteProject(project: Project): Promise<boolean> {
  return confirmAction({
    title: `Supprimer « ${project.name} » ?`,
    description: "Le projet est supprimé définitivement, avec ses groupes, ses livrables et leurs rendus, ses soutenances et ses grilles de notation. Les étudiants ne le verront plus.",
    confirmText: "Supprimer le projet",
    destructive: true,
  })
}

export type StudentGroupState = "member" | "can-join" | "waiting" | "closed"

/** Où en est l’étudiant dans son projet : dans un groupe, libre d’en rejoindre un, en attente de l’enseignant, ou trop tard. */
export function studentGroupState(project: Project, studentId: number): { group: ProjectGroup | null; state: StudentGroupState } {
  const group = groupsOf(project).find((item) => item.members.some((member) => member.id === studentId)) ?? null
  if (group) return { group, state: "member" }
  if (!isFreeFormation(project)) return { group: null, state: "waiting" }
  return { group: null, state: formationClosed(project) ? "closed" : "can-join" }
}

/** Prochaine échéance de livrable du projet, ou null. */
export function nextDeliverable(project: Project): ProjectDeliverable | null {
  const now = Date.now()
  return (
    deliverablesOf(project)
      .filter((deliverable) => new Date(deliverable.deadline).getTime() >= now)
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())[0] ?? null
  )
}
