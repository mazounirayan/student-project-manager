/**
 * Sérialisation : transforme les lignes de la base de démo en réponses JSON
 * calquées sur les formes attendues par le frontend (mêmes champs que l’API).
 */
import type { DemoDb, DemoDeliverable, DemoGroup, DemoProject, DemoSubmission, DemoUser } from "./types"

export function serializeUser(db: DemoDb, idOrUser: number | DemoUser): Record<string, unknown> {
  const user = typeof idOrUser === "number" ? db.users.find((u) => u.id === idOrUser) : idOrUser
  if (!user) return {}
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.createdAt,
  }
}

export function serializeGroup(db: DemoDb, group: DemoGroup): Record<string, unknown> {
  return {
    id: group.id,
    name: group.name,
    members: group.memberIds.map((id) => serializeUser(db, id)),
  }
}

/** La ressemblance entre rendus n’est exposée qu’à l’enseignant (`forTeacher`), comme dans l’API. */
export function serializeSubmission(db: DemoDb, submission: DemoSubmission, forTeacher = false): Record<string, unknown> {
  const group = db.groups.find((g) => g.id === submission.groupId)
  return {
    id: submission.id,
    deliverableId: submission.deliverableId,
    groupId: submission.groupId,
    group: group ? { id: group.id, name: group.name } : null,
    fileName: submission.fileName ?? null,
    fileSize: submission.fileSize ?? null,
    gitUrl: submission.gitUrl ?? null,
    submittedAt: submission.submittedAt,
    isLate: submission.isLate,
    penalty: submission.penalty,
    validationResults: submission.validationResults ?? [],
    ...(forTeacher && {
      similarityScore: submission.similarityScore ?? null,
      similarTo: (submission.similarityMatches ?? []).map((match) => {
        const other = db.submissions.find((s) => s.id === match.submissionId)
        const otherGroup = other ? db.groups.find((g) => g.id === other.groupId) : undefined
        return {
          submissionId: match.submissionId,
          groupId: otherGroup?.id ?? null,
          groupName: otherGroup?.name ?? null,
          score: match.finalScore,
          details: match.details,
        }
      }),
    }),
  }
}

/** `onlyGroupIds` limite les rendus exposés (vue étudiante : uniquement ceux de son groupe). */
export function serializeDeliverable(
  db: DemoDb,
  deliverable: DemoDeliverable,
  onlyGroupIds?: number[],
  forTeacher = !onlyGroupIds,
): Record<string, unknown> {
  const rules = db.rules.filter((r) => r.deliverableId === deliverable.id)
  const submissions = db.submissions.filter(
    (s) => s.deliverableId === deliverable.id && (!onlyGroupIds || onlyGroupIds.includes(s.groupId)),
  )
  return {
    id: deliverable.id,
    projectId: deliverable.projectId,
    name: deliverable.name,
    title: deliverable.name,
    description: deliverable.description,
    type: deliverable.type,
    deadline: deliverable.deadline,
    dueDate: deliverable.deadline,
    allowLateSubmission: deliverable.allowLateSubmission,
    penaltyPerHour: deliverable.penaltyPerHour,
    validationRules: rules.map((r) => ({
      id: r.id,
      deliverableId: r.deliverableId,
      type: r.type,
      configuration: r.configuration,
      errorMessage: r.errorMessage ?? null,
    })),
    submissions: submissions.map((s) => serializeSubmission(db, s, forTeacher)),
    createdAt: deliverable.createdAt,
    updatedAt: deliverable.updatedAt,
  }
}

export function serializeProjectSummary(db: DemoDb, project: DemoProject): Record<string, unknown> {
  const promotion = db.promotions.find((p) => p.id === project.promotionId)
  const groups = db.groups.filter((g) => g.projectId === project.id)
  const deliverables = db.deliverables.filter((d) => d.projectId === project.id)
  const teacher = db.users.find((u) => u.id === project.teacherId)
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    minGroupSize: project.minGroupSize,
    maxGroupSize: project.maxGroupSize,
    groupFormationRule: project.groupFormationRule,
    groupFormationDeadline: project.groupFormationDeadline,
    promotionId: project.promotionId,
    promotionName: promotion?.name,
    promotion: promotion
      ? { id: promotion.id, name: promotion.name, students: promotion.studentIds.map((id) => serializeUser(db, id)) }
      : null,
    groups: groups.map((g) => serializeGroup(db, g)),
    deliverables: deliverables.map((d) => serializeDeliverable(db, d, undefined, false)),
    teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : "",
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }
}

