import {
  CriterionGrade, Defense, Deliverable, DeliverableRule, DeliverableSubmission, Grade, GradingCriterion,
  GradingGrid, Group, Report, ReportConfig, ReportSection, ReportSectionConfig,
} from './entities/Entities';

/**
 * Les chemins serveur des fichiers ne quittent jamais l'API.
 * La ressemblance entre rendus n'est exposée qu'à l'enseignant : `peers` sert à nommer les groupes comparés.
 */
export function serializeSubmission(
  submission: DeliverableSubmission,
  view: { teacher?: boolean; peers?: DeliverableSubmission[] } = {},
) {
  const peers = view.peers ?? [];
  return {
    id: submission.id,
    deliverableId: submission.deliverable?.id,
    groupId: submission.group?.id,
    group: submission.group ? { id: submission.group.id, name: submission.group.name } : null,
    fileName: submission.fileName ?? null,
    fileSize: submission.fileSize ?? null,
    gitUrl: submission.gitUrl ?? null,
    submittedAt: submission.submittedAt,
    isLate: submission.isLate,
    penalty: submission.penalty,
    validationResults: submission.validationResults ?? [],
    ...(view.teacher && {
      similarityScore: submission.similarityScore ?? null,
      similarTo: (submission.similarityMatches ?? []).map(match => {
        const other = peers.find(peer => peer.id === match.submissionId);
        return {
          submissionId: match.submissionId,
          groupId: other?.group?.id ?? null,
          groupName: other?.group?.name ?? null,
          score: match.finalScore,
          details: match.details,
        };
      }),
    }),
  };
}

export function serializeRule(rule: DeliverableRule) {
  return {
    id: rule.id,
    deliverableId: rule.deliverable?.id,
    type: rule.type,
    configuration: rule.configuration,
    errorMessage: rule.errorMessage ?? null,
  };
}

export function serializeDeliverable(
  deliverable: Deliverable,
  submissions: DeliverableSubmission[] = deliverable.submissions ?? [],
  forTeacher = false,
) {
  return {
    id: deliverable.id,
    projectId: deliverable.project?.id,
    name: deliverable.name,
    description: deliverable.description,
    type: deliverable.type,
    deadline: deliverable.deadline,
    allowLateSubmission: deliverable.allowLateSubmission,
    penaltyPerHour: deliverable.penaltyPerHour,
    validationRules: (deliverable.validationRules ?? []).map(serializeRule),
    submissions: submissions.map(submission => serializeSubmission(submission, { teacher: forTeacher, peers: submissions })),
    createdAt: deliverable.createdAt,
    updatedAt: deliverable.updatedAt,
  };
}

export function serializeGroup(group: Group) {
  return { id: group.id, name: group.name, members: group.members ?? [] };
}

export function serializeDefense(defense: Defense) {
  return {
    id: defense.id,
    projectId: defense.project?.id,
    groupId: defense.group?.id,
    group: defense.group ? { id: defense.group.id, name: defense.group.name } : null,
    startTime: defense.startTime,
    endTime: defense.endTime,
    orderIndex: defense.orderIndex,
    location: defense.location ?? null,
    instructions: defense.instructions ?? null,
  };
}

export function serializeCriterion(criterion: GradingCriterion, gridId = criterion.gradingGrid?.id) {
  return {
    id: criterion.id,
    gridId,
    name: criterion.name,
    description: criterion.description ?? null,
    maxScore: criterion.maxScore,
    weight: criterion.weight,
    type: criterion.type,
    hasComments: criterion.hasComments,
    allowComments: criterion.hasComments,
    requireComments: false,
  };
}

export function serializeGrid(grid: GradingGrid) {
  return {
    id: grid.id,
    projectId: grid.project?.id,
    name: grid.name,
    description: grid.description ?? null,
    type: grid.type,
    weight: grid.weight,
    deliverableId: grid.deliverableId ?? null,
    criteria: [...(grid.criteria ?? [])].sort((a, b) => a.id - b.id).map(criterion => serializeCriterion(criterion, grid.id)),
  };
}

export function serializeEntry(entry: CriterionGrade, grade: Grade) {
  return {
    id: entry.id,
    criterionId: entry.criterion?.id,
    groupId: grade.group?.id,
    score: entry.score,
    comment: entry.comments ?? '',
    gradedBy: grade.gradedBy?.id ?? null,
    gradedAt: grade.updatedAt,
    status: grade.status,
  };
}

export function serializeSession(grade: Grade) {
  return {
    id: grade.id,
    gridId: grade.gradingGrid?.id,
    groupId: grade.group?.id,
    entries: (grade.criterionGrades ?? []).map(entry => serializeEntry(entry, grade)),
    globalComment: grade.globalComments ?? '',
    totalScore: grade.totalScore ?? 0,
    status: grade.status,
    gradedBy: grade.gradedBy?.id ?? null,
    gradedAt: grade.updatedAt,
    validatedAt: grade.validatedAt ?? null,
    publishedAt: grade.publishedAt ?? null,
  };
}

export function serializeSectionConfig(section: ReportSectionConfig) {
  return {
    id: section.id,
    title: section.title,
    description: section.description ?? '',
    required: section.required,
    wordLimit: section.wordLimit ?? null,
    order: section.orderIndex,
  };
}

export function serializeReportConfig(config: ReportConfig | null, projectId: number) {
  if (!config) return { projectId, isEnabled: false, format: 'markdown', deadline: null, instructions: null, sections: [] };
  return {
    id: config.id,
    projectId,
    isEnabled: config.isEnabled,
    format: config.format,
    deadline: config.deadline ?? null,
    instructions: config.instructions ?? null,
    sections: [...(config.sections ?? [])].sort((a, b) => a.orderIndex - b.orderIndex).map(serializeSectionConfig),
  };
}

export function serializeReportSection(section: ReportSection) {
  const author = section.updatedBy;
  return {
    sectionConfigId: section.sectionConfig?.id,
    content: section.content,
    updatedAt: section.updatedAt,
    updatedBy: author ? { id: author.id, firstName: author.firstName, lastName: author.lastName } : null,
  };
}

export function serializeReport(report: Report) {
  return {
    id: report.id,
    projectId: report.project?.id,
    groupId: report.group?.id,
    group: report.group ? { id: report.group.id, name: report.group.name } : null,
    title: report.title,
    description: report.description ?? null,
    status: report.status,
    submittedAt: report.submittedAt ?? null,
    sections: (report.sections ?? []).map(serializeReportSection),
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
  };
}