/**
 * Détail complet d’un projet, relations incluses. Pour un étudiant, les rendus et
 * rapports des autres groupes sont exclus.
 */
export function serializeProjectDetail(db: DemoDb, project: DemoProject, viewer: DemoUser): Record<string, unknown> {
  const ownGroupIds =
    viewer.role === "student"
      ? db.groups.filter((g) => g.projectId === project.id && g.memberIds.includes(viewer.id)).map((g) => g.id)
      : undefined
  const promotion = db.promotions.find((p) => p.id === project.promotionId)
  const groups = db.groups.filter((g) => g.projectId === project.id)
  const deliverables = db.deliverables.filter((d) => d.projectId === project.id)
  const reports = db.reports.filter((r) => r.projectId === project.id && (!ownGroupIds || ownGroupIds.includes(r.groupId)))
  const defenses = db.defenses.filter((d) => d.projectId === project.id).sort((a, b) => a.orderIndex - b.orderIndex)
  const grids = db.grids.filter((g) => g.projectId === project.id)

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    minGroupSize: project.minGroupSize,
    maxGroupSize: project.maxGroupSize,
    groupFormationRule: project.groupFormationRule,
    groupFormationDeadline: project.groupFormationDeadline,
    promotionId: project.promotionId,
    promotionName: promotion?.name,
    promotion: promotion
      ? {
          id: promotion.id,
          name: promotion.name,
          students: promotion.studentIds.map((id) => serializeUser(db, id)),
        }
      : null,
    teacher: db.users.find((u) => u.id === project.teacherId)
      ? serializeUser(db, project.teacherId)
      : null,
    groups: groups.map((g) => serializeGroup(db, g)),
    deliverables: deliverables.map((d) => serializeDeliverable(db, d, ownGroupIds)),
    reports: reports.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      groupId: r.groupId,
      group: db.groups.find((g) => g.id === r.groupId)
        ? { id: r.groupId, name: db.groups.find((g) => g.id === r.groupId)?.name }
        : null,
      title: r.title,
      description: r.title,
      status: r.status,
      submittedAt: r.submittedAt ?? null,
      sections: r.sections,
      createdAt: r.sections[0]?.updatedAt ?? project.createdAt,
      updatedAt: r.sections[0]?.updatedAt ?? project.createdAt,
    })),
    defenses: defenses.map((d) => ({
      id: d.id,
      projectId: d.projectId,
      groupId: d.groupId,
      group: db.groups.find((g) => g.id === d.groupId)
        ? { id: d.groupId, name: db.groups.find((g) => g.id === d.groupId)?.name }
        : null,
      startTime: d.startTime,
      endTime: d.endTime,
      orderIndex: d.orderIndex,
      location: d.location,
    })),
    gradingGrids: grids.map((g) => serializeGrid(db, g)),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }
}

export function serializeGrid(db: DemoDb, grid: { id: number; name: string; type: string; weight: number; description?: string; projectId?: number; criteria?: Array<{ id: number; name: string; description?: string; maxScore: number; weight: number; type: string; hasComments: boolean }> }): Record<string, unknown> {
  const criteria = grid.criteria ?? db.grids.find((g) => g.id === grid.id)?.criteria ?? []
  return {
    id: grid.id,
    projectId: grid.projectId,
    name: grid.name,
    description: grid.description,
    type: grid.type,
    weight: grid.weight,
    criteria: criteria.map((c) => ({
      id: c.id,
      gridId: grid.id,
      name: c.name,
      description: c.description,
      maxScore: c.maxScore,
      weight: c.weight,
      type: c.type,
      hasComments: c.hasComments,
      allowComments: c.hasComments,
      requireComments: false,
      order: c.id % 100,
    })),
  }
}

export function serializeSession(session: { id: number; gridId: number; groupId: number; entries: Array<{ id: number; criterionId: number; score: number; comment: string }>; globalComment: string; totalScore: number; status: string; gradedBy: number; gradedAt: string; submittedAt?: string; validatedAt?: string }): Record<string, unknown> {
  return {
    id: session.id,
    gridId: session.gridId,
    groupId: session.groupId,
    entries: session.entries.map((e) => ({
      id: e.id,
      criterionId: e.criterionId,
      groupId: session.groupId,
      score: e.score,
      comment: e.comment,
      gradedBy: session.gradedBy,
      gradedAt: session.gradedAt,
      status: session.status,
    })),
    globalComment: session.globalComment,
    totalScore: session.totalScore,
    status: session.status,
    gradedBy: session.gradedBy,
    gradedAt: session.gradedAt,
    submittedAt: session.submittedAt,
    validatedAt: session.validatedAt,
  }
}
